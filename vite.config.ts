import path from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 读取版本号（单一来源）
const versionFileContent = readFileSync('./src/config/version.ts', 'utf-8');
const versionMatch = versionFileContent.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  throw new Error('无法从 src/config/version.ts 读取 APP_VERSION');
}
const APP_VERSION = versionMatch[1];
console.log('📦 构建版本:', APP_VERSION);

// 自定义插件：替换 HTML 和 SW 中的版本号占位符
function versionInjection(): Plugin {
  return {
    name: 'version-injection',
    transformIndexHtml(html) {
      return html.replace(/__APP_VERSION__/g, `"${APP_VERSION}"`);
    },
    writeBundle() {
      // 在文件写入后处理 sw.js
      // 使用 setTimeout 确保 Vite 已完成 public 目录的复制
      setTimeout(() => {
        const swPath = path.resolve(__dirname, 'dist/sw.js');
        try {
          // 检查文件是否存在
          if (!existsSync(swPath)) {
            // 如果 dist/sw.js 不存在，尝试从 public/sw.js 复制
            const publicSwPath = path.resolve(__dirname, 'public/sw.js');
            if (existsSync(publicSwPath)) {
              // 复制文件
              const swContent = readFileSync(publicSwPath, 'utf-8');
              // 替换版本号占位符
              const updatedContent = swContent.replace(/__APP_VERSION__/g, `'${APP_VERSION}'`);
              // 确保 dist 目录存在
              const distDir = path.dirname(swPath);
              if (!existsSync(distDir)) {
                mkdirSync(distDir, { recursive: true });
              }
              writeFileSync(swPath, updatedContent, 'utf-8');
              console.log(`✅ 已复制并注入 SW 版本号: ${APP_VERSION}`);
            } else {
              console.warn('⚠️ public/sw.js 不存在，跳过 SW 版本号注入');
            }
            return;
          }
          // 文件存在，直接更新版本号
          let swContent = readFileSync(swPath, 'utf-8');
          swContent = swContent.replace(/__APP_VERSION__/g, `'${APP_VERSION}'`);
          writeFileSync(swPath, swContent, 'utf-8');
          console.log(`✅ 已注入 SW 版本号: ${APP_VERSION}`);
        } catch (error) {
          console.warn('⚠️ 无法处理 sw.js:', error);
        }
      }, 100);
    }
  };
}

export default defineConfig({
    base: '/meds/',
    server: {
      port: 5173,
      host: 'localhost',
    },
    plugins: [
      react(),
      versionInjection()
    ],
    define: {
      '__APP_VERSION__': JSON.stringify(APP_VERSION),
      'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
});

