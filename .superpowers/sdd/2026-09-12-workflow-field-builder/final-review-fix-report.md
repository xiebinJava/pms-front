# Final whole-branch review fix round 1

Date: 2026-09-12

Branch: `feature/configurable-project-workflows`
Worktrees: `pms-front` and `pms-backend` (linked worktrees; no branch switch, merge, or push)

## Outcome

All scoped Important findings and the reported null-order/key-collision/admin-preview follow-ups are fixed. The change keeps exactly one field-definition array and one source of values. Migrated v1 definitions use a compatibility-only `legacy-custom-fields` ordered token after old workbenches; while the token exists, `fields` renders bound project fields and the compatibility token renders unbound legacy fields. Ordinary v2 templates omit the token and render both kinds in the unified `fields` slot.

## TDD RED/GREEN evidence

Tests were added before the corresponding production changes. RED outputs below are the actual focused runs captured during implementation; stale source assertions exposed by the structural change were updated to assert the new two-slot persistence contract.

| Area | RED evidence | GREEN evidence |
| --- | --- | --- |
| v1 schema migration | `node src/views/admin/workflows/workflow-template-schema.test.mjs`: 5 tests; 3 passed, 2 failed. The expected compatibility placement was missing and project binding key collided with original custom key. | Same command: 5/5 passed. |
| editor removal semantics | `node src/views/admin/workflows/workflow-template-model.test.mjs`: 12 tests; 11 passed, 1 failed because removing the last unbound field left a dangling compatibility token. | Same command: 12/12 passed. |
| v1 runtime grouping and key collision | `node src/views/project/detail/workflow-config.test.mjs`: initial split-order run had 16 tests, 15 passed, 1 failed. After adding the direct-runtime key regression, 17-test RED showed `project-description` instead of collision-safe `project-description-2`; two pre-existing source-shape checks also still named the old save helper and were corrected. | Same command: 17/17 passed, including direct v1 DTO collision and separate bound/unbound slot contents. |
| admin editor / previews | `node src/views/admin/workflows/workflow-admin-visual.test.mjs`: 15 tests; 13 passed, 2 failed. One was a stale remove-slot assertion; the other confirmed template preview still treated the compatibility token as a component and flattened fields outside content order. | Same command: 15/15 passed. Checks cover translated label, component-only removal, movement, filtered node/template previews in order, and `profileContainer` anchor placement. |
| backend schema and date-value behavior | `docker run --rm -v 'C:\Users\Brad\Desktop\MyWorker\project\.worktrees\pms-backend:/workspace' -w /workspace maven:3.9.9-eclipse-temurin-17 mvn '-Dtest=WorkflowTemplateDefinitionValidatorTest,WorkflowFieldValueValidatorTest,NodeCustomFieldServiceTest' test`: 26 tests, 2 failures, 4 errors. Empty v2 nodes/order and blank date ranges were rejected; null order entry caused NPE; required blank range did not produce the expected missing-required error. | Final four-class Maven command below: 39 tests, 0 failures/errors/skips. |

## Implementation and files changed

Frontend worktree:

