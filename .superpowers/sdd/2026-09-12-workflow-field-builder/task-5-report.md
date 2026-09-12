# Task 5 Report: Project detail unified field rendering

## Implementation commit

- `490c174` — `feat: unify project workflow fields`
- Base frontend commit: `53b3bef`

## Changed files

- `src/types/domain.ts`
- `src/views/project/detail/components/WorkflowCustomFields.vue`
- `src/views/project/detail/index.vue`
- `src/views/project/detail/workflow-config.d.mts`
- `src/views/project/detail/workflow-config.mjs`
- `src/views/project/detail/workflow-config.test.mjs`
- `src/views/project/detail/workflow.test.mjs`

`src/types/workflow.ts` already contained the Task 1 v2 field types and binding union at the requested base, so it required no Task 5 change.

## Verification

- `node src/views/project/detail/workflow-config.test.mjs` — 15 passing, 0 failing.
- `node src/views/project/detail/workflow.test.mjs` — 59 passing, 0 failing.
- `node_modules\\.bin\\vue-tsc.cmd --noEmit` — exit 0.
- `git diff --check` — exit 0 before commit.
- Full direct Node regression sweep: 48 `*.test.mjs` files passed after updating the pre-existing business-line-owner assertion to the canonical v2 `project.businessLine` binding (the runtime adapter maps the old v1 key to this binding).

`node --test` could not start child workers in this sandbox (`spawn EPERM`), so the focused test files were run directly, following the repository plan's sandbox convention. `pnpm typecheck` attempted an automatic dependency reset and was blocked by pnpm's non-interactive install wrapper; after restoring the locked dependencies, the underlying `vue-tsc --noEmit` command completed successfully.

## Rulings and limitations

- v1 runtime nodes are adapted into bound fields and a `fields` content-order item without modifying published definitions; custom fields retain their keys and remain unbound.
- Bound project fields render through the existing project controls and permissions, and are never loaded or saved through the node custom-field API. Free fields continue to use the existing node-field API, optimistic versions, and attachment handling.
- Visible required bindings are checked before completion in the project detail page; visible required free fields are checked by the shared field component. Hidden fields are excluded from both paths.
- `contentOrder` positions the unified fields block with configurable workbenches. Node owner and schedule remain above the configurable stack, and the task board remains below it.
- No browser end-to-end session was run; Task 5 requested focused Node tests and typechecking, and browser coverage belongs to Task 6.
