// ====================================
// 药品管理系统 - 浏览器缓存清除脚本
// 在浏览器控制台执行此脚本
// ====================================

(async () => {
  console.log('🧹 开始清理所有缓存...');
  
  // 1. 注销所有 Service Worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
      console.log('✅ Service Worker 已注销:', reg.scope);
    }
  }
  
  // 2. 清除所有 Cache Storage
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      await caches.delete(name);
      console.log('✅ Cache 已删除:', name);
    }
  }
  
  // 3. 清除 localStorage
  localStorage.clear();
  console.log('✅ localStorage 已清除');
  
  // 4. 清除 sessionStorage
  sessionStorage.clear();
  console.log('✅ sessionStorage 已清除');
  
  // 5. 删除所有 IndexedDB
  if (window.indexedDB) {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      indexedDB.deleteDatabase(db.name);
      console.log('✅ IndexedDB 已删除:', db.name);
    }
  }
  
  console.log('🎉 所有缓存已清除!');
  console.log('⚠️ 3秒后将自动刷新页面...');
  
  setTimeout(() => {
    window.location.reload(true);
  }, 3000);
})();

