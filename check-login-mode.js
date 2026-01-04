#!/usr/bin/env node

/**
 * 检查登录模式：本地Mock还是Supabase云端
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 检查登录模式...\n');

// 检查.env文件
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🏠 当前模式: Mock模式（本地模拟）\n');
  console.log('原因: 未找到 .env 文件\n');
  console.log('特点:');
  console.log('  ✅ 任何用户名和密码都能登录');
  console.log('  ✅ 数据保存在本地浏览器（IndexedDB）');
  console.log('  ❌ 无法多设备同步');
  console.log('  ❌ 清除浏览器数据会丢失所有记录\n');
  process.exit(0);
}

// 读取.env配置
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

let supabaseUrl = '';
let supabaseKey = '';

lines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = trimmed.split('=')[1]?.trim() || '';
  }
  if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    supabaseKey = trimmed.split('=')[1]?.trim() || '';
  }
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('🏠 当前模式: Mock模式（本地模拟）\n');
  console.log('原因:');
  if (!supabaseUrl) console.log('  ❌ VITE_SUPABASE_URL 未配置');
  if (!supabaseKey) console.log('  ❌ VITE_SUPABASE_ANON_KEY 未配置');
  console.log('\n特点:');
  console.log('  ✅ 任何用户名和密码都能登录');
  console.log('  ✅ 数据保存在本地浏览器（IndexedDB）');
  console.log('  ❌ 无法多设备同步');
  console.log('  ❌ 清除浏览器数据会丢失所有记录\n');
  
  console.log('💡 要启用云端同步:');
  console.log('   1. 在 .env 文件中配置 Supabase URL 和 Key');
  console.log('   2. 重启服务器');
  console.log('   3. 在 Supabase 创建用户账号\n');
} else {
  console.log('☁️  当前模式: Supabase模式（云端同步）\n');
  console.log('配置:');
  console.log(`  ✅ VITE_SUPABASE_URL: ${supabaseUrl}`);
  console.log(`  ✅ VITE_SUPABASE_ANON_KEY: ${supabaseKey.substring(0, 20)}...（已配置）\n`);
  
  console.log('特点:');
  console.log('  ✅ 需要在 Supabase 创建的用户账号才能登录');
  console.log('  ✅ 数据保存在 Supabase 云端数据库');
  console.log('  ✅ 支持多设备实时同步');
  console.log('  ✅ 数据安全，不会因清除浏览器而丢失');
  console.log('  ✅ 自动备份，可随时恢复\n');
  
  console.log('登录验证:');
  console.log('  📧 用户名 "sevenoy" → sevenoy@gmail.com');
  console.log('  🔐 密码必须在 Supabase 中设置正确');
  console.log('  🌐 登录时会向 Supabase 服务器验证\n');
  
  console.log('💡 如何确认用户是否在 Supabase 中创建:');
  console.log('   访问: https://supabase.com/dashboard/project/ptmgncjechjprxtndqon/auth/users');
  console.log('   查看是否有用户: sevenoy@gmail.com\n');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 检查代码逻辑
console.log('📝 登录流程说明:\n');
console.log('1. 代码检查环境变量是否配置');
console.log('2. 如果配置了 → Supabase模式 → 向服务器验证');
console.log('3. 如果未配置 → Mock模式 → 本地自动通过\n');

console.log('🔍 判断方法:\n');
console.log('方法1: 查看浏览器控制台日志');
console.log('  - Mock模式: "🔧 Mock模式：自动登录成功"');
console.log('  - Supabase模式: "🌐 Supabase模式：调用登录API"\n');

console.log('方法2: 测试错误密码');
console.log('  - Mock模式: 任何密码都能登录');
console.log('  - Supabase模式: 错误密码会提示"Invalid credentials"\n');

console.log('方法3: 检查多设备同步');
console.log('  - Mock模式: 每个设备数据独立，不会同步');
console.log('  - Supabase模式: 设备A添加数据，设备B能看到\n');
