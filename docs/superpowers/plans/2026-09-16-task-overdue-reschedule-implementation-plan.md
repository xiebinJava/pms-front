# Task Overdue and Reschedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-derived task due-date states and auditable due-date change history across task cards, task details, the workbench, the Gantt timeline, and the calendar without introducing task-to-task dependencies.

**Architecture:** Keep the existing three task workflow states (TODO, DOING, DONE) and add a read-only schedule projection calculated from dueDate, task status, and the Asia/Shanghai calendar date. Persist due-date changes in a separate history table inside the existing task update transaction; reuse the existing task endpoints and permission/version checks. The frontend consumes the projection and renders one consistent schedule badge/tone in every task surface.

**Tech Stack:** Spring Boot, MyBatis-Plus, Flyway, JUnit 5, Mockito, Vue 3, TypeScript, Vue I18n, Ant Design Vue, Node test runner, Vite, Playwright.

**Spec:** docs/superpowers/specs/2026-09-16-task-overdue-reschedule-design.md

## Global Constraints

- Tasks remain associated with workflow nodes only; do not add task dependency, blocker, critical-path, or Gantt-link data.
- project_task.status remains 0 TODO, 1 DOING, 2 DONE; schedule state is derived and read-only.
- Use Asia/Shanghai natural dates; a task due today is DUE_TODAY, and it becomes OVERDUE on the next calendar date if unfinished.
- Completed tasks never expose OVERDUE, even when their due date is in the past; reopening an overdue task exposes OVERDUE again.
- Due-date changes are recorded in a separate history table; do not add a duplicate TASK_DUE_DATE_CHANGED audit event because existing TASK_UPDATED already captures the task date snapshot.
- Existing permissions, optimistic locking, project/node read-only rules, reminder jobs, soft deletion, and task deep links must remain compatible.
- Do not stage unrelated existing work; every commit must list only the files changed for that task.
- Backend verification commands use the installed `mvn` executable because this checkout does not contain `mvnw`.

## File Map

### Backend repository: /Users/fs/Desktop/Project/pms-backend

- src/main/java/com/brad/pms/common/enums/TaskScheduleState.java owns the JSON-visible schedule-state values.
- src/main/java/com/brad/pms/common/TaskScheduleCalculator.java owns the date/status projection and Asia/Shanghai date helper.
- src/main/java/com/brad/pms/entity/ProjectTaskScheduleHistoryDO.java and src/main/java/com/brad/pms/mapper/ProjectTaskScheduleHistoryMapper.java own persisted date-change history.
- src/main/java/com/brad/pms/common/enums/TaskScheduleChangeType.java owns SET, RESCHEDULED, MOVED_EARLIER, and CLEARED.
- src/main/java/com/brad/pms/dto/response/TaskScheduleHistoryDTO.java exposes history without exposing database entities.
- src/main/java/com/brad/pms/service/TaskService.java remains the transaction boundary for task updates, schedule projection, history writes, and task-detail assembly.
- src/main/java/com/brad/pms/service/WorkbenchService.java and src/main/java/com/brad/pms/dto/response/WorkbenchSummaryDTO.java expose the personal overdue count using the same date projection.
- src/main/resources/db/migration/V45__task_schedule_history.sql adds the production migration; src/main/resources/schema.sql keeps fresh installs aligned.
- src/main/resources/openapi/pms-api.yaml documents the added task and workbench response fields.

### Frontend repository: /Users/fs/Desktop/Project/pms-front

- src/types/domain.ts owns the client task schedule-state and history types.
- src/views/project/detail/task-schedule.mjs, task-schedule.d.mts, and task-schedule.test.mjs own state-to-tone/label mapping.
- src/views/project/detail/components/TaskKanban.vue owns task-card and task-editor schedule presentation.
- src/views/project/detail/components/TaskWorkPanel.vue owns task-detail schedule history presentation.
- src/views/project/detail/schedule.ts owns task marker/event schedule tones for the timeline and calendar.
- src/views/project/detail/components/ProjectScheduleChart.vue and ProjectScheduleCalendar.vue render those tones without dependency edges.
- src/views/workbench/workbench.ts and src/views/workbench/index.vue own workbench summary types and task presentation.
- src/locales/zh-CN.ts and src/locales/en-US.ts own all new copy.
- src/styles/pms-theme.css owns reusable schedule badge/tone styles.

---

### Task 1: Add the deterministic backend schedule projection

