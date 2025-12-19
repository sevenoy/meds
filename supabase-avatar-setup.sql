-- ================================================
-- 用户头像功能 - Supabase 设置脚本
-- ================================================
-- 本脚本创建用户头像存储所需的数据库表和Storage Bucket
-- 
-- 使用方法：
-- 1. 登录 Supabase Dashboard
-- 2. 进入 SQL Editor
-- 3. 复制粘贴以下SQL并执行
-- ================================================

-- ============================================
-- 步骤 1: 创建 Storage Bucket (通过Dashboard)
-- ============================================
-- 注意：Storage Bucket 需要在 Dashboard 中创建，不能通过 SQL
-- 
-- 手动操作步骤：
-- 1. 在 Supabase Dashboard 左侧菜单中点击 "Storage"
-- 2. 点击 "Create a new bucket"
-- 3. 填写以下信息：
--    - Name: user-avatars
--    - Public: ✅ 勾选（允许公开访问头像）
-- 4. 点击 "Create bucket"
-- 
-- 5. 点击刚创建的 "user-avatars" bucket
-- 6. 点击 "Policies" 标签页
-- 7. 点击 "New Policy"
-- 8. 选择模板：
--    - 第一个选择：Select
--    - 第二个选择：All users (public read access)
-- 9. 点击 "Review"
-- 10. 点击 "Save policy"
--
-- 11. 再次点击 "New Policy"
-- 12. 选择模板：
--    - 第一个选择：Insert
--    - 第二个选择：Authenticated users only
-- 13. Policy definition 改为：
--    (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
-- 14. 点击 "Review"
-- 15. 点击 "Save policy"
--
-- 16. 再次点击 "New Policy"  
-- 17. 选择模板：
--    - 第一个选择：Update
--    - 第二个选择：Authenticated users only
-- 18. Policy definition 改为：
--    (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
-- 19. 点击 "Review"
-- 20. 点击 "Save policy"
--
-- 21. 再次点击 "New Policy"
-- 22. 选择模板：
--    - 第一个选择：Delete
--    - 第二个选择：Authenticated users only
-- 23. Policy definition 改为：
--    (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
-- 24. 点击 "Review"
-- 25. 点击 "Save policy"


-- ============================================
-- 步骤 2: 更新 user_settings 表结构
-- ============================================
-- 由于我们的设置存储在 JSONB 字段中，不需要修改表结构
-- 头像URL将存储在 settings.avatar_url 中

-- 但是我们可以添加一个辅助函数来方便获取头像URL
CREATE OR REPLACE FUNCTION get_user_avatar_url(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avatar_url TEXT;
BEGIN
  SELECT settings->>'avatar_url' 
  INTO v_avatar_url
  FROM user_settings 
  WHERE user_id = p_user_id;
  
  RETURN v_avatar_url;
END;
$$;

-- 添加注释
COMMENT ON FUNCTION get_user_avatar_url IS '获取用户头像URL的辅助函数';


-- ============================================
-- 步骤 3: 创建头像清理触发器（可选）
-- ============================================
-- 当用户删除账号时，自动删除其头像文件
-- 注意：这需要创建一个 Edge Function 来调用 Storage API
-- 这里我们只创建一个标记，实际删除由客户端或Edge Function处理

CREATE OR REPLACE FUNCTION handle_user_avatar_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 记录需要清理的头像路径
  -- 实际文件删除需要通过 Edge Function 或客户端处理
  RAISE NOTICE 'User % deleted, avatar cleanup needed: %', 
    OLD.user_id, 
    OLD.settings->>'avatar_url';
  
  RETURN OLD;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_user_settings_delete ON user_settings;
CREATE TRIGGER on_user_settings_delete
  BEFORE DELETE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_avatar_cleanup();

COMMENT ON TRIGGER on_user_settings_delete ON user_settings IS '用户设置删除时的头像清理触发器';


-- ============================================
-- 步骤 4: 验证设置
-- ============================================
-- 运行以下查询验证所有表和函数已正确创建

-- 检查 user_settings 表是否存在
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_settings'
) AS user_settings_exists;

-- 检查辅助函数是否存在
SELECT EXISTS (
  SELECT FROM pg_proc 
  WHERE proname = 'get_user_avatar_url'
) AS get_avatar_function_exists;

-- 检查触发器是否存在
SELECT EXISTS (
  SELECT FROM pg_trigger 
  WHERE tgname = 'on_user_settings_delete'
) AS avatar_cleanup_trigger_exists;


-- ============================================
-- 完成提示
-- ============================================
-- ✅ SQL 脚本执行完成！
-- 
-- 后续步骤：
-- 1. 确认已在 Dashboard 中创建 "user-avatars" bucket
-- 2. 确认已配置 bucket 的 RLS 策略
-- 3. 在客户端代码中实现头像上传功能
-- 4. 测试头像上传、读取、更新、删除功能
-- 
-- 头像URL格式：
-- https://<project-ref>.supabase.co/storage/v1/object/public/user-avatars/<user-id>/<filename>
-- ============================================
