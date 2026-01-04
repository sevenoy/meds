# 项目结构说明

## 目录结构

```
meds/
├── frontend/                    # 前端应用
│   ├── public/                  # 静态资源
│   │   ├── icon/               # 应用图标
│   │   ├── manifest.json       # PWA Manifest
│   │   └── sw.js               # Service Worker
│   ├── src/
│   │   ├── components/         # React 组件
│   │   │   ├── LoginPage.tsx   # 登录页面
│   │   │   ├── MainApp.tsx     # 主应用
│   │   │   ├── MedicationList.tsx  # 药品列表
│   │   │   ├── CameraModal.tsx     # 拍照模态框
│   │   │   ├── SyncStatusIndicator.tsx  # 同步状态指示器
│   │   │   └── UpdateNotification.tsx   # 更新通知
│   │   ├── services/          # 业务逻辑服务
│   │   │   ├── medication.ts   # 药品管理
│   │   │   ├── realtime.ts     # 实时同步
│   │   │   └── sync.ts         # 数据同步
│   │   ├── db/                 # 数据库层
│   │   │   └── localDB.ts      # Dexie 封装
│   │   ├── lib/                # 第三方库封装
│   │   │   └── supabase.ts    # Supabase 客户端
│   │   ├── utils/              # 工具函数
│   │   │   ├── exif.ts        # EXIF 提取
│   │   │   ├── crypto.ts      # 加密工具
│   │   │   ├── networkCheck.ts # 网络检测
│   │   │   └── index.ts       # 通用工具
│   │   ├── config/             # 配置文件
│   │   │   └── version.ts     # 版本配置
│   │   ├── App.tsx            # 主应用组件
│   │   ├── App.css            # 应用样式
│   │   ├── main.tsx           # 入口文件
│   │   ├── index.css          # 全局样式
│   │   └── sw-register.ts     # Service Worker 注册
│   ├── index.html             # HTML 入口
│   ├── package.json          # 依赖配置
│   ├── tsconfig.json          # TypeScript 配置
│   ├── vite.config.ts         # Vite 配置
│   ├── tailwind.config.js     # Tailwind 配置
│   └── postcss.config.js      # PostCSS 配置
│
├── backend/                    # 后端 API
│   ├── src/
│   │   ├── routes/            # API 路由
│   │   │   ├── auth.ts        # 认证路由
│   │   │   ├── medications.ts # 药品路由
│   │   │   ├── logs.ts        # 记录路由
│   │   │   └── snapshots.ts   # 快照路由
│   │   ├── middleware/        # 中间件
│   │   │   └── auth.ts        # 认证中间件
│   │   ├── lib/               # 库封装
│   │   │   └── supabase.ts    # Supabase 客户端
│   │   └── index.ts           # 入口文件
│   ├── database/              # 数据库脚本
│   │   ├── schema.sql         # 数据库架构
│   │   └── storage-setup.sql  # Storage 设置
│   ├── package.json           # 依赖配置
│   ├── tsconfig.json           # TypeScript 配置
│   └── .env.example           # 环境变量示例
│
├── shared/                     # 共享代码
│   └── types/                  # 类型定义
│       └── index.ts           # 共享类型
│
├── README.md                   # 项目说明
├── SETUP.md                    # 设置指南
├── PROJECT_STRUCTURE.md        # 项目结构说明
└── TECHNICAL_WHITEPAPER.md     # 技术白皮书
```

## 技术栈

### 前端
- **框架**: React 19.2.3
- **语言**: TypeScript 5.8.2
- **构建工具**: Vite 6.2.0
- **样式**: Tailwind CSS 3.3.6
- **图标**: Lucide React
- **路由**: React Router 6.21.1
- **本地存储**: Dexie 3.2.4 (IndexedDB)
- **云端服务**: Supabase 2.39.0
- **图像处理**: EXIF.js, heic2any
- **加密**: crypto-js

### 后端
- **框架**: Express 4.18.2
- **语言**: TypeScript 5.8.2
- **运行时**: Node.js 18+
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth (JWT)
- **验证**: Zod 3.22.4

## 核心模块

### 前端模块

#### 1. 组件层 (`components/`)
- **LoginPage**: 用户登录/注册
- **MainApp**: 主应用容器
- **MedicationList**: 药品列表展示
- **CameraModal**: 拍照记录模态框
- **SyncStatusIndicator**: 同步状态显示
- **UpdateNotification**: PWA 更新通知

#### 2. 服务层 (`services/`)
- **medication.ts**: 药品 CRUD 操作
- **realtime.ts**: 实时同步管理
- **sync.ts**: 数据同步逻辑

#### 3. 数据层 (`db/`)
- **localDB.ts**: IndexedDB 封装（Dexie）

#### 4. 工具层 (`utils/`)
- **exif.ts**: EXIF 时间提取
- **crypto.ts**: 图片哈希计算
- **networkCheck.ts**: 网络状态检测
- **index.ts**: 通用工具函数

### 后端模块

#### 1. 路由层 (`routes/`)
- **auth.ts**: 用户认证
- **medications.ts**: 药品管理 API
- **logs.ts**: 服药记录 API
- **snapshots.ts**: 快照管理 API

#### 2. 中间件 (`middleware/`)
- **auth.ts**: JWT 认证验证

#### 3. 数据库 (`database/`)
- **schema.sql**: 数据库表结构
- **storage-setup.sql**: Storage 配置

## 数据流

```
用户操作
  ↓
React 组件
  ↓
Service 层
  ↓
┌─────────────┬─────────────┐
│  Local DB   │   Supabase  │
│ (IndexedDB) │ (PostgreSQL)│
└─────────────┴─────────────┘
       ↓              ↓
    Realtime ←───────┘
    (WebSocket)
       ↓
   更新 UI
```

## 开发流程

1. **前端开发**: `cd frontend && npm run dev`
2. **后端开发**: `cd backend && npm run dev`
3. **数据库迁移**: 在 Supabase Dashboard 执行 SQL
4. **构建生产**: `npm run build`

## 环境变量

### 前端 (.env)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 后端 (.env)
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PORT=3001
NODE_ENV=development
```

## 更多信息

详细技术文档请参考 [TECHNICAL_WHITEPAPER.md](./TECHNICAL_WHITEPAPER.md)

