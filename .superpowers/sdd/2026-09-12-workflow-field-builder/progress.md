# SDD ledger — plan: docs/superpowers/plans/2026-09-12-workflow-field-builder.md

Plan: `docs/superpowers/plans/2026-09-12-workflow-field-builder.md`
Spec: `docs/superpowers/specs/2026-09-12-configurable-workflow-fields-design.md`
Frontend base before implementation: `3592a94e8d604d3189f83c870e141017eb844ba9`
Backend base before implementation: `d99609f`
Workspace isolation: both repositories are linked worktrees on `feature/configurable-project-workflows`; no superproject.

Ruling: Run `.test.mjs` files directly with Node for red/green checks rather than through `node --test`; the sandbox blocks Node's worker-process spawn with `EPERM`, while direct invocation executes each `node:test` file in-process. Cost if wrong: direct-file execution may differ from package-level runner orchestration, so the final suite will also be attempted using the least-mutating available route.

Ruling: In schema v2, `contentOrder` is the sole source of truth for configurable components and layout; do not duplicate it in `components[]`, `projectBasicInfo`, or `projectBasicInfoFields`. The existing runtime DTO may derive `components[]` from `component:<key>` entries so current module-mount conditions continue to work, while v1 retains its original properties. Cost if wrong: configurable modules may be omitted from node detail or two independently editable order lists may diverge.

## Preflight plan scan

| Tasks | Shared file/interface | Producer → consumer check | Result |
|---|---|---|---|
| 1 ↔ 4 | `workflow-template-model.mjs`, `workflow.ts` | Task 1 exports v2 conversion/manipulation helpers and types; Task 4 uses them in the editor. | Consistent; Task 1 declaration file added to Task 1 file list. |
| 1 ↔ 5 | `workflow.ts`, `workflow-config.mjs` | Task 1 schema types/bindings feed Task 5 runtime rendering and old-node adapter. | Consistent; Task 5 explicitly adapts old node DTOs. |
| 1 ↔ 2 | v2 JSON contract | Frontend emits `schemaVersion: 2`, `fields`, `binding`, `visible`, `contentOrder`; backend validator consumes those names. | Consistent with spec. |
| 2 ↔ 3 | Java workflow records/types and validators | Task 2 defines nullable visibility, bindings, expanded enum, v2 content order; Task 3 consumes those in value storage/completion. | Consistent; constructor overloads preserve old call sites. |
| 2 ↔ 4 | schema v2 JSON | Admin editor emits only field types and bindings allowed by backend; Task 2 accepts same contract. | Consistent; mapping is enumerated in spec. |
| 2 ↔ 5 | field types and binding rules | Runtime controls and canonical data mapping must agree with backend allow-list/type validation. | Consistent with spec mapping; verify end-to-end in Task 6. |
| 3 ↔ 5 | `ProjectNodeDTO` and custom-field API | Task 3 returns ordered v2 node metadata and excludes bound fields from custom field writes; Task 5 renders/saves by binding. | Consistent; node DTO is listed in both tasks. |
| 3 ↔ 6 | project/node persistence contract | Task 6 verifies canonical project updates vs node custom-field persistence enforced by Task 3. | Consistent. |
| 4 ↔ 5 | `contentOrder` | Editor stores the ordered `fields` block and existing `component:<key>` modules; detail page consumes same tokens. | Consistent; fixed owner/schedule/task board remain outside this order. |
| 4 ↔ 6 | workflow editor DOM/schema | Task 6 exercises drag/edit/save/publish behavior delivered in Task 4. | Consistent. |
| 5 ↔ 6 | runtime fields and project-detail save | Task 6 exercises bound/custom values, validation, and legacy layout from Task 5. | Consistent. |
| Task 1 | Self-consistency | Tests cover v1 normalization/idempotence; implementation creates schema adapter and ordering helpers; files include declarations. | Consistent. |
| Task 2 | Self-consistency | Validator/value tests precede schema, enum, and value-validation changes. | Consistent. |
| Task 3 | Self-consistency | Service tests cover binding exclusion, people permissions, v1/v2 completion; service/DTO files implement each. | Consistent. |
| Task 4 | Self-consistency | Editor tests cover field and module operations; implementation is scoped to model/editor/locales. | Consistent. |
| Task 5 | Self-consistency | Runtime tests cover control types, requiredness, binding lookup, and legacy DTO; page/panel/config adapter implement them. | Consistent. |
| Task 6 | Self-consistency | Browser checks target admin/runtime flows delivered earlier; full front/back verification is included. | Consistent; full backend run depends on locating a usable Java/Maven runtime. |

## Baseline

- `pnpm test` did not reach tests: pnpm attempted dependency-directory reconciliation and aborted in the non-interactive shell (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). No reinstall/cleanup was performed.
- Direct Node execution: `workflow-template-model.test.mjs` 9/9 passed; `workflow-config.test.mjs` 11/11 passed.
- After Task 1, direct invocation of all 48 frontend `*.test.mjs` files passed (48 files, 0 failures).
- `node --test` suite mode could not spawn child processes in the sandbox (`EPERM`); use direct Node file invocations for tests.
- Backend: `mvn` and `java` are not on PATH; Docker daemon pipe access is denied in the sandbox. Continue to locate an approved local runtime before final backend verification; do not claim backend tests pass without evidence.
- Backend Docker baseline: Java 17/Maven 3.9.9 container compiled 404 production and 115 test sources. Workflow validator, field-value validator, and the node custom-field/node-completion service tests passed; full suite reported 384 tests, 3 failures, 29 errors, 3 skipped because Testcontainers could not discover/access a Docker environment from inside the Maven container. Treat these as environment-bound baseline failures unless reproduced in focused code tests.

