# Supabase 多设备同步配置指南

## 📋 快速开始

### 1. 注册Supabase账号
访问 https://supabase.com 并注册账号（推荐使用GitHub登录）

### 2. 创建新项目
```
Project name: meds-tracker
Database Password: [设置一个强密码]
Region: Northeast Asia (Tokyo)
Pricing Plan: Free
```

### 3. 运行数据库架构
进入 SQL Editor，运行 `supabase-schema.sql` 中的所有SQL代码

### 4. 创建照片存储Bucket
```
Storage → New bucket
Name: medication-images
Public: ✅ (勾选)
```

配置存储策略：
- **上传策略**: 允许已登录用户上传
- **查看策略**: 允许所有人查看

### 5. 获取API密钥
```
Settings → API
```
复制：
- Project URL: `https://xxxxx.supabase.co`
- anon public key: `eyJhbGciOiJI...`

### 6. 配置环境变量
```bash
# 复制模板
cp .env.example .env

# 编辑 .env 文件，填入实际值
VITE_SUPABASE_URL=https://你的项目ID.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon密钥
```

### 7. 创建测试用户
```
Authentication → Users → Add user
Email: test@example.com
Password: 设置密码
Auto Confirm User: ✅
```

### 8. 重启开发服务器
```bash
npm run dev
```

## ✅ 验证配置

打开浏览器控制台，运行：
```javascript
console.log('Mock模式:', window.location.href.includes('supabase') ? '已连接Supabase' : '纯本地模式');
```

## 🔄 数据同步机制

配置完成后，应用会自动：
- ✅ 每30秒同步一次数据
- ✅ 实时接收其他设备的更新
- ✅ 照片上传到Supabase Storage
- ✅ 本地IndexedDB作为缓存

## 🔒 安全性

- ✅ RLS（行级安全）：用户只能访问自己的数据
- ✅ 图片哈希校验：防止重复/篡改
- ✅ Supabase Auth认证
- ✅ HTTPS加密传输

## 📱 多设备使用

1. 在每台设备上配置相同的 `.env` 文件
2. 使用相同的账号登录
3. 数据会自动在所有设备间同步

## ⚠️ 注意事项

1. **不要提交 `.env` 文件到Git**（已在.gitignore中）
2. **不要泄露 anon key**（虽然它是公开的，但要保护项目URL）
3. **定期备份数据**（Supabase免费版有数据库大小限制）
4. **监控使用量**（免费版有请求限制）

## 🆘 常见问题

### Q: 显示 "Mock模式"？
A: 检查 `.env` 文件是否正确配置，环境变量名是否以 `VITE_` 开头

### Q: 无法上传照片？
A: 检查Storage bucket是否创建，策略是否配置正确

### Q: 数据不同步？
A: 
1. 检查网络连接
2. 打开浏览器控制台查看错误
3. 确认用户已登录（localStorage中有user_id）

### Q: 如何查看数据库？
A: Supabase Dashboard → Table Editor → medications / medication_logs

## 📊 免费版限制

- ✅ 500MB 数据库存储
- ✅ 1GB 文件存储
- ✅ 50,000 月活用户
- ✅ 2GB 带宽/月
- ✅ Realtime连接

对于个人使用完全够用！

## 🔗 相关链接

- Supabase文档: https://supabase.com/docs
- JavaScript客户端: https://supabase.com/docs/reference/javascript
- Storage指南: https://supabase.com/docs/guides/storage

