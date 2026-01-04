# 药盒助手 - 前端应用

## 📋 项目说明

这是药盒助手的前端应用，包含完整的 UI 和业务逻辑。后端 API 需要单独实现。

## 🎯 当前状态

- ✅ 前端 UI 完整实现
- ✅ 本地存储（IndexedDB）
- ✅ 核心功能完整
- ⏳ 后端 API 待实现

## 📁 项目结构

```
frontend/
├── src/
│   ├── components/          # React 组件
│   │   ├── MainApp.tsx      # 主应用容器
│   │   ├── MedicationList.tsx    # 药品列表
│   │   ├── AddMedicationModal.tsx # 添加/编辑药品模态框
│   │   ├── CameraModal.tsx       # 拍照模态框
│   │   ├── TodayProgress.tsx     # 今日进度
│   │   ├── LogHistory.tsx        # 历史记录
│   │   └── SyncStatusIndicator.tsx # 同步状态
│   ├── services/           # 业务逻辑
│   │   ├── medication.ts   # 药品管理
│   │   ├── logs.ts        # 记录管理
│   │   ├── sync.ts        # 数据同步
│   │   └── realtime.ts    # 实时同步
│   ├── db/                 # 数据库
│   │   └── localDB.ts      # IndexedDB 封装
│   ├── lib/                # 库封装
│   │   ├── supabase.ts    # Supabase 客户端
│   │   └── localAuth.ts   # 本地认证（测试模式）
│   └── utils/              # 工具函数
├── public/                 # 静态资源
└── package.json           # 依赖配置
```

## 🚀 快速开始

### 安装依赖

```bash
cd frontend
npm install --legacy-peer-deps
```

### 配置环境变量

创建 `frontend/.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_LOCAL_TEST_MODE=true
VITE_SKIP_LOGIN=true
```

### 启动开发服务器

```bash
npm run dev
```

访问: http://localhost:3000

## 📚 文档

- **[FRONTEND_UI_DOCUMENTATION.md](./FRONTEND_UI_DOCUMENTATION.md)** - 前端 UI 功能详细说明
- **[BACKEND_REQUIREMENTS.md](./BACKEND_REQUIREMENTS.md)** - 后端 API 需求文档
- **[FEATURES_SUMMARY.md](./FEATURES_SUMMARY.md)** - 功能实现总结
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - 测试指南

## ✨ 核心功能

### 已实现
- ✅ 药品管理（添加/编辑/删除）
- ✅ 拍照记录功能
- ✅ 今日进度显示
- ✅ 历史记录列表
- ✅ 本地数据存储
- ✅ 响应式设计

### 待后端支持
- ⏳ API 接口集成
- ⏳ 实时同步
- ⏳ 云端存储
- ⏳ 用户认证

## 🔧 技术栈

- React 19.2.3
- TypeScript 5.8.2
- Vite 6.2.0
- Tailwind CSS
- Dexie (IndexedDB)
- Lucide React (图标)

## 📝 开发说明

### 跳过登录
代码中已强制跳过登录，直接进入主页面（`App.tsx` 中 `SKIP_LOGIN = true`）

### 本地测试模式
启用 `VITE_LOCAL_TEST_MODE=true` 后，使用本地认证，无需后端

### API 集成
所有 API 调用在 `services/` 目录中，需要配置正确的 API 端点

## 🎯 下一步

1. 实现后端 API（参考 `BACKEND_REQUIREMENTS.md`）
2. 配置 API 端点
3. 集成实时同步
4. 测试完整流程

---

**版本**: V260103.01  
**最后更新**: 2026-01-03
