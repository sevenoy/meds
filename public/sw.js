/**
 * Service Worker - 缓存管理和版本更新
 */

const VERSION = 'V251219.17';
const CACHE_NAME = `meds-cache-${VERSION}`;

// 需要缓存的关键资源
const CRITICAL_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json'
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
  console.log(`[SW] 安装 Service Worker ${VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 预缓存关键资源');
      return cache.addAll(CRITICAL_RESOURCES).catch((err) => {
        console.warn('[SW] 预缓存失败:', err);
      });
    })
  );
  
  // 强制跳过等待，立即激活新版本
  self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  console.log(`[SW] 激活 Service Worker ${VERSION}`);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW] 清理旧缓存: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // 立即控制所有客户端
  return self.clients.claim();
});

// 处理请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }
  
  // HTML文件和关键资源：网络优先，失败时使用缓存
  if (
    request.destination === 'document' ||
    request.url.includes('.html') ||
    request.url.includes('.json') ||
    request.url.includes('.js') ||
    request.url.includes('.css')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功获取网络资源，更新缓存
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败，使用缓存
          return caches.match(request);
        })
    );
  } else {
    // 其他资源（图片、字体等）：缓存优先
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
  }
});

// 监听消息（增强版本）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] 收到 SKIP_WAITING 消息，立即跳过等待');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] 收到 CLEAR_CACHE 消息，清除所有缓存');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log(`[SW] 清除缓存: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
  
  // 响应版本查询
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION_INFO',
      version: VERSION,
      cacheName: CACHE_NAME
    });
  }
});

