#!/usr/bin/env node

import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

console.log('🧪 测试Supabase API Key...\n');
console.log('📍 URL:', url);
console.log('🔑 Key长度:', key?.length, '字符\n');

// 解码JWT查看内容
try {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString());
  console.log('📊 JWT内容:');
  console.log('   - 发行者 (iss):', payload.iss);
  console.log('   - 项目ID (ref):', payload.ref);
  console.log('   - 角色 (role):', payload.role);
  console.log('   - 签发时间 (iat):', new Date(payload.iat * 1000).toISOString());
  console.log('   - 过期时间 (exp):', new Date(payload.exp * 1000).toISOString());
  
  const now = Date.now();
  const exp = payload.exp * 1000;
  if (exp < now) {
    console.log('\n❌ Key已过期！');
  } else {
    console.log('\n✅ Key未过期（有效期到', new Date(exp).toLocaleDateString(), '）');
  }
  
  // 检查项目ID是否匹配
  const urlProjectId = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (urlProjectId !== payload.ref) {
    console.log('\n⚠️  警告：URL中的项目ID与Key不匹配！');
    console.log('   URL项目ID:', urlProjectId);
    console.log('   Key项目ID:', payload.ref);
  } else {
    console.log('✅ 项目ID匹配');
  }
} catch (e) {
  console.log('❌ 无法解码JWT:', e.message);
}

console.log('\n💡 建议：');
console.log('1. 访问 Supabase Dashboard');
console.log('2. 确认项目ID是否正确');
console.log('3. 重新复制最新的 anon key');
console.log('4. 更新 .env 文件');
