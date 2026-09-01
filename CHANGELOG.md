# Changelog

## Unreleased

- Release-closure snapshot (2026-09-01): `pnpm test` 111/111 passed; `pnpm typecheck` and `pnpm build` passed. Playwright desktop, 390px narrow-screen, and manual recording flows passed with deterministic `zh-CN` locale.
- Load the workbench from `GET /workbench` instead of fanning out project, task, and comment requests.
- Open a task detail from the kanban or workbench with subtasks, comments, and attachments.
- Add header search (projects, tasks, milestones, comments) and an in-app notification bell. Project comments now reach followers; completing or rolling back a node opens the matching stage.
- Point local contributors at the sibling MySQL 8 start path.
- Add Chinese / English UI switching for the shell, sign-in, and workbench. Preference is stored in localStorage.
- Extend locale coverage to project list, project detail, task board, task detail, collaboration tabs, admin pages, and the user-guide chrome. Status and priority labels follow the active language.
- Show OIDC / LDAP buttons on the sign-in page when the backend enables those providers.
- Refresh the README so the workbench, search, notifications, locale switch, and SSO callback are documented. Kubernetes install stays in the backend Helm chart.
- Add project Gantt and calendar views in the collaboration section. They read existing project/node dates, milestone due dates, and dated tasks.
- Refresh the in-app user guide and the markdown manual so they match search, notifications, Gantt, and admin behavior. Login screenshot is current; remaining shots will follow the live UI.
- Distinguish login connection failures from credential errors: a down backend now says the service is unreachable instead of a generic retry later.

## 1.0.0

- Vue 3 workbench, project kanban, organization canvas, and admin pages.
- Privacy denylist scan in CI. Demo copy uses fictional identities only.