- `src/views/admin/workflows/workflow-template-schema.mjs` and `.test.mjs`: one-array v1 migration; collision-safe project binding keys against original custom keys; `fields` at the legacy project-profile location and compatibility slot after legacy workbenches.
- `src/views/admin/workflows/workflow-template-model.mjs` and `.test.mjs`: add/remove behavior maintains real field slots and clears only the compatibility slot when its last unbound field is removed.
- `src/views/admin/workflows/index.vue`, `workflow-admin-visual.test.mjs`, `src/locales/zh-CN.ts`, `src/locales/en-US.ts`: translated compatibility label; move-only token semantics; node and template previews show filtered fields in content token order.
- `src/views/project/detail/workflow-config.mjs`, `.d.mts`, `.test.mjs`, and `workflow.test.mjs`: direct v1 runtime key collision avoidance and slot filtering/order; tests cover ordinary v2 unified behavior. The project profile click-away anchor remains on the bound-fields wrapper.
- `src/views/project/detail/index.vue`: render two compatibility slots only when appropriate and save/flush both refs across navigation, lifecycle, and completion paths.
- `src/types/workflow.ts`: include the compatibility token in the ordered item type.
- `.superpowers/sdd/2026-09-12-workflow-field-builder/task-6-report.md`, `docs/superpowers/plans/2026-09-12-workflow-field-builder.md`, `docs/superpowers/specs/2026-09-12-configurable-workflow-fields-design.md`, `.superpowers/sdd/2026-09-12-workflow-field-builder/progress.md`: synchronize the controller ruling, final test evidence, and limitations.
- `.superpowers/sdd/2026-09-12-workflow-field-builder/final-review-fix-report.md`: this detailed report.

Backend worktree:

- `src/main/java/com/brad/pms/workflow/WorkflowTemplateDefinitionValidator.java`: allow empty content order only when no field definitions exist; validate fields and migration slots against bound/unbound definitions; reject null entries as a normal unknown-item validation error.
- `src/main/java/com/brad/pms/workflow/WorkflowFieldValueValidator.java`: preserve empty `DATE_RANGE` arrays as valid draft values; required-field completion still treats them as missing.
- `src/test/java/com/brad/pms/workflow/WorkflowTemplateDefinitionValidatorTest.java`, `WorkflowFieldValueValidatorTest.java`, `src/test/java/com/brad/pms/service/NodeCustomFieldServiceTest.java`: focused empty node/order, split-slot, null-entry, blank range persistence, and required-completion regressions.

The three pre-existing dirty frontend Task 6 report/plan/spec changes were preserved and extended; no user changes were discarded.

## Final focused verification

| Command/check | Result |
| --- | --- |
| Direct execution of all `src/**/*.test.mjs` files with Node (48 files) | 313 tests passed, 0 failed |
| Focused workflow schema/model/runtime/admin files | 49 tests passed, 0 failed |
| `node_modules/.bin/vue-tsc.CMD --noEmit` | Passed, exit 0 |
| `node node_modules/vite/bin/vite.js build` | Passed; 3423 modules transformed; 13.11 s. Initial sandbox run hit `spawn EPERM`; elevated retry succeeded. |
| `node --check tests/workflows/workflow-field-builder.spec.mjs` and `node --check tests/workflows/playwright.config.mjs` | Both passed |
| Focused backend Maven classes | 39 tests passed, 0 failures, 0 errors, 0 skipped |
| `git diff --check` in both worktrees | Passed |

Focused backend command:

```powershell
docker run --rm -v 'C:\Users\Brad\Desktop\MyWorker\project\.worktrees\pms-backend:/workspace' -w /workspace maven:3.9.9-eclipse-temurin-17 mvn '-Dtest=WorkflowTemplateDefinitionValidatorTest,WorkflowFieldValueValidatorTest,NodeCustomFieldServiceTest,NodeServiceCompleteTest' test
```

Relevant output:

