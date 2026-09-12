# Task 6 Report: end-to-end acceptance and regression

## Scope and changes

- Added `tests/workflows/workflow-field-builder.spec.mjs`.
  - It uses only Playwright `page.route()` fixtures: no browser request reaches a real API.
  - The route fixture only mocks URL pathnames beginning exactly with `/api/`; all Vite source modules and other non-API requests use `route.continue()`. It explicitly mocks `/notifications/unread-count` with `{ unreadCount: 0 }`, `/projects/7/tasks` with `[]`, and `/projects/7/iteration-plans` with `[]`. An unhandled API request is recorded and receives HTTP 501, and each test asserts its unmatched-request list is empty.
  - Admin coverage loads a legacy nine-stage definition, checks the three fixed blocks, uses drag-and-drop to reorder nodes, fields, and the requirement-scope workbench relative to the field section, opens the preview, saves a v2 draft, and publishes. Draft assertions verify `legacy-notes` and `component:requirement-scope` remain in the migrated v2 node.
  - Project-detail coverage uses the real `ProjectPermissions` field names (`canManageProject`, `canManageMembers`, `canSetProjectManager`, and the other permission flags), fills the bound description and member picker, then clicks the node heading outside `.node-tab-profile` to trigger the documented pointerdown autosave. It waits for and checks `PUT /projects/7` including member IDs, then verifies only the unbound radio value goes to the node-field API. Completion confirmation is scoped to the visible `role=dialog` and matches the primary `完 成` button despite Ant Design's inserted whitespace.
  - Completion paths include successful completion, hidden required bindings, and visible missing required bindings. The visible-missing path checks the localized `请先完善` validation and asserts the completion endpoint callback remains at zero. Backend parity is covered by `NodeServiceCompleteTest.blocksCompletionWhenAVisibleRequiredV2ProjectBindingIsMissingFromCanonicalProjectData` (`pms-backend` worktree: `src/test/java/com/brad/pms/service/NodeServiceCompleteTest.java:261-280`).
- Added `tests/workflows/playwright.config.mjs`, limiting discovery to this single spec and setting a 30-second test timeout.
- No product implementation, schema, plan, or spec files were changed. The user's existing uncommitted plan/spec files remain untouched.

## Repeatable browser command

Start only the feature-worktree server on an unused port, then run the fixture suite:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5177 --strictPort
$env:PMS_E2E_BASE_URL = 'http://127.0.0.1:5177'
node_modules/.bin/playwright.CMD test --config=tests/workflows/playwright.config.mjs --workers=1
```

Chromium 136.0.7103.25 was installed for this project-pinned Playwright 1.52.0 suite. No screenshots were produced because the host runner never began a test; screenshots/traces are configured to retain on browser-test failure.

## Verification results

| Check | Result |
| --- | --- |
| `node --check tests/workflows/workflow-field-builder.spec.mjs` | Passed after the fixture corrections |
| `node --check tests/workflows/playwright.config.mjs` | Passed |
| Direct frontend `*.test.mjs` sweep | Passed: 48 files, 0 failures |
| `node_modules/.bin/vue-tsc.CMD --noEmit` | Passed |
| `node node_modules/vite/bin/vite.js build` | Passed |
| Frontend `git diff --check` | Passed |
| Backend focused Maven container test | Passed: 33 tests, 0 failures/errors (`WorkflowTemplateDefinitionValidatorTest`, `WorkflowFieldValueValidatorTest`, `NodeCustomFieldServiceTest`, `NodeServiceCompleteTest`), including `NodeServiceCompleteTest.blocksCompletionWhenAVisibleRequiredV2ProjectBindingIsMissingFromCanonicalProjectData` |
| Backend worktree `git diff --check` | Passed |

The focused backend check was run in the backend worktree with:

```powershell
docker run --rm -v 'C:\Users\Brad\Desktop\MyWorker\project\.worktrees\pms-backend:/workspace' -w /workspace maven:3.9.9-eclipse-temurin-17 mvn '-Dtest=WorkflowTemplateDefinitionValidatorTest,WorkflowFieldValueValidatorTest,NodeCustomFieldServiceTest,NodeServiceCompleteTest' test
```

## Limitations

- The local `pnpm` wrapper aborts before commands because it tries to reconcile `node_modules` in a non-interactive shell (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). Equivalent direct Node, `vue-tsc`, and Vite commands were used.
- The earlier blank page had a concrete fixture root cause: `page.route('**/api/**')` also matched Vite imports such as `/src/api/...`, and the generic JSON mock returned JavaScript modules as `application/json`. The fixture now passes every non-API request through unchanged and only mocks pathnames starting `/api/`.
- The earlier disabled description/member controls were fixture-data errors: the page reads `permissions.canManageProject` and `permissions.canManageMembers`, while the fixture supplied the nonexistent `canManage` property. These fields now match the domain `ProjectPermissions` shape. The profile save was also previously not triggered because the interaction stayed inside `.node-tab-profile`; it now clicks `.node-detail-title__heading h2` outside that container and explicitly waits for the project update. The completion dialog uses its actual localized primary action; the role-scoped matcher accepts Ant Design's rendered `完 成` spacing and cannot match the background `完成节点` control.
- Although Chromium launches successfully and the Vite app returns HTTP 200 on 5177, Playwright's `test` runner on this host produced no test-start, timeout, or error output and did not terminate in the earlier bounded attempts. Per user direction, the runner was not retried for these fixture-only corrections; the user is performing direct Playwright-browser validation separately. Browser behavior is therefore not claimed as executed by this run.
- Java and Maven are absent from PATH. The backend focused tests were run in a disposable `maven:3.9.9-eclipse-temurin-17` container. A full backend suite is not newly runnable in that container because Testcontainers cannot access the host Docker engine from inside it; previous full-suite attempts also have the known Docker/Testcontainers and CRLF-sensitive failures.

## Reviews

1. Reviewed fixture selectors and data against rendered source, `ProjectPermissions`, `PersonSelect`, v1 normalization tests, and completion localization. Confirmed actual drag/drop handlers are exercised and the edit/save flow uses the outside-profile pointerdown boundary.
2. Re-read the complete scoped diff against Task 6 requirements and the final route log: the three observed page-load endpoints have literal fixture responses, Vite modules are never fulfilled with JSON, genuine API misses fail explicitly, member IDs are asserted on the project update and absent from node field values, v1 data is retained, and the report does not overstate browser execution.
