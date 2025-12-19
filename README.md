# 药箱助手（Medication Tracker）

一个基于"证据"的行为记录系统，专注于真实时间、数据可追溯性和多设备同步。

## ✨ 核心特性

- 📸 **EXIF 时间提取** - 自动从照片中提取真实拍摄时间
- 🔒 **数据可追溯** - 每条记录都有完整的时间戳和哈希验证
- 🔄 **多设备同步** - 支持多设备实时同步，冲突检测和用户决策
- 💾 **Local-first** - 本地优先架构，离线可用
- 🎯 **时间可信度** - 自动计算并标记时间可信度（准时/延迟/可疑）

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 配置（可选）

创建 `.env.local` 文件配置 Supabase：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**如果不配置 Supabase，系统将自动使用 Mock 模式（完全离线）**

### 运行

```bash
npm run dev
```

访问 http://localhost:3000

## 📋 Supabase 设置（可选）

如果需要多设备同步功能：

1. 在 Supabase Dashboard 中执行 `supabase-schema.sql`
2. 创建 Storage Bucket：`medication-images`（公开）
3. 配置 Storage 策略（见 SQL 文件注释）

## 🎯 使用说明

### 记录服药

1. 点击药物卡片上的相机按钮
2. 选择或拍摄照片
3. 系统自动提取 EXIF 时间并计算可信度
4. 记录保存到本地，后台同步到服务器

### 查看时间线

切换到 "History" 标签页查看历史记录，包括：
- EXIF 拍摄时间
- 上传时间
- 设备信息
- 时间可信度状态

### 多设备同步

当其他设备添加记录时，会显示同步提示，用户可以查看详情并决定是否接受。

## 📚 技术栈

- React 19 + TypeScript
- Dexie (IndexedDB) - 本地数据库
- Supabase - 后端服务（可选）
- exif-js - EXIF 时间提取
- crypto-js - 哈希计算
- Tailwind CSS - 样式

## 📖 详细文档

查看 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 了解详细的功能实现说明。

## 🎨 设计理念

本系统不是「打卡 App」，而是：

> **一个基于"证据"的行为记录系统**

核心原则：
1. **真实时间优先于用户输入**
2. **数据可被追溯，不被静默篡改**
3. **多设备同步必须可感知、可决策**

## 📝 License

MIT
