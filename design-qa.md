# Design QA

## Comparison target

- Source visual truth: `/var/folders/m3/dy3hyl112_q8qb_vfgdh5qqh0000gn/T/codex-clipboard-cb03f915-869d-4195-8306-03a2b820ae06.png`
- Implementation screenshot: `/private/tmp/pms-project-detail-reference-viewport.png`
- Supplemental responsive screenshot: `/private/tmp/pms-project-detail-mobile.png`
- Route: `http://127.0.0.1:4173/projects/1`
- State: seeded project detail; project is active, kickoff node is active, later nodes are freely selectable, task tab is selected.
- Viewport: 1128 × 644 CSS px for the primary comparison; source and implementation screenshots are both 1128 × 644 px with no resampling.
- Responsive check: 390 × 844 CSS px.

## Comparison evidence

The full-view comparison checks the same primary hierarchy: project header, workflow canvas, and current-node detail. The implementation keeps the same visual reading order, white card surfaces, light gray page background, rounded borders, blue active state, green completed state, and compact metadata treatment.

The focused comparison checks the workflow/detail region because it carries the reference's strongest visual language. The implementation uses a horizontally scrollable sequence because the current backend exposes a strictly ordered `sort` sequence and only unlocks one next node at a time. The reference's branched connectors are therefore treated as a visual inspiration, not a claim that the backend supports parallel dependencies.

## Fidelity surfaces

- Fonts and typography: the existing system Chinese font stack is retained; title, metadata, labels, and body copy use distinct weights and sizes. Long node names truncate inside flow pills instead of breaking the layout.
- Spacing and layout rhythm: the page uses consistent 16px section gaps, 22–28px card padding, compact metadata grids, and horizontal scrolling for the flow when the viewport is narrow.
- Colors and visual tokens: active blue, completed green, pending gray, `#1F2329` text, and `#E5E6EB` borders align with the existing PMS/Feishu-like token set.
- Image quality and asset fidelity: the source has no custom raster artwork; UI icons use the existing Ant Design icon library. No placeholder imagery is present.
- Copy and content: implementation uses the project's real project/node/task data. Fields absent from the current API are not fabricated.

## Findings

No actionable P0/P1/P2 visual findings remain.

- [P3] The source image shows a branched workflow while the implementation shows a sequential workflow.
  Location: workflow navigator.
  Evidence: the backend currently models node order with `sort` and sequential unlock semantics; the implementation preserves that truth while using the reference's pill, connector, and state styling.
  Impact: minor visual difference, not a usability regression.
  Follow-up: add explicit dependency/parallel-branch fields to the backend before presenting true branched graphs.

- [P3] The implementation includes the existing PMS sidebar and the management section below the detail card, which are outside the reference crop.
  Location: application shell and lower page.
  Evidence: the reference is a focused detail surface; the implementation remains inside the existing product shell and keeps task, milestone, member, and activity functions available.
  Impact: intentional product-context difference.
  Follow-up: none required for this redesign.

## Comparison history

1. Initial review used a different browser viewport and a stale backend process, so the page state and viewport did not match the source exactly.
2. Fixed by capturing the implementation at 1128 × 644, removing the stale `*:8080` backend process, restarting the local H2 demo backend, and recapturing the active-kickoff state.
3. Final review found no actionable P0/P1/P2 findings. Desktop and 390 × 844 responsive captures are available at the paths above.
4. Follow-up review verified the username hydration, removed the project description, made every flow node clickable, calculated progress from completed nodes, and verified rollback visibility and execution.
5. The node detail body was restructured into a read-only project profile form: available project fields are displayed in a two-column layout, people information is separated, and node-specific information remains available below it. Project template, associated RD, and tags are intentionally omitted.
6. Follow-up feedback removed project name and project code from the profile body because both are already presented in the project header.
7. The first visual migration pass now applies shared cold-gray tokens, blue primary actions, lighter panel borders, compact shell dimensions, and consistent list/detail/login surfaces.
8. Flow nodes now use color and icon treatment without rendering status words; the detail header omits the current-node index, and the detail body renders only fields configured on the selected node.
9. The node detail card now behaves as a node-specific tab panel: the kickoff node includes the project profile and people sections, while other nodes omit those shared project fields; the collaboration section remains public below all node tabs.
10. The kickoff profile now has an edit mode with text area, priority and user selects, date range picker, multi-select members and multi-select followers; saving persists the project fields and relations through the backend.
11. Primary actions across the page now use one shared button style: 36px height, 13px text, 14px horizontal padding, 6px radius, and consistent hover treatment.
12. The project creator is now a lightweight identity annotation while the project manager keeps the highlighted responsibility treatment; multi-person selector chips have a consistent 4px gap.
13. The creator annotation is placed inline before the creation time in the compact project metadata row, leaving the manager as the only highlighted person card.

## Implementation checklist

- [x] Project header matches the reference's compact status/title treatment.
- [x] Flow states are visually distinct and every node can be selected for inspection.
- [x] Current-node detail has a clear primary completion action.
- [x] Overall progress is calculated from completed nodes.
- [x] Rollback is shown only for completed nodes and restores the selected node to in-progress.
- [x] Existing task/milestone/member/activity management remains available.
- [x] Desktop and mobile layouts were rendered and checked.
- [x] Browser regression covered active, pending, and completed node states.
- [x] Read-only project profile matches the supplied form-style reference and excludes unmodeled fields.
- [x] Duplicate project name and project code fields are omitted from the profile body.
- [x] Shared global design tokens are applied to shell, list, detail, and login surfaces.
- [x] Flow node status words and the current-node index are omitted from the detail experience.
- [x] Node detail fields are rendered dynamically from the selected node's configured content.
- [x] Project profile and people content is shown only for the kickoff node tab.
- [x] Project collaboration remains shared below the node-specific detail panel.
- [x] Kickoff profile controls use the requested input, select, date-range, and multi-select behaviors.
- [x] Member and follower selections save and reload from backend relations.
- [x] Primary actions use the shared button standard across page, node detail, and collaboration toolbars.
- [x] Creator and manager emphasis is differentiated, and multi-person chips remain visually separated.
- [x] Creator metadata stays compact and appears before the creation time in the project header.

final result: passed
