#!/usr/bin/env node

/**
 * 检查 Supabase 项目状态
 * 用于验证项目是否已完全恢复
 */

const SUPABASE_URL = 'https://ptmgncjechjprxtndqon.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0bWduY2plY2hqcHJ4dG5kcW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzA2NjIsImV4cCI6MjA4MTcwNjY2Mn0.vN58E7gBVxZXfhL_qEUfYkX7ihMjMUr5z1_KQAul5Hg';

console.log('🔍 检查 Supabase 项目状态...\n');
console.log(`📡 项目 URL: ${SUPABASE_URL}`);
console.log(`⏰ 检查时间: ${new Date().toLocaleString('zh-CN')}\n`);

async function checkProjectStatus() {
  try {
    console.log('1️⃣ 测试基础连接...');
    const healthResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (healthResponse.ok) {
      console.log('   ✅ 基础连接成功\n');
    } else {
      console.log(`   ⚠️ 状态码: ${healthResponse.status}\n`);
    }

    console.log('2️⃣ 测试数据库连接...');
    const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/medications?limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (dbResponse.ok) {
      console.log('   ✅ 数据库连接成功\n');
    } else {
      console.log(`   ⚠️ 状态码: ${dbResponse.status}`);
      const errorText = await dbResponse.text();
      console.log(`   错误信息: ${errorText}\n`);
    }

    console.log('3️⃣ 测试 Realtime 连接...');
    const realtimeResponse = await fetch(`${SUPABASE_URL}/realtime/v1/websocket`, {
      method: 'HEAD'
    });

    if (realtimeResponse.status === 426 || realtimeResponse.status === 101) {
      // 426 Upgrade Required 或 101 Switching Protocols 都表示 WebSocket 端点正常
      console.log('   ✅ Realtime 端点可用\n');
    } else {
      console.log(`   ⚠️ 状态码: ${realtimeResponse.status}\n`);
    }

    console.log('4️⃣ 测试 Storage 连接...');
    const storageResponse = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (storageResponse.ok) {
      console.log('   ✅ Storage 连接成功\n');
    } else {
      console.log(`   ⚠️ 状态码: ${storageResponse.status}\n`);
    }

    // 总结
    console.log('=' .repeat(50));
    if (healthResponse.ok && dbResponse.ok) {
      console.log('🎉 项目已完全恢复！可以正常使用了！');
      console.log('\n📋 下一步：');
      console.log('   1. 运行 npm run build 重新构建应用');
      console.log('   2. 测试应用的所有功能');
      console.log('   3. 验证多设备实时同步是否正常');
    } else {
      console.log('⏳ 项目仍在启动中，请稍等几分钟后重试');
      console.log('\n💡 提示：');
      console.log('   - 通常需要 5-15 分钟完全启动');
      console.log('   - 可以再次运行此脚本检查状态');
      console.log('   - 如果超过 30 分钟仍未恢复，请联系 Supabase 支持');
    }
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('\n❌ 检查过程中出现错误:');
    console.error(error.message);
    console.log('\n💡 这可能意味着：');
    console.log('   - 项目仍在启动中（正常情况）');
    console.log('   - 网络连接问题');
    console.log('   - 请稍后重试');
  }
}

checkProjectStatus();

