#!/usr/bin/env node

/**
 * 检查环境变量配置
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 检查Supabase环境变量配置...\n');

// 检查.env文件
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env 文件不存在！');
  console.log('📝 请根据 .env.example 创建 .env 文件\n');
  
  if (fs.existsSync(envExamplePath)) {
    console.log('💡 可以运行以下命令创建：');
    console.log('   cp .env.example .env');
    console.log('   然后编辑 .env 文件，填入正确的配置\n');
  }
  process.exit(1);
}

// 读取.env文件
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

let supabaseUrl = '';
let supabaseKey = '';

lines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = trimmed.split('=')[1] || '';
  }
  if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    supabaseKey = trimmed.split('=')[1] || '';
  }
});

console.log('📋 当前配置：\n');

// 检查URL
if (!supabaseUrl) {
  console.log('❌ VITE_SUPABASE_URL: 未配置');
} else {
  console.log(`✅ VITE_SUPABASE_URL: ${supabaseUrl}`);
  
  // 验证URL格式
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('supabase.co')) {
    console.log('   ⚠️  URL格式可能不正确');
  }
}

// 检查Key
if (!supabaseKey) {
  console.log('❌ VITE_SUPABASE_ANON_KEY: 未配置\n');
} else {
  const keyLength = supabaseKey.length;
  const keyPreview = supabaseKey.substring(0, 20) + '...' + supabaseKey.substring(keyLength - 10);
  console.log(`✅ VITE_SUPABASE_ANON_KEY: ${keyPreview}`);
  console.log(`   长度: ${keyLength} 字符`);
  
  // 验证Key格式
  if (keyLength < 100) {
    console.log('   ⚠️  Key长度太短，可能不完整');
  } else if (keyLength > 300) {
    console.log('   ⚠️  Key长度太长，可能包含多余字符');
  }
  
  // 检查是否是JWT格式
  if (!supabaseKey.startsWith('eyJ')) {
    console.log('   ⚠️  Key不是标准JWT格式（应该以eyJ开头）');
  }
  
  const parts = supabaseKey.split('.');
  if (parts.length !== 3) {
    console.log('   ⚠️  Key不是标准JWT格式（应该有3个部分，用.分隔）');
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 检查是否两个都配置了
if (!supabaseUrl || !supabaseKey) {
  console.log('💡 配置步骤：\n');
  console.log('1. 登录 Supabase Dashboard');
  console.log('   https://supabase.com/dashboard\n');
  console.log('2. 选择项目\n');
  console.log('3. 点击左侧 Settings (⚙️) → API\n');
  console.log('4. 复制以下信息到 .env 文件：');
  console.log('   - Project URL → VITE_SUPABASE_URL');
  console.log('   - anon public key → VITE_SUPABASE_ANON_KEY\n');
  console.log('5. 重启开发服务器：npm run dev\n');
} else {
  console.log('✅ 环境变量已配置！\n');
  console.log('💡 如果仍然报错 "Invalid API key"：\n');
  console.log('1. 检查 Supabase Dashboard 中的 API key 是否正确');
  console.log('2. 确认项目 URL 和 Key 来自同一个项目');
  console.log('3. 重启开发服务器：npm run dev');
  console.log('4. 清除浏览器缓存并刷新\n');
}
