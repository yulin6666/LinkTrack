# LinkTrack CI/CD 指南

本文档说明 LinkTrack 的 CI/CD 流程是如何工作的，以及如何从零开始配置和使用它。

---

## 目录

1. [CI/CD 是什么](#1-cicd-是什么)
2. [整体流程图](#2-整体流程图)
3. [现有 CI 配置解析](#3-现有-ci-配置解析)
4. [第一次使用：一步步配置](#4-第一次使用一步步配置)
5. [日常使用：如何触发 CI](#5-日常使用如何触发-ci)
6. [查看 CI 结果](#6-查看-ci-结果)
7. [配置 Codecov 覆盖率报告（可选）](#7-配置-codecov-覆盖率报告可选)
8. [扩展：加入自动部署到 Railway](#8-扩展加入自动部署到-railway)
9. [常见问题](#9-常见问题)

---

## 1. CI/CD 是什么

**CI（持续集成）**：每次提交代码，自动运行测试，确保代码没有破坏已有功能。

**CD（持续部署）**：测试通过后，自动把代码部署到服务器，不需要手动操作。

本项目目前实现了 **CI 部分**（自动测试），CD 部分（自动部署）需要额外配置，见第 8 节。

---

## 2. 整体流程图

```
开发者本地写代码
      ↓
git push 到 GitHub（或创建 Pull Request）
      ↓
GitHub Actions 自动触发
      ↓
┌─────────────────────┐    ┌─────────────────────┐
│   后端测试 Job       │    │   前端测试 Job       │
│                     │    │                     │
│ 1. 安装依赖          │    │ 1. 安装依赖          │
│ 2. 运行 Jest 测试    │    │ 2. 运行 Jest 测试    │
│ 3. 生成覆盖率报告    │    │ 3. 生成覆盖率报告    │
│ 4. 上传到 Codecov   │    │ 4. 构建 Next.js      │
│                     │    │ 5. 上传到 Codecov   │
└─────────────────────┘    └─────────────────────┘
      ↓                           ↓
   通过 ✅ 或失败 ❌          通过 ✅ 或失败 ❌
      ↓
GitHub PR 页面显示结果
```

两个 Job **并行运行**，互不等待，节省时间。

---

## 3. 现有 CI 配置解析

配置文件位于 `.github/workflows/ci.yml`，逐段解释：

### 触发条件

```yaml
on:
  push:
    branches: [main]       # push 到 main 分支时触发
  pull_request:
    branches: [main]       # 向 main 发起 PR 时触发
```

只有涉及 `main` 分支的操作才会触发 CI，推送到其他分支不会触发。

### 后端测试 Job

```yaml
jobs:
  test-backend:
    runs-on: ubuntu-latest   # 在 GitHub 提供的 Ubuntu 虚拟机上运行
    steps:
      - uses: actions/checkout@v4          # 第一步：拉取代码
      - uses: actions/setup-node@v4        # 第二步：安装 Node.js 20
        with:
          node-version: '20'
          cache: 'npm'                     # 缓存 node_modules，加速后续运行
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: backend         # 切换到 backend 目录
        run: npm ci                        # 严格按 lock 文件安装，比 npm install 更稳定

      - name: Run tests
        working-directory: backend
        run: npm test -- --coverage        # 运行测试并生成覆盖率

      - name: Upload coverage
        uses: codecov/codecov-action@v4    # 上传覆盖率到 Codecov
        if: always()                       # 即使测试失败也上传
        with:
          files: ./backend/coverage/lcov.info
          flags: backend
          fail_ci_if_error: false          # Codecov 上传失败不影响 CI 结果
```

### 前端测试 Job

前端 Job 与后端类似，多了一步构建验证：

```yaml
      - name: Build
        working-directory: frontend
        run: npm run build    # 确保代码能成功编译，不只是测试通过
```

---

## 4. 第一次使用：一步步配置

### 前提条件

- 代码已经推送到 GitHub 仓库
- 仓库是 public，或者你有 GitHub Actions 的使用额度（private 仓库每月有免费额度）

### 步骤 1：确认文件存在

检查项目根目录下有没有这个文件：

```
.github/
  workflows/
    ci.yml    ← 这个文件
```

本项目已经有了，不需要创建。

### 步骤 2：推送代码到 GitHub

如果还没有推送过：

```bash
# 在项目根目录
git add .
git commit -m "add CI configuration"
git push origin main
```

### 步骤 3：确认 GitHub Actions 已启用

1. 打开你的 GitHub 仓库页面
2. 点击顶部的 **Actions** 标签
3. 如果看到提示"Workflows aren't being run on this forked repository"，点击 **I understand my workflows, go ahead and enable them**

### 步骤 4：验证 CI 是否工作

推送代码后：

1. 进入 GitHub 仓库 → **Actions** 标签
2. 应该能看到一条正在运行或已完成的 workflow
3. 点进去可以看到每个步骤的日志

---

## 5. 日常使用：如何触发 CI

### 场景一：直接推送到 main

```bash
git add .
git commit -m "fix: 修复某个 bug"
git push origin main
```

推送后 CI 自动触发，无需任何额外操作。

### 场景二：通过 Pull Request（推荐）

这是更规范的做法，可以在合并前看到测试结果：

```bash
# 1. 创建新分支
git checkout -b feature/my-new-feature

# 2. 写代码、提交
git add .
git commit -m "feat: 新功能"
git push origin feature/my-new-feature

# 3. 在 GitHub 上创建 Pull Request，目标分支选 main
# 4. CI 自动运行，PR 页面会显示测试是否通过
# 5. 测试通过后再合并
```

PR 页面底部会显示类似这样的状态：

```
✅ Backend Tests — All checks have passed
✅ Frontend Tests — All checks have passed
```

---

## 6. 查看 CI 结果

### 在 Actions 页面查看

1. GitHub 仓库 → **Actions**
2. 左侧选择 **CI** workflow
3. 点击某次运行，展开每个 Job 查看详细日志

### 在 PR 页面查看

PR 底部的 **Checks** 区域会显示每个 Job 的状态，点击 **Details** 可以看完整日志。

### 理解日志

成功的运行看起来像这样：

```
✅ Checkout code
✅ Setup Node.js
✅ Install dependencies
✅ Run tests
   PASS src/__tests__/routes.test.ts
   PASS src/__tests__/linkService.test.ts
   Tests: 36 passed, 36 total
✅ Upload coverage
```

失败时会显示具体哪个测试失败：

```
❌ Run tests
   FAIL src/__tests__/routes.test.ts
   ● POST /api/v1/links › returns 201 with short link on success
     Expected: 201
     Received: 500
```

---

## 7. 配置 Codecov 覆盖率报告（可选）

Codecov 可以在 PR 里显示覆盖率变化，比如"这次 PR 覆盖率从 49% 提升到 55%"。

### 步骤 1：注册 Codecov

1. 访问 [codecov.io](https://codecov.io)
2. 用 GitHub 账号登录
3. 找到你的仓库，点击 **Setup repo**

### 步骤 2：获取 Token

1. 在 Codecov 仓库设置页面找到 **Repository Upload Token**
2. 复制这个 token

### 步骤 3：添加到 GitHub Secrets

1. GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**
3. Name 填 `CODECOV_TOKEN`，Value 粘贴刚才复制的 token
4. 点击 **Add secret**

### 步骤 4：更新 ci.yml

在 `Upload coverage` 步骤里加上 token：

```yaml
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: always()
        with:
          token: ${{ secrets.CODECOV_TOKEN }}   # 加这一行
          files: ./backend/coverage/lcov.info
          flags: backend
          fail_ci_if_error: false
```

前端的 Upload coverage 步骤同样加上这行。

---

## 8. 扩展：加入自动部署到 Railway

本项目部署在 Railway，可以在测试通过后自动触发重新部署。

### 步骤 1：获取 Railway Token

1. 登录 [railway.app](https://railway.app)
2. 右上角头像 → **Account Settings** → **Tokens**
3. 点击 **New Token**，复制生成的 token

### 步骤 2：获取 Railway Service ID

1. 进入你的 Railway 项目
2. 点击后端 Service → **Settings**
3. 复制 **Service ID**

### 步骤 3：添加到 GitHub Secrets

在 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** 中添加：

| Name | Value |
|------|-------|
| `RAILWAY_TOKEN` | 刚才复制的 Railway token |
| `RAILWAY_BACKEND_SERVICE_ID` | 后端 Service ID |

### 步骤 4：在 ci.yml 末尾添加部署 Job

```yaml
  deploy:
    name: Deploy to Railway
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]   # 必须两个测试都通过才部署
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'  # 只在 push 到 main 时部署

    steps:
      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy backend
        run: railway redeploy --service ${{ secrets.RAILWAY_BACKEND_SERVICE_ID }}
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

加上这个 Job 后，完整流程变为：

```
push 到 main
    ↓
后端测试 + 前端测试（并行）
    ↓
两个都通过
    ↓
自动触发 Railway 重新部署
```

---

## 9. 常见问题

### Q: CI 一直显示 "Waiting for a runner"

**A**: GitHub Actions 免费额度用完了，或者 private 仓库需要等待队列。public 仓库通常几秒内就会开始运行。

### Q: `npm ci` 失败，报错 "package-lock.json not found"

**A**: 需要先在本地运行 `npm install` 生成 `package-lock.json`，然后把它提交到 git：

```bash
cd backend && npm install
cd ../frontend && npm install
git add backend/package-lock.json frontend/package-lock.json
git commit -m "add package-lock.json"
git push
```

### Q: 测试在本地通过，但 CI 里失败

常见原因：
- 本地有 `.env` 文件但 CI 没有 → 检查测试是否依赖环境变量
- 依赖版本不一致 → 确保 `package-lock.json` 已提交
- 时区问题 → CI 运行在 UTC 时区

### Q: 前端 Build 步骤失败

**A**: 通常是 TypeScript 类型错误或缺少环境变量。查看日志里的具体报错，在本地运行 `npm run build` 复现问题。

### Q: 如何跳过某次 CI

在 commit message 里加 `[skip ci]`：

```bash
git commit -m "update README [skip ci]"
```

---

## 相关文件

- CI 配置：`.github/workflows/ci.yml`
- 后端测试：`backend/src/__tests__/`
- 前端测试：`frontend/__tests__/`
- 测试指南：`TESTING.md`