## Task progress

Task 1: complete (commits `3592a94..3cf1233`, review clean). Initial Important stale-component finding was fixed in round 1 and re-reviewed as addressed; fixed-module coverage was independently confirmed by the passing `workflow-template-model.test.mjs` and will be exercised again in Tasks 4-6.
Task 2: complete (commits `d99609f..3aaa78d`, review clean). Fix round 1 addressed both v1 metadata bypass findings and scoped re-review passed. **Ruling:** node owner/schedule/task-board are fixed runtime blocks and are not legal configurable components; `project.schedule` is the separate project-date field explicitly mapped as a configurable binding by the spec. Requiring every node to include `project.schedule` would conflate the two and prevent configuring that field; cost if wrong: valid v2 templates could hide or omit a project field only to be rejected, while still not enforcing node-level UI. The supported component allowlist rejects fixed blocks from `contentOrder`. Minor (deferred): a null `contentOrder` member currently raises NPE rather than a Chinese validation error; final review will triage. After fix, focused backend workflow tests passed 17/17.
Task 3: complete (commit `3aaa78d..5400e80`, independent task review approved with no findings; focused Maven tests passed 16/16. Full Maven suite remains environment-blocked by Docker-dependent Testcontainers and CRLF-sensitive script failures, consistent with baseline. Bound values/attachments are excluded from custom-field persistence, multi-person membership and visible required canonical bindings are enforced, and v2 content order/components are returned by the runtime DTO).
Task 4: complete (commit `3cf1233..53b3bef`, review clean). Scoped review could not verify runtime binding saves and published-version immutability because those unchanged paths belong to Tasks 3/5/6; track them for end-to-end verification.
Task 5: complete (implementation commit `490c174`, independent review approved with no Important/Critical findings; reviewer noted only that render-branch tests could assert behavior more directly. Focused project/config tests and `vue-tsc --noEmit` pass; the full direct Node suite passes 48/48 after updating a stale source assertion in `business-line-owner.test.mjs` from the legacy `field.key` to the canonical `field.binding` contract. Browser-level field persistence remains in Task 6.)

Ruling: The pre-existing business-line-owner unit test asserted the v1-only source branch (`field.key === 'businessLine'`), while the runtime now renders the canonical v2 binding (`field.binding === 'project.businessLine'`) after adapting v1 definitions. Update the assertion to the current contract and cover user-visible selection/save behavior in Task 6; do not reintroduce a v1-only branch into production code. Cost if wrong: either all frontend tests stay red after a valid schema migration, or runtime behavior regresses to an obsolete data model.

Task 6: complete (commits `27b2ae1..5d6c4e3`, scoped review approved; project-detail and workflow-admin direct Playwright API browser scripts passed, including v1 nine-stage migration and bound/custom field persistence. The committed Playwright test runner hung silently before starting tests; `pnpm` wrapper could not run non-interactively; full Maven suite remains blocked by Docker/Testcontainers and CRLF-sensitive environment failures. Available regressions passed: 48 frontend `.test.mjs` files, `vue-tsc`, Vite build, and 33 focused backend tests.)

Final whole-branch review fix round 1: complete. The empty-node/order, date-range, compatibility layout, null-order entry, schema key collision, direct-v1-runtime key collision, and admin-preview findings are covered by focused regressions. The controller-approved contract uses one definitions array and a migration-only `legacy-custom-fields` token after old workbenches; ordinary v2 fields remain unified. Empty nodes validate; null order entries return the normal unknown-item error; blank `DATE_RANGE` arrays save and remain missing when required at completion.

Ruling: Preserve the v1 split between project-bound profile fields and legacy custom fields with a compatibility-only ordered content slot when converting v1 definitions; keep ordinary v2-authored workflows on the unified fields slot. This honors the binding spec's explicit requirement that legacy custom fields remain after workbenches, even though one unified v2 fields block cannot represent both legacy positions. Cost if wrong: migration-only layout/rendering complexity; collapsing the fields instead visibly moves existing project data controls or custom fields for legacy users.

Final review Minor (deferred): Some runtime control/render tests assert source text rather than component behavior. Ruling: retain these unit checks for pure field normalization/validation and rely on the separately executed direct-browser smoke tests for rendered interactions; replace with component-level tests when the repo has a runnable component test harness. Cost if wrong: a rendering regression can escape unit tests, especially because the committed Playwright runner does not launch in this host.

Final fix-round verification: 48 direct Node test files / 313 tests passed; `vue-tsc --noEmit`, Vite production build, Playwright source syntax checks, and both `git diff --check` passed. Focused backend Maven classes (`WorkflowTemplateDefinitionValidatorTest`, `WorkflowFieldValueValidatorTest`, `NodeCustomFieldServiceTest`, `NodeServiceCompleteTest`) passed 39/39. The full Maven suite and committed Playwright runner remain deferred for the already-recorded host limitations; latest template-preview changes were covered by source regression tests, typecheck, and build rather than a fresh browser session.

Scoped fix-round re-review: PASS (2026-09-13). All six findings in `final-review-fix-brief.md` were marked ADDRESSED; no new breakage was found. Controller independently reran the 48-file frontend suite (313/313), four focused frontend files (49/49), typecheck, Vite build, four focused backend classes (39/39), Playwright syntax checks, and scoped `git diff --check`; all passed. Both feature refs were freshly fetched and remain ahead-only. The local `5173` browser page is an older static bundle and is not served from the feature worktree; no `main` checkout was modified or merged.
