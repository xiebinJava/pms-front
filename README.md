# PMS Front — 项目管理系统前端

单企业、本地部署的开源项目管理前端。和兄弟仓库 [`pms-backend`](../pms-backend) 一起用。许可证 Apache-2.0，贡献前请读 [CONTRIBUTING.md](CONTRIBUTING.md)。

演示身份只用 `张伟` / `Alex.Zhang` / `alex.zhang@example.com`。

## 现在能做什么

- 工作台：我的任务、参与项目、最近动态
- 项目列表与详情：看板、任务详情（子任务 / 评论 / 附件）、里程碑、成员、动态
- 顶栏搜索、站内通知铃
- 登录页 / 顶栏 / 工作台 / 项目协作面的中文 · English 切换（写入 `localStorage` 的 `pms.locale`）
- 后端打开 OIDC / LDAP 时，登录页出现对应入口；否则只显示邮箱登录
- 企业管理：组织画布、人员、角色数据范围、审计、Excel/CSV 导入
- 应用内「使用手册」页

手册、截图和设计约定：

- [docs/user-manual.md](docs/user-manual.md)
- [docs/frontend-design-system.md](docs/frontend-design-system.md)
- [docs/design-logic.md](docs/design-logic.md)

## 技术栈

- Vue 3.5 + TypeScript + Vite 6 + pnpm 9.15.9（`packageManager` 锁定）
- ant-design-vue 4、Pinia、vue-router 4、vue-i18n
- UnoCSS、axios、dayjs

## 快速启动

先在后端仓库起 API。贡献者可用 MySQL 8：`./scripts/start-local-mysql.sh`。企业演练仍走 OceanBase，不要把生产库改成 MySQL。

```bash
pnpm install
pnpm dev
```

默认 `http://localhost:5173`，`/api` 代理到 `http://localhost:8080`。本机 Vite 有时只听 `[::1]`，请用 `localhost` 而不是 `127.0.0.1` 打开。

空库首次启动后的演示管理员是后端注入的 `alex.zhang@example.com` / 张伟，密码在你自己的 env 里，不写在这份 README。

### 构建与检查

```bash
pnpm test
pnpm typecheck
pnpm build
./scripts/check-privacy.sh
```

界面改动优先复用 `--pms-*` 变量。文案放在 `src/locales/zh-CN.ts` 与 `src/locales/en-US.ts`，两棵树保持同步。OIDC / LDAP 按钮在 `GET /auth/providers` 报启用之前不要画出来。

### Docker Compose 与 Helm

后端仓库的 `docker-compose.example.yml` 会构建本目录的 Nginx 镜像（默认两个仓库在同一父目录），并把 `/api` 代理到服务名 `backend`。也可以单独构建：

```bash
docker build -t pms-front:1.0.0 .
docker run --rm -p 5173:8080 pms-front:1.0.0
```

最终层使用非 root Nginx。集群部署用后端仓库的 [`deploy/helm/pms`](../pms-backend/deploy/helm/pms/README.md)，不在本仓库再放一份 Chart。

生产请用反向代理限制来源，并把后端 `PMS_CORS_ALLOWED_ORIGINS` 配成实际访问域名。

## 目录

```
src/
├── api/         接口（auth / workbench / notification / search / project / task / admin…）
├── auth/        SSO 启动与回调
├── components/  共享控件与语言切换
├── enums/       createEnum（状态、优先级、角色等）
├── i18n/        vue-i18n
├── layout/      侧边栏 + 顶栏（搜索、通知）
├── locales/     zh-CN / en-US
├── plugins/     axios（token、刷新、401）
├── router/      登录守卫与管理页权限
├── store/       用户、语言
├── styles/      全局与设计令牌
├── types/       api / domain
├── utils/       日期等
└── views/       登录、工作台、项目、管理、手册
```

## 页面

- **登录 / 激活 / 重置密码**：邮箱登录；后端启用时显示 OIDC / LDAP
- **OIDC 回调**：`/login/oidc/callback`
- **工作台**：当前用户的任务、项目和最近动态
- **项目列表**：分页、搜索、新建 / 编辑 / 删除
- **项目详情**：看板拖拽、任务详情、里程碑、成员、动态
- **企业管理**：组织、人员、角色、导入、审计
- **使用手册**：模块化操作说明

升级与生产配置看后端 [`enterprise-upgrade-runbook.md`](../pms-backend/docs/operations/enterprise-upgrade-runbook.md)。

## 环境变量

开发环境见 `/.env.development`。

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `VITE_PORT` | 开发端口 | 5173 |
| `VITE_PROXY_TARGET` | 后端代理目标 | http://localhost:8080 |
