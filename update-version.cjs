#!/usr/bin/env node

/**
 * 版本更新脚本（基于技术文档）
 * 
 * 功能：
 * 1. 自动统计 update-log.json 中的总版本数
 * 2. 生成新版本号：V + YYMMDD + . + TotalCount
 * 3. 更新所有文件中的版本号
 * 
 * 使用方法：
 * node update-version.js          # 自动计算版本号
 * node update-version.js V251219.9   # 手动指定版本号
 */

const fs = require('fs');
const path = require('path');

/**
 * 统计 update-log.json 中的总版本数
 */
function countTotalVersions() {
  const logPath = path.join(__dirname, 'public', 'update-log.json');
  
  if (!fs.existsSync(logPath)) {
    console.log('⚠️  update-log.json 不存在，返回版本数 0');
    return 0;
  }
  
  try {
    const logContent = fs.readFileSync(logPath, 'utf8');
    const updateLog = JSON.parse(logContent);
    const versionCount = Object.keys(updateLog).length;
    
    console.log(`📊 当前版本总数: ${versionCount}`);
    return versionCount;
  } catch (err) {
    console.error('❌ 读取 update-log.json 失败:', err.message);
    return 0;
  }
}

/**
 * 获取新版本号
 */
function getNewVersion() {
  const args = process.argv.slice(2);
  
  // 如果手动指定版本号
  if (args.length > 0) {
    const manualVersion = args[0];
    console.log(`🔢 使用手动指定的版本号: ${manualVersion}`);
    return manualVersion;
  }
  
  // 自动计算版本号
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const totalVersions = countTotalVersions();
  const newVersionNumber = totalVersions + 1;
  
  const newVersion = `V${dateStr}.${newVersionNumber}`;
  console.log(`🎉 自动生成新版本号: ${newVersion}`);
  
  return newVersion;
}

/**
 * 更新文件中的版本号
 */
function updateVersionInFile(filePath, pattern, replacement) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  文件不存在: ${filePath}`);
    return false;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    content = content.replace(pattern, replacement);
    
    if (content === originalContent) {
      console.warn(`⚠️  ${path.basename(filePath)} 中未找到匹配的版本号模式`);
      return false;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已更新: ${path.basename(filePath)}`);
    return true;
  } catch (err) {
    console.error(`❌ 更新 ${filePath} 失败:`, err.message);
    return false;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始更新版本号...\n');
  
  const newVersion = getNewVersion();
  console.log('');
  
  let successCount = 0;
  let totalCount = 0;
  
  // 1. 更新 index.html
  totalCount++;
  if (updateVersionInFile(
    path.join(__dirname, 'index.html'),
    /const APP_VERSION = ['"]([^'"]+)['"];/g,
    `const APP_VERSION = '${newVersion}';`
  )) {
    successCount++;
  }
  
  // 2. 更新 public/sw.js
  totalCount++;
  if (updateVersionInFile(
    path.join(__dirname, 'public', 'sw.js'),
    /const VERSION = ['"]([^'"]+)['"];/g,
    `const VERSION = '${newVersion}';`
  )) {
    successCount++;
  }
  
  // 3. 更新 public/manifest.json
  totalCount++;
  if (updateVersionInFile(
    path.join(__dirname, 'public', 'manifest.json'),
    /"version":\s*["']([^"']+)["']/g,
    `"version": "${newVersion}"`
  )) {
    successCount++;
  }
  
  // 4. 更新 package.json
  totalCount++;
  const versionWithoutV = newVersion.replace(/^V/, '');
  if (updateVersionInFile(
    path.join(__dirname, 'package.json'),
    /"version":\s*["']([^"']+)["']/,
    `"version": "${versionWithoutV}"`
  )) {
    successCount++;
  }
  
  // 5. 更新 force-update.html
  const forceUpdatePath = path.join(__dirname, 'force-update.html');
  if (fs.existsSync(forceUpdatePath)) {
    totalCount++;
    if (updateVersionInFile(
      forceUpdatePath,
      /const TARGET_VERSION = ['"]([^'"]+)['"];/g,
      `const TARGET_VERSION = '${newVersion}';`
    )) {
      successCount++;
    }
  }
  
  // 6. 更新 HOW_TO_UPDATE.md
  const updateGuidePath = path.join(__dirname, 'HOW_TO_UPDATE.md');
  if (fs.existsSync(updateGuidePath)) {
    totalCount++;
    let content = fs.readFileSync(updateGuidePath, 'utf8');
    content = content.replace(/当前最新版本.*?V\d{6}\.\d+/g, `当前最新版本**: ${newVersion}`);
    fs.writeFileSync(updateGuidePath, content, 'utf8');
    console.log(`✅ 已更新: HOW_TO_UPDATE.md`);
    successCount++;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 更新完成: ${successCount}/${totalCount} 个文件成功更新`);
  console.log(`🎯 新版本号: ${newVersion}`);
  console.log('='.repeat(50));
  
  console.log('\n📝 下一步操作:');
  console.log('1. 更新 public/update-log.json，添加新版本条目');
  console.log('2. 提交代码: git add . && git commit -m "feat: ' + newVersion + ' - 描述"');
  console.log('3. 推送到 GitHub: git push origin main');
}

// 执行主函数
main();
