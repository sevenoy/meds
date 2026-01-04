# 安装问题修复

## 问题 1: @types/exif-js 版本不存在

**解决方案**: 已移除 `@types/exif-js`，改为使用自定义类型声明文件。

## 问题 2: vite 命令找不到

**原因**: 依赖没有安装成功

**解决方案**: 重新安装依赖

## 修复步骤

### 1. 清理并重新安装

```bash
cd "/Users/lorenmac/Downloads/26年软件项目/Meds/meds/frontend"

# 清理
rm -rf node_modules package-lock.json

# 重新安装
npm install --legacy-peer-deps
```

### 2. 验证安装

```bash
# 检查 node_modules 是否存在
ls node_modules | head -10

# 检查 vite 是否安装
ls node_modules/.bin/vite
```

### 3. 如果 vite 仍然找不到

使用 npx 运行：

```bash
npx vite
```

或者直接使用完整路径：

```bash
./node_modules/.bin/vite
```

## 完整的安装命令

```bash
cd "/Users/lorenmac/Downloads/26年软件项目/Meds/meds/frontend"
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
```

安装完成后：

```bash
npm run dev
```

## 如果仍然失败

尝试使用 yarn：

```bash
# 安装 yarn（如果还没有）
npm install -g yarn

# 使用 yarn 安装
cd "/Users/lorenmac/Downloads/26年软件项目/Meds/meds/frontend"
yarn install
yarn dev
```

