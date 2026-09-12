# Task 6 Report: end-to-end acceptance and regression

## Scope and changes

- Added `tests/workflows/workflow-field-builder.spec.mjs`.
  - It uses only Playwright `page.route()` fixtures: no browser request reaches a real API.
  - The route fixture only mocks URL pathnames beginning exactly with `/api/`; all Vite source modules and other non-API requests use `route.continue()`. It explicitly mocks `/notifications/unread-count` with `{ unreadCount: 0 }`, `/projects/7/tasks` with `[]`, and `/projects/7/iteration-plans` with `[]`. An unhandled API request is recorded and receives HTTP 501, and each test asserts its unmatched-request list is empty.
  - Admin coverage loads a legacy nine-stage definition, checks the three fixed blocks, uses drag-and-drop to reorder nodes, fields, and the requirement-scope workbench relative to the field section, opens the preview, saves a v2 draft, and publishes. Draft assertions verify `legacy-notes` and `component:requirement-scope` remain in the migrated v2 node.
  - Project-detail coverage uses the real `ProjectPermissions` field names (`canManageProject`, `canManageMembers`, `canSetProjectManager`, and the other permission flags), fills the bound description and member picker, then clicks the node heading outside `.node-tab-profile` to trigger the documented pointerdown autosave. It waits for and checks `PUT /projects/7` including member IDs, then verifies only the unbound radio value goes to the node-field API. Completion confirmation is scoped to the visible `role=dialog` and matches the primary `完 成` button despite Ant Design's inserted whitespace.
  - Completion paths include successful completion, hidden required bindings, and visible missing required bindings. The visible-missing path checks the localized `请先完善` validation and asserts the completion endpoint callback remains at zero. Backend parity is covered by `NodeServiceCompleteTest.blocksCompletionWhenAVisibleRequiredV2ProjectBindingIsMissingFromCanonicalProjectData` (`pms-backend` worktree: `src/test/java/com/brad/pms/service/NodeServiceCompleteTest.java:261-280`).
- Added `tests/workflows/playwright.config.mjs`, limiting discovery to this single spec and setting a 30-second test timeout.
- Task 6 made no product implementation changes. The plan/spec were synchronized with the implementation decisions that v2 `contentOrder` is authoritative and the runtime DTO derives `components[]` for existing workbench mounts.

## Repeatable browser command

