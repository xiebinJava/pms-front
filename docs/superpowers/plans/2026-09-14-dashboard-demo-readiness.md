# Dashboard Demo Readiness Implementation Plan

> **For agentic workers:** Execute the checklist in order, with a test checkpoint after the metric change and database verification after the seed.

**Goal:** Simplify enterprise dashboard summary metrics and populate the local development instance with coherent, clearly labeled sample projects.

**Architecture:** Keep metric definitions in the existing pure dashboard helper module so they can be unit-tested, render four primary cards plus a compact terminated filter count, and use the existing local database schema for one-time synthetic data. Do not change backend application code or alter existing records.

**Tech Stack:** Vue 3, TypeScript, Node test runner, Vite/Playwright, local MySQL 8 in Colima.

**Spec:** [2026-09-14-dashboard-demo-readiness.md](../specs/2026-09-14-dashboard-demo-readiness.md)

## Global Constraints

- Preserve the user's existing uncommitted changes in both repositories.
- Only seed the verified local development database; never write to a remote or production database.
- Prefix every inserted sample project name with `【演示】` and preserve all existing rows.
- Keep node progression coherent: completed prefix, at most one current node, not-started suffix.
- Do not change workflow template definitions or their default-version selection.

---

### Task 1: Simplify the dashboard summary

**Files:**
- Modify: `src/views/project-dashboard/enterprise-board.mjs`
- Test: `src/views/project-dashboard/enterprise-board.test.mjs`
- Modify: `src/views/project-dashboard/index.vue`
- Modify: `src/views/project-dashboard/enterprise-board.css`
- Verify: `tests/e2e/enterprise-board.spec.ts`

**Interfaces:** `overviewMetricCards(summary)` returns exactly four card descriptors in order: `total`, `notStarted`, `inProgress`, `completed`; each descriptor contains `key`, `value`, `filter`, and `tone`.

- [ ] Add a unit test asserting the four keys, values, filters, tones, and absence of `terminated` / `attention` cards.
- [ ] Run `node --test src/views/project-dashboard/enterprise-board.test.mjs` and confirm the new test fails because the helper is absent.
- [ ] Implement `overviewMetricCards(summary)` and render labels through the existing i18n keys.
- [ ] Add a compact “已终止 N” button below the cards, wired to the existing phase filter; keep the attention count in the attention-section header.
- [ ] Set wide-screen grid to four columns and tablet/narrow layouts to two balanced columns.
- [ ] Run the focused unit test, `pnpm build`, and the isolated enterprise-board Playwright suite at desktop and 390px.

### Task 2: Seed and verify local sample projects

**Files:**
- One-time data operation only; no backend source edits.
- Read from: local active project type, default published workflow definition, users, and org units.

**Interfaces:** The local database receives exactly eight projects plus their nine workflow nodes each, member/follower associations, and one lifecycle log for the terminated sample.

- [ ] Re-read `@@read_only`, database identity, deployment environment, current default version, and current project count immediately before writes.
- [ ] In one transaction, insert the eight labeled projects and their complete workflow node chains using the current default workflow's stored definitions.
- [ ] Verify the eight exact project names/codes, phase totals, and every node-state sequence with read-only SQL.
- [ ] Verify `/api/projects/board` reports the expected aggregate and each sample's current node/phase; load the dashboard and confirm all primary cards, terminated secondary count, and attention section render.
- [ ] Confirm the original project rows are unchanged and report the sample identifiers so they can be distinguished from production data.
