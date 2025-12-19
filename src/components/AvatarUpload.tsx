/**
 * 用户头像上传组件
 * 支持头像上传、预览、删除，自动同步到云端
 */

import React, { useState, useRef, useEffect } from 'react';
import { User, Upload, Trash2, Loader } from 'lucide-react';
import { supabase, isMockMode, getCurrentUserId } from '../lib/supabase';
import { getUserSettings, updateUserSettings } from '../services/userSettings';

interface AvatarUploadProps {
  /** 当前头像URL */
  currentAvatarUrl?: string;
  /** 头像更新回调 */
  onAvatarUpdated?: (url: string | null) => void;
  /** 大小（像素） */
  size?: number;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatarUrl,
  onAvatarUpdated,
  size = 120
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 监听 props 变化，同步更新内部 state
  useEffect(() => {
    console.log('👤 AvatarUpload: props更新，同步头像URL', currentAvatarUrl);
    setAvatarUrl(currentAvatarUrl || null);
  }, [currentAvatarUrl]);

  /**
   * 处理文件选择
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    // 验证文件大小（最大 2MB）
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setError('图片大小不能超过 2MB');
      return;
    }

    setError(null);
    await uploadAvatar(file);
  };

  /**
   * 上传头像到 Supabase Storage
   */
  const uploadAvatar = async (file: File) => {
    if (isMockMode) {
      // Mock 模式：使用本地 Data URL
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        
        // 立即更新本地显示
        setAvatarUrl(dataUrl);
        
        // 保存到用户设置
        await updateUserSettings({ avatar_url: dataUrl });
        
        // 通知父组件更新
        onAvatarUpdated?.(dataUrl);
        
        console.log('🔧 Mock模式：头像已保存到本地');
        
        // 显示成功提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg animate-fade-in';
        notification.textContent = '✅ 头像上传成功（Mock模式）';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('animate-fade-out');
          setTimeout(() => notification.remove(), 300);
        }, 3000);
      };
      reader.readAsDataURL(file);
      return;
    }

    setUploading(true);

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('请先登录');
      }

      // 删除旧头像（如果存在）
      if (avatarUrl && avatarUrl.includes('user-avatars')) {
        const oldPath = avatarUrl.split('/user-avatars/')[1];
        if (oldPath) {
          await supabase!.storage
            .from('user-avatars')
            .remove([oldPath]);
          console.log('🗑️ 已删除旧头像');
        }
      }

      // 生成文件名：<user-id>/<timestamp>.<ext>
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      console.log('☁️ 上传头像到:', filePath);

      // 上传文件
      const { data, error: uploadError } = await supabase!.storage
        .from('user-avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      console.log('✅ 头像上传成功:', data.path);

      // 获取公开URL
      const { data: urlData } = supabase!.storage
        .from('user-avatars')
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      
      // 立即更新本地显示
      setAvatarUrl(publicUrl);
      console.log('✅ 头像URL:', publicUrl);

      // 保存到用户设置（会自动触发云端同步）
      await updateUserSettings({ avatar_url: publicUrl });
      console.log('☁️ 头像已保存到云端，正在推送到其他设备...');
      
      // 通知父组件更新
      onAvatarUpdated?.(publicUrl);

      // 显示成功提示
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg animate-fade-in';
      notification.textContent = '✅ 头像上传成功，已推送到其他设备';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('animate-fade-out');
        setTimeout(() => notification.remove(), 300);
      }, 3000);

      console.log('✅ 头像上传和同步完成');
    } catch (err: any) {
      console.error('❌ 头像上传失败:', err);
      setError(err.message || '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  /**
   * 删除头像
   */
  const handleDeleteAvatar = async () => {
    if (!avatarUrl) return;

    const confirmed = confirm('确定要删除头像吗？');
    if (!confirmed) return;

    setUploading(true);
    setError(null);

    try {
      // 删除云端文件（仅在Supabase模式）
      if (!isMockMode && avatarUrl.includes('user-avatars')) {
        const filePath = avatarUrl.split('/user-avatars/')[1];
        if (filePath) {
          const { error: deleteError } = await supabase!.storage
            .from('user-avatars')
            .remove([filePath]);

          if (deleteError) throw deleteError;
          console.log('🗑️ 头像文件已删除');
        }
      }

      // 立即更新本地显示
      setAvatarUrl(null);
      
      // 更新用户设置（会自动触发云端同步）
      await updateUserSettings({ avatar_url: null });
      
      // 通知父组件更新
      onAvatarUpdated?.(null);

      // 显示成功提示
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg animate-fade-in';
      notification.textContent = '✅ 头像已删除，已同步到其他设备';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('animate-fade-out');
        setTimeout(() => notification.remove(), 300);
      }, 3000);

      console.log('✅ 头像删除和同步完成');
    } catch (err: any) {
      console.error('❌ 删除头像失败:', err);
      setError(err.message || '删除失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  /**
   * 触发文件选择
   */
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 头像显示区域 */}
      <div 
        className="relative rounded-full overflow-hidden bg-gray-200 flex items-center justify-center shadow-lg"
        style={{ width: size, height: size }}
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="用户头像" 
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-1/2 h-1/2 text-gray-400" strokeWidth={1.5} />
        )}

        {/* 加载蒙层 */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="text-red-600 text-sm font-medium bg-red-50 px-4 py-2 rounded-xl">
          {error}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold text-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          <Upload className="w-4 h-4" />
          {avatarUrl ? '更换头像' : '上传头像'}
        </button>

        {avatarUrl && (
          <button
            onClick={handleDeleteAvatar}
            disabled={uploading}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full font-bold text-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 提示文本 */}
      <p className="text-xs text-gray-500 text-center max-w-xs">
        支持 JPG、PNG、GIF 格式，最大 2MB
        {!isMockMode && <><br />头像会自动同步到所有设备</>}
      </p>
    </div>
  );
};