**Files:**
- Create: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/common/enums/TaskScheduleState.java
- Create: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/common/TaskScheduleCalculator.java
- Test: /Users/fs/Desktop/Project/pms-backend/src/test/java/com/brad/pms/common/TaskScheduleCalculatorTest.java

**Interfaces:**
- Produces TaskScheduleState values NO_DUE_DATE, DUE_TODAY, ON_TIME, OVERDUE, and COMPLETED.
- Produces the nested TaskScheduleCalculator.TaskScheduleSnapshot record with state() and overdueDays().
- Exposes TaskScheduleCalculator.calculate(Integer taskStatus, LocalDate dueDate, LocalDate today) and TaskScheduleCalculator.today().

- [ ] Step 1: Write the failing unit tests with an explicit today value.

~~~java
@Test
void unfinishedTaskDueBeforeTodayIsOverdue() {
    var result = TaskScheduleCalculator.calculate(1,
            LocalDate.of(2026, 9, 14), LocalDate.of(2026, 9, 16));

    assertThat(result.state()).isEqualTo(TaskScheduleState.OVERDUE);
    assertThat(result.overdueDays()).isEqualTo(2);
}

@Test
void dueTodayIsNotOverdueUntilTheNextCalendarDate() {
    var result = TaskScheduleCalculator.calculate(1,
            LocalDate.of(2026, 9, 16), LocalDate.of(2026, 9, 16));

    assertThat(result.state()).isEqualTo(TaskScheduleState.DUE_TODAY);
    assertThat(result.overdueDays()).isZero();
}

@Test
void completedTaskWithPastDueDateIsCompleted() {
    var result = TaskScheduleCalculator.calculate(2,
            LocalDate.of(2026, 9, 14), LocalDate.of(2026, 9, 16));

    assertThat(result.state()).isEqualTo(TaskScheduleState.COMPLETED);
    assertThat(result.overdueDays()).isZero();
}
~~~

- [ ] Step 2: Run the focused test to verify it fails.

~~~bash
cd /Users/fs/Desktop/Project/pms-backend
mvn -q -Dtest=TaskScheduleCalculatorTest test
~~~

Expected: FAIL because TaskScheduleState and TaskScheduleCalculator do not exist.

- [ ] Step 3: Implement the minimal projection. Use TaskStatus.DONE.getCode() for completion and ZoneId.of("Asia/Shanghai") in today().

~~~java
public enum TaskScheduleState {
    NO_DUE_DATE, DUE_TODAY, ON_TIME, OVERDUE, COMPLETED
}

public final class TaskScheduleCalculator {
    public record TaskScheduleSnapshot(TaskScheduleState state, int overdueDays) { }

    public static TaskScheduleSnapshot calculate(Integer taskStatus, LocalDate dueDate, LocalDate today) {
        if (Objects.equals(taskStatus, TaskStatus.DONE.getCode())) {
            return new TaskScheduleSnapshot(TaskScheduleState.COMPLETED, 0);
        }
        if (dueDate == null) return new TaskScheduleSnapshot(TaskScheduleState.NO_DUE_DATE, 0);
        if (dueDate.isBefore(today)) {
            return new TaskScheduleSnapshot(TaskScheduleState.OVERDUE,
                    Math.toIntExact(ChronoUnit.DAYS.between(dueDate, today)));
        }
        if (dueDate.equals(today)) {
            return new TaskScheduleSnapshot(TaskScheduleState.DUE_TODAY, 0);
        }
        return new TaskScheduleSnapshot(TaskScheduleState.ON_TIME, 0);
    }
}
~~~

- [ ] Step 4: Add boundary tests for null dates, future dates, and reopened tasks. Assert NO_DUE_DATE, ON_TIME, and OVERDUE respectively.

- [ ] Step 5: Run the focused test and commit.

~~~bash
mvn -q -Dtest=TaskScheduleCalculatorTest test
git add src/main/java/com/brad/pms/common/enums/TaskScheduleState.java src/main/java/com/brad/pms/common/TaskScheduleCalculator.java src/test/java/com/brad/pms/common/TaskScheduleCalculatorTest.java
git commit -m 'feat: add task schedule state calculator'
~~~

Expected: PASS and one commit containing only the three task files.

### Task 2: Expose schedule state from task and workbench APIs

**Files:**
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/response/ProjectTaskDTO.java
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/service/TaskService.java
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/service/WorkbenchService.java
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/resources/openapi/pms-api.yaml
- Test: /Users/fs/Desktop/Project/pms-backend/src/test/java/com/brad/pms/service/TaskServiceTest.java
- Test: /Users/fs/Desktop/Project/pms-backend/src/test/java/com/brad/pms/service/WorkbenchServiceTest.java

