import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Image as ImageIcon, Keyboard, RefreshCw, X, Zap } from 'lucide-react';
import jsQR from 'jsqr';
import { Language } from '../types';
import { t } from '../i18n/translations';

interface Props {
  lang: Language;
  title: string;
  subtitle?: string;
  onCaptured: (imageDataUrl: string, autoDetectedCode?: string) => void;
  onManualInput: () => void;
  onClose: () => void;
}

export const CameraViewfinder: React.FC<Props> = ({
  lang,
  title,
  subtitle,
  onCaptured,
  onManualInput,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [trackRef, setTrackRef] = useState<MediaStreamTrack | null>(null);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported on this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreamActive(true);
        const track = stream.getVideoTracks()[0];
        setTrackRef(track || null);
      }
    } catch (err: any) {
      console.warn('Camera stream could not start:', err);
      setCameraError(err.message || 'Camera permission denied or camera unavailable');
      setStreamActive(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      // Clean up camera streams on unmount
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // Toggle flashlight / torch if supported by device
  const toggleTorch = async () => {
    if (trackRef && 'applyConstraints' in trackRef) {
      try {
        const nextState = !torchOn;
        await (trackRef as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn('Torch constraint not supported', e);
      }
    }
  };

  // Decode barcode/QR from image data using BarcodeDetector if available, fallback to jsQR
  const tryDecodeBarcodeOrQR = async (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    imageElementOrCanvas: HTMLCanvasElement | HTMLImageElement
  ): Promise<string | undefined> => {
    // 1. Try native BarcodeDetector API (modern Android Chrome)
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'data_matrix', 'ean_13', 'upc_a']
        });
        const barcodes = await barcodeDetector.detect(imageElementOrCanvas);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          const raw = barcodes[0].rawValue.trim();
          const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          if (clean) return clean;
        }
      } catch (err) {
        console.debug('Native BarcodeDetector pass failed, continuing to jsQR', err);
      }
    }

    // 2. Fallback to jsQR
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (code && code.data) {
        const clean = code.data.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (clean) return clean;
      }
    } catch (err) {
      console.debug('jsQR pass failed:', err);
    }

    return undefined;
  };

  // Capture current video frame
  const takeSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    setIsProcessing(true);

    try {
      if (navigator.vibrate) navigator.vibrate(50);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.drawImage(video, 0, 0, width, height);

      // Attempt client-side QR/barcode decoding
      const detectedCode = await tryDecodeBarcodeOrQR(ctx, width, height, canvas);

      // Compress to high quality JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      onCaptured(dataUrl, detectedCode);
    } catch (error) {
      console.error('Error capturing snapshot:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle image selected from phone Gallery
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setIsProcessing(false);
        return;
      }

      // Render onto canvas to inspect for QR code
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = canvasRef.current || document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          let detectedCode: string | undefined = undefined;
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            detectedCode = await tryDecodeBarcodeOrQR(ctx, img.width, img.height, img);
          }
          onCaptured(dataUrl, detectedCode);
        } catch {
          onCaptured(dataUrl);
        } finally {
          setIsProcessing(false);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide">{title}</h2>
          {subtitle && <p className="text-xs text-sky-400 font-medium">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {trackRef && (
            <button
              onClick={toggleTorch}
              className={`p-2.5 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center transition ${
                torchOn ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300'
              }`}
              title="Torch / Flashlight"
            >
              <Zap className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-200 transition"
            title={t('close', lang)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Viewfinder Area */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        {streamActive && !cameraError ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Framing Guide Box with corner brackets */}
            <div className="relative pointer-events-none w-[80%] max-w-[340px] aspect-[4/3] border-2 border-sky-400/80 rounded-2xl shadow-2xl flex flex-col justify-between p-3">
              {/* Animated scanning line */}
              <div className="w-full h-0.5 bg-sky-400 shadow-[0_0_12px_#38bdf8] animate-pulse" />
              
              <div className="flex justify-between items-center text-[11px] text-sky-300 font-bold bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm self-center">
                <span>{lang === 'hi' ? 'गेज / शोल्डर को फ्रेम में रखें' : 'Align Gauge / Shoulder Inside'}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm">
            <Camera className="w-16 h-16 text-slate-500 mb-4 animate-bounce" />
            <h3 className="text-lg font-bold text-slate-200 mb-2">
              {cameraError ? (lang === 'hi' ? 'कैमरा उपलब्ध नहीं है' : 'Camera Unavailable') : (lang === 'hi' ? 'कैमरा शुरू हो रहा है...' : 'Starting Camera...')}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              {cameraError || (lang === 'hi' ? 'कृपया कैमरा अनुमति दें या गैलरी / टाइपिंग का उपयोग करें।' : 'Please allow camera access or choose Gallery or Type instead.')}
            </p>
            {cameraError && (
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 font-semibold text-sm transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{lang === 'hi' ? 'पुनः प्रयास करें' : 'Retry Camera'}</span>
              </button>
            )}
          </div>
        )}

        {/* Hidden Canvas for capture & analysis */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Bottom Action Bar: Minimum touch targets 56px+ */}
      <div className="px-4 py-5 bg-black/90 border-t border-slate-800 flex items-center justify-around gap-2 z-10 safe-area-bottom">
        {/* Gallery Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex-1 flex flex-col items-center justify-center gap-1.5 min-h-[56px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-slate-200 transition cursor-pointer touch-manipulation"
        >
          <ImageIcon className="w-6 h-6 text-sky-400" />
          <span className="text-xs font-semibold">{t('gallery', lang)}</span>
        </button>

        {/* Big Shutter Button: 68px minimum */}
        <button
          onClick={takeSnapshot}
          disabled={!streamActive || isProcessing}
          className="flex flex-col items-center justify-center min-w-[72px] min-h-[72px] rounded-full bg-white text-slate-950 shadow-xl border-4 border-sky-400 active:scale-95 disabled:opacity-40 transition cursor-pointer touch-manipulation mx-2"
          title={t('take_photo', lang)}
        >
          <div className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center">
            {isProcessing ? (
              <RefreshCw className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </div>
        </button>

        {/* Type Instead Button */}
        <button
          onClick={onManualInput}
          disabled={isProcessing}
          className="flex-1 flex flex-col items-center justify-center gap-1.5 min-h-[56px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-slate-200 transition cursor-pointer touch-manipulation"
        >
          <Keyboard className="w-6 h-6 text-amber-400" />
          <span className="text-xs font-semibold">{t('type_instead', lang)}</span>
        </button>
      </div>
    </div>
  );
};
