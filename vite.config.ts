import path from 'path';
import { readFileSync, writeFileSync } from 'fs';
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
    closeBundle() {
      // 构建完成后，替换 dist/sw.js 中的版本号占位符
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      try {
        let swContent = readFileSync(swPath, 'utf-8');
        swContent = swContent.replace(/__APP_VERSION__/g, `'${APP_VERSION}'`);
        writeFileSync(swPath, swContent, 'utf-8');
        console.log(`✅ 已注入 SW 版本号: ${APP_VERSION}`);
      } catch (error) {
        console.warn('⚠️ 无法处理 sw.js:', error);
      }
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