**Interfaces:**
- Extends ProjectTaskDTO with TaskScheduleState scheduleState and int overdueDays.
- Changes TaskService.toDTO(...) to accept one captured LocalDate today, so one response cannot cross a midnight boundary.
- Changes WorkbenchService.toTaskItems(...) to accept the same captured LocalDate today.
- Does not change existing task endpoint paths or request payloads.

- [ ] Step 1: Add a failing task-service assertion.

~~~java
@Test
void taskDtoIncludesDerivedOverdueState() {
    ProjectTaskDO task = task(1L, null);
    task.setStatus(TaskStatus.DOING.getCode());
    task.setDueDate(LocalDate.now(ZoneId.of("Asia/Shanghai")).minusDays(2));
    when(taskMapper.selectList(any())).thenReturn(List.of(task));
    when(permissionService.requireProject(9L)).thenReturn(openProject());
    when(permissionService.requireNode(eq(9L), eq(3L))).thenReturn(openNode());
    when(permissionService.taskPermissions(any(), any(), any())).thenReturn(new TaskPermissionsDTO());
    when(userService.listByIds(any())).thenReturn(List.of());

    ProjectTaskDTO result = taskService.listByProject(9L, 3L).get(0);

    assertThat(result.getScheduleState()).isEqualTo(TaskScheduleState.OVERDUE);
    assertThat(result.getOverdueDays()).isEqualTo(2);
}
~~~

- [ ] Step 2: Run the focused backend tests to verify they fail to compile.

~~~bash
mvn -q -Dtest=TaskServiceTest,WorkbenchServiceTest test
~~~

Expected: FAIL because the DTO does not yet contain schedule fields.

- [ ] Step 3: Add schedule fields and enrich every task response path. Add scheduleState and overdueDays to ProjectTaskDTO; in TaskService, calculate today once in listByProject, getDetail, create, update, and move, then call the calculator after Convertors.toTask(...).

~~~java
private void enrichSchedule(ProjectTaskDTO dto, ProjectTaskDO task, LocalDate today) {
    TaskScheduleCalculator.TaskScheduleSnapshot snapshot =
            TaskScheduleCalculator.calculate(task.getStatus(), task.getDueDate(), today);
    dto.setScheduleState(snapshot.state());
    dto.setOverdueDays(snapshot.overdueDays());
}
~~~

- [ ] Step 4: Update workbench task conversion. Pass TaskScheduleCalculator.today() from load() to toTaskItems(...); calculate each WorkbenchTaskDTO from the inherited task status and due date.

- [ ] Step 5: Document the response schema. Add scheduleState enum and overdueDays integer to the task schemas in pms-api.yaml; keep request schemas unchanged.

- [ ] Step 6: Run the focused tests and commit.

~~~bash
mvn -q -Dtest=TaskServiceTest,WorkbenchServiceTest test
git add src/main/java/com/brad/pms/dto/response/ProjectTaskDTO.java src/main/java/com/brad/pms/service/TaskService.java src/main/java/com/brad/pms/service/WorkbenchService.java src/main/resources/openapi/pms-api.yaml src/test/java/com/brad/pms/service/TaskServiceTest.java src/test/java/com/brad/pms/service/WorkbenchServiceTest.java
git commit -m 'feat: expose task schedule state'
~~~

Expected: PASS; a task read after the calendar date changes reports a new schedule state without a database update.

### Task 3: Add frontend schedule-state types, mapping, and locale copy

**Files:**
- Modify: src/types/domain.ts
- Create: src/views/project/detail/task-schedule.mjs
- Create: src/views/project/detail/task-schedule.d.mts
- Create: src/views/project/detail/task-schedule.test.mjs
- Modify: src/locales/zh-CN.ts
- Modify: src/locales/en-US.ts

**Interfaces:**
- Produces TypeScript type TaskScheduleState = 'NO_DUE_DATE' | 'DUE_TODAY' | 'ON_TIME' | 'OVERDUE' | 'COMPLETED'.
- Extends Task with optional scheduleState?: TaskScheduleState and overdueDays?: number for backward-compatible fixture data.
- Exposes scheduleTone(state?: TaskScheduleState): 'none' | 'due-today' | 'on-time' | 'overdue' | 'completed'.
- Exposes scheduleLabelKey(state?: TaskScheduleState): string.

- [ ] Step 1: Write mapping tests.

