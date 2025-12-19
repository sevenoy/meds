/**
 * 头像同步调试工具
 * 
 * 使用方法：
 * 1. 打开浏览器控制台（F12）
 * 2. 复制这个脚本并粘贴到控制台
 * 3. 按回车执行
 * 
 * 该脚本会检查：
 * - 本地存储状态
 * - Supabase 连接状态
 * - Realtime 订阅状态
 * - 用户设置数据
 */

(async function debugAvatarSync() {
  console.log('🔍 开始诊断头像同步问题...\n');
  
  // 1. 检查本地存储
  console.log('📦 1. 检查本地存储...');
  const userSettings = localStorage.getItem('user_settings');
  const lastSync = localStorage.getItem('settings_last_sync');
  const userId = localStorage.getItem('userId');
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  
  if (userSettings) {
    const settings = JSON.parse(userSettings);
    console.log('  ✅ 本地用户设置:', settings);
    console.log('  📸 本地头像URL:', settings.avatar_url || '(未设置)');
  } else {
    console.log('  ⚠️ 本地没有用户设置');
  }
  
  console.log('  🕐 上次同步时间:', lastSync ? new Date(parseInt(lastSync)).toLocaleString() : '(从未同步)');
  console.log('  👤 用户ID:', userId || '(未登录)');
  console.log('  🔐 登录状态:', isLoggedIn === 'true' ? '已登录' : '未登录');
  console.log('');
  
  // 2. 检查 Supabase 客户端
  console.log('☁️ 2. 检查 Supabase 连接...');
  if (typeof window.supabase === 'undefined') {
    console.log('  ❌ Supabase 客户端未初始化');
    console.log('  提示：确保已经导入并初始化 Supabase 客户端');
    return;
  }
  
  const supabase = window.supabase;
  console.log('  ✅ Supabase 客户端已初始化');
  
  // 3. 检查用户会话
  console.log('');
  console.log('👤 3. 检查用户会话...');
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('  ❌ 获取会话失败:', error.message);
      return;
    }
    
    if (!session) {
      console.log('  ⚠️ 未登录');
      return;
    }
    
    console.log('  ✅ 已登录');
    console.log('  📧 邮箱:', session.user.email);
    console.log('  🆔 User ID:', session.user.id);
    
    // 4. 检查云端用户设置
    console.log('');
    console.log('☁️ 4. 检查云端用户设置...');
    const { data: cloudSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    
    if (settingsError) {
      console.log('  ❌ 查询失败:', settingsError.message);
      return;
    }
    
    if (!cloudSettings) {
      console.log('  ⚠️ 云端没有用户设置记录');
      console.log('  提示：首次上传头像会自动创建记录');
      return;
    }
    
    console.log('  ✅ 云端用户设置:', cloudSettings.settings);
    console.log('  📸 云端头像URL:', cloudSettings.settings?.avatar_url || '(未设置)');
    console.log('  🕐 云端更新时间:', new Date(cloudSettings.updated_at).toLocaleString());
    
    // 比较本地和云端
    console.log('');
    console.log('🔄 5. 比较本地和云端...');
    if (userSettings) {
      const localSettings = JSON.parse(userSettings);
      const localAvatar = localSettings.avatar_url;
      const cloudAvatar = cloudSettings.settings?.avatar_url;
      
      if (localAvatar === cloudAvatar) {
        console.log('  ✅ 本地和云端头像URL一致');
      } else {
        console.log('  ⚠️ 本地和云端头像URL不一致！');
        console.log('    本地:', localAvatar || '(未设置)');
        console.log('    云端:', cloudAvatar || '(未设置)');
        
        const cloudTime = new Date(cloudSettings.updated_at).getTime();
        const localTime = parseInt(lastSync || '0');
        
        if (cloudTime > localTime) {
          console.log('  💡 云端数据更新，建议拉取云端数据');
        } else {
          console.log('  💡 本地数据更新，建议推送到云端');
        }
      }
    }
    
    // 6. 检查 Storage bucket
    console.log('');
    console.log('🗄️ 6. 检查 Storage bucket...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.log('  ❌ 查询失败:', bucketsError.message);
    } else {
      const avatarBucket = buckets.find(b => b.name === 'user-avatars');
      if (avatarBucket) {
        console.log('  ✅ user-avatars bucket 存在');
        console.log('  📦 Bucket 信息:', {
          public: avatarBucket.public,
          created_at: new Date(avatarBucket.created_at).toLocaleString()
        });
        
        // 尝试列出用户的头像文件
        const { data: files, error: filesError } = await supabase.storage
          .from('user-avatars')
          .list(session.user.id, {
            limit: 10,
            sortBy: { column: 'created_at', order: 'desc' }
          });
        
        if (!filesError && files && files.length > 0) {
          console.log('  📁 用户头像文件:');
          files.forEach((file, i) => {
            console.log(`    ${i + 1}. ${file.name} (${(file.metadata?.size / 1024).toFixed(2)} KB)`);
          });
        } else {
          console.log('  ℹ️ 用户目录下没有头像文件');
        }
      } else {
        console.log('  ❌ user-avatars bucket 不存在');
        console.log('  提示：需要在 Supabase Dashboard 中创建 user-avatars bucket');
      }
    }
    
    // 7. 检查 Realtime 订阅
    console.log('');
    console.log('📡 7. 检查 Realtime 订阅...');
    const channels = supabase.getChannels();
    console.log('  📊 当前订阅数量:', channels.length);
    
    const settingsChannel = channels.find(ch => ch.topic.includes('user-settings-sync'));
    if (settingsChannel) {
      console.log('  ✅ 用户设置 Realtime 订阅已启动');
      console.log('  📌 订阅状态:', settingsChannel.state);
      
      if (settingsChannel.state !== 'joined') {
        console.log('  ⚠️ 订阅状态不是 joined，可能无法接收实时更新');
      }
    } else {
      console.log('  ⚠️ 未找到用户设置 Realtime 订阅');
      console.log('  提示：确保调用了 initSettingsRealtimeSync()');
    }
    
    // 8. 总结和建议
    console.log('');
    console.log('📋 诊断总结:');
    
    const issues = [];
    
    if (!isLoggedIn || !session) {
      issues.push('❌ 未登录');
    }
    
    if (!cloudSettings) {
      issues.push('⚠️ 云端没有用户设置');
    }
    
    if (userSettings && cloudSettings) {
      const localSettings = JSON.parse(userSettings);
      if (localSettings.avatar_url !== cloudSettings.settings?.avatar_url) {
        issues.push('⚠️ 本地和云端头像不一致');
      }
    }
    
    if (!settingsChannel || settingsChannel.state !== 'joined') {
      issues.push('⚠️ Realtime 订阅未正常工作');
    }
    
    if (issues.length === 0) {
      console.log('  ✅ 所有检查通过，系统运行正常！');
    } else {
      console.log('  发现以下问题:');
      issues.forEach(issue => console.log(`    ${issue}`));
    }
    
    console.log('');
    console.log('💡 建议操作:');
    console.log('  1. 如果本地和云端不一致，尝试重新上传头像');
    console.log('  2. 如果 Realtime 订阅有问题，刷新页面重新连接');
    console.log('  3. 如果问题持续，查看 AVATAR_SYNC_TEST.md 文档');
    console.log('');
    console.log('🔍 诊断完成！');
    
  } catch (error) {
    console.error('❌ 诊断过程中出错:', error);
  }
})();

