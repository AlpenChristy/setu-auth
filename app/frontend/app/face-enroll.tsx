import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import { Asset } from 'expo-asset';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { NitroModules } from 'react-native-nitro-modules';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/src/theme/colors';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { useAuthStore } from '@/src/store/authStore';
import { useAttendanceStore } from '@/src/store/attendanceStore';
import { BACKEND_URL } from '@/src/utils/config';
import { encryptData } from '@/src/utils/encryption';
import { sqliteDb } from '@/src/utils/sqliteDb';
import * as Location from 'expo-location';

const { height } = Dimensions.get('window');

const ENROLLMENT_STEPS = [
    { id: 1, instruction: 'Look straight at the camera', icon: 'eye-outline', label: 'Straight' },
    { id: 2, instruction: 'Blink slowly', icon: 'eye-off-outline', label: 'Blink' },
    { id: 3, instruction: 'Turn your head left', icon: 'arrow-back', label: 'Turn Left' },
    { id: 4, instruction: 'Turn your head right', icon: 'arrow-forward', label: 'Turn Right' },
    { id: 5, instruction: 'Smile slightly', icon: 'happy-outline', label: 'Smile' },
];

function preprocessAndGateFaceImage(
    pixels: Float32Array,
    faceWidth: number,
    faceHeight: number,
    frameWidth: number,
    frameHeight: number
): { success: boolean; reason?: string; meanY: number; laplacianVar: number; uniformRatio: number } {
    'worklet';
    const width = 112;
    const height = 112;
    const numPixels = width * height;

    // --- 1. Face Size Check ---
    const bboxArea = faceWidth * faceHeight;
    const frameArea = frameWidth * frameHeight;
    const sizeRatio = frameArea > 0 ? bboxArea / frameArea : 0;
    if (sizeRatio < 0.05) {
        return { success: false, reason: 'Face too far (size < 5%)', meanY: 0, laplacianVar: 0, uniformRatio: 0 };
    }

    // --- 2. Convert RGB to Grayscale / Y channel ---
    const Y = new Float32Array(numPixels);
    const Cb = new Float32Array(numPixels);
    const Cr = new Float32Array(numPixels);
    
    let sumY = 0;
    for (let i = 0; i < numPixels; i++) {
        const r = pixels[i * 3];
        const g = pixels[i * 3 + 1];
        const b = pixels[i * 3 + 2];
        
        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
        Y[i] = yVal;
        Cb[i] = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
        Cr[i] = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
        sumY += yVal;
    }
    
    const meanY = sumY / numPixels;

    // --- 3. Exposure check ---
    if (meanY < 15) {
        return { success: false, reason: 'Too dark (exposure < 15)', meanY, laplacianVar: 0, uniformRatio: 0 };
    }
    if (meanY > 220) {
        return { success: false, reason: 'Too bright (exposure > 220)', meanY, laplacianVar: 0, uniformRatio: 0 };
    }

    // --- 4. Blur detection (Laplacian Variance) ---
    const laplacian = new Float32Array(numPixels);
    let sumLap = 0;
    let lapCount = 0;
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const val = Y[idx - width] + Y[idx - 1] - 4 * Y[idx] + Y[idx + 1] + Y[idx + width];
            laplacian[idx] = val;
            sumLap += val;
            lapCount++;
        }
    }
    
    const meanLap = lapCount > 0 ? sumLap / lapCount : 0;
    let sumSqDiffLap = 0;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            sumSqDiffLap += Math.pow(laplacian[idx] - meanLap, 2);
        }
    }
    
    const laplacianVar = lapCount > 0 ? sumSqDiffLap / lapCount : 0;
    if (laplacianVar < 50) {
        return { success: false, reason: 'Blur detected (variance < 50)', meanY, laplacianVar, uniformRatio: 0 };
    }

    // --- 5. LBP Texture Anti-Spoof ---
    let uniformLBPCount = 0;
    let totalLBPCount = 0;
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const centerIdx = y * width + x;
            const centerVal = Y[centerIdx];
            
            const nVal = [
                Y[(y - 1) * width + (x - 1)],
                Y[(y - 1) * width + x],
                Y[(y - 1) * width + (x + 1)],
                Y[y * width + (x + 1)],
                Y[(y + 1) * width + (x + 1)],
                Y[(y + 1) * width + x],
                Y[(y + 1) * width + (x - 1)],
                Y[y * width + (x - 1)]
            ];
            
            let code = 0;
            for (let i = 0; i < 8; i++) {
                if (nVal[i] >= centerVal) {
                    code |= (1 << i);
                }
            }
            
            let transitions = 0;
            let prevBit = code & 1;
            for (let i = 1; i < 8; i++) {
                const bit = (code >> i) & 1;
                if (bit !== prevBit) transitions++;
                prevBit = bit;
            }
            if ((code & 1) !== ((code >> 7) & 1)) transitions++;
            
            if (transitions <= 2) {
                uniformLBPCount++;
            }
            totalLBPCount++;
        }
    }
    
    const uniformRatio = totalLBPCount > 0 ? uniformLBPCount / totalLBPCount : 0;
    
    if (uniformRatio < 0.55) {
        return { success: false, reason: 'Spoof attempt detected (LBP pattern < 0.55)', meanY, laplacianVar, uniformRatio };
    }
    if (uniformRatio > 0.98) {
        return { success: false, reason: 'Spoof attempt detected (LBP pattern > 0.98)', meanY, laplacianVar, uniformRatio };
    }

    // --- 6. Adaptive Gamma Correction ---
    let gamma = 1.0;
    if (meanY < 110) {
        gamma = 0.5 + 0.5 * (meanY / 110);
    } else if (meanY > 150) {
        gamma = 1.0 + 0.5 * ((meanY - 150) / 105);
    }
    
    if (gamma !== 1.0) {
        for (let i = 0; i < numPixels; i++) {
            Y[i] = Math.pow(Y[i] / 255.0, gamma) * 255.0;
        }
    }

    // --- 7. CLAHE ---
    const tilesX = 8;
    const tilesY = 8;
    const tileSizeX = 14;
    const tileSizeY = 14;
    const clipLimit = 2.5;
    
    const histograms = new Int32Array(tilesY * tilesX * 256);
    
    for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
            const histOffset = (ty * tilesX + tx) * 256;
            const startY = ty * tileSizeY;
            const startX = tx * tileSizeX;
            
            for (let y = 0; y < tileSizeY; y++) {
                for (let x = 0; x < tileSizeX; x++) {
                    const pixelY = startY + y;
                    const pixelX = startX + x;
                    const val = Math.max(0, Math.min(255, Math.round(Y[pixelY * width + pixelX])));
                    histograms[histOffset + val]++;
                }
            }
            
            const totalPixels = tileSizeX * tileSizeY;
            const clipVal = Math.round(clipLimit * (totalPixels / 256));
            const actualClipLimit = Math.max(1, clipVal);
            
            let excess = 0;
            for (let i = 0; i < 256; i++) {
                if (histograms[histOffset + i] > actualClipLimit) {
                    excess += histograms[histOffset + i] - actualClipLimit;
                    histograms[histOffset + i] = actualClipLimit;
                }
            }
            
            const binIncr = Math.floor(excess / 256);
            const remainder = excess % 256;
            
            for (let i = 0; i < 256; i++) {
                histograms[histOffset + i] += binIncr;
            }
            for (let i = 0; i < remainder; i++) {
                histograms[histOffset + ((i * 17) % 256)]++;
            }
        }
    }
    
    const cdfs = new Float32Array(tilesY * tilesX * 256);
    for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
            const histOffset = (ty * tilesX + tx) * 256;
            let sum = 0;
            for (let i = 0; i < 256; i++) {
                sum += histograms[histOffset + i];
                cdfs[histOffset + i] = sum;
            }
            const total = tileSizeX * tileSizeY;
            for (let i = 0; i < 256; i++) {
                cdfs[histOffset + i] = (cdfs[histOffset + i] / total) * 255.0;
            }
        }
    }
    
    const equalizedY = new Float32Array(numPixels);
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            const idx = py * width + px;
            const val = Math.max(0, Math.min(255, Math.round(Y[idx])));
            
            const txFloat = (px - tileSizeX / 2.0) / tileSizeX;
            const tyFloat = (py - tileSizeY / 2.0) / tileSizeY;
            
            const tx0 = Math.max(0, Math.min(tilesX - 1, Math.floor(txFloat)));
            const tx1 = Math.max(0, Math.min(tilesX - 1, tx0 + 1));
            const ty0 = Math.max(0, Math.min(tilesY - 1, Math.floor(tyFloat)));
            const ty1 = Math.max(0, Math.min(tilesY - 1, ty0 + 1));
            
            const weightX = txFloat - tx0;
            const weightY = tyFloat - ty0;
            
            const cdf00 = cdfs[(ty0 * tilesX + tx0) * 256 + val];
            const cdf01 = cdfs[(ty0 * tilesX + tx1) * 256 + val];
            const cdf10 = cdfs[(ty1 * tilesX + tx0) * 256 + val];
            const cdf11 = cdfs[(ty1 * tilesX + tx1) * 256 + val];
            
            const interpVal = (1.0 - weightY) * ((1.0 - weightX) * cdf00 + weightX * cdf01) +
                              weightY * ((1.0 - weightX) * cdf10 + weightX * cdf11);
                              
            equalizedY[idx] = interpVal;
        }
    }
    
    // --- 8. Reconstruct RGB ---
    for (let i = 0; i < numPixels; i++) {
        const yVal = equalizedY[i];
        const cbVal = Cb[i];
        const crVal = Cr[i];
        
        let r = yVal + 1.402 * (crVal - 128);
        let g = yVal - 0.344136 * (cbVal - 128) - 0.714136 * (crVal - 128);
        let b = yVal + 1.772 * (cbVal - 128);
        
        pixels[i * 3] = Math.max(0, Math.min(255, r));
        pixels[i * 3 + 1] = Math.max(0, Math.min(255, g));
        pixels[i * 3 + 2] = Math.max(0, Math.min(255, b));
    }

    return { success: true, meanY, laplacianVar, uniformRatio };
}

