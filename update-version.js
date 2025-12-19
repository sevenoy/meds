#!/usr/bin/env node

/**
 * 版本更新脚本
 * 
 * 版本号规则：V + 年月日（6位） + . + 总更新次数
 * 示例：V251219.1, V251219.2
 * 
 * 用法：node update-version.js "更新说明"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取新版本号
function getNewVersion() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;
  
  // 读取 update-log.json 统计总版本数
  const updateLogPath = path.join(__dirname, 'update-log.json');
  let totalUpdates = 0;
  
  if (fs.existsSync(updateLogPath)) {
    const updateLogContent = fs.readFileSync(updateLogPath, 'utf8');
    const updateLog = JSON.parse(updateLogContent);
    totalUpdates = Object.keys(updateLog).length;
  }
  
  return `V${datePart}.${totalUpdates + 1}`;
}

// 更新文件中的版本号
function updateVersionInFile(filePath, oldVersion, newVersion) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;
  
  // 匹配不同的版本号格式
  const patterns = [
    /const APP_VERSION = ['"]([^'"]+)['"]/g,
    /const VERSION = ['"]([^'"]+)['"]/g,
    /"version":\s*['"]([^'"]+)['"]/g,
  ];
  
  patterns.forEach(pattern => {
    if (content.match(pattern)) {
      content = content.replace(pattern, (match) => {
        return match.replace(oldVersion || /V\d{6}\.\d+/, newVersion);
      });
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已更新: ${filePath}`);
    return true;
  }
  
  return false;
}

// 更新 update-log.json
function updateLog(version, message) {
  const updateLogPath = path.join(__dirname, 'update-log.json');
  let updateLog = {};
  
  if (fs.existsSync(updateLogPath)) {
    const content = fs.readFileSync(updateLogPath, 'utf8');
    updateLog = JSON.parse(content);
  }
  
  // 添加新版本条目
  updateLog[version] = {
    title: `版本更新 ${version}`,
    date: new Date().toISOString(),
    content: Array.isArray(message) ? message : [message]
  };
  
  fs.writeFileSync(
    updateLogPath,
    JSON.stringify(updateLog, null, 2),
    'utf8'
  );
  
  console.log(`✅ 已更新: update-log.json`);
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const updateMessage = args[0] || '常规更新和优化';
  
  console.log('🚀 开始更新版本号...\n');
  
  // 生成新版本号
  const newVersion = getNewVersion();
  console.log(`📦 新版本号: ${newVersion}\n`);
  
  // 需要更新的文件列表
  const filesToUpdate = [
    'index.html',
    'public/sw.js',
    'public/manifest.json'
  ];
  
  // 更新每个文件
  let updateCount = 0;
  filesToUpdate.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (updateVersionInFile(filePath, null, newVersion)) {
      updateCount++;
    }
  });
  
  // 更新 update-log.json
  updateLog(newVersion, updateMessage);
  
  console.log(`\n✨ 版本更新完成！`);
  console.log(`📝 更新说明: ${updateMessage}`);
  console.log(`📊 共更新 ${updateCount + 1} 个文件\n`);
  console.log(`💡 提示：请运行以下命令提交更改：`);
  console.log(`   npm run build`);
  console.log(`   git add .`);
  console.log(`   git commit -m "chore: 更新版本到 ${newVersion}"`);
  console.log(`   git push\n`);
}

main();