~~~js
import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduleLabelKey, scheduleTone } from './task-schedule.mjs'

test('maps overdue state to the overdue tone and locale key', () => {
  assert.equal(scheduleTone('OVERDUE'), 'overdue')
  assert.equal(scheduleLabelKey('OVERDUE'), 'task.scheduleState.overdue')
})

test('completed state never uses the overdue tone', () => {
  assert.equal(scheduleTone('COMPLETED'), 'completed')
  assert.notEqual(scheduleTone('COMPLETED'), 'overdue')
})
~~~

- [ ] Step 2: Run the focused frontend test to verify it fails.

~~~bash
cd /Users/fs/Desktop/Project/pms-front
pnpm exec node --test src/views/project/detail/task-schedule.test.mjs
~~~

Expected: FAIL because the mapping module does not exist.

- [ ] Step 3: Implement explicit state maps. Do not derive locale keys by string manipulation; unknown or empty states resolve to none and task.scheduleState.noDueDate.

- [ ] Step 4: Add both locale trees. Include labels for no due date, due today, on time, overdue with {days}, completed, schedule history, and the four change types.

- [ ] Step 5: Run the focused test and commit the frontend type/copy layer.

~~~bash
pnpm exec node --test src/views/project/detail/task-schedule.test.mjs
git add src/types/domain.ts src/views/project/detail/task-schedule.mjs src/views/project/detail/task-schedule.d.mts src/views/project/detail/task-schedule.test.mjs src/locales/zh-CN.ts src/locales/en-US.ts
git commit -m 'feat: add task schedule frontend contract'
~~~

### Task 4: Render due-today and overdue states in task cards and task editors

**Files:**
- Modify: src/views/project/detail/components/TaskKanban.vue
- Modify: src/styles/pms-theme.css
- Modify: src/views/project/project-visual.test.mjs

**Interfaces:**
- Consumes Task.scheduleState and Task.overdueDays; never recomputes date state in the component.
- Renders a supplemental schedule badge next to the due date while leaving task status unchanged.
- Uses the existing semantic soft-orange and soft-red tokens.

- [ ] Step 1: Add a visual contract test requiring server-state rendering.

~~~js
const kanban = read('views/project/detail/components/TaskKanban.vue')
assert.match(kanban, /scheduleState/)
assert.match(kanban, /overdueDays/)
assert.doesNotMatch(kanban, /new Date\(\).*dueDate/)
~~~

- [ ] Step 2: Run the focused visual test to verify it fails.

~~~bash
pnpm exec node --test src/views/project/project-visual.test.mjs
~~~

- [ ] Step 3: Add the card schedule badge. Show DUE_TODAY and OVERDUE beside the formatted due date; show overdueDays only for OVERDUE. Do not show a pill for ON_TIME to keep cards compact.

- [ ] Step 4: Add the task-editor schedule summary. In the modal, show the current schedule state below the date picker, including NO_DUE_DATE, DUE_TODAY, ON_TIME, OVERDUE, and COMPLETED copy.

- [ ] Step 5: Add reusable styles. Add pms-task-schedule-badge, --due-today, --overdue, --on-time, and --completed to pms-theme.css; the overdue background must use var(--pms-danger-soft) and the text must use var(--pms-danger).

- [ ] Step 6: Run typecheck and the focused test, then commit.

~~~bash
pnpm exec node --test src/views/project/project-visual.test.mjs
pnpm typecheck
git add src/views/project/detail/components/TaskKanban.vue src/styles/pms-theme.css src/views/project/project-visual.test.mjs
git commit -m 'feat: show task due-date state on cards'
~~~

### Task 5: Persist and expose due-date change history

**Files:**
- Create: /Users/fs/Desktop/Project/pms-backend/src/main/resources/db/migration/V45__task_schedule_history.sql
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/resources/schema.sql
- Create: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/common/enums/TaskScheduleChangeType.java
- Create: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/entity/ProjectTaskScheduleHistoryDO.java
- Create: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/mapper/ProjectTaskScheduleHistoryMapper.java
- Create: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/response/TaskScheduleHistoryDTO.java
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/response/ProjectTaskDTO.java
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/response/TaskDetailDTO.java
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/service/TaskService.java
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/resources/openapi/pms-api.yaml
- Modify: /Users/fs/Desktop/Project/pms-backend/src/test/java/com/brad/pms/service/TaskServiceTest.java
- Create: /Users/fs/Desktop/Project/pms-backend/src/test/java/com/brad/pms/migration/TaskScheduleHistoryMigrationTest.java