// 导出一些有用的调试函数
window.debugAvatarSync = {
  // 强制从云端拉取设置
  async pullSettings() {
    console.log('📥 正在从云端拉取设置...');
    const { getUserSettings } = await import('./src/services/userSettings');
    const settings = await getUserSettings();
    console.log('✅ 拉取成功:', settings);
    return settings;
  },
  
  // 强制推送设置到云端
  async pushSettings(settings) {
    console.log('📤 正在推送设置到云端...');
    const { saveUserSettings } = await import('./src/services/userSettings');
    await saveUserSettings(settings);
    console.log('✅ 推送成功');
  },
  
  // 清除本地缓存
  clearLocal() {
    console.log('🗑️ 清除本地缓存...');
    localStorage.removeItem('user_settings');
    localStorage.removeItem('settings_last_sync');
    console.log('✅ 本地缓存已清除');
  },
  
  // 查看当前头像
  async showAvatar() {
    const userSettings = localStorage.getItem('user_settings');
    if (!userSettings) {
      console.log('⚠️ 本地没有用户设置');
      return;
    }
    
    const settings = JSON.parse(userSettings);
    const avatarUrl = settings.avatar_url;
    
    if (!avatarUrl) {
      console.log('⚠️ 未设置头像');
      return;
    }
    
    console.log('📸 当前头像URL:', avatarUrl);
    
    // 在新标签页打开头像
    window.open(avatarUrl, '_blank');
  }
};

console.log('');
console.log('💡 提示：可以使用以下调试函数:');
console.log('  - window.debugAvatarSync.pullSettings()  // 从云端拉取设置');
console.log('  - window.debugAvatarSync.pushSettings({}) // 推送设置到云端');
console.log('  - window.debugAvatarSync.clearLocal()     // 清除本地缓存');
console.log('  - window.debugAvatarSync.showAvatar()     // 查看当前头像');
