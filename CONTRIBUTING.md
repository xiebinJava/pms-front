# 贡献指南

共享流程见后端仓库的 [贡献指南](https://github.com/xiebinJava/pms-backend/blob/main/CONTRIBUTING.md)。本仓库提交前请执行：

```bash
./scripts/check-privacy.sh
pnpm test
pnpm typecheck
pnpm build
```

本地 API：在兄弟仓库 `pms-backend` 用 `./scripts/start-local-mysql.sh` 启动 MySQL 8。

壳层、登录页和工作台文案在 `src/locales/zh-CN.ts` 与 `src/locales/en-US.ts`，两边必须同步。
OIDC / LDAP 按钮只有在 `GET /auth/providers` 报告已启用时才显示。
Kubernetes 安装在后端 Helm chart 中，不要在本仓库再加一份。

示例身份使用 `张伟` / `Alex.Zhang` / `alex.zhang@example.com`。不要加入公司品牌名、内部主机名或真实员工身份。
