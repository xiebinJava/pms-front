# Contributing

See the backend `CONTRIBUTING.md` for the shared workflow. In this repository:

```bash
./scripts/check-privacy.sh
pnpm test
pnpm typecheck
pnpm build
```

Local API: start the sibling `pms-backend` with `./scripts/start-local-mysql.sh` (MySQL 8, contributor-only). Enterprise runtime stays on OceanBase.

UI copy for the shell, sign-in, and workbench lives in `src/locales/zh-CN.ts` and `src/locales/en-US.ts`. Keep both trees in sync.
OIDC/LDAP buttons stay hidden until `GET /auth/providers` reports them enabled.

Use `张伟` / `Alex.Zhang` / `alex.zhang@example.com` for examples. Do not add company brand names, internal hostnames, or real employee identities.
