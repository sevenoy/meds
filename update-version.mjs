#!/usr/bin/env node

/**
 * 自动更新版本号工具
 * 用法: node update-version.mjs
 * 或者: npm run update-version
 */

import fs from 'fs';
import { execSync } from 'child_process';
import readline from 'readline';

const VERSION_FILE = 'src/config/version.ts';

// 颜色输出
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

// 创建询问接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    log('\n🔄 自动更新版本号工具\n', 'blue');

    // 检查版本文件是否存在
    if (!fs.existsSync(VERSION_FILE)) {
      log(`❌ 版本文件不存在: ${VERSION_FILE}`, 'red');
      process.exit(1);
    }

    // 读取当前版本号
    const content = fs.readFileSync(VERSION_FILE, 'utf8');
    const match = content.match(/APP_VERSION = '(.+)'/);
    
    if (!match) {
      log('❌ 无法解析当前版本号', 'red');
      process.exit(1);
    }

    const currentVersion = match[1];
    log(`📌 当前版本: ${currentVersion}`, 'blue');

    // 生成新版本号 (基于日期)
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const newDate = `${year}${month}${day}`;

    let newVersion;
    if (currentVersion.startsWith(`V${newDate}.`)) {
      // 同一天，递增序号
      const currentSeq = parseInt(currentVersion.split('.')[1]);
      const newSeq = String(currentSeq + 1).padStart(2, '0');
      newVersion = `V${newDate}.${newSeq}`;
    } else {
      // 新的一天，从01开始
      newVersion = `V${newDate}.01`;
    }

    log(`✨ 新版本号: ${newVersion}\n`, 'green');

    // 询问确认
    const confirm = await question('是否更新版本号? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      log('\n❌ 已取消', 'yellow');
      rl.close();
      return;
    }

    // 更新版本号文件
    const newContent = content.replace(
      /APP_VERSION = '.+'/,
      `APP_VERSION = '${newVersion}'`
    );
    fs.writeFileSync(VERSION_FILE, newContent, 'utf8');

    log(`\n✅ 版本号已更新为: ${newVersion}`, 'green');

    // 显示修改内容
    try {
      log('\n📝 修改内容:', 'blue');
      const diff = execSync(`git diff ${VERSION_FILE}`, { encoding: 'utf8' });
      console.log(diff);
    } catch (e) {
      // Git 可能未安装或未初始化
    }

    // 询问是否提交
    const commitConfirm = await question('\n是否提交到 Git? (y/n): ');
    if (commitConfirm.toLowerCase() === 'y') {
      try {
        execSync(`git add ${VERSION_FILE}`, { encoding: 'utf8' });
        execSync(`git commit -m "🔖 更新版本号到 ${newVersion}"`, { encoding: 'utf8' });
        log('\n✅ 已提交到 Git', 'green');

        // 询问是否推送
        const pushConfirm = await question('\n是否推送到远程仓库? (y/n): ');
        if (pushConfirm.toLowerCase() === 'y') {
          execSync('git push', { encoding: 'utf8', stdio: 'inherit' });
          log('\n✅ 已推送到远程仓库', 'green');
        }
      } catch (e) {
        log(`\n⚠️  Git 操作失败: ${e.message}`, 'yellow');
      }
    }

    log('\n🎉 版本更新完成!', 'green');
    log(`📌 新版本: ${newVersion}\n`, 'blue');

  } catch (error) {
    log(`\n❌ 错误: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();