**Interfaces:**
- ProjectTaskScheduleHistoryMapper extends BaseMapper<ProjectTaskScheduleHistoryDO>.
- TaskScheduleHistoryDTO contains id, taskId, previousDueDate, nextDueDate, changeType, operatorName, and createdAt.
- ProjectTaskDTO gains boolean rescheduled; TaskDetailDTO gains List<TaskScheduleHistoryDTO> scheduleHistory.
- TaskService writes history in the existing @Transactional update(...) method and returns history in getDetail(...).

- [ ] Step 1: Add migration contract tests before the table.

~~~java
@Test
void migrationDefinesTaskScheduleHistoryAndIndexes() throws IOException {
    String sql = Files.readString(Path.of("src/main/resources/db/migration/V45__task_schedule_history.sql"));
    assertThat(sql).contains("CREATE TABLE project_task_schedule_history");
    assertThat(sql).contains("previous_due_date  DATE NULL");
    assertThat(sql).contains("next_due_date      DATE NULL");
    assertThat(sql).contains("idx_task_schedule_history_task");
    assertThat(sql).contains("task_schedule_history_task_fk");
}
~~~

- [ ] Step 2: Run the migration test to verify it fails.

~~~bash
mvn -q -Dtest=TaskScheduleHistoryMigrationTest test
~~~

- [ ] Step 3: Add the V45 migration and mirror it in schema.sql. Use the exact table and index definition from the approved spec; do not add a deleted column because history follows the task's existing soft-delete visibility rules.

~~~sql
CREATE TABLE project_task_schedule_history (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id         BIGINT NOT NULL,
    task_id            BIGINT NOT NULL,
    previous_due_date  DATE NULL,
    next_due_date      DATE NULL,
    change_type        VARCHAR(24) NOT NULL,
    operator_id        BIGINT NULL,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT task_schedule_history_project_fk
        FOREIGN KEY (project_id) REFERENCES project (id),
    CONSTRAINT task_schedule_history_task_fk
        FOREIGN KEY (task_id) REFERENCES project_task (id),
    CONSTRAINT task_schedule_history_operator_fk
        FOREIGN KEY (operator_id) REFERENCES sys_user (id)
);

CREATE INDEX idx_task_schedule_history_task
    ON project_task_schedule_history (task_id, created_at);
CREATE INDEX idx_task_schedule_history_project
    ON project_task_schedule_history (project_id, created_at);
~~~

- [ ] Step 4: Add the history entity, enum, mapper, and DTO. Map change_type to the enum and keep operator lookup in the service layer so the DTO contains a display name.

- [ ] Step 5: Add failing service tests for SET, RESCHEDULED, MOVED_EARLIER, CLEARED, unchanged date, stale version, forbidden update, and no history insert on create or failed updates.

~~~java
@Test
void updatingToALaterDateRecordsRescheduledHistory() {
    ProjectTaskDO task = task(73L, null);
    task.setDueDate(LocalDate.of(2026, 9, 15));
    when(taskMapper.selectById(73L)).thenReturn(task);
    when(permissionService.requireProject(9L)).thenReturn(openProject());
    when(permissionService.requireNode(9L, 3L)).thenReturn(openNode());

    TaskUpdateCmd cmd = new TaskUpdateCmd();
    cmd.setVersion(task.getVersion());
    cmd.setDueDate(LocalDate.of(2026, 9, 18));

    taskService.update(73L, cmd);

    ArgumentCaptor<ProjectTaskScheduleHistoryDO> history =
            ArgumentCaptor.forClass(ProjectTaskScheduleHistoryDO.class);
    verify(scheduleHistoryMapper).insert(history.capture());
    assertThat(history.getValue().getChangeType()).isEqualTo(TaskScheduleChangeType.RESCHEDULED);
    assertThat(history.getValue().getPreviousDueDate()).isEqualTo(LocalDate.of(2026, 9, 15));
 assertThat(history.getValue().getNextDueDate()).isEqualTo(LocalDate.of(2026, 9, 18));
}
~~~

Add `@Mock ProjectTaskScheduleHistoryMapper scheduleHistoryMapper` to the existing `TaskServiceTest`, initialize its MyBatis table metadata beside `ProjectTaskDO`, and stub its list query to return an empty list in tests that do not exercise history.

- [ ] Step 6: Implement one transactionally shared date-change helper. Capture previousDueDate before applying dueDate or clearDueDate; after a successful updateById, insert one history row only when the value changed. Use SET for null-to-date, RESCHEDULED for a later date, MOVED_EARLIER for an earlier date, and CLEARED for date-to-null.

