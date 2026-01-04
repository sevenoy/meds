# 修复依赖冲突

## 问题

`lucide-react@0.263.1` 不支持 React 19，导致依赖冲突。

## 解决方案

### 方法一：使用 --legacy-peer-deps（推荐）

```bash
cd frontend
npm install --legacy-peer-deps
```

### 方法二：手动修复

已更新 `frontend/package.json`：
- 升级 `lucide-react` 到 `^0.460.0`（支持 React 19）
- 更新 `@types/react` 和 `@types/react-dom` 到 `^19.0.0`

然后执行：
```bash
cd frontend
npm install
```

## 如果仍然失败

尝试清理缓存后重新安装：

```bash
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
```

