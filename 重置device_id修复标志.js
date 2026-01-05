// ====================================
// 重置 device_id 修复标志
// 在浏览器控制台执行此脚本
// ====================================

// 用途: 清除修复标志,让下次加载重新执行 fixLegacyDeviceIds()
// 场景: 
// 1. 测试修复功能
// 2. 数据库中有新的旧数据需要修复
// 3. 故障排除

(function() {
  console.log('🔧 开始重置 device_id 修复标志...');
  
  // 清除修复标志
  localStorage.removeItem('device_id_fixed_v2');
  console.log('✅ 修复标志已清除');
  
  // 显示当前状态
  const currentFlag = localStorage.getItem('device_id_fixed_v2');
  console.log('📊 当前状态:', currentFlag === null ? '未修复 (下次加载将执行修复)' : '已修复');
  
  // 提示刷新
  console.log('⚠️ 请刷新页面以重新执行修复');
  console.log('💡 提示: 刷新后应该看到 "🔧 开始修复所有药品的 device_id..."');
  
  // 询问是否立即刷新
  if (confirm('是否立即刷新页面?')) {
    window.location.reload();
  }
})();