```text
Tests run: 5,  Failures: 0, Errors: 0, Skipped: 0 -- NodeCustomFieldServiceTest
Tests run: 13, Failures: 0, Errors: 0, Skipped: 0 -- NodeServiceCompleteTest
Tests run: 6,  Failures: 0, Errors: 0, Skipped: 0 -- WorkflowFieldValueValidatorTest
Tests run: 15, Failures: 0, Errors: 0, Skipped: 0 -- WorkflowTemplateDefinitionValidatorTest
Tests run: 39, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

The direct Node suite command was executed as a PowerShell loop because `node --test` worker spawning is denied on this host:

```powershell
$files = @(rg --files src | Where-Object { $_ -match '\.test\.mjs$' } | Sort-Object)
foreach ($file in $files) {
  node $file
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Output summary: `Files: 48; tests: 313; passed: 313; failed: 0`.

## Self-review

- Single source of definitions and values: migration combines bindings and unbound definitions once; the token only filters render placement.
- Ordinary v2 unchanged: absent `legacy-custom-fields`, the `fields` slot returns all visible bound and unbound fields.
- Collision safety covers both migration and direct, unconverted v1 DTO runtime adaptation; generated project keys reserve all original custom keys and previous generated keys.
- Admin ordering can move either field token; only `component:*` has a standalone remove action. Removing the last unbound definition cleans up its compatibility token without disturbing bound definitions or their slot.
- Profile `profileContainer` remains on the bound/project-profile wrapper because document pointer handling uses it as the project profile auto-save boundary. The unbound compatibility wrapper does not claim it.
- Backend allows an empty v2 node (`fields=[]`, `contentOrder=[]`) and workbench-only nodes, but rejects dangling field tokens and missing required field slots. A null token now yields the standard unknown-item validation error, not an NPE.
- Draft persistence accepts `DATE_RANGE: []`; required completion semantics remain missing because empty arrays still fail the required-value check.
- No full Maven suite, committed Playwright runner, branch switch, reset, or merge was performed. See the final verification below for the independent controller rerun.

## Deferred concerns

- The committed Playwright test runner remains unexecuted on this host because Task 6 recorded that it hangs silently before starting tests. Its source syntax passes; Task 6's independent direct-browser smoke scripts had passed before this final review round. The latest admin template-preview delta was verified by focused source regression, typecheck, and production build, not a fresh browser run.
- The full backend Maven suite is not claimed; only the four targeted classes ran. The full suite's Testcontainers dependency cannot access the Docker host from inside the Maven container in this environment.
- Some rendering tests remain source-structure assertions because this repository has no runnable component-test harness. Replace them when a supported component harness is available.

## Commits

The fix round was committed on the existing feature branch:

- Frontend: `382ae8b4c361a52aed5072786384c978e51b7e5d` — `fix(workflow): preserve legacy field placement in migration`
- Backend: `8b6bb6c568e21a6931682c6e9eadec60f2db22be` — `fix(workflow): validate empty nodes and date ranges`

## Controller verification and scoped re-review

Fresh verification on 2026-09-13:

- All frontend `src/**/*.test.mjs` files: 48 files, 313 tests passed, 0 failed.
- Four focused workflow/node admin and runtime frontend test files: 49/49 passed.
- `node_modules/.bin/vue-tsc.CMD --noEmit`: exit 0.
- `node node_modules/vite/bin/vite.js build`: exit 0; 3423 modules transformed.
- Focused backend Maven suite (`WorkflowTemplateDefinitionValidatorTest`, `WorkflowFieldValueValidatorTest`, `NodeCustomFieldServiceTest`, `NodeServiceCompleteTest`): 39 tests passed, 0 failures/errors/skips; `BUILD SUCCESS`.
- Both scoped fix diffs passed `git diff --check`; Playwright spec/config syntax checks passed.
- Independent scoped re-review: all six findings ADDRESSED; no new breakage found.
- Fresh remote fetches showed both feature branches are ahead only (frontend 13 commits, backend 4 commits) with no remote-only commits.
- The browser's `localhost:5173` still serves the older static bundle (`/assets/index-HcphHPy1.js`); a Vue source-module request returns the SPA HTML shell. The fresh feature-worktree build has a different entry bundle (`/assets/index-Ct53ZwsL.js`). The main checkouts and their local edits were left untouched; the feature branch has not been merged into `main`.

Deferred limitations remain: the full Maven suite is not claimed because Testcontainers cannot access Docker from the Maven container; the committed Playwright runner hangs before tests start on this host. Direct browser smoke from Task 6 passed before this final fix, but the latest template-preview delta was verified with focused regressions, typecheck, and production build rather than a new interactive browser run.