export default function FaceEnrollScreen() {
    const router = useRouter();
    const { updateFaceEnrollment, user } = useAuthStore();
    const { addLog } = useAttendanceStore();
    const [currentStep, setCurrentStep] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const isTransitioningRef = useRef(false);
    const [transitionConfidence, setTransitionConfidence] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const isScanningShared = useSharedValue(false);
    
    // Liveness helper states for enrollment
    const [eyesClosed, setEyesClosed] = useState(false);
    const [faces, setFaces] = useState<any[]>([]);

    // Location tracking states
    const [locationStr, setLocationStr] = useState('Fetching location...');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    // Animation values
    const scanLineAnim = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const fetchLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setLocationStr('Location permission denied');
                    setLatitude(19.0760);
                    setLongitude(72.8777);
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                const lat = location.coords.latitude;
                const lon = location.coords.longitude;
                setLatitude(lat);
                setLongitude(lon);

                try {
                    const geocode = await Location.reverseGeocodeAsync({
                        latitude: lat,
                        longitude: lon,
                    });
                    if (geocode && geocode.length > 0) {
                        const address = geocode[0];
                        const city = address.city || address.district || address.subregion || '';
                        const region = address.region || address.isoCountryCode || '';
                        setLocationStr(`${city}${city && region ? ', ' : ''}${region} (${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E)`);
                    } else {
                        setLocationStr(`GPS (${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E)`);
                    }
                } catch (geoErr) {
                    console.error('Geo reverse err:', geoErr);
                    setLocationStr(`GPS (${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E)`);
                }
            } catch (error) {
                console.error('Error fetching GPS location:', error);
                setLocationStr('Mumbai, MH (19.0760° N, 72.8777° E)');
                setLatitude(19.0760);
                setLongitude(72.8777);
            }
        };

        fetchLocation();
    }, []);

    // AI & TFLite setup
    const faceEmbeddingsRef = useRef<number[][]>([]);
    const tempPoseEmbeddings = useRef<number[][]>([]);
    const framesToCapture = useSharedValue(0);
    const resizePlugin = useResizePlugin();

    const [model, setModel] = useState<any>(null);
    const [modelLoading, setModelLoading] = useState(true);
    const [modelError, setModelError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        async function loadModel() {
            try {
                console.log('FaceEnroll: Resolving model asset via expo-asset...');
                const asset = Asset.fromModule(require('../assets/mobilefacenet.tflite'));
                await asset.downloadAsync();
                const path = asset.localUri || asset.uri;
                console.log('FaceEnroll: Loading model from path:', path);
                const loadedModel = await loadTensorflowModel({ url: path }, []);
                if (isMounted) {
                    setModel(loadedModel);
                    setModelLoading(false);
                    console.log('FaceEnroll: TFLite Model loaded successfully from local asset cache.');
                }
            } catch (err) {
                console.error('FaceEnroll: Failed to load model from cache, falling back:', err);
                try {
                    const loadedModel = await loadTensorflowModel(require('../assets/mobilefacenet.tflite'), []);
                    if (isMounted) {
                        setModel(loadedModel);
                        setModelLoading(false);
                        console.log('FaceEnroll: TFLite Model loaded via direct require fallback.');
                    }
                } catch (fallbackErr) {
                    console.error('FaceEnroll: Fallback model loading failed:', fallbackErr);
                    if (isMounted) {
                        setModelError(fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
                        setModelLoading(false);
                    }
                }
            }
        }
        loadModel();
        return () => {
            isMounted = false;
        };
    }, []);

    const boxedModel = useMemo(() => (model != null ? NitroModules.box(model) : undefined), [model]);

    const currentStepRef = useRef(currentStep);
    currentStepRef.current = currentStep;

    const facesRef = useRef(faces);
    facesRef.current = faces;

    const userRef = useRef(user);
    userRef.current = user;

    const addLogRef = useRef(addLog);
    addLogRef.current = addLog;

    // Unified transition useEffect to handle step progression cleanly in React lifecycle
    useEffect(() => {
        if (isTransitioning) {
            console.log('FaceEnroll: Step transition timer started for step', currentStep);
            const timer = setTimeout(() => {
                console.log('FaceEnroll: Step transition timer fired!');
                const next = currentStep + 1;
                setCurrentStep(next);
                tempPoseEmbeddings.current = []; // Reset for next step
                
                Animated.timing(progressAnim, {
                    toValue: (next / ENROLLMENT_STEPS.length) * 100,
                    duration: 500,
                    useNativeDriver: false,
                }).start();
                
                if (next === ENROLLMENT_STEPS.length) {
                    setIsComplete(true);
                    if (userRef.current) {
                        addLogRef.current({
                            userId: userRef.current.id,
                            timestamp: new Date().toISOString(),
                            type: 'enrollment',
                            status: 'success',
                        });
                    }
                }

                isTransitioningRef.current = false;
                setIsTransitioning(false);
                setTransitionConfidence(null);
            }, 1200);
            
            return () => {
                clearTimeout(timer);
            };
        }
    }, [isTransitioning, currentStep, progressAnim]);

    const onFrameCaptured = useRunOnJS((embedding: number[]) => {
        console.log('FaceEnroll: Captured frame embedding for pose, dimensions:', embedding.length);
        tempPoseEmbeddings.current.push(embedding);
        
        if (tempPoseEmbeddings.current.length === 3) {
            // Compute average embedding
            const avg = new Array(embedding.length).fill(0);
            for (let i = 0; i < embedding.length; i++) {
                avg[i] = (tempPoseEmbeddings.current[0][i] + tempPoseEmbeddings.current[1][i] + tempPoseEmbeddings.current[2][i]) / 3.0;
            }
            
            // L2 normalize the average embedding
            const norm = Math.sqrt(avg.reduce((sum, val) => sum + val * val, 0));
            const normalizedAvg = norm > 0 ? avg.map(v => v / norm) : avg;
            
            console.log('FaceEnroll: Successfully averaged and normalized 3 frames for current step.');
            faceEmbeddingsRef.current.push(normalizedAvg);

            // Trigger step transition
            const step = currentStepRef.current;
            const face = facesRef.current[0];
            let calculatedConfidence = 100;
            if (face) {
                const yaw = face.yawAngle ?? 0;
                if (step === 0) {
                    calculatedConfidence = Math.max(0, Math.min(100, Math.round((1 - Math.abs(yaw) / 8) * 100)));
                } else if (step === 2) {
                    calculatedConfidence = Math.max(0, Math.min(100, Math.round((Math.abs(yaw) / 18) * 100)));
                } else if (step === 3) {
                    calculatedConfidence = Math.max(0, Math.min(100, Math.round((Math.abs(yaw) / 18) * 100)));
                } else if (step === 4) {
                    calculatedConfidence = Math.min(100, Math.round((face.smilingProbability ?? 0) * 100));
                }
            }
            
            isTransitioningRef.current = true;
            setIsTransitioning(true);
            setTransitionConfidence(calculatedConfidence);
        }
    }, [faceEmbeddingsRef, tempPoseEmbeddings]);

    // Vision Camera setup
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('front');
    

    
    const { detectFaces, stopListeners } = useFaceDetector({
      performanceMode: 'accurate',
      contourMode: 'none',
      landmarkMode: 'none',
      classificationMode: 'all' // Enable smiling and eye open calculations
    });

    useEffect(() => {
        return () => {
            // Ignore stopListeners dependency to prevent constant unmounting
        };
    }, []);
    
    const updateFaces = useRunOnJS((detectedFaces: any[]) => {
      setFaces(detectedFaces);
    }, [setFaces]);

    const frameProcessor = useFrameProcessor((frame) => {
      'worklet';
      
      if (!isScanningShared.value) return;
      
      const detectedFaces = detectFaces(frame);
      updateFaces(detectedFaces);

      if (framesToCapture.value > 0 && detectedFaces.length > 0) {
          const face = detectedFaces[0];
          if (face && face.bounds) {
              const bounds = face.bounds;
              const cropX = Math.max(0, Math.min(bounds.x, frame.width));
              const cropY = Math.max(0, Math.min(bounds.y, frame.height));
              const cropW = Math.min(bounds.width, frame.width - cropX);
              const cropH = Math.min(bounds.height, frame.height - cropY);

              if (cropW > 0 && cropH > 0) {
                  try {
                      const resized = resizePlugin.resize(frame, {
                          scale: { width: 112, height: 112 },
                          crop: {
                              x: cropX,
                              y: cropY,
                              width: cropW,
                              height: cropH,
                          },
                          pixelFormat: 'rgb',
                          dataType: 'float32',
                      });

                      // Scale pixels to [0, 255] because the preprocessing helper and MobileFaceNet normalization expect this range
                      const len = resized.length;
                      for (let i = 0; i < len; i++) {
                          resized[i] = resized[i] * 255.0;
                      }

                      // Apply advanced image preprocessing (CLAHE, Gamma correction) & Quality gates
                      const gate = preprocessAndGateFaceImage(resized, bounds.width, bounds.height, frame.width, frame.height);
                      if (!gate.success) {
                          console.log('FaceEnroll: Frame rejected by quality gating: ' + gate.reason);
                          return;
                      }

                      // Normalize pixels to [-1, 1] for MobileFaceNet
                      for (let i = 0; i < len; i++) {
                          resized[i] = (resized[i] - 127.5) / 127.5;
                      }

                      if (boxedModel != null) {
                          const modelInstance = boxedModel.unbox();
                          const output = modelInstance.runSync([resized.buffer as ArrayBuffer]);
                          if (output && output[0]) {
                              const embedding = Array.from(new Float32Array(output[0]));
                              
                              // Quality check: raw vector magnitude (MobileFaceNet outputs L2 normalized embeddings of norm ~1.0)
                              const rawNorm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
                              if (rawNorm < 0.1) {
                                  console.log('FaceEnroll: Weak embedding detected, norm: ' + rawNorm);
                                  return;
                              }

                              // Decrement capture count
                              framesToCapture.value = framesToCapture.value - 1;

                              onFrameCaptured(embedding);
                          }
                      }
                  } catch (err) {
                      console.error('FaceEnroll: Model inference error:', err);
                  }
              }
          }
      }
    }, [detectFaces, boxedModel, resizePlugin, onFrameCaptured, isScanningShared, framesToCapture]);



    useEffect(() => {
        // Scanning line animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanLineAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(scanLineAnim, {
                    toValue: 0,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [scanLineAnim]);

    // Real-time enrollment challenge checker
    useEffect(() => {
        if (faces.length === 0 || currentStep >= ENROLLMENT_STEPS.length || isComplete || isTransitioningRef.current) {
            return;
        }

        const face = faces[0];
        const yaw = face.yawAngle ?? 0;

        let stepCompleted = false;

        if (currentStep === 0) {
            // Step 1: Look straight at the camera
            if (Math.abs(yaw) < 8) {
                if (framesToCapture.value === 0 && tempPoseEmbeddings.current.length === 0) {
                    console.log('FaceEnroll: Looking straight detected, starting capture...');
                    framesToCapture.value = 3;
                }
            }
        } else if (currentStep === 1) {
            // Step 2: Blink slowly (Does not capture embeddings, transitions directly on liveness detection)
            const leftEye = face.leftEyeOpenProbability ?? 1.0;
            const rightEye = face.rightEyeOpenProbability ?? 1.0;
            const eyesAreClosed = leftEye < 0.25 && rightEye < 0.25;
            const eyesAreOpen = leftEye > 0.7 && rightEye > 0.7;

            if (eyesAreClosed && !eyesClosed) {
                setEyesClosed(true);
            } else if (eyesAreOpen && eyesClosed) {
                setEyesClosed(false);
                console.log('FaceEnroll: Blink detected');
                stepCompleted = true;
            }
        } else if (currentStep === 2) {
            // Step 3: Turn head left (strictly yaw < -18)
            if (yaw < -18) {
                if (framesToCapture.value === 0 && tempPoseEmbeddings.current.length === 0) {
                    console.log('FaceEnroll: Turn left detected, starting capture...');
                    framesToCapture.value = 3;
                }
            }
        } else if (currentStep === 3) {
            // Step 4: Turn head right (strictly yaw > 18)
            if (yaw > 18) {
                if (framesToCapture.value === 0 && tempPoseEmbeddings.current.length === 0) {
                    console.log('FaceEnroll: Turn right detected, starting capture...');
                    framesToCapture.value = 3;
                }
            }
        } else if (currentStep === 4) {
            // Step 5: Smile slightly
            const smileProb = face.smilingProbability ?? 0.0;
            if (smileProb > 0.5) {
                if (framesToCapture.value === 0 && tempPoseEmbeddings.current.length === 0) {
                    console.log('FaceEnroll: Smile detected, starting capture...');
                    framesToCapture.value = 3;
                }
            }
        }

        if (stepCompleted) {
            let calculatedConfidence = 100;
            if (currentStep === 0) {
                calculatedConfidence = Math.max(0, Math.min(100, Math.round((1 - Math.abs(yaw) / 8) * 100)));
            } else if (currentStep === 1) {
                calculatedConfidence = 100;
            } else if (currentStep === 2) {
                calculatedConfidence = Math.max(0, Math.min(100, Math.round((Math.abs(yaw) / 18) * 100)));
            } else if (currentStep === 3) {
                calculatedConfidence = Math.max(0, Math.min(100, Math.round((Math.abs(yaw) / 18) * 100)));
            } else if (currentStep === 4) {
                calculatedConfidence = Math.min(100, Math.round((face.smilingProbability ?? 0) * 100));
            }

            isTransitioningRef.current = true;
            setIsTransitioning(true);
            setTransitionConfidence(calculatedConfidence);
        }
    }, [faces, currentStep, isComplete, eyesClosed, addLog, progressAnim, framesToCapture, user]);

    const handleComplete = async () => {
        if (user) {
            if (faceEmbeddingsRef.current.length < 4) {
                alert('Face templates not fully captured yet. Please scan again.');
                return;
            }
            
            // Intra-class consistency check
            const cosSim = (a: number[], b: number[]) => {
                return a.reduce((sum, val, i) => sum + val * b[i], 0);
            };
            
            const pairs = [
                { idx1: 0, idx2: 1, threshold: 0.30, label: 'Straight vs Left' },
                { idx1: 0, idx2: 2, threshold: 0.30, label: 'Straight vs Right' },
                { idx1: 0, idx2: 3, threshold: 0.30, label: 'Straight vs Smile' },
                { idx1: 1, idx2: 2, threshold: 0.25, label: 'Left vs Right' },
                { idx1: 1, idx2: 3, threshold: 0.30, label: 'Left vs Smile' },
                { idx1: 2, idx2: 3, threshold: 0.30, label: 'Right vs Smile' }
            ];
            
            for (const { idx1, idx2, threshold, label } of pairs) {
                const sim = cosSim(faceEmbeddingsRef.current[idx1], faceEmbeddingsRef.current[idx2]);
                console.log(`FaceEnroll: Consistency check template ${idx1} vs ${idx2} (${label}) similarity = ${sim} (threshold = ${threshold})`);
                if (sim < threshold) {
                    alert('Enrollment quality check failed: Poses are inconsistent (' + label + ' similarity ' + Math.round(sim * 100) + '%). Please position your face clearly and repeat.');
                    // Reset enrollment state
                    faceEmbeddingsRef.current = [];
                    tempPoseEmbeddings.current = [];
                    setCurrentStep(0);
                    setIsComplete(false);
                    setIsScanning(false);
                    isScanningShared.value = false;
                    setFaces([]);
                    return;
                }
            }
            
            try {
                const response = await fetch(`${BACKEND_URL}/api/workers/${user.employeeId}/enroll`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        face_embeddings: faceEmbeddingsRef.current,
                        assigned_lat: latitude,
                        assigned_lng: longitude,
                    }),
                });
                
                if (response.ok) {
                    try {
                        const encEmbedding = await encryptData(JSON.stringify(faceEmbeddingsRef.current));
                        sqliteDb.saveCachedEmbedding(
                            user.id,
                            encEmbedding,
                            user.facePhoto || null,
                            latitude || user.assignedLat || null,
                            longitude || user.assignedLng || null,
                            user.assignedRadius || 200.0
                        );
                        console.log('FaceEnroll: Enrolled embeddings cached locally in SQLite successfully.');
                    } catch (cacheErr) {
                        console.error('FaceEnroll: Error caching embeddings locally:', cacheErr);
                    }

                    updateFaceEnrollment(true);
                    router.replace('/(tabs)');
                } else {
                    alert('Error saving face template to backend database.');
                }
            } catch (error) {
                console.error('Error during face enrollment api call:', error);
                alert('Connection to backend database failed.');
            }
        }
    };

    const scanLineTranslateY = scanLineAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-180, 180],
    });

    const isFaceDetected = faces.length > 0;
    const face = faces[0];
    const liveYaw = face?.yawAngle ?? 0;
    const liveSmile = face?.smilingProbability ?? 0;
    const liveLeftEye = face?.leftEyeOpenProbability ?? 1.0;
    const liveRightEye = face?.rightEyeOpenProbability ?? 1.0;

    // Calculate live confidence score for active step
    const liveConfidence = useMemo(() => {
        if (!isFaceDetected || currentStep >= ENROLLMENT_STEPS.length) return 0;
        if (currentStep === 0) {
            return Math.max(0, Math.min(100, Math.round((1 - Math.abs(liveYaw) / 8) * 100)));
        } else if (currentStep === 1) {
            return Math.min(100, Math.max(0, Math.round((1 - (liveLeftEye + liveRightEye) / 2) * 100)));
        } else if (currentStep === 2) {
            return Math.max(0, Math.min(100, Math.round((-liveYaw / 18) * 100)));
        } else if (currentStep === 3) {
            return Math.max(0, Math.min(100, Math.round((liveYaw / 18) * 100)));
        } else if (currentStep === 4) {
            return Math.min(100, Math.round(liveSmile * 100));
        }
        return 0;
    }, [currentStep, isFaceDetected, liveYaw, liveLeftEye, liveRightEye, liveSmile]);

    const activeStepData = ENROLLMENT_STEPS[currentStep] || null;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Face Enrollment</Text>
                <Text style={styles.subtitle}>
                    {isComplete ? 'Enrollment finished!' : 
                     isFaceDetected ? 'Face detected! Follow the instructions' : 'Position your face in the frame'}
                </Text>
            </View>

            {/* Camera Preview Area (Takes exactly 50% of layout height) */}
            <View style={styles.cameraContainer}>
                {!hasPermission ? (
                    <View style={styles.cameraPlaceholder}>
                        <Text style={styles.placeholderText}>We need camera permissions to scan your face.</Text>
                        <Button title="Grant Permission" onPress={requestPermission} />
                    </View>
                ) : device == null ? (
                    <View style={styles.cameraPlaceholder}>
                        <Text style={styles.placeholderText}>No front camera found.</Text>
                    </View>
                ) : (
                    <View style={styles.cameraWrapper}>
                        <Camera 
                            style={styles.cameraView} 
                            device={device}
                            isActive={!isComplete && !modelLoading && !modelError}
                            frameProcessor={frameProcessor}
                        />
                        {modelLoading && (
                            <View style={styles.modelLoadingOverlay}>
                                <ActivityIndicator size="large" color={colors.secondary} />
                                <Text style={styles.modelLoadingText}>Initializing AI Engine...</Text>
                            </View>
                        )}
                        {modelError && (
                            <View style={[styles.modelLoadingOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
                                <Ionicons name="warning" size={48} color={colors.error} />
                                <Text style={[styles.modelLoadingText, { color: colors.error, marginTop: spacing.md }]}>
                                    AI Engine Initialization Failed
                                </Text>
                                <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.md }}>
                                    {modelError}
                                </Text>
                            </View>
                        )}
                        <View style={styles.cameraOverlay}>
                            {/* Scanning outline frame */}
                            <View style={styles.faceFrame}>
                                <View style={[styles.corner, styles.topLeft, { borderColor: isFaceDetected ? colors.success : colors.secondary }]} />
                                <View style={[styles.corner, styles.topRight, { borderColor: isFaceDetected ? colors.success : colors.secondary }]} />
                                <View style={[styles.corner, styles.bottomLeft, { borderColor: isFaceDetected ? colors.success : colors.secondary }]} />
                                <View style={[styles.corner, styles.bottomRight, { borderColor: isFaceDetected ? colors.success : colors.secondary }]} />

                                {!isComplete && isFaceDetected && !isTransitioning && (
                                    <Animated.View
                                        style={[
                                            styles.scanLine,
                                            { transform: [{ translateY: scanLineTranslateY }] },
                                        ]}
                                    />
                                )}

                                {isTransitioning && (
                                    <View style={styles.stepSuccessOverlay}>
                                        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                                        <Text style={styles.successOverlayText}>Pose Accepted!</Text>
                                        <Text style={styles.successOverlayConfidence}>{transitionConfidence}% Confidence</Text>
                                    </View>
                                )}

                                {isComplete && (
                                    <View style={styles.stepSuccessOverlay}>
                                        <Ionicons name="shield-checkmark" size={72} color={colors.success} />
                                        <Text style={styles.successOverlayText}>Scanning Complete</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {/* Active Pose Analyzer HUD (Eye level, fits perfectly below the camera) */}
            <View style={styles.hudContainer}>
                {!isScanning && !isComplete && (
                    <Card style={styles.hudCard}>
                        <Text style={styles.completeTitle}>Ready to Enroll?</Text>
                        <Text style={[styles.completeSubtitle, { marginVertical: spacing.md }]}>
                            Position your face inside the frame and tap the button below to start the 5-step face signature scan.
                        </Text>
                        <Button
                            title="Start Scan"
                            onPress={() => {
                                isScanningShared.value = true;
                                setIsScanning(true);
                            }}
                            size="large"
                        />
                    </Card>
                )}

                {isScanning && !isComplete && activeStepData && (
                    <Card style={styles.hudCard}>
                        <View style={styles.hudHeader}>
                            <Ionicons name={activeStepData.icon as any} size={28} color={colors.secondary} />
                            <Text style={styles.hudStepLabel}>STEP {currentStep + 1} OF 5</Text>
                        </View>
                        <Text style={styles.hudInstruction}>{activeStepData.instruction}</Text>
                        
                        {/* Live Confidence Score progress bar */}
                        {isFaceDetected && (
                            <View style={styles.progressSection}>
                                <View style={styles.progressInfoRow}>
                                    <Text style={styles.progressText}>Matching Confidence</Text>
                                    <Text style={styles.progressPercentage}>
                                        {isTransitioning ? transitionConfidence : liveConfidence}%
                                    </Text>
                                </View>
                                <View style={styles.progressTrack}>
                                    <View 
                                        style={[
                                            styles.progressFill, 
                                            { 
                                                width: `${isTransitioning ? transitionConfidence : liveConfidence}%`,
                                                backgroundColor: isTransitioning || liveConfidence >= 80 ? colors.success : colors.secondary
                                            }
                                        ]} 
                                    />
                                </View>
                            </View>
                        )}
                        
                        {/* Dynamic Live Telemetry Readout */}
                        {isFaceDetected && (
                            <View style={styles.miniTelemetry}>
                                {currentStep === 0 && (
                                    <Text style={styles.telemetryValueText}>Yaw angle: {liveYaw.toFixed(1)}° (Goal: &lt; 8°)</Text>
                                )}
                                {currentStep === 1 && (
                                    <Text style={styles.telemetryValueText}>Eyes open: L {(liveLeftEye*100).toFixed(0)}% | R {(liveRightEye*100).toFixed(0)}%</Text>
                                )}
                                {currentStep === 2 && (
                                    <Text style={styles.telemetryValueText}>Yaw angle: {liveYaw.toFixed(1)}° (Goal: &lt; -18°)</Text>
                                )}
                                {currentStep === 3 && (
                                    <Text style={styles.telemetryValueText}>Yaw angle: {liveYaw.toFixed(1)}° (Goal: &gt; 18°)</Text>
                                )}
                                {currentStep === 4 && (
                                    <Text style={styles.telemetryValueText}>Smile power: {(liveSmile*100).toFixed(0)}% (Goal: &gt; 50%)</Text>
                                )}
                            </View>
                        )}
                    </Card>
                )}

                {isComplete && (
                    <Card style={styles.hudCard}>
                        <Text style={styles.completeTitle}>Face Signature Verified</Text>
                        <Text style={styles.completeSubtitle}>All 5 pose challenge metrics successfully compiled.</Text>
                        <Button
                            title="Save Enrollment Template"
                            onPress={handleComplete}
                            size="large"
                            style={styles.saveBtn}
                        />
                    </Card>
                )}
            </View>

            {/* Stepper Dots (Compact indicators instead of vertical checklist to keep layout at eye level) */}
            <View style={styles.stepperContainer}>
                {ENROLLMENT_STEPS.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isActive = index === currentStep;
                    return (
                        <View key={step.id} style={styles.stepIndicatorWrapper}>
                            <View 
                                style={[
                                    styles.stepperDot,
                                    isCompleted && styles.stepperDotCompleted,
                                    isActive && styles.stepperDotActive,
                                ]}
                            >
                                {isCompleted ? (
                                    <Ionicons name="checkmark" size={10} color={colors.white} />
                                ) : isActive ? (
                                    <View style={styles.activeDotInner} />
                                ) : null}
                            </View>
                            <Text style={[
                                styles.stepperText,
                                isActive && styles.stepperTextActive,
                                isCompleted && styles.stepperTextCompleted
                            ]}>
                                {step.label}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'space-between',
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
    },
    title: {
        ...typography.h2,
        color: colors.text,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.xs - 2,
    },
    cameraContainer: {
        flex: 1,
        maxHeight: height * 0.46,
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
    },
    cameraPlaceholder: {
        width: '100%',
        aspectRatio: 4 / 3,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    placeholderText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    cameraWrapper: {
        width: '100%',
        height: '100%',
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.surface,
    },
    cameraView: {
        ...StyleSheet.absoluteFillObject,
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    faceFrame: {
        width: '70%',
        aspectRatio: 3 / 4,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderWidth: 3,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderTopLeftRadius: borderRadius.md,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
        borderTopRightRadius: borderRadius.md,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: borderRadius.md,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomRightRadius: borderRadius.md,
    },
    scanLine: {
        position: 'absolute',
        width: '100%',
        height: 3,
        backgroundColor: colors.secondary,
    },
    stepSuccessOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: borderRadius.sm,
    },
    successOverlayText: {
        ...typography.bodyBold,
        fontSize: 18,
        color: colors.success,
        marginTop: spacing.sm,
    },
    successOverlayConfidence: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: spacing.xs - 2,
    },
    hudContainer: {
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
        marginVertical: spacing.xs,
    },
    hudCard: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
    },
    hudHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    hudStepLabel: {
        ...typography.caption,
        color: colors.textSecondary,
        fontWeight: 'bold',
        marginLeft: spacing.sm,
    },
    hudInstruction: {
        ...typography.h3,
        fontSize: 18,
        color: colors.text,
        marginVertical: spacing.xs,
    },
    progressSection: {
        marginTop: spacing.sm,
    },
    progressInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    progressText: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    progressPercentage: {
        ...typography.caption,
        fontWeight: 'bold',
        color: colors.secondary,
    },
    progressTrack: {
        height: 6,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: borderRadius.sm,
    },
    miniTelemetry: {
        marginTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: colors.surface,
        paddingTop: spacing.xs,
    },
    telemetryValueText: {
        ...typography.small,
        color: colors.textSecondary,
    },
    completeTitle: {
        ...typography.h3,
        color: colors.text,
        textAlign: 'center',
    },
    completeSubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginVertical: spacing.sm,
    },
    saveBtn: {
        marginTop: spacing.xs,
    },
    stepperContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: colors.surface,
        backgroundColor: colors.white,
    },
    stepIndicatorWrapper: {
        alignItems: 'center',
        flex: 1,
    },
    stepperDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs - 2,
    },
    stepperDotCompleted: {
        backgroundColor: colors.success,
    },
    stepperDotActive: {
        borderWidth: 2,
        borderColor: colors.secondary,
        backgroundColor: colors.white,
    },
    activeDotInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.secondary,
    },
    stepperText: {
        fontSize: 9,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    stepperTextActive: {
        color: colors.secondary,
        fontWeight: 'bold',
    },
    stepperTextCompleted: {
        color: colors.success,
    },
    modelLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    modelLoadingText: {
        color: '#ffffff',
        marginTop: spacing.sm,
        fontSize: 14,
        fontWeight: '600',
    },
});
