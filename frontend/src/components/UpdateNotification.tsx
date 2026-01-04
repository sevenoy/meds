import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export default function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      });

      // 定期检查更新（每分钟）
      const checkInterval = setInterval(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        registration?.update();
      }, 60000);

      return () => clearInterval(checkInterval);
    }
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">新版本可用</p>
          <p className="text-sm opacity-90">点击更新以获取最新功能</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdate}
            className="flex items-center gap-1 px-3 py-1 bg-white text-blue-500 rounded hover:bg-gray-100 transition-colors text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            className="text-white hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