- [ ] Step 7: Add the rescheduled flag without N+1 queries. In listByProject, query history once for the returned task IDs and RESCHEDULED type, then pass a Set<Long> into toDTO(...). In getDetail, query the selected task's history once and resolve operator names in one user query.

- [ ] Step 8: Preserve existing audit behavior. Keep the existing TASK_UPDATED snapshot, do not modify AuditAction, and do not introduce a second date-change audit row.

- [ ] Step 9: Update OpenAPI and run backend tests.

~~~bash
mvn -q -Dtest=TaskScheduleHistoryMigrationTest,TaskServiceTest test
~~~

- [ ] Step 10: Commit only backend history files.

~~~bash
git add src/main/resources/db/migration/V45__task_schedule_history.sql src/main/resources/schema.sql src/main/java/com/brad/pms/common/enums/TaskScheduleChangeType.java src/main/java/com/brad/pms/entity/ProjectTaskScheduleHistoryDO.java src/main/java/com/brad/pms/mapper/ProjectTaskScheduleHistoryMapper.java src/main/java/com/brad/pms/dto/response/TaskScheduleHistoryDTO.java src/main/java/com/brad/pms/dto/response/ProjectTaskDTO.java src/main/java/com/brad/pms/dto/response/TaskDetailDTO.java src/main/java/com/brad/pms/service/TaskService.java src/main/resources/openapi/pms-api.yaml src/test/java/com/brad/pms/service/TaskServiceTest.java src/test/java/com/brad/pms/migration/TaskScheduleHistoryMigrationTest.java
git commit -m 'feat: record task due-date changes'
~~~

### Task 6: Show schedule history in task details

**Files:**
- Modify: src/types/domain.ts
- Modify: src/views/project/detail/components/TaskWorkPanel.vue
- Modify: src/views/project/detail/task-schedule.test.mjs
- Modify: src/locales/zh-CN.ts
- Modify: src/locales/en-US.ts

**Interfaces:**
- Extends TaskDetail with scheduleHistory?: TaskScheduleHistory[].
- Consumes the history already returned by GET /tasks/{id}; do not add a second request.

- [ ] Step 1: Add a failing rendering contract test.

~~~js
const panel = read('views/project/detail/components/TaskWorkPanel.vue')
assert.match(panel, /scheduleHistory/)
assert.match(panel, /formatDateTime/)
assert.match(panel, /scheduleChange/)
~~~

- [ ] Step 2: Run the focused test to verify it fails.

~~~bash
pnpm exec node --test src/views/project/detail/task-schedule.test.mjs
~~~

- [ ] Step 3: Render a compact 排期记录 section. Hide it when history is empty; otherwise render newest first with old date, new date, change type, operator, and timestamp. Render null dates as the existing no-date copy.

- [ ] Step 4: Keep edits simple. Changing the date still uses the existing save button and optimistic/rollback behavior; do not add a reason dialog or a second confirmation.

- [ ] Step 5: Run typecheck and commit.

~~~bash
pnpm exec node --test src/views/project/detail/task-schedule.test.mjs
pnpm typecheck
git add src/types/domain.ts src/views/project/detail/components/TaskWorkPanel.vue src/views/project/detail/task-schedule.test.mjs src/locales/zh-CN.ts src/locales/en-US.ts
git commit -m 'feat: show task schedule history'
~~~

### Task 7: Add overdue count and labels to the personal workbench

**Files:**
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/response/WorkbenchSummaryDTO.java
- Modify: /Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/service/WorkbenchService.java
- Modify: /Users/fs/Desktop/Project/pms-backend/src/test/java/com/brad/pms/service/WorkbenchServiceTest.java
- Modify: src/views/workbench/workbench.ts
- Modify: src/views/workbench/index.vue
- Modify: src/styles/pms-theme.css
- Modify: src/views/workbench/workbench.test.mjs
- Modify: src/locales/zh-CN.ts
- Modify: src/locales/en-US.ts

**Interfaces:**
- Extends WorkbenchSummary and WorkbenchSummaryDTO with overdueTaskCount.
- Uses the same TaskScheduleCalculator projection in the backend and scheduleState fields in task rows.

- [ ] Step 1: Add a failing backend summary assertion.

~~~java
assertThat(WorkbenchService.summarize(tasks, 1, LocalDate.of(2026, 9, 16))
        .getOverdueTaskCount()).isEqualTo(1);
~~~

