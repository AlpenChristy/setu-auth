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
import { useNetInfo } from '@react-native-community/netinfo';
import { colors, spacing, typography, borderRadius } from '@/src/theme/colors';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { useAuthStore } from '@/src/store/authStore';
import { useAttendanceStore } from '@/src/store/attendanceStore';
import { format, differenceInMinutes, parse } from 'date-fns';
import { BACKEND_URL } from '@/src/utils/config';
import { sqliteDb } from '@/src/utils/sqliteDb';
import { decryptData } from '@/src/utils/encryption';
import * as Location from 'expo-location';

const { height } = Dimensions.get('window');

const ALL_VERIFICATION_STEPS = [
    { id: 1, instruction: 'Look straight at the camera', icon: 'eye-outline', label: 'Straight Face' },
    { id: 2, instruction: 'Blink slowly to verify liveness', icon: 'eye-off-outline', label: 'Blink Check' },
    { id: 3, instruction: 'Turn your head left', icon: 'arrow-back-circle', label: 'Left Turn' },
    { id: 4, instruction: 'Turn your head right', icon: 'arrow-forward-circle', label: 'Right Turn' },
    { id: 5, instruction: 'Smile slightly', icon: 'happy-outline', label: 'Smile Check' },
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

export default function FaceAuthScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { addLog, fetchAttendance, fetchLogs, addAttendance } = useAttendanceStore();
    
    // Randomly select one verification action on initialization
    const [activeChallenges] = useState<any[]>(() => {
        const randomIdx = Math.floor(Math.random() * ALL_VERIFICATION_STEPS.length);
        return [ALL_VERIFICATION_STEPS[randomIdx]];
    });

    const [currentChallenge, setCurrentChallenge] = useState(0);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const isTransitioningRef = useRef(false);
    const [transitionConfidence, setTransitionConfidence] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const isScanningShared = useSharedValue(false);
    const [registeredEmbedding, setRegisteredEmbedding] = useState<number[] | null>(null);
    const [locationStr, setLocationStr] = useState('Fetching location...');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const netInfo = useNetInfo();

    // Liveness helper states
    const [blinkCount, setBlinkCount] = useState(0);
    const [eyesClosed, setEyesClosed] = useState(false);
    const [faces, setFaces] = useState<any[]>([]);

    // Animation values
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    const currentChallengeRef = useRef(currentChallenge);
    currentChallengeRef.current = currentChallenge;

    const activeChallengesRef = useRef(activeChallenges);
    activeChallengesRef.current = activeChallenges;

    const facesRef = useRef(faces);
    facesRef.current = faces;

    // AI & TFLite setup
    const faceEmbeddingRef = useRef<number[] | null>(null);
    const shouldExtractEmbedding = useSharedValue(false);
    const resizePlugin = useResizePlugin();

    const [model, setModel] = useState<any>(null);
    const [modelLoading, setModelLoading] = useState(true);
    const [modelError, setModelError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        async function loadModel() {
            try {
                console.log('FaceAuth: Resolving model asset via expo-asset...');
                const asset = Asset.fromModule(require('../assets/mobilefacenet.tflite'));
                await asset.downloadAsync();
                const path = asset.localUri || asset.uri;
                console.log('FaceAuth: Loading model from path:', path);
                const loadedModel = await loadTensorflowModel({ url: path }, []);
                if (isMounted) {
                    setModel(loadedModel);
                    setModelLoading(false);
                    console.log('FaceAuth: TFLite Model loaded successfully from local asset cache.');
                }
            } catch (err) {
                console.error('FaceAuth: Failed to load model from cache, falling back:', err);
                try {
                    const loadedModel = await loadTensorflowModel(require('../assets/mobilefacenet.tflite'), []);
                    if (isMounted) {
                        setModel(loadedModel);
                        setModelLoading(false);
                        console.log('FaceAuth: TFLite Model loaded via direct require fallback.');
                    }
                } catch (fallbackErr) {
                    console.error('FaceAuth: Fallback model loading failed:', fallbackErr);
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

    // Unified transition useEffect to handle step progression cleanly in React lifecycle
    useEffect(() => {
        if (isTransitioning) {
            console.log('FaceAuth: Step transition timer started for challenge', currentChallenge);
            const timer = setTimeout(() => {
                console.log('FaceAuth: Step transition timer fired!');
                const next = currentChallenge + 1;
                setCurrentChallenge(next);

                Animated.timing(progressAnim, {
                    toValue: (next / activeChallenges.length) * 100,
                    duration: 500,
                    useNativeDriver: false,
                }).start();

                if (next === activeChallenges.length) {
                    setIsVerifying(true);
                }

                isTransitioningRef.current = false;
                setIsTransitioning(false);
                setTransitionConfidence(null);
            }, 1200);

            return () => {
                clearTimeout(timer);
            };
        }
    }, [isTransitioning, currentChallenge, activeChallenges, progressAnim]);



    useEffect(() => {
        if (model) {
            console.log('TFLite Model loaded successfully! Inputs:', JSON.stringify(model.inputs), 'Outputs:', JSON.stringify(model.outputs));
        }
    }, [model]);

    const onEmbeddingExtracted = useRunOnJS((embedding: number[]) => {
        console.log('FaceAuth: Real embedding extracted, vector dimensions:', embedding.length);
        faceEmbeddingRef.current = embedding;

        const challengeIdx = currentChallengeRef.current;
        const challenge = activeChallengesRef.current[challengeIdx];
        const face = facesRef.current[0];
        
        let calculatedConfidence = 100;
        if (face) {
            const yaw = face.yawAngle ?? 0;
            if (challenge.id === 1) {
                calculatedConfidence = Math.max(0, Math.min(100, Math.round((1 - Math.abs(yaw) / 8) * 100)));
            } else if (challenge.id === 2) {
                calculatedConfidence = 100;
            } else if (challenge.id === 3) {
                calculatedConfidence = Math.max(0, Math.min(100, Math.round((-yaw / 18) * 100)));
            } else if (challenge.id === 4) {
                calculatedConfidence = Math.max(0, Math.min(100, Math.round((yaw / 18) * 100)));
            } else if (challenge.id === 5) {
                calculatedConfidence = Math.min(100, Math.round((face.smilingProbability ?? 0) * 100));
            }
        }

        isTransitioningRef.current = true;
        setIsTransitioning(true);
        setTransitionConfidence(calculatedConfidence);
    }, [faceEmbeddingRef]);
    
    useEffect(() => {
        if (user) {
            console.log('FaceAuth: Fetching registered embedding for', user.employeeId);
            fetch(`${BACKEND_URL}/api/workers/${user.employeeId}/embedding`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.face_embedding) {
                        console.log('FaceAuth: Registered embedding loaded');
                        setRegisteredEmbedding(data.face_embedding);
                    } else {
                        console.log('FaceAuth: No registered embedding found');
                    }
                })
                .catch(err => console.error("Error fetching registered embedding:", err));
        }
    }, [user]);

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

    // Note: Embedding extraction is now triggered during the "Look straight" liveness step

    const frameProcessor = useFrameProcessor((frame) => {
      'worklet';
      
      if (!isScanningShared.value) return;
      
      const detectedFaces = detectFaces(frame);
      updateFaces(detectedFaces);

      if (shouldExtractEmbedding.value && detectedFaces.length > 0) {
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

                      // Apply advanced image preprocessing (CLAHE, Gamma correction) & Quality gating
                      const gate = preprocessAndGateFaceImage(resized, bounds.width, bounds.height, frame.width, frame.height);
                      if (!gate.success) {
                          console.log('FaceAuth: Frame rejected by quality gating: ' + gate.reason);
                          return;
                      }

                      // Successfully passed quality gate, now we can set it to false so we don't extract again
                      shouldExtractEmbedding.value = false;

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
                                  console.log('FaceAuth: Weak embedding detected, norm: ' + rawNorm);
                                  shouldExtractEmbedding.value = true; // Set back to try again
                                  return;
                              }

                              onEmbeddingExtracted(embedding);
                          }
                      }
                  } catch (err) {
                      console.error('FaceAuth: Model inference error:', err);
                      shouldExtractEmbedding.value = true; // Set back to try again
                  }
              }
          }
      }
    }, [detectFaces, boxedModel, resizePlugin, onEmbeddingExtracted, isScanningShared]);



    useEffect(() => {
        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    // Real liveness challenge progression based on face detection parameters
    useEffect(() => {
        if (faces.length === 0 || currentChallenge >= activeChallenges.length || isVerifying || isTransitioningRef.current) {
            return;
        }

        const face = faces[0];
        const challenge = activeChallenges[currentChallenge];
        const yaw = face.yawAngle ?? 0;

        if (challenge.id === 1) {
            // Step 1: Look straight at the camera
            if (Math.abs(yaw) < 8) {
                if (!shouldExtractEmbedding.value && !faceEmbeddingRef.current) {
                    console.log('FaceAuth: Looking straight detected');
                    shouldExtractEmbedding.value = true;
                }
            }
        } else if (challenge.id === 2) {
            // Step 2: Blink slowly
            const leftEye = face.leftEyeOpenProbability ?? 1.0;
            const rightEye = face.rightEyeOpenProbability ?? 1.0;
            const eyesAreClosed = leftEye < 0.25 && rightEye < 0.25;
            const eyesAreOpen = leftEye > 0.7 && rightEye > 0.7;

            if (eyesAreClosed && !eyesClosed) {
                setEyesClosed(true);
            } else if (eyesAreOpen && eyesClosed) {
                setEyesClosed(false);
                const nextBlinkCount = blinkCount + 1;
                setBlinkCount(nextBlinkCount);
                console.log('FaceAuth: Blink detected. Total:', nextBlinkCount);
                if (nextBlinkCount >= 1) {
                    if (!shouldExtractEmbedding.value && !faceEmbeddingRef.current) {
                        shouldExtractEmbedding.value = true;
                    }
                }
            }
        } else if (challenge.id === 3) {
            // Step 3: Turn Head Left (yaw < -18)
            if (yaw < -18) {
                if (!shouldExtractEmbedding.value && !faceEmbeddingRef.current) {
                    console.log('FaceAuth: Head turn left detected. Yaw:', yaw);
                    shouldExtractEmbedding.value = true;
                }
            }
        } else if (challenge.id === 4) {
            // Step 4: Turn Head Right (yaw > 18)
            if (yaw > 18) {
                if (!shouldExtractEmbedding.value && !faceEmbeddingRef.current) {
                    console.log('FaceAuth: Head turn right detected. Yaw:', yaw);
                    shouldExtractEmbedding.value = true;
                }
            }
        } else if (challenge.id === 5) {
            // Step 5: Smile slightly
            const smileProb = face.smilingProbability ?? 0.0;
            if (smileProb > 0.5) {
                if (!shouldExtractEmbedding.value && !faceEmbeddingRef.current) {
                    console.log('FaceAuth: Smile detected. Probability:', smileProb);
                    shouldExtractEmbedding.value = true;
                }
            }
        }
    }, [faces, currentChallenge, isVerifying, eyesClosed, blinkCount, activeChallenges, shouldExtractEmbedding]);

    // Runs the verification call after a short delay
    useEffect(() => {
        if (!isVerifying || isComplete || !user) return;

        const verifyTimer = setTimeout(async () => {
            try {
                if (!faceEmbeddingRef.current) {
                    console.log('FaceAuth: Real embedding not captured');
                    alert('Face template not fully captured yet. Please align your face and try again.');
                    setIsVerifying(false);
                    setIsComplete(false);
                    setCurrentChallenge(0);
                    setBlinkCount(0);
                    setEyesClosed(false);
                    setIsScanning(false);
                    isScanningShared.value = false;
                    return;
                }

                setIsComplete(true);
                const liveEmbedding = faceEmbeddingRef.current;
                const spoof = false;

                const isOffline = netInfo.isConnected === false;

                if (isOffline) {
                    console.log('FaceAuth: Network is offline. Running on-device offline verification.');

                    const cached = sqliteDb.getCachedEmbedding(user.id);
                    if (!cached || !cached.embedding) {
                        console.log('FaceAuth: No cached embedding found offline');
                        alert('No face template cached on device. Please connect to the internet to verify.');
                        setIsVerifying(false);
                        setIsComplete(false);
                        setCurrentChallenge(0);
                        setBlinkCount(0);
                        setEyesClosed(false);
                        setIsScanning(false);
                        isScanningShared.value = false;
                        return;
                    }

                    // Decrypt embedding
                    const decryptedStr = await decryptData(cached.embedding);
                    const parsedEmbeddings = JSON.parse(decryptedStr);
                    
                    let registeredEmbeddings: number[][];
                    if (parsedEmbeddings.length > 0 && !Array.isArray(parsedEmbeddings[0])) {
                        registeredEmbeddings = [parsedEmbeddings];
                    } else {
                        registeredEmbeddings = parsedEmbeddings;
                    }

                    // L2 normalize live embedding
                    const liveNorm = Math.sqrt(liveEmbedding.reduce((sum, val) => sum + val * val, 0));
                    const liveNormalized = liveNorm > 0 ? liveEmbedding.map(v => v / liveNorm) : liveEmbedding;

                    const activeChallengeId = activeChallenges[0]?.id;
                    let targetIndex: number | null = null;
                    if (activeChallengeId !== undefined && registeredEmbeddings.length === 4) {
                        if (activeChallengeId === 1 || activeChallengeId === 2) {
                            targetIndex = 0;
                        } else if (activeChallengeId === 3) {
                            targetIndex = 1;
                        } else if (activeChallengeId === 4) {
                            targetIndex = 2;
                        } else if (activeChallengeId === 5) {
                            targetIndex = 3;
                        }
                    }

                    // Helper to compute metrics
                    const computeMetrics = (live: number[], reg: number[]) => {
                        if (live.length !== reg.length) return { cos: -1, dist: Number.MAX_VALUE };
                        
                        // L2 normalize registered vector
                        const regNorm = Math.sqrt(reg.reduce((sum, val) => sum + val * val, 0));
                        const regNormalized = regNorm > 0 ? reg.map(v => v / regNorm) : reg;

                        const cos = live.reduce((sum, val, i) => sum + val * regNormalized[i], 0);
                        const dist = Math.sqrt(
                            live.reduce((sum, val, i) => sum + Math.pow(val - regNormalized[i], 2), 0)
                        );
                        return { cos, dist };
                    };

                    let bestCosine = -1.0;
                    let bestDist = Number.MAX_VALUE;
                    let targetCosine = -1.0;
                    let targetDist = Number.MAX_VALUE;

                    // Evaluate target pose template
                    if (targetIndex !== null && targetIndex < registeredEmbeddings.length) {
                        const metrics = computeMetrics(liveNormalized, registeredEmbeddings[targetIndex]);
                        targetCosine = metrics.cos;
                        targetDist = metrics.dist;
                    }

                    // Evaluate all poses to find the best match
                    for (const regVector of registeredEmbeddings) {
                        const metrics = computeMetrics(liveNormalized, regVector);
                        if (metrics.cos > bestCosine) {
                            bestCosine = metrics.cos;
                            bestDist = metrics.dist;
                        }
                    }

                    // Weighted pose score computation
                    let otherPosesMaxCosine = -1.0;
                    for (let i = 0; i < registeredEmbeddings.length; i++) {
                        if (i !== targetIndex) {
                            const metrics = computeMetrics(liveNormalized, registeredEmbeddings[i]);
                            if (metrics.cos > otherPosesMaxCosine) {
                                otherPosesMaxCosine = metrics.cos;
                            }
                        }
                    }

                    const weightedPoseScore = targetIndex !== null 
                        ? (0.6 * targetCosine + 0.4 * otherPosesMaxCosine) 
                        : bestCosine;

                    // Enforce primary match condition
                    let isMatch = targetIndex !== null ? (weightedPoseScore >= 0.70) : (bestCosine >= 0.80);

                    console.log('FaceAuth Offline: targetCosine =', targetCosine, 'bestCosine =', bestCosine, 'weightedScore =', weightedPoseScore);

                    // Impostor Guard & Score Margin Check against all other cached users
                    let maxOtherUserCosine = -1.0;
                    let impostorDetected = false;
                    let marginViolation = false;

                    try {
                        const allCached = sqliteDb.getAllCachedEmbeddings();
                        for (const cachedUser of allCached) {
                            if (cachedUser.userId !== user.id && cachedUser.embedding) {
                                const decryptedOtherStr = await decryptData(cachedUser.embedding);
                                const parsedOtherEmbeddings = JSON.parse(decryptedOtherStr);
                                const otherEmbeddings: number[][] = (parsedOtherEmbeddings.length > 0 && !Array.isArray(parsedOtherEmbeddings[0]))
                                    ? [parsedOtherEmbeddings]
                                    : parsedOtherEmbeddings;

                                for (const otherVector of otherEmbeddings) {
                                    const metrics = computeMetrics(liveNormalized, otherVector);
                                    if (metrics.cos > maxOtherUserCosine) {
                                        maxOtherUserCosine = metrics.cos;
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error('FaceAuth Offline: Impostor check error:', e);
                    }

                    console.log('FaceAuth Offline: maxOtherUserCosine =', maxOtherUserCosine);

                    // Check Impostor Guard (reject if similarity to other user > 0.82)
                    if (maxOtherUserCosine > 0.82) {
                        console.log('FaceAuth Offline: Impostor Guard triggered! Similarity to other user:', maxOtherUserCosine);
                        impostorDetected = true;
                        isMatch = false;
                    }

                    // Check Score Margin (reject if gap < 0.05)
                    const targetScore = targetIndex !== null ? weightedPoseScore : bestCosine;
                    const margin = targetScore - maxOtherUserCosine;
                    if (isMatch && maxOtherUserCosine > 0.0 && margin < 0.05) {
                        console.log('FaceAuth Offline: Score Margin check failed! Gap:', margin);
                        marginViolation = true;
                        isMatch = false;
                    }

                    if (!isMatch) {
                        let failReason = 'Cosine similarity matching failed.';
                        if (impostorDetected) {
                            failReason = 'Security Warning: Face matches another registered user profile.';
                        } else if (marginViolation) {
                            failReason = 'Security Warning: High similarity to multiple profiles (Margin Check failed).';
                        }
                        console.log('FaceAuth Offline: ' + failReason);
                        alert(failReason);
                        await addLog({
                            userId: user.id,
                            timestamp: new Date().toISOString(),
                            type: 'face_auth',
                            status: impostorDetected ? 'spoof' : 'failed',
                        });
                        router.replace('/auth-failure');
                        return;
                    }

                    // Geofencing verification offline
                    let locationMatch = true;
                    let locationMessage = '';
                    const clientLat = latitude !== null ? latitude : 19.0760;
                    const clientLng = longitude !== null ? longitude : 72.8777;

                    if (cached.assignedLat !== null && cached.assignedLng !== null) {
                        const R = 6371000.0; // meters
                        const phi1 = (clientLat * Math.PI) / 180;
                        const phi2 = (cached.assignedLat * Math.PI) / 180;
                        const delta_phi = ((cached.assignedLat - clientLat) * Math.PI) / 180;
                        const delta_lambda = ((cached.assignedLng - clientLng) * Math.PI) / 180;

                        const a = Math.sin(delta_phi / 2.0) ** 2 +
                                  Math.cos(phi1) * Math.cos(phi2) *
                                  Math.sin(delta_lambda / 2.0) ** 2;
                        const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
                        const calculatedDistance = R * c;

                        console.log('FaceAuth Offline: Geofence distance =', calculatedDistance, 'Allowed =', cached.assignedRadius);

                        if (calculatedDistance > cached.assignedRadius) {
                            locationMatch = false;
                            locationMessage = `Location mismatch. Distance: ${Math.round(calculatedDistance)}m (Allowed: ${cached.assignedRadius}m).`;
                        }
                    }

                    if (!locationMatch) {
                        console.log('FaceAuth Offline: Geofencing validation failed.');
                        await addLog({
                            userId: user.id,
                            timestamp: new Date().toISOString(),
                            type: 'face_auth',
                            status: 'failed',
                        });
                        alert(locationMessage);
                        router.replace('/auth-failure');
                        return;
                    }

                    // Successfully verified face and geofence offline!
                    // Determine today's record in SQLite (check-in vs check-out)
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    const records = sqliteDb.getAttendance(user.id);
                    const todayRecord = records.find((r: any) => r.date === todayStr);

                    const timeStr = format(new Date(), 'hh:mm a');

                    if (!todayRecord) {
                        // Check-in
                        await addAttendance({
                            userId: user.id,
                            date: todayStr,
                            checkIn: timeStr,
                            checkOut: null,
                            checkInLocation: locationStr,
                            checkOutLocation: null,
                            status: 'present',
                            workingHours: 0.0,
                        });
                    } else if (!todayRecord.checkOut) {
                        // Check-out
                        let workingHours = 0.0;
                        try {
                            const inTime = parse(todayRecord.checkIn, 'hh:mm a', new Date());
                            const outTime = parse(timeStr, 'hh:mm a', new Date());
                            const diffMins = differenceInMinutes(outTime, inTime);
                            workingHours = Math.max(0, Math.round((diffMins / 60) * 10) / 10);
                        } catch (e) {
                            console.error('Error calculating working hours offline:', e);
                        }

                        await addAttendance({
                            userId: user.id,
                            date: todayStr,
                            checkIn: todayRecord.checkIn,
                            checkOut: timeStr,
                            checkInLocation: todayRecord.checkInLocation,
                            checkOutLocation: locationStr,
                            status: 'present',
                            workingHours: workingHours,
                        });
                    }

                    // Log success record offline
                    await addLog({
                        userId: user.id,
                        timestamp: new Date().toISOString(),
                        type: 'face_auth',
                        status: 'success',
                    });

                    console.log('FaceAuth: Offline check-in/out written successfully.');
                    router.replace('/auth-success');

                } else {
                    // Online Mode: Fetch verification from backend server
                    console.log('FaceAuth: Network is online. Calling backend verify API.');
                    const response = await fetch(`${BACKEND_URL}/api/workers/${user.employeeId}/verify`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            face_embedding: liveEmbedding,
                            device_id: 'iPhone-DEV',
                            simulate_spoof: spoof,
                            location_name: locationStr,
                            latitude: latitude,
                            longitude: longitude,
                            challenge_id: activeChallenges[0]?.id,
                        }),
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.match) {
                            console.log('FaceAuth: Online Verification success!', result.action);

                            // Pull updated logs and attendance from backend database
                            await fetchAttendance(user.id);
                            await fetchLogs(user.id);

                            router.replace('/auth-success');
                        } else {
                            console.log('FaceAuth: Online Verification rejected:', result.message);
                            alert(result.message || 'Verification failed');
                            await fetchLogs(user.id);
                            router.replace('/auth-failure');
                        }
                    } else {
                        throw new Error('Server returned error status');
                    }
                }
            } catch (error) {
                console.error('FaceAuth: Error during verification:', error);
                await addLog({
                    userId: user.id,
                    timestamp: new Date().toISOString(),
                    type: 'face_auth',
                    status: 'failed',
                });
                router.replace('/auth-failure');
            }
        }, 1500);

        return () => clearTimeout(verifyTimer);
    }, [isVerifying, isComplete, user, registeredEmbedding, latitude, longitude, locationStr, netInfo.isConnected, activeChallenges, addAttendance, addLog, fetchAttendance, fetchLogs, isScanningShared, router]);

    const isFaceDetected = faces.length > 0;
    const face = faces[0];
    const liveYaw = face?.yawAngle ?? 0;
    const liveSmile = face?.smilingProbability ?? 0;
    const liveLeftEye = face?.leftEyeOpenProbability ?? 1.0;
    const liveRightEye = face?.rightEyeOpenProbability ?? 1.0;

    // Calculate live confidence score for active challenge
    const liveConfidence = useMemo(() => {
        if (!isFaceDetected || currentChallenge >= activeChallenges.length) return 0;
        const challenge = activeChallenges[currentChallenge];
        if (challenge.id === 1) {
            return Math.max(0, Math.min(100, Math.round((1 - Math.abs(liveYaw) / 8) * 100)));
        } else if (challenge.id === 2) {
            const eyeCloseness = Math.min(100, Math.max(0, Math.round((1 - (liveLeftEye + liveRightEye) / 2) * 100)));
            return Math.min(100, Math.round(blinkCount * 100 + (eyeCloseness * (1 - blinkCount))));
        } else if (challenge.id === 3) {
            return Math.max(0, Math.min(100, Math.round((-liveYaw / 18) * 100)));
        } else if (challenge.id === 4) {
            return Math.max(0, Math.min(100, Math.round((liveYaw / 18) * 100)));
        } else if (challenge.id === 5) {
            return Math.min(100, Math.round(liveSmile * 100));
        }
        return 0;
    }, [currentChallenge, isFaceDetected, blinkCount, activeChallenges, liveLeftEye, liveRightEye, liveSmile, liveYaw]);

    const activeChallengeData = activeChallenges[currentChallenge] || null;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Face Authentication</Text>
                <Text style={styles.subtitle}>
                    {isVerifying ? 'Verifying identity with backend templates...' : 
                     isFaceDetected ? 'Face detected! Follow the instructions' : 'Position your face in the frame'}
                </Text>
            </View>

            {/* Camera Preview Area (Fits exactly at eye-level) */}
            <View style={styles.cameraContainer}>
                {!hasPermission ? (
                    <View style={styles.cameraPlaceholder}>
                        <Text style={styles.placeholderText}>We need camera permissions to verify your face.</Text>
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
                            {/* Scanning outline ring */}
                            <Animated.View
                                style={[
                                    styles.faceRing,
                                    {
                                        transform: [{ scale: isVerifying ? 1 : pulseAnim }],
                                        borderColor: isFaceDetected ? colors.success : colors.secondary,
                                    },
                                ]}
                            />

                            {isTransitioning && (
                                <View style={styles.challengeSuccessOverlay}>
                                    <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                                    <Text style={styles.successOverlayText}>Verification Step Done!</Text>
                                    <Text style={styles.successOverlayConfidence}>{transitionConfidence}% Score</Text>
                                </View>
                            )}

                            {isVerifying && (
                                <View style={styles.verifyingOverlay}>
                                    <Ionicons name="shield-checkmark" size={64} color={colors.success} />
                                    <Text style={styles.verifyingText}>Comparing Embeddings...</Text>
                                    <Text style={styles.verifyingSubtext}>Matching live vectors with database</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </View>

            {/* Active Challenge Analyzer HUD */}
            <View style={styles.hudContainer}>
                {!isScanning && !isVerifying && !isComplete && (
                    <Card style={styles.hudCard}>
                        <Text style={styles.completeTitle}>Ready to Verify?</Text>
                        <Text style={[styles.completeSubtitle, { marginVertical: spacing.md, textAlign: 'center', color: colors.textSecondary }]}>
                            Position your face inside the frame and tap the button below to start the liveness and identity check.
                        </Text>
                        <Button
                            title="Start Verification"
                            onPress={() => {
                                isScanningShared.value = true;
                                setIsScanning(true);
                            }}
                            size="large"
                        />
                    </Card>
                )}

                {isScanning && !isVerifying && activeChallengeData && (
                    <Card style={styles.hudCard}>
                        <View style={styles.hudHeader}>
                            <Ionicons name={activeChallengeData.icon as any} size={28} color={colors.secondary} />
                            <Text style={styles.hudStepLabel}>VERIFICATION ACTION REQUIRED</Text>
                        </View>
                        <Text style={styles.hudInstruction}>{activeChallengeData.instruction}</Text>
                        
                        {/* Live Confidence meter */}
                        {isFaceDetected && (
                            <View style={styles.progressSection}>
                                <View style={styles.progressInfoRow}>
                                    <Text style={styles.progressText}>Action Progress</Text>
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

                        {/* Live challenge context details */}
                        {isFaceDetected && (
                            <View style={styles.miniTelemetry}>
                                {activeChallengeData.id === 1 && (
                                    <Text style={styles.telemetryValueText}>Yaw angle: {liveYaw.toFixed(1)}° (Goal: &lt; 8°)</Text>
                                )}
                                {activeChallengeData.id === 2 && (
                                    <Text style={styles.telemetryValueText}>Blinks: {blinkCount}/1 (Closeness: {Math.round((1 - (liveLeftEye + liveRightEye)/2)*100)}%)</Text>
                                )}
                                {activeChallengeData.id === 3 && (
                                    <Text style={styles.telemetryValueText}>Yaw rotation: {liveYaw.toFixed(1)}° (Goal: &lt; -18°)</Text>
                                )}
                                {activeChallengeData.id === 4 && (
                                    <Text style={styles.telemetryValueText}>Yaw rotation: {liveYaw.toFixed(1)}° (Goal: &gt; 18°)</Text>
                                )}
                                {activeChallengeData.id === 5 && (
                                    <Text style={styles.telemetryValueText}>Smile power: {(liveSmile*100).toFixed(0)}% (Goal: &gt; 50%)</Text>
                                )}
                            </View>
                        )}
                    </Card>
                )}

                {isVerifying && (
                    <Card style={styles.hudCard}>
                        <View style={styles.matchCardContent}>
                            <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
                            <Text style={styles.locationText} numberOfLines={2}>
                                GPS Location: {locationStr}
                            </Text>
                        </View>
                    </Card>
                )}
            </View>

            {/* Stepper Dots for Challenge Progression */}
            {activeChallenges.length > 1 && (
                <View style={styles.stepperContainer}>
                    {activeChallenges.map((challenge, index) => {
                        const isCompleted = index < currentChallenge;
                        const isActive = index === currentChallenge;
                        return (
                            <View key={challenge.id} style={styles.stepIndicatorWrapper}>
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
                                    {challenge.label}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            )}
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
    faceRing: {
        width: '65%',
        aspectRatio: 1,
        borderRadius: 999,
        borderWidth: 4,
        borderColor: colors.secondary,
        borderStyle: 'dashed',
    },
    challengeSuccessOverlay: {
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
    verifyingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    verifyingText: {
        ...typography.h3,
        color: colors.text,
        marginTop: spacing.sm,
    },
    verifyingSubtext: {
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
    matchCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    locationText: {
        ...typography.body,
        color: colors.textSecondary,
        marginLeft: spacing.sm,
        flex: 1,
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
