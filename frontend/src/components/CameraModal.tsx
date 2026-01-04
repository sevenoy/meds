import { useState, useRef, useEffect } from 'react';
import { X, Camera, Check } from 'lucide-react';
import { extractExifTime } from '../utils/exif';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string, takenAt: Date, timeSource: 'exif' | 'system' | 'manual') => void;
  medicationName?: string;
}

export default function CameraModal({
  isOpen,
  onClose,
  onCapture,
  medicationName
}: CameraModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [takenAt, setTakenAt] = useState<Date>(new Date());
  const [timeSource, setTimeSource] = useState<'exif' | 'system' | 'manual'>('system');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('无法访问摄像头:', error);
      alert('无法访问摄像头，请检查权限设置');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);

      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImageData(imageDataUrl);

      // 尝试从 Canvas 提取 EXIF 时间
      // 注意：Canvas 无法直接提取 EXIF，需要从原始文件
      // 这里先使用系统时间，后续可以从文件上传中提取
      setTakenAt(new Date());
      setTimeSource('system');
    } catch (error) {
      console.error('拍照失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (imageData) {
      onCapture(imageData, takenAt, timeSource);
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setImageData(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">
            {medicationName ? `记录 ${medicationName}` : '拍照记录'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!imageData ? (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <button
              onClick={capturePhoto}
              disabled={loading || !stream}
              className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              {loading ? '处理中...' : '拍照'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <img
              src={imageData}
              alt="拍摄的照片"
              className="w-full rounded-lg"
            />
            <div className="text-sm text-gray-600">
              <p>拍摄时间: {takenAt.toLocaleString('zh-CN')}</p>
              <p>时间来源: {timeSource === 'exif' ? 'EXIF' : timeSource === 'system' ? '系统时间' : '手动输入'}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setImageData(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                重拍
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-black text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                确认
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

