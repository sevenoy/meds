# 删除后端代码

## 手动删除步骤

由于权限限制，请手动删除后端目录：

```bash
cd "/Users/lorenmac/Downloads/26年软件项目/Meds/meds"
rm -rf backend
```

或者使用 Finder：
1. 打开项目目录
2. 找到 `backend` 文件夹
3. 右键删除或拖到废纸篓

## 验证删除

删除后，项目结构应该是：

```
meds/
├── frontend/          # 前端应用（保留）
├── shared/            # 共享类型（保留）
└── 文档文件
```

不应该再有 `backend/` 目录。

