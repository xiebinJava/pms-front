# Changelog

## Unreleased

- Load the workbench from `GET /workbench` instead of fanning out project, task, and comment requests.
- Open a task detail from the kanban or workbench with subtasks, comments, and attachments.
- Add header search and an in-app notification bell.
- Point local contributors at the sibling MySQL 8 start path.
- Add Chinese / English UI switching for the shell, sign-in, and workbench. Preference is stored in localStorage.
- Extend locale coverage to project list, task board, task detail, and collaboration tabs. Status and priority labels follow the active language.
- Show OIDC / LDAP buttons on the sign-in page when the backend enables those providers.
- Refresh the README so the workbench, search, notifications, locale switch, and SSO callback are documented. Kubernetes install stays in the backend Helm chart.

## 1.0.0

- Vue 3 workbench, project kanban, organization canvas, and admin pages.
- Privacy denylist scan in CI. Demo copy uses fictional identities only.
