#!/usr/bin/env node

/**
 * 构建并自动推送到 GitHub
 * 用法: node build-and-push.mjs
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'inherit', ...options });
  } catch (error) {
    log(`❌ 命令执行失败: ${command}`, 'red');
    throw error;
  }
}

async function main() {
  try {
    log('\n🚀 开始构建项目...\n', 'blue');

    // 1. 构建项目
    log('📦 运行构建...', 'blue');
    exec('npm run build');
    log('✅ 构建完成\n', 'green');

    // 2. 检查构建产物
    const distPath = join(process.cwd(), 'dist');
    if (!existsSync(distPath)) {
      log('❌ 错误: dist 目录不存在', 'red');
      process.exit(1);
    }

    // 3. 检查 Git 状态
    log('📝 检查 Git 状态...', 'blue');
    let hasUncommitted = false;
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      hasUncommitted = status.trim().length > 0;
    } catch (e) {
      // Git 可能未初始化
    }

    // 4. 如果有未提交的更改，先提交
    if (hasUncommitted) {
      log('📝 检测到未提交的更改，先提交代码...', 'yellow');
      try {
        exec('git add -A');
        exec('git commit -m "chore: 构建前提交更改"');
      } catch (e) {
        // 可能没有需要提交的内容
      }
    }

    // 5. 添加构建产物
    log('📦 添加构建产物到 Git...', 'blue');
    exec('git add dist/');

    // 6. 检查是否有需要提交的内容
    let hasStaged = false;
    try {
      const diff = execSync('git diff --staged --name-only', { encoding: 'utf8' });
      hasStaged = diff.trim().length > 0;
    } catch (e) {
      // 可能没有暂存的文件
    }

    if (!hasStaged) {
      log('ℹ️  没有新的构建产物需要提交', 'yellow');
      return;
    }

    // 7. 提交构建产物
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const commitMsg = `chore: 自动构建产物 - ${dateStr}`;
    log(`💾 提交构建产物: ${commitMsg}`, 'blue');
    exec(`git commit -m "${commitMsg}"`);

    // 8. 推送到 GitHub
    log('🚀 推送到 GitHub...', 'blue');
    exec('git push origin main');

    log('\n✅ 构建产物已推送到 GitHub', 'green');
    log('🎉 完成！\n', 'green');

  } catch (error) {
    log(`\n❌ 错误: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();

