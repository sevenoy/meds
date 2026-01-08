import { logger } from './logger';
import { logger } from './logger';
import { logger } from './logger';
import { logger } from './logger';
/**
 * 网络连接检测工具
 */

/**
 * 检测 Supabase 是否可访问
 */
export async function checkSupabaseConnection(url: string): Promise<{
  accessible: boolean;
  error?: string;
  latency?: number;
}> {
  const startTime = Date.now();
  
  try {
    // 尝试访问 Supabase REST API
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5秒超时
    });
    
    const latency = Date.now() - startTime;
    
    return {
      accessible: response.ok || response.status === 401, // 401 也说明服务可达
      latency,
    };
  } catch (error: any) {
    return {
      accessible: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * 显示网络问题提示
 */
export function showNetworkErrorNotification(error: string) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-500 text-white px-6 py-4 rounded-2xl font-bold text-sm shadow-2xl max-w-md';
  notification.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="text-2xl">⚠️</div>
      <div>
        <div class="font-black mb-1">无法连接到服务器</div>
        <div class="text-xs font-normal opacity-90">
          ${error.includes('NAME_NOT_RESOLVED') || error.includes('Failed to fetch') 
            ? '网络连接失败，可能原因：<br/>• DNS 解析失败<br/>• 网络限制（需要 VPN）<br/>• 防火墙阻止'
            : error
          }
        </div>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
          class="mt-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs transition-all">
          知道了
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // 30秒后自动移除
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 30000);
}

/**
 * 在应用启动时检测网络
 */
export async function performNetworkCheck(supabaseUrl: string): Promise<boolean> {
  logger.log('🔍 检测 Supabase 连接...');
  
  const result = await checkSupabaseConnection(supabaseUrl);
  
  if (result.accessible) {
    logger.log(`✅ Supabase 可访问 (延迟: ${result.latency}ms)`);
    return true;
  } else {
    console.error('❌ Supabase 不可访问:', result.error);
    
    // 显示友好提示
    showNetworkErrorNotification(result.error || 'Unknown error');
    
    return false;
  }
}