- [ ] Step 2: Run the focused backend test to verify it fails.

~~~bash
mvn -q -Dtest=WorkbenchServiceTest test
~~~

- [ ] Step 3: Add the count and make workbench loading use Asia/Shanghai. Replace the current LocalDate.now() call in load() with TaskScheduleCalculator.today() and count only unfinished tasks with due dates before that date.

- [ ] Step 4: Add the fifth overview card and task-row label. Use a soft-danger icon style; keep existing task ordering and deep-link behavior unchanged.

- [ ] Step 5: Add frontend summary fixtures and tests. Extend emptySummary(), WorkbenchSummary, and existing workbench test fixtures; assert the overdue card key and overdue-row source reference.

- [ ] Step 6: Run tests, typecheck, and commit.

~~~bash
cd /Users/fs/Desktop/Project/pms-backend
./mvnw -q -Dtest=WorkbenchServiceTest test
git add src/main/java/com/brad/pms/dto/response/WorkbenchSummaryDTO.java src/main/java/com/brad/pms/service/WorkbenchService.java src/test/java/com/brad/pms/service/WorkbenchServiceTest.java
git commit -m 'feat: surface overdue task count in workbench'

cd /Users/fs/Desktop/Project/pms-front
pnpm exec node --test src/views/workbench/workbench.test.mjs
pnpm typecheck
git add src/views/workbench/workbench.ts src/views/workbench/index.vue src/styles/pms-theme.css src/views/workbench/workbench.test.mjs src/locales/zh-CN.ts src/locales/en-US.ts
git commit -m 'feat: add overdue task card to workbench'
~~~

### Task 8: Synchronize overdue tones in Gantt and calendar without dependency lines

**Files:**
- Modify: src/views/project/detail/schedule.ts
- Modify: src/views/project/detail/components/ProjectScheduleChart.vue
- Modify: src/views/project/detail/components/ProjectScheduleCalendar.vue
- Modify: src/views/project/detail/schedule.test.mjs
- Modify: src/views/project/project-visual.test.mjs
- Modify: src/locales/zh-CN.ts
- Modify: src/locales/en-US.ts

**Interfaces:**
- Extends ScheduleTone with overdue.
- taskMarkerTone(task) returns completed first, then overdue, then active, then task.
- ScheduleMarker and CalendarEvent carry overdueDays?: number for tooltip copy.
- Top-level task filtering remains !task.parentId; no child-task lanes or dependency geometry are added.

- [ ] Step 1: Add failing pure schedule tests.

~~~js
test('overdue unfinished task gets overdue timeline tone', () => {
  const model = buildScheduleModel({
    project: projectFixture,
    nodes: [nodeFixture],
    tasks: [{ ...taskFixture, status: 1, scheduleState: 'OVERDUE', overdueDays: 2 }],
    iterationPlans: [],
    today: '2026-09-16',
  })

  assert.equal(model.lanes.find((lane) => lane.id === 'tasks').markers[0].tone, 'overdue')
})
~~~

- [ ] Step 2: Run the focused schedule test to verify it fails.

~~~bash
pnpm exec node --test src/views/project/detail/schedule.test.mjs
~~~

- [ ] Step 3: Update the pure schedule model. Use task.scheduleState for marker tone, carry task.overdueDays, and keep due-date-only marker positioning unchanged.

- [ ] Step 4: Update Gantt and calendar presentation. Add overdue legend copy, marker CSS, calendar chip CSS, and tooltip text such as '截止 2026-09-14 · 已逾期 2 天'; retain today marker, node drag/resize, task click, and current scrolling behavior.

- [ ] Step 5: Add a regression assertion that no dependency line is rendered. Keep the timeline contract limited to gantt-mark, bars, and today line; do not add SVG/canvas edge containers or dependency imports.

- [ ] Step 6: Run focused tests and commit.

~~~bash
pnpm exec node --test src/views/project/detail/schedule.test.mjs src/views/project/project-visual.test.mjs
pnpm typecheck
git add src/views/project/detail/schedule.ts src/views/project/detail/components/ProjectScheduleChart.vue src/views/project/detail/components/ProjectScheduleCalendar.vue src/views/project/detail/schedule.test.mjs src/views/project/project-visual.test.mjs src/locales/zh-CN.ts src/locales/en-US.ts
git commit -m 'feat: mark overdue tasks on project timelines'
~~~

### Task 9: Add end-to-end regression coverage and perform the full verification pass

