#!/usr/bin/env node

/**
 * 测试 API Key 格式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 检查 Supabase API Key 格式...\n');

// 读取 .env 文件
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env 文件不存在！');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

let key = '';
lines.forEach(line => {
  if (line.trim().startsWith('VITE_SUPABASE_ANON_KEY=')) {
    key = line.split('=')[1] || '';
  }
});

if (!key) {
  console.log('❌ 未找到 VITE_SUPABASE_ANON_KEY 配置\n');
  process.exit(1);
}

console.log('📋 当前 Key 分析：\n');
console.log(`长度: ${key.length} 字符`);
console.log(`开头: ${key.substring(0, 20)}...`);
console.log(`结尾: ...${key.substring(key.length - 20)}\n`);

// 检查格式
let isValid = true;
const errors = [];

if (!key.startsWith('eyJ')) {
  errors.push('❌ Key 不是以 "eyJ" 开头（应该是JWT格式）');
  isValid = false;
} else {
  console.log('✅ Key 以 "eyJ" 开头（JWT格式）');
}

const parts = key.split('.');
if (parts.length !== 3) {
  errors.push(`❌ Key 不是标准JWT格式（应该有3个部分，当前有 ${parts.length} 个）`);
  isValid = false;
} else {
  console.log('✅ Key 有3个部分（用点分隔）');
  console.log(`   - 第1部分: ${parts[0].length} 字符`);
  console.log(`   - 第2部分: ${parts[1].length} 字符`);
  console.log(`   - 第3部分: ${parts[2].length} 字符`);
}

if (key.length < 150) {
  errors.push('⚠️  Key 长度太短（正常应该在200-250字符）');
  isValid = false;
} else if (key.length > 300) {
  errors.push('⚠️  Key 长度太长（可能包含多余内容）');
  isValid = false;
} else {
  console.log('✅ Key 长度正常');
}

// 检查是否是错误的 key
if (key.startsWith('sb_publishable_')) {
  errors.push('❌ 这是 publishable key，不是 anon key！');
  errors.push('   请复制标记为 "anon public" 的 key');
  isValid = false;
}

if (key.includes(' ') || key.includes('\n')) {
  errors.push('❌ Key 包含空格或换行符');
  isValid = false;
} else {
  console.log('✅ Key 不包含空格或换行');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (errors.length > 0) {
  console.log('发现以下问题：\n');
  errors.forEach(err => console.log(err));
  console.log('\n');
}

if (isValid) {
  console.log('✅ API Key 格式正确！\n');
  
  // 尝试解码 JWT
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('📊 JWT 内容：\n');
    console.log('   - iss (发行者):', payload.iss);
    console.log('   - ref (项目ID):', payload.ref);
    console.log('   - role (角色):', payload.role);
    
    if (payload.ref !== 'ptmgncjechjprxtndqon') {
      console.log('\n⚠️  警告：项目ID不匹配！');
      console.log(`   期望: ptmgncjechjprxtndqon`);
      console.log(`   实际: ${payload.ref}`);
    } else {
      console.log('\n✅ 项目ID匹配');
    }
    
    if (payload.role !== 'anon') {
      console.log('\n⚠️  警告：角色不是 anon！');
      console.log(`   当前角色: ${payload.role}`);
      console.log('   应该使用 anon 角色的 key');
    } else {
      console.log('✅ 角色正确（anon）');
    }
  } catch (e) {
    console.log('⚠️  无法解码JWT内容');
  }
  
  console.log('\n💡 下一步：');
  console.log('   1. 重启服务器: npm run dev');
  console.log('   2. 清除浏览器缓存');
  console.log('   3. 尝试登录\n');
} else {
  console.log('❌ API Key 格式不正确！\n');
  console.log('💡 请按照以下步骤获取正确的 key：\n');
  console.log('1. 访问: https://supabase.com/dashboard/project/ptmgncjechjprxtndqon/settings/api');
  console.log('2. 找到 "anon public" 标签的 key');
  console.log('3. 点击 [Copy] 按钮复制');
  console.log('4. 完整粘贴到 .env 文件的 VITE_SUPABASE_ANON_KEY= 后面');
  console.log('5. 确保整个 key 在同一行\n');
}
