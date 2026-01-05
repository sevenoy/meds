/**
 * Service Worker 注册
 * 使用 import.meta.env.BASE_URL 确保正确的部署路径
 */

import { APP_VERSION } from './config/version';

const FORCE_UPDATE_KEY = `pwa_force_update_done_${APP_VERSION}`;
const FORCE_UPDATE_IN_FLIGHT_KEY = `pwa_force_update_in_flight_${APP_VERSION}`;

async function getRegistrationSafe(): Promise<ServiceWorkerRegistration | null> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    // 尽量使用同 scope 的 registration
    const reg = await navigator.serviceWorker.getRegistration(base);
    if (reg) return reg;
  } catch {
    // ignore
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg || null;
  } catch {
    return null;
  }
}

async function postMessageAll(reg: ServiceWorkerRegistration, msg: any): Promise<void> {
  try {
    reg.active?.postMessage(msg);
  } catch {
    // ignore
  }
  try {
    reg.waiting?.postMessage(msg);
  } catch {
    // ignore
  }
  try {
    reg.installing?.postMessage(msg);
  } catch {
    // ignore
  }
}

/**
 * 【关键增强】每台设备在“首次登录此版本”时，强制更新一次 PWA/SW，并自动刷新页面。
 * 目的：避免用户无法同时清理多设备缓存，导致继续运行旧代码。
 *
 * 注意：如果你发布了新代码但没变更 APP_VERSION，任何强制更新都无法可靠拿到新资源。
 */
export async function forcePwaUpdateOncePerVersion(reason: 'login' | 'manual' = 'login'): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sw-register.ts:forcePwaUpdate:entry',message:'forcePwaUpdateOncePerVersion called',data:{version:APP_VERSION,alreadyDone:localStorage.getItem(FORCE_UPDATE_KEY)||'null',inFlight:sessionStorage.getItem(FORCE_UPDATE_IN_FLIGHT_KEY)||'null',reason:reason},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B3'})}).catch(()=>{});
  // #endregion

  // 已完成则跳过
  if (localStorage.getItem(FORCE_UPDATE_KEY) === 'true') return;

  // 避免死循环：同一页面生命周期只做一次
  if (sessionStorage.getItem(FORCE_UPDATE_IN_FLIGHT_KEY) === 'true') return;
  sessionStorage.setItem(FORCE_UPDATE_IN_FLIGHT_KEY, 'true');

  const reg = await getRegistrationSafe();
  if (!reg) {
    // 没有 SW，也就不用强制更新
    localStorage.setItem(FORCE_UPDATE_KEY, 'true');
    return;
  }

  console.warn('🧨 [PWA] 首次登录触发强制更新', { version: APP_VERSION, reason });

  // 等待 controller 切换后刷新
  const controllerChangePromise = new Promise<void>((resolve) => {
    const onChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
  });

  // 主动检查更新
  try {
    await reg.update();
  } catch (e) {
    console.warn('⚠️ [PWA] registration.update() 失败:', e);
  }

  // 清缓存 + 让 waiting 立即接管（若存在）
  await postMessageAll(reg, { type: 'CLEAR_CACHE' });
  await postMessageAll(reg, { type: 'SKIP_WAITING' });

  // 兜底：如果没有 controllerchange，也在短时间后刷新一次
  await Promise.race([
    controllerChangePromise,
    new Promise<void>((resolve) => setTimeout(resolve, 2500))
  ]);

  // 标记完成，避免反复刷新
  localStorage.setItem(FORCE_UPDATE_KEY, 'true');
  sessionStorage.removeItem(FORCE_UPDATE_IN_FLIGHT_KEY);

  // 刷新以确保 index.html / assets 全部切到新缓存/新 SW
  window.location.reload();
}

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

        // 暴露给其他模块（比如登录后强制更新）
        (window as any).__swRegistration = registration;

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
