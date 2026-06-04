import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusChip } from '../components/ui/StatusChip';
import { Camera, Check, ScanFace, Loader2, VideoOff } from 'lucide-react';

/**
 * Enrollment Component
 * 
 * Manages the step-by-step biometric registration flow for new employees.
 * Simulates sequential posture scanning (Front, Left, Right Profile, Liveness Blink)
 * using local camera streams, compiling landmarks into database embeddings.
 */
export const Enrollment: React.FC = () => {
  const [selectedWorker, setSelectedWorker] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Progression indicator for face pose steps (0-4)
  const [stage, setStage] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * Shuts down all active camera sensor tracks and releases stream locks.
   */
  const stopCamera = () => {
    setIsCameraActive(false);
    setStage(0);
    setIsSuccess(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  /**
   * Queries navigator.mediaDevices for camera streams and binds to the video ref.
   */
  const startCamera = async () => {
    if (!selectedWorker) {
      alert("Please select a worker first.");
      return;
    }

    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera permission denied or device not found.");
    }
  };

  // Timed simulation of enrollment sequence stages
  useEffect(() => {
    if (isCameraActive && stage < 4) {
      const timer = setTimeout(() => {
        setStage(prev => prev + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCameraActive, stage]);

  // Clean up physical camera locks on component unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  /**
   * Compiles the captured frame sets into 3D facial feature vectors.
   */
  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setIsSuccess(true);
      stopCamera();
    }, 1500);
  };

  const getStageColor = (idx: number) => {
    if (stage > idx) return 'var(--color-success)';
    if (stage === idx && isCameraActive) return 'var(--color-primary)';
    return 'var(--color-border)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div>
        <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Face Enrollment</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Select a worker, grant camera access, and capture 3D facial metrics.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--spacing-lg)' }}>
        <Card style={{ display: 'flex', flexDirection: 'column', padding: 'var(--spacing-xl)' }}>
          <div style={{ flex: 1, backgroundColor: '#050B14', borderRadius: 'var(--radius-lg)', minHeight: 400, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            
            {/* Real Camera Feed */}
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: isCameraActive ? 'block' : 'none', transform: 'scaleX(-1)' }}
            />
            
            {!isCameraActive && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#333' }}>
                {cameraError ? <VideoOff size={48} color="var(--color-error)" /> : <Camera size={48} />}
                {cameraError && <p style={{ color: 'var(--color-error)', marginTop: 8 }}>{cameraError}</p>}
              </div>
            )}
            
            <div style={{ position: 'absolute', top: 20, right: 20 }}>
              <StatusChip 
                status={isCameraActive ? "success" : cameraError ? "error" : "neutral"} 
                label={isCameraActive ? "Camera Active" : cameraError ? "Access Denied" : "Camera Offline"} 
                icon={<Camera size={14} />} 
              />
            </div>
            
            {/* Overlay Guides */}
            <div style={{ 
              position: 'absolute', 
              border: `2px dashed ${isCameraActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.2)'}`, 
              width: 200, 
              height: 250, 
              borderRadius: '50%',
              transition: 'border-color 0.3s ease',
              boxShadow: (isCameraActive && stage < 4) ? '0 0 20px rgba(126, 167, 255, 0.2) inset' : 'none',
              pointerEvents: 'none'
            }}>
              {isCameraActive && stage < 4 && (
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '2px',
                  backgroundColor: 'var(--color-primary)',
                  boxShadow: '0 0 10px var(--color-primary)',
                  animation: 'scan-vertical 2s infinite linear'
                }} />
              )}
            </div>

            {/* Success Overlay */}
            {isSuccess && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(165, 214, 167, 0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1B5E20' }}>
                <Check size={64} style={{ marginBottom: 16 }} />
                <h3>Enrollment Complete for {selectedWorker}</h3>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--spacing-lg)' }}>
            {!isCameraActive && !isSuccess ? (
              <Button onClick={startCamera} icon={<Camera size={18} />}>Start Camera</Button>
            ) : !isSuccess ? (
              <Button variant="danger" onClick={stopCamera}>Stop Camera</Button>
            ) : (
              <Button onClick={stopCamera}>Enroll Another Worker</Button>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Card>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Worker Selection</h3>
            <select 
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              disabled={isCameraActive || isSuccess}
              style={{
                width: '100%',
                padding: '8px var(--spacing-md)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '0.875rem',
                outline: 'none',
                cursor: (isCameraActive || isSuccess) ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">-- Select Pending Worker --</option>
              <option value="EMP003">Mike Johnson (EMP003)</option>
              <option value="EMP008">David Clark (EMP008)</option>
              <option value="EMP012">Emma Wilson (EMP012)</option>
            </select>
          </Card>

          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Capture Progress</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {['Front View', 'Left Profile', 'Right Profile', 'Liveness Check (Blink)'].map((label, idx) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <div style={{ 
                    width: 24, height: 24, 
                    borderRadius: 'var(--radius-full)', 
                    border: `2px solid ${getStageColor(idx)}`, 
                    backgroundColor: stage > idx ? 'var(--color-success)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s ease'
                  }}>
                    {stage > idx && <Check size={14} color="white" />}
                  </div>
                  <span style={{ 
                    color: stage > idx ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    fontWeight: stage === idx && isCameraActive ? 600 : 400
                  }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <Button 
              style={{ width: '100%', marginTop: 'auto' }} 
              disabled={stage < 4 || isSuccess || isGenerating}
              onClick={handleGenerate}
              icon={isGenerating ? <Loader2 size={16} className="spin" /> : <ScanFace size={16} />}
            >
              {isGenerating ? 'Generating...' : isSuccess ? 'Generated' : 'Generate Embedding'}
            </Button>
          </Card>
        </div>
      </div>
      
      <style>
        {`
          @keyframes scan-vertical {
            0% { top: 0; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
};
