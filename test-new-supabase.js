#!/usr/bin/env node

/**
 * 测试新 Supabase 项目配置
 */

const SUPABASE_URL = 'https://vcoioqystzyztgrgesjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjb2lvcXlzdHp5enRncmdlc2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MzI2NzIsImV4cCI6MjA4MTIwODY3Mn0.vhuogI_SkNOrJCL_Zf72XWjYk29ZGXvIn2-GJBMAocI';

console.log('🔍 测试新 Supabase 项目...\n');
console.log(`📡 项目 URL: ${SUPABASE_URL}`);
console.log(`⏰ 测试时间: ${new Date().toLocaleString('zh-CN')}\n`);

async function testNewSupabase() {
  try {
    console.log('1️⃣ 测试基础连接...');
    const healthResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (healthResponse.ok || healthResponse.status === 401) {
      console.log('   ✅ 基础连接成功\n');
    } else {
      console.log(`   ⚠️ 状态码: ${healthResponse.status}\n`);
    }

    console.log('2️⃣ 测试数据库表是否存在...');
    
    // 测试 medications 表
    const medicationsResponse = await fetch(`${SUPABASE_URL}/rest/v1/medications?limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (medicationsResponse.ok) {
      console.log('   ✅ medications 表存在');
    } else if (medicationsResponse.status === 404) {
      console.log('   ❌ medications 表不存在 - 需要执行数据库迁移！');
    } else {
      console.log(`   ⚠️ medications 表状态: ${medicationsResponse.status}`);
    }

    // 测试 user_settings 表
    const settingsResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_settings?limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (settingsResponse.ok) {
      console.log('   ✅ user_settings 表存在');
    } else if (settingsResponse.status === 404) {
      console.log('   ❌ user_settings 表不存在 - 需要执行数据库迁移！');
    } else {
      console.log(`   ⚠️ user_settings 表状态: ${settingsResponse.status}`);
    }

    console.log('\n3️⃣ 测试 Storage...');
    const storageResponse = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (storageResponse.ok) {
      const buckets = await storageResponse.json();
      console.log(`   ✅ Storage 可用，找到 ${buckets.length} 个 buckets`);
      if (buckets.length > 0) {
        console.log('   Buckets:', buckets.map(b => b.name).join(', '));
      } else {
        console.log('   ⚠️ 没有 buckets - 需要执行存储配置！');
      }
    } else {
      console.log(`   ⚠️ Storage 状态: ${storageResponse.status}`);
    }

    // 总结
    console.log('\n' + '='.repeat(50));
    
    if (medicationsResponse.status === 404 || settingsResponse.status === 404) {
      console.log('⚠️ 数据库迁移未完成！');
      console.log('\n📋 需要执行的操作：');
      console.log('   1. 访问 https://supabase.com/dashboard');
      console.log('   2. 选择项目：vcoioqystzyztgrgesjw');
      console.log('   3. 打开 SQL Editor');
      console.log('   4. 依次执行以下 SQL 文件：');
      console.log('      - supabase-schema.sql');
      console.log('      - supabase-user-settings-schema.sql');
      console.log('      - supabase_snapshots_migration.sql');
      console.log('      - supabase-realtime-migration.sql');
      console.log('      - supabase-storage-setup.sql');
      console.log('\n   详细步骤请查看：新项目快速设置.md');
    } else {
      console.log('🎉 新 Supabase 项目配置正确！');
      console.log('\n📋 下一步：');
      console.log('   1. 访问 http://localhost:5174/meds/');
      console.log('   2. 注册新账号');
      console.log('   3. 测试应用功能');
    }
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ 测试过程中出现错误:');
    console.error(error.message);
  }
}

testNewSupabase();

