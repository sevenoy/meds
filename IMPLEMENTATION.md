# 药箱助手 - 功能实现说明

## ✅ 已完成功能

### 1. 核心架构
- ✅ Local-first 架构（IndexedDB/Dexie）
- ✅ Supabase 集成（支持 Mock 模式）
- ✅ 多设备同步框架
- ✅ 冲突检测机制

### 2. EXIF 时间提取系统
- ✅ EXIF 时间解析（DateTimeOriginal > CreateDate）
- ✅ 时间可信度计算（ontime/late/suspect）
- ✅ 降级处理（无 EXIF 时使用系统时间）

### 3. 数据模型
- ✅ Medication（药物定义）
- ✅ MedicationLog（证据记录表）
- ✅ 完整的类型定义

### 4. 本地数据库
- ✅ Dexie 数据库初始化
- ✅ 同步状态管理（clean/dirty/conflict）
- ✅ 设备标识生成

### 5. 照片处理
- ✅ 照片上传（Supabase Storage / DataURL）
- ✅ SHA-256 哈希计算
- ✅ 防重复上传机制

### 6. 同步系统
- ✅ 本地推送（pushLocalChanges）
- ✅ 远程拉取（pullRemoteChanges）
- ✅ Realtime 监听
- ✅ 冲突检测和提示

### 7. UI 组件
- ✅ 相机拍照模态框
- ✅ 同步提示组件
- ✅ 时间线展示
- ✅ 进度环显示

### 8. Mock 模式
- ✅ 完全离线可用
- ✅ 数据存储在 IndexedDB
- ✅ 照片使用 DataURL

## 📋 使用说明

### 安装依赖

```bash
npm install
```

### 配置 Supabase（可选）

1. 创建 `.env.local` 文件：
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

2. 在 Supabase 中执行 `supabase-schema.sql` 创建数据库表

3. 在 Supabase Storage 中创建 `medication-images` bucket

**如果不配置 Supabase，系统将自动使用 Mock 模式（完全离线）**

### 运行项目

```bash
npm run dev
```

## 🔧 核心功能使用

### 记录服药

1. 点击药物卡片上的相机按钮
2. 选择或拍摄照片
3. 系统自动提取 EXIF 时间
4. 计算时间可信度
5. 保存到本地数据库
6. 后台同步到服务器（如果配置了 Supabase）

### 多设备同步

- 当其他设备添加记录时，会显示同步提示
- 用户可以查看记录详情并决定是否接受
- 系统会检测冲突并提示用户

### 时间线查看

- 切换到 "History" 标签页
- 查看最近7天的服药记录
- 显示 EXIF 时间、上传时间、设备信息
- 可疑记录会有特殊标记

## 🎯 技术特点

### 1. 真实时间优先
- 优先使用 EXIF 时间
- 明确标记时间来源
- 时间差超过阈值会标记为可疑

### 2. 数据可追溯
- 每条记录都有完整的时间戳
- 照片哈希防止篡改
- 设备信息记录

### 3. 多设备同步
- Realtime 通知
- 用户决策机制
- 冲突检测

## 📝 待完善功能（可选）

1. **用户认证 UI**
   - 登录/注册界面
   - 当前使用简化版认证

2. **药物管理**
   - 添加/编辑/删除药物
   - 当前使用默认数据

3. **数据导出**
   - CSV/PDF 导出
   - 合规报告

4. **通知提醒**
   - 服药提醒
   - 同步通知

5. **照片查看**
   - 全屏查看
   - 放大缩小

## 🐛 已知问题

1. exif-js 在某些浏览器可能需要 polyfill
2. 照片上传失败时错误处理可以更完善
3. 同步冲突解决界面可以更详细

## 📚 技术栈

- React 19
- TypeScript
- Dexie (IndexedDB)
- Supabase
- exif-js
- crypto-js
- Tailwind CSS
- Vite





