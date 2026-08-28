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

### Docker Compose

后端仓库的 `docker-compose.example.yml` 会构建本目录的 Nginx 静态镜像（默认假设两个仓库
位于同一父目录），并把 `/api` 代理到后端容器。也可以单独构建前端镜像：

```bash
docker build -t pms-front .
docker run --rm -p 5173:80 pms-front
```

生产环境请通过反向代理限制来源，并将后端 `PMS_CORS_ALLOWED_ORIGINS` 配置为实际访问域名。

## 前端界面规范

页面视觉令牌、布局、控件、状态语义和验收清单统一沉淀在
[docs/frontend-design-system.md](docs/frontend-design-system.md)。新增或修改界面时优先复用
`--pms-*` 变量和共享样式，完成后执行 `pnpm typecheck`、`pnpm build` 与浏览器回归。

页面职责、路由访问、人员/组织展示、项目交互和请求状态约定见
[docs/design-logic.md](docs/design-logic.md)。

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

- **登录页**：持久化部署使用企业管理员配置的英文名登录；H2 演示环境才提供 `admin / admin123` 种子账号
- **项目管理**：项目分页列表、搜索、新建/编辑/删除，进入详情
- **项目详情**：头部信息 + 进度环，四个页签
  - **任务看板**：待办 / 进行中 / 已完成三列，支持拖拽切换状态、任务增删改
  - **里程碑**：列表 + 任务进度，增删改
  - **成员**：成员列表、按用户搜索添加、移除（负责人不可移除）
  - **动态**：项目评论时间线，发布/删除
- **企业管理**：组织架构可视化编排、人员与权限、角色数据范围、审计日志和 Excel/CSV 导入预览/提交

企业管理接口与上线配置请参阅后端
[`enterprise-upgrade-runbook.md`](../pms-backend/docs/operations/enterprise-upgrade-runbook.md)。

## 环境变量

`/.env.development`

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `VITE_PORT` | 开发端口 | 5173 |
| `VITE_PROXY_TARGET` | 后端接口代理目标 | http://localhost:8080 |