Start only the feature-worktree server on an unused port, then run the fixture suite:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5177 --strictPort
$env:PMS_E2E_BASE_URL = 'http://127.0.0.1:5177'
node_modules/.bin/playwright.CMD test --config=tests/workflows/playwright.config.mjs --workers=1
```

Chromium 136.0.7103.25 was installed for this project-pinned Playwright 1.52.0 suite. The test runner itself produced no screenshots because it never began a test; screenshots/traces are configured to retain on browser-test failure. Independent direct-browser screenshots are listed in the verification table below.

## Verification results

| Check | Result |
| --- | --- |
| `node --check tests/workflows/workflow-field-builder.spec.mjs` | Passed after the fixture corrections |
| `node --check tests/workflows/playwright.config.mjs` | Passed |
| Direct frontend `*.test.mjs` sweep | Passed: 48 files, 313 tests, 0 failures |
| `node_modules/.bin/vue-tsc.CMD --noEmit` | Passed |
| `node node_modules/vite/bin/vite.js build` | Passed |
| Frontend `git diff --check` | Passed |
| Backend focused Maven container test | Passed in Task 6: 33 tests, 0 failures/errors (`WorkflowTemplateDefinitionValidatorTest`, `WorkflowFieldValueValidatorTest`, `NodeCustomFieldServiceTest`, `NodeServiceCompleteTest`), including `NodeServiceCompleteTest.blocksCompletionWhenAVisibleRequiredV2ProjectBindingIsMissingFromCanonicalProjectData` |
| Backend worktree `git diff --check` | Passed |
| Direct Playwright API browser smoke on isolated Vite `5177` (project detail, 1440×1000) | Passed: canonical description/member updates, free-radio node-field save, successful completion, hidden-required allowed, visible-missing required blocked; no console errors. Script: `C:\Users\Brad\.codex\visualizations\2026\08\31\01a05861-ff7d-7030-8ff6-31e468f2f6fb\workflow-runtime-qa.cjs`. Screenshots: `workflow-runtime-desktop.png`, `workflow-runtime-required.png` in the same external directory. |
| Direct Playwright API browser smoke on isolated Vite `5177` (workflow admin, 1440×1000) | Passed: loaded the legacy nine-stage definition; reordered nodes, fields, and workbench relative to fields; added radio/person-multi fields, changed options/required state, previewed, saved v2 draft, and published. Legacy notes, component order, and all three fixed blocks were retained; no unmatched API calls or console errors. Script: `C:\Users\Brad\.codex\visualizations\2026\08\31\01a05861-ff7d-7030-8ff6-31e468f2f6fb\workflow-admin-v1-qa.cjs`; screenshot: `workflow-admin-v1-preview.png` in the same external directory. |

The focused backend check was run in the backend worktree with:

```powershell
docker run --rm -v 'C:\Users\Brad\Desktop\MyWorker\project\.worktrees\pms-backend:/workspace' -w /workspace maven:3.9.9-eclipse-temurin-17 mvn '-Dtest=WorkflowTemplateDefinitionValidatorTest,WorkflowFieldValueValidatorTest,NodeCustomFieldServiceTest,NodeServiceCompleteTest' test
```

## Limitations

- The local `pnpm` wrapper aborts before commands because it tries to reconcile `node_modules` in a non-interactive shell (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). Equivalent direct Node, `vue-tsc`, and Vite commands were used.
- The earlier blank page had a concrete fixture root cause: `page.route('**/api/**')` also matched Vite imports such as `/src/api/...`, and the generic JSON mock returned JavaScript modules as `application/json`. The fixture now passes every non-API request through unchanged and only mocks pathnames starting `/api/`.
- The earlier disabled description/member controls were fixture-data errors: the page reads `permissions.canManageProject` and `permissions.canManageMembers`, while the fixture supplied the nonexistent `canManage` property. These fields now match the domain `ProjectPermissions` shape. The profile save was also previously not triggered because the interaction stayed inside `.node-tab-profile`; it now clicks `.node-detail-title__heading h2` outside that container and explicitly waits for the project update. The completion dialog uses its actual localized primary action; the role-scoped matcher accepts Ant Design's rendered `完 成` spacing and cannot match the background `完成节点` control.
- Although Chromium launches successfully and the Vite app returns HTTP 200 on 5177, Playwright's `test` runner on this host produced no test-start, timeout, or error output and did not terminate; one final one-worker retry after the fixture corrections also remained silent for 60 seconds and was stopped. The committed Playwright spec therefore remains unexecuted by that runner. Separate direct Playwright API scripts did execute both the project-detail and admin legacy-template interactions listed in the table; they are browser smoke scripts outside the repository, not a substitute claim that the committed runner passed.
- Java and Maven are absent from PATH. The backend focused tests were run in a disposable `maven:3.9.9-eclipse-temurin-17` container. A full backend suite is not newly runnable in that container because Testcontainers cannot access the host Docker engine from inside it; previous full-suite attempts also have the known Docker/Testcontainers and CRLF-sensitive failures.

## Reviews

1. Reviewed fixture selectors and data against rendered source, `ProjectPermissions`, `PersonSelect`, v1 normalization tests, and completion localization. Confirmed actual drag/drop handlers are exercised and the edit/save flow uses the outside-profile pointerdown boundary.
2. Re-read the complete scoped diff against Task 6 requirements and the final route log: the three observed page-load endpoints have literal fixture responses, Vite modules are never fulfilled with JSON, genuine API misses fail explicitly, member IDs are asserted on the project update and absent from node field values, v1 data is retained, and the report does not overstate browser execution.

## Final whole-branch review fix round 1 addendum

The controller-authoritative migration contract is now explicit: a single `fields` definition array is retained. A v1 definition with legacy unbound fields gets one migration-only `legacy-custom-fields` token after old workbenches; with that token, the `fields` slot renders project bindings and the compatibility slot renders unbound fields. Ordinary v2 templates do not get this token and their single `fields` slot continues rendering all fields. Values and definitions are not duplicated. Collision-safe project binding keys are applied in both schema migration and the direct v1 runtime adapter.

The admin editor labels the token in Chinese and English, lets it move with the other content tokens but does not expose standalone removal, and renders filtered fields in token order in both node and template previews. `profileContainer` remains on the bound-fields wrapper because it is specifically the click-away boundary for project-profile autosave; the legacy custom-field wrapper does not claim that ref. Saving/flushing on navigation, completion, and lifecycle actions now covers both rendered field refs.

TDD evidence (RED was captured before corresponding implementation changes):

| Regression area | RED command/result | GREEN command/result |
| --- | --- | --- |
| v1 schema layout/key collision | `node src/views/admin/workflows/workflow-template-schema.test.mjs` — 5 tests, 3 passed, 2 failed; old placement token absent and colliding key was not suffixed. | Same command — 5/5 passed. |
| editor field/slot removal | `node src/views/admin/workflows/workflow-template-model.test.mjs` — 12 tests, 11 passed, 1 failed; deleting last unbound field left compatibility token dangling. | Same command — 12/12 passed. |
| v1 runtime order and direct key collision | `node src/views/project/detail/workflow-config.test.mjs` — first 16-test run: 15 passed, 1 failed on missing split runtime order. After adding direct key-collision regression, the captured 17-test run showed expected duplicate `project-description` versus `project-description-2` plus two stale save-source assertions, which were updated to assert both refs. | Same command — 17/17 passed; direct v1 key is `project-description-2` and the custom key/value remains `project-description`. |
| admin compatibility preview | `node src/views/admin/workflows/workflow-admin-visual.test.mjs` — 15 tests, 13 passed, 2 failed: old remove-slot assertion and template preview label/order behavior. | Same command — 15/15 passed; move/remove, localized label, filtered fields, token order, and profile click-away anchor asserted. |
| backend empty node/order, null entry, and blank date range | `docker run --rm -v 'C:\Users\Brad\Desktop\MyWorker\project\.worktrees\pms-backend:/workspace' -w /workspace maven:3.9.9-eclipse-temurin-17 mvn '-Dtest=WorkflowTemplateDefinitionValidatorTest,WorkflowFieldValueValidatorTest,NodeCustomFieldServiceTest' test` — 26 tests, 2 failures, 4 errors. Empty nodes/order and blank date ranges were rejected; null order entry threw NPE; required blank range did not produce the expected missing-field message. | Final four-class command below — 39 tests, 0 failures/errors/skips. |

Final focused verification after the fix:

```powershell
# All source unit files, invoked in-process as required by this host:
$files = @(rg --files src | Where-Object { $_ -match '\.test\.mjs$' } | Sort-Object)
foreach ($file in $files) { node $file; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
# Output summary: Files 48; tests 313; passed 313; failed 0.

node_modules/.bin/vue-tsc.CMD --noEmit
# exit 0
node node_modules/vite/bin/vite.js build
# ✓ 3423 modules transformed; ✓ built in 13.11s (exit 0; elevated retry needed for esbuild spawn permission)
node --check tests/workflows/workflow-field-builder.spec.mjs
node --check tests/workflows/playwright.config.mjs
# both exit 0
git diff --check
# exit 0 in both worktrees

docker run --rm -v 'C:\Users\Brad\Desktop\MyWorker\project\.worktrees\pms-backend:/workspace' -w /workspace maven:3.9.9-eclipse-temurin-17 mvn '-Dtest=WorkflowTemplateDefinitionValidatorTest,WorkflowFieldValueValidatorTest,NodeCustomFieldServiceTest,NodeServiceCompleteTest' test
# Tests run: 39, Failures: 0, Errors: 0, Skipped: 0; BUILD SUCCESS.
```

Changed files in this fix round are listed in `final-review-fix-report.md`. The full Maven suite and committed Playwright runner were not repeated: Task 6 records the Docker/Testcontainers limitation and the runner’s silent pre-test hang. The latest admin-template preview was verified by regression tests, typecheck, and production build, not by a fresh interactive browser run.
