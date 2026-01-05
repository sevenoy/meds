/**
 * Service Worker 注册
 * 使用 import.meta.env.BASE_URL 确保正确的部署路径
 */

import { APP_VERSION } from './config/version';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    // 关键修复：给 sw.js 加版本参数，强制浏览器/Service Worker 更新脚本
    // 否则会出现 “页面版本已更新，但 SW 仍旧是 V260103.01” 的情况，导致一直运行旧代码
    const swUrl = `${base}sw.js?v=${encodeURIComponent(APP_VERSION)}`;

    navigator.serviceWorker
      .register(swUrl, {
        scope: base,
        // Chromium 支持：绕过 HTTP cache 来更新 SW 脚本
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        updateViaCache: 'none'
      })
      .then(async (registration) => {
        console.log('✅ Service Worker 注册成功:', swUrl);

        // 立即触发一次更新检查，避免等浏览器的 24h 周期
        try {
          await registration.update();
        } catch (e) {
          console.warn('⚠️ Service Worker update() 失败:', e);
        }

        // 运行时证据：检查当前控制中的 SW 版本，如果和 APP_VERSION 不一致，自动清理
        // 通过 sw.js 的 GET_VERSION 消息获取其 VERSION 常量
        const controller = navigator.serviceWorker.controller;
        if (controller) {
          const channel = new MessageChannel();
          const versionInfo = await new Promise<{ version?: string }>((resolve) => {
            const timeout = setTimeout(() => resolve({}), 1200);
            channel.port1.onmessage = (event) => {
              clearTimeout(timeout);
              resolve(event.data || {});
            };
            controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
          });

          const swVersion = versionInfo?.version;
          console.log('🔎 SW 版本检查', { appVersion: APP_VERSION, swVersion, swScriptURL: controller.scriptURL });

          if (swVersion && swVersion !== APP_VERSION) {
            console.warn('🧨 检测到 SW 版本与 App 不一致，执行自动清理并重载', {
              appVersion: APP_VERSION,
              swVersion
            });

            // 清理 caches + 注销所有 SW，然后刷新
            try {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
            } catch (e) {
              console.warn('⚠️ 注销 Service Worker 失败:', e);
            }

            try {
              if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map((n) => caches.delete(n)));
              }
            } catch (e) {
              console.warn('⚠️ 清除 caches 失败:', e);
            }

            // 避免死循环：只自动重载一次
            if (!sessionStorage.getItem('sw_hard_reset_done')) {
              sessionStorage.setItem('sw_hard_reset_done', 'true');
              window.location.reload();
            }
          }
        }

        // 监听更新事件，派发给 UpdateNotification 使用
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(
                new CustomEvent('sw-update-available', { detail: { registration } })
              );
            }
          });
        });
      })
      .catch(error => {
        console.error('❌ Service Worker 注册失败:', error);
      });
  });
}
