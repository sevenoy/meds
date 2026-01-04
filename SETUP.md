# 项目设置指南

## 前置要求

- Node.js 18+ 
- npm 或 yarn
- Supabase 账号（用于数据库和认证）

## 快速开始

### 1. 安装依赖

```bash
# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ../backend
npm install
```

### 2. 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 获取项目 URL 和 API Keys
3. 执行数据库迁移脚本：

```bash
# 在 Supabase Dashboard 的 SQL Editor 中执行
backend/database/schema.sql
```

4. 创建 Storage Bucket：
   - 名称: `medication-photos`
   - 私有访问
   - 配置 RLS 策略（参考 `backend/database/storage-setup.sql`）

### 3. 配置环境变量

#### 前端 (.env)

```bash
cd frontend
cp .env.example .env
```

编辑 `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### 后端 (.env)

```bash
cd backend
cp .env.example .env
```

编辑 `.env`:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
NODE_ENV=development
```

### 4. 启动开发服务器

#### 终端 1 - 后端
```bash
cd backend
npm run dev
```

后端将在 http://localhost:3001 运行

#### 终端 2 - 前端
```bash
cd frontend
npm run dev
```

前端将在 http://localhost:3000 运行

### 5. 构建生产版本

#### 前端
```bash
cd frontend
npm run build
```

构建产物在 `frontend/dist/`

#### 后端
```bash
cd backend
npm run build
npm start
```

## 项目结构

```
meds/
├── frontend/              # React 前端应用
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── services/      # 业务逻辑服务
│   │   ├── db/           # 本地数据库 (Dexie)
│   │   ├── lib/          # 第三方库封装
│   │   └── utils/        # 工具函数
│   └── public/           # 静态资源
├── backend/              # Express 后端 API
│   ├── src/
│   │   ├── routes/       # API 路由
│   │   ├── middleware/   # 中间件
│   │   └── lib/          # 库封装
│   └── database/         # 数据库迁移脚本
├── shared/               # 共享类型定义
└── TECHNICAL_WHITEPAPER.md  # 技术白皮书
```

## 核心功能

- ✅ 用户认证（Supabase Auth）
- ✅ 药品管理（CRUD）
- ✅ 服药记录与照片证据链
- ✅ EXIF 时间提取
- ✅ 多设备实时同步（Supabase Realtime）
- ✅ 离线优先架构（IndexedDB）
- ✅ PWA 支持
- ✅ 快照同步机制

## 开发指南

### 添加新 API 路由

1. 在 `backend/src/routes/` 创建新路由文件
2. 在 `backend/src/index.ts` 注册路由
3. 使用 `authenticate` 中间件保护路由

### 添加新前端组件

1. 在 `frontend/src/components/` 创建组件
2. 使用 TypeScript 和 Tailwind CSS
3. 遵循现有代码风格

### 数据库迁移

1. 在 `backend/database/` 创建新的 SQL 文件
2. 在 Supabase Dashboard 执行
3. 更新 `schema.sql` 文档

## 故障排查

### 前端无法连接后端

- 检查后端是否运行在 3001 端口
- 检查 `vite.config.ts` 中的 proxy 配置

### Supabase 连接失败

- 检查环境变量是否正确
- 检查 Supabase 项目是否激活
- 检查网络连接

### 实时同步不工作

- 检查 Supabase Realtime 是否启用
- 检查 RLS 策略是否正确
- 查看浏览器控制台日志

## 更多文档

详细技术文档请参考 [TECHNICAL_WHITEPAPER.md](./TECHNICAL_WHITEPAPER.md)

