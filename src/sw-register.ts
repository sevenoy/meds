/**
 * Service Worker 注册
 * 使用 import.meta.env.BASE_URL 确保正确的部署路径
 */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    const swUrl = `${base}sw.js`;

    navigator.serviceWorker
      .register(swUrl, { scope: base })
      .then(registration => {
        console.log('✅ Service Worker 注册成功:', swUrl);
      })
      .catch(error => {
        console.error('❌ Service Worker 注册失败:', error);
      });
  });
}