**Files:**
- Create: tests/e2e/task-overdue-reschedule.spec.ts
- Modify: tests/e2e/playwright.project-list.config.mjs only if the existing local-app fixture cannot reuse its login/baseURL setup.
- Review: /Users/fs/Desktop/Project/pms-backend/src/main/resources/db/migration/V45__task_schedule_history.sql
- Review: src/locales/zh-CN.ts and src/locales/en-US.ts

**Interfaces:**
- E2E coverage uses existing local seed data or creates a task through the UI; it must not depend on a new endpoint.
- Verification covers the visible user contract, while unit tests cover date and persistence edge cases.

- [ ] Step 1: Write the browser scenarios for today due, overdue, later-date reschedule history, completion clearing the overdue badge, and English copy.

~~~ts
test('task due-date state and reschedule history stay consistent', async ({ page }) => {
  await page.goto('/projects/24')
  await page.locator('.pms-task-card').first().click()
  await expect(page.locator('.pms-task-schedule-badge')).toBeVisible()
  await page.getByLabel('截止日期').fill('2026-09-18')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('延期', { exact: true })).toBeVisible()
})
~~~

- [ ] Step 2: Run the E2E spec against the running local frontend/backend.

~~~bash
pnpm exec playwright test tests/e2e/task-overdue-reschedule.spec.ts
~~~

Expected: PASS for task card, detail, timeline/calendar, and English-copy checks.

- [ ] Step 3: Run backend verification.

~~~bash
cd /Users/fs/Desktop/Project/pms-backend
mvn -q test
~~~

Expected: all existing and new backend tests pass, including migration, task, notification, and workbench tests.

- [ ] Step 4: Run frontend verification.

~~~bash
cd /Users/fs/Desktop/Project/pms-front
pnpm test
pnpm typecheck
pnpm build
git diff --check
~~~

Expected: all tests pass, typecheck/build succeed, and no whitespace errors are reported.

- [ ] Step 5: Perform browser QA on /projects/24 in Chinese and English. Verify no task dependency line appears, node schedule dragging still works, a completed overdue-date task is not red, and a soft-deleted task's history is not shown.

- [ ] Step 6: Review the final diff by repository. Confirm only approved feature files changed; leave unrelated pre-existing work untouched.

~~~bash
git status --short
git log --oneline --decorate -12 -- src/views/project/detail src/views/workbench src/styles/pms-theme.css
~~~

- [ ] Step 7: Commit the E2E coverage after the full verification pass.

~~~bash
git add tests/e2e/task-overdue-reschedule.spec.ts tests/e2e/playwright.project-list.config.mjs
git commit -m 'test: cover task overdue and reschedule flow'
~~~

## Verification Matrix

| Scenario | Backend source of truth | Frontend surface | Expected result |
| --- | --- | --- | --- |
| No due date | dueDate = null | Task card/editor | No overdue label; no history row |
| Due today | dueDate = today and unfinished | Card/editor/calendar | 今日到期 |
| Past due | dueDate < today and unfinished | Card/workbench/Gantt/calendar | 已逾期 N 天 |
| Completed past-due task | status = DONE | All task surfaces | 已完成, no overdue label |
| Reopened past-due task | status changes from DONE to TODO/DOING | All task surfaces | 已逾期 N 天 returns |
| First date set | null → date | Task history | 设置截止日期 |
| Date moved later | earlier date → later date | Task history | 延期 |
| Date moved earlier | later date → earlier date | Task history | 提前 |
| Date cleared | date → null | Task history | 清除截止日期 |
| Same date saved | date → same date | Task history | No new row |
| Version conflict | stale version | Task editor | Existing conflict error; no history row |
| Read-only/terminated project | permission denied | Task editor | Existing permission behavior; no history row |

## Plan Self-Review

- Coverage: schedule calculation, DTO propagation, task card/editor, history persistence, workbench, timeline/calendar, locale copy, E2E, and full verification are all represented by tasks.
- Scope: no task dependency table, no blocker status, no automatic rescheduling, no Gantt edge layer, and no cross-project scheduling are introduced.
- Consistency: backend uses TaskScheduleState; frontend uses the same uppercase JSON values; overdueDays is zero outside OVERDUE; rescheduled is history-derived and does not replace schedule state.
- Persistence: history is written only after a successful task update inside the existing transaction; soft deletion hides it from ordinary reads but preserves audit history.
- Audit: existing TASK_UPDATED remains the single generic task update event; no duplicate date-specific audit action is created.
- Time: every aggregate response captures one Asia/Shanghai date; pure calculator tests use explicit dates.
