# LinkTrack 测试指南

本文档说明如何在 LinkTrack 项目中运行和编写测试。

---

## 快速开始

### 运行所有测试

```bash
# 后端测试
cd backend
npm test

# 前端测试
cd frontend
npm test
```

### 运行测试并生成覆盖率报告

```bash
# 后端
cd backend
npm run test:coverage

# 前端
cd frontend
npm run test:coverage
```

覆盖率报告会生成在 `coverage/` 目录，打开 `coverage/lcov-report/index.html` 查看详细报告。

---

## 测试框架

### 后端（Node.js + Express）

- **测试框架**: Jest
- **HTTP 测试**: Supertest
- **TypeScript 支持**: ts-jest

### 前端（Next.js + React）

- **测试框架**: Jest
- **组件测试**: React Testing Library
- **DOM 环境**: jsdom

---

## 测试文件结构

```
backend/
  src/
    __tests__/
      analyticsService.test.ts    # 数据解析逻辑测试
      linkService.test.ts         # 短链服务测试
      routes.test.ts              # API 路由测试
  jest.config.ts                  # Jest 配置

frontend/
  __tests__/
    api.test.ts                   # API 客户端测试
    LinkList.test.tsx             # LinkList 组件测试
  jest.config.ts                  # Jest 配置
  jest.setup.ts                   # 测试环境初始化
```

---

## 后端测试详解

### 测试覆盖范围

| 模块 | 测试内容 |
|------|---------|
| `analyticsService` | User-Agent 解析、IP 地理位置、Referer 识别 |
| `linkService` | 创建短链、URL 查询、缓存逻辑、防穿透/防击穿 |
| `routes` | POST/GET 参数校验、302 重定向、404 处理、点击事件入队 |

### Mock 策略

所有外部依赖（数据库、Redis、队列）都被 mock，测试只验证业务逻辑：

```typescript
jest.mock('../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../services/cacheService', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    // ...
  },
}));
```

### 运行单个测试文件

```bash
npm test -- linkService.test.ts
```

### 监听模式（开发时推荐）

```bash
npm test -- --watch
```

---

## 前端测试详解

### 测试覆盖范围

| 模块 | 测试内容 |
|------|---------|
| `api.ts` | fetch 请求构造、响应解析、错误处理 |
| `LinkList.tsx` | Loading/Error/Empty 状态、数据渲染、分页交互、refresh 触发 |

### Mock 策略

- **API 模块**: 使用 `jest.mock('@/lib/api')` mock 所有 API 调用
- **Next.js 组件**: mock `next/link` 和 `next/navigation`
- **全局 fetch**: 在 `api.test.ts` 中 mock `global.fetch`

### 组件测试示例

```typescript
it('shows loading state initially', () => {
  mockGetAllLinks.mockReturnValue(new Promise(() => {})); // 永不 resolve
  render(<LinkList refresh={0} />);
  expect(screen.getByText('Loading links...')).toBeInTheDocument();
});
```

### 异步测试

使用 `waitFor` 等待异步操作完成：

```typescript
await waitFor(() => {
  expect(screen.getByText('abc123')).toBeInTheDocument();
});
```

---

## CI/CD 集成

### GitHub Actions

每次 push 到 `main` 或创建 PR 时，会自动运行：

1. **后端测试** (Node.js 20)
   - 安装依赖
   - 运行测试 + 覆盖率
   - 上传覆盖率到 Codecov

2. **前端测试** (Node.js 20)
   - 安装依赖
   - 运行测试 + 覆盖率
   - 构建验证（`npm run build`）
   - 上传覆盖率到 Codecov

配置文件：`.github/workflows/ci.yml`

### 查看 CI 状态

在 GitHub PR 页面或 Actions 标签页查看测试结果。

---

## 如何新增测试

### 后端测试

1. 在 `backend/src/__tests__/` 创建 `*.test.ts` 文件
2. Mock 外部依赖（数据库、Redis、第三方库）
3. 导入要测试的模块
4. 编写测试用例

**示例：测试新的 service**

```typescript
// Mock dependencies
jest.mock('../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import myService from '../services/myService';
import pool from '../config/database';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('MyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const result = await myService.doSomething();
    expect(result).toBeDefined();
  });
});
```

### 前端测试

1. 在 `frontend/__tests__/` 创建 `*.test.tsx` 文件
2. Mock API 调用和 Next.js 组件
3. 使用 `render` 渲染组件
4. 使用 `screen` 查询元素
5. 使用 `waitFor` 处理异步

**示例：测试新组件**

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

---

## 常见问题

### Q: 后端测试报错 "Cannot use import statement outside a module"

**A**: 某些 ESM 包（如 `nanoid`）需要 mock。在测试文件顶部添加：

```typescript
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-id'),
}));
```

### Q: 前端测试报错 "React is not defined"

**A**: 确保 `jest.config.ts` 中 `jsx` 设置为 `react-jsx`：

```typescript
transform: {
  '^.+\\.(ts|tsx)$': ['ts-jest', {
    tsconfig: { jsx: 'react-jsx' },
  }],
},
```

### Q: 如何跳过某个测试？

**A**: 使用 `it.skip` 或 `describe.skip`：

```typescript
it.skip('this test is skipped', () => {
  // ...
});
```

### Q: 如何只运行某个测试？

**A**: 使用 `it.only` 或 `describe.only`：

```typescript
it.only('only run this test', () => {
  // ...
});
```

---

## 测试最佳实践

1. **测试行为，不是实现**
   - ✅ 测试用户看到的结果
   - ❌ 测试内部变量或私有方法

2. **保持测试独立**
   - 每个测试应该能独立运行
   - 使用 `beforeEach` 重置 mock

3. **使用有意义的测试名称**
   - ✅ `it('returns 404 when link not found')`
   - ❌ `it('test1')`

4. **Mock 外部依赖**
   - 数据库、Redis、第三方 API 都应该 mock
   - 测试应该快速且可重复

5. **覆盖边界情况**
   - 空输入、无效输入、错误状态
   - 不只测试 happy path

---

## 相关资源

- [Jest 官方文档](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Supertest](https://github.com/ladjs/supertest)
- [GitHub Actions](https://docs.github.com/en/actions)

---

## 联系方式

如有测试相关问题，请在项目 issue 中提出。
