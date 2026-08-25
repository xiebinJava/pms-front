# PMS Front — 项目管理系统前端

基于 Vue 3 + Vite + ant-design-vue 的开源项目管理系统前端，工程规范参考业界主流 Vue3 中后台工程骨架精简而来。

## 技术栈

- Vue 3.5 + TypeScript + Vite 6 + pnpm
- ant-design-vue 4 + @ant-design/icons-vue
- Pinia 状态管理 + vue-router 4
- UnoCSS 原子类
- axios 统一请求封装
- dayjs

## 快速启动

```bash
pnpm install
pnpm dev
```

默认 `http://localhost:5173`，已配置 `/api` 代理到 `http://localhost:8080`（后端默认地址）。

### 构建

```bash
pnpm build      # 类型检查 + 生产构建
pnpm typecheck  # 仅类型检查
```

## 目录结构

```
src/
├── api/         接口层（auth/user/project/task/milestone/member/comment）
├── enums/       createEnum 枚举工厂（项目/任务/优先级/里程碑/成员角色）
├── layout/      主布局（侧边栏 + 顶栏）
├── plugins/     http（axios 拦截器，自动带 token / 401 跳登录）
├── router/      路由（登录守卫）
├── store/       pinia（用户状态）
├── styles/      全局样式
├── types/       全局类型（api / domain）
├── utils/       工具（日期格式化）
└── views/       页面（login / project/list / project/detail）
```

## 页面

- **登录页**：默认账号 `admin / admin123`
- **项目管理**：项目分页列表、搜索、新建/编辑/删除，进入详情
- **项目详情**：头部信息 + 进度环，四个页签
  - **任务看板**：待办 / 进行中 / 已完成三列，支持拖拽切换状态、任务增删改
  - **里程碑**：列表 + 任务进度，增删改
  - **成员**：成员列表、按用户搜索添加、移除（负责人不可移除）
  - **动态**：项目评论时间线，发布/删除

## 环境变量

`/.env.development`

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `VITE_PORT` | 开发端口 | 5173 |
| `VITE_PROXY_TARGET` | 后端接口代理目标 | http://localhost:8080 |
