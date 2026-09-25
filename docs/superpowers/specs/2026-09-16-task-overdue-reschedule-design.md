# 任务逾期与改期记录设计

## 1. 背景

PMS 当前的项目详情以流程节点为主线，任务只能归属于某个节点。任务已有待办、进行中、已完成三种状态，以及可选的截止日期；项目节点和项目本身已有甘特图、日历和逾期摘要。

本次不引入任务之间的依赖关系，也不引入新的“阻塞”状态。用户真正需要的是：任务到期后没有完成时，系统能自动识别为逾期；任务截止日期被改晚时，系统能留下清晰的改期记录。

## 2. 目标

1. 让任务负责人和项目经理在任务卡片、任务详情、甘特图、日历和个人工作台中看到一致的逾期状态。
2. 使用服务端统一计算日期状态，避免浏览器时区和后端时区不一致。
3. 记录每次截止日期变化，并区分设置日期、改期、提前和清除日期。
4. 不改变现有任务状态和节点推进规则，不让逾期自动阻止节点完成。
5. 保持现有权限、乐观锁、通知和审计行为兼容。

## 3. 非目标

以下能力不在本期范围内：

- 任务之间的前置、后置、阻塞或关联关系。
- 甘特图中的依赖连线、关键路径和自动排期。
- 新增“阻塞”任务状态。
- 根据延期自动推迟后续任务、节点或项目日期。
- 跨项目任务排期和资源容量计算。
- 要求用户填写延期原因。后续如有需要，可以在改期记录上增加可选原因字段。

## 4. 核心定义

### 4.1 任务状态与排期状态分离

任务业务状态继续保持现有三种值：

| 任务状态 | 含义 |
| --- | --- |
| `0 TODO` | 待办，尚未开始 |
| `1 DOING` | 进行中 |
| `2 DONE` | 已完成 |

排期状态是根据任务状态和截止日期派生出的只读状态，不写回 `project_task.status`：

| 排期状态 | 判断条件 | 展示文案 |
| --- | --- | --- |
| `NO_DUE_DATE` | `dueDate` 为空 | 未设置截止日期 |
| `DUE_TODAY` | 未完成且 `dueDate = today` | 今日到期 |
| `ON_TIME` | 未完成且 `dueDate > today` | 按期 |
| `OVERDUE` | 未完成且 `dueDate < today` | 已逾期 |
| `COMPLETED` | 任务状态为已完成 | 已完成 |

日期计算统一使用 `Asia/Shanghai` 的自然日。截止日期为日期而非时间，因此截止日期为今天的任务在当天仍显示“今日到期”，从次日开始显示“已逾期”。已完成任务不显示逾期，即使其截止日期早于今天。

`overdueDays` 仅在 `OVERDUE` 时返回大于 0 的天数，其他状态返回 0。

### 4.2 改期记录

只要已有任务的 `dueDate` 发生变化，就记录一条排期历史；创建任务时写入初始截止日期不算改期记录。

| 原截止日期 | 新截止日期 | `changeType` | 含义 |
| --- | --- | --- | --- |
| 空 | 有值 | `SET` | 首次设置截止日期 |
| 有值 | 更晚日期 | `RESCHEDULED` | 延期 |
| 有值 | 更早日期 | `MOVED_EARLIER` | 提前 |
| 有值 | 空 | `CLEARED` | 清除截止日期 |
| 有值 | 相同日期 | 不记录 | 没有实际变化 |

“已延期”是历史事实，不是当前任务状态。一个任务可以同时处于“已延期”和“已逾期”；已完成后仍保留“已延期”历史，但不再显示逾期。

## 5. 用户体验设计

### 5.1 任务卡片

在项目详情的任务看板中：

- 保留现有任务状态标签和优先级标签。
- 截止日期旁增加排期标签，不替换任务状态。
- `今日到期`使用浅橙色。
- `已逾期 N 天`使用现有语义化浅红色，不使用刺眼的纯红底。
- 已完成任务只显示完成状态，不显示逾期标签。
- 无截止日期时继续显示现有的日期占位文案。
- 任务卡片不显示依赖箭头，也不增加额外关系图标。

示例：

```text
接口文档整理       进行中   高
负责人：张三       截止：2026-09-15   已逾期 1 天
```

### 5.2 任务详情弹窗

在截止日期字段下方显示一行只读排期摘要：

- `今日到期`
- `已逾期 3 天`
- `按期`
- `未设置截止日期`
- 已完成任务显示 `已完成`

当用户把截止日期改晚后，保存仍使用现有任务保存流程；保存成功后显示“截止日期已更新”，并在任务详情的“排期记录”区域追加一条记录。无需增加二次确认弹窗，也不要求填写原因。

排期记录按时间倒序显示，包含：

- 原截止日期
- 新截止日期
- 操作类型，例如“延期”“提前”“设置截止日期”“清除截止日期”
- 操作人
- 操作时间

### 5.3 甘特图与日历

本期保留现有“项目、节点、迭代计划、任务”的时间线结构，不增加连线。

- 甘特图中的任务圆点根据派生排期状态使用不同颜色。
- 逾期任务使用浅红语义色，悬浮提示中显示“已逾期 N 天”。
- 今日到期任务使用浅橙语义色。
- 日历中的任务事件使用相同状态色。
- 点击任务仍回到对应节点的任务详情。
- 甘特图继续只展示当前已有的顶层任务截止日期标记；子任务在任务详情中展示，不单独增加甘特图标记。
- 节点排期拖拽行为不变；本期不允许通过甘特图拖动任务，因为任务只有截止日期，没有任务开始日期。

### 5.4 个人工作台

个人工作台是任务负责人最重要的入口，本期同步增加：

- 概览卡片“已逾期任务”。
- 我的任务列表中的“已逾期 N 天”标签。
- 点击任务仍进入项目详情并打开任务详情。

现有通知中心的临期、逾期通知逻辑保持不变。通知是提醒，任务接口中的 `scheduleState` 是实时状态，两者不互相替代。

## 6. 后端设计

后端仓库：`../pms-backend`。

### 6.1 数据库迁移

新增 Flyway 迁移：

`src/main/resources/db/migration/V45__task_schedule_history.sql`

新增表 `project_task_schedule_history`：

```sql
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
```

说明：

- 使用独立表承载用户可读的排期变化，不依赖解析审计日志中的 JSON。
- 保留 `previous_due_date` 和 `next_due_date` 的空值语义。
- 项目和任务均使用现有软删除/权限边界，不为历史记录单独开放跨项目读取。
- `schema.sql` 同步补充表结构和索引，保证新环境初始化与 Flyway 升级一致。

### 6.2 领域对象和 DTO

新增后端对象：

- `ProjectTaskScheduleHistoryDO`
- `ProjectTaskScheduleHistoryMapper`
- `TaskScheduleChangeType` 枚举
- `TaskScheduleState` 枚举或等价的纯函数
- `TaskScheduleHistoryDTO`

扩展 `ProjectTaskDTO`：

```java
private String scheduleState;
private int overdueDays;
private boolean rescheduled;
```

扩展 `TaskDetailDTO`：

```java
private List<TaskScheduleHistoryDTO> scheduleHistory;
```

字段约定：

- `scheduleState` 返回 `NO_DUE_DATE`、`DUE_TODAY`、`ON_TIME`、`OVERDUE` 或 `COMPLETED`。
- `rescheduled` 只有在任务存在至少一条 `RESCHEDULED` 记录时为 `true`。
- 任务列表使用批量查询获得 `rescheduled`，不得对每个任务单独查询历史。
- 任务详情返回全部排期历史；当前任务历史量不做分页，后续数据量明显增长时再独立分页。

### 6.3 服务层逻辑

在 `TaskService` 中集中处理截止日期变化，避免主任务编辑和子任务快速改期出现不同规则：

1. 读取并保存 `previousDueDate`。
2. 复用现有版本校验、权限校验和截止日期清除规则。
3. 更新任务。
4. 当新旧日期不相同时，在同一事务中插入排期历史。
5. 保留现有 `TASK_UPDATED` 审计记录，不新增重复的截止日期审计动作；排期历史表负责用户可读的日期变化记录。
6. 返回包含最新派生排期状态的任务 DTO。

主任务、子任务、任务负责人、项目经理、节点负责人和管理员沿用现有权限边界：谁有权限修改截止日期，谁就可以产生改期记录；查看历史必须先通过任务所属项目和节点的读取校验。

### 6.4 API 合同

不新增任务改期接口，复用现有接口：

```text
GET  /projects/{projectId}/tasks?nodeId={nodeId}
GET  /tasks/{id}
PUT  /tasks/{id}
```

`PUT /tasks/{id}` 仍接受：

```json
{
  "dueDate": "2026-09-18",
  "version": 3
}
```

清除日期仍使用现有：

```json
{
  "clearDueDate": true,
  "version": 3
}
```

返回任务时补充：

```json
{
  "scheduleState": "OVERDUE",
  "overdueDays": 2,
  "rescheduled": true
}
```

任务详情补充：

```json
{
  "scheduleHistory": [
    {
      "id": 18,
      "taskId": 73,
      "previousDueDate": "2026-09-15",
      "nextDueDate": "2026-09-18",
      "changeType": "RESCHEDULED",
      "operatorName": "张伟（Alex.Zhang）",
      "createdAt": "2026-09-16T10:30:00"
    }
  ]
}
```

### 6.5 工作台汇总

扩展 `WorkbenchSummaryDTO`：

```java
private int overdueTaskCount;
```

`WorkbenchService.summarize` 使用同一 `Asia/Shanghai` 日期规则统计：任务未完成、截止日期早于今天即计入逾期。工作台任务 DTO 复用 `ProjectTaskDTO` 的排期字段，避免前端自行重复计算。

## 7. 前端改造边界

前端仓库：`../pms-front`。

### 7.1 类型与接口

- `src/types/domain.ts`：增加 `TaskScheduleState`、`TaskScheduleHistory`，扩展 `Task` 和 `TaskDetail`。
- `src/api/task.ts`：保持现有接口签名，确保任务返回值包含新增字段；不新增依赖关系 API。
- `src/views/workbench/workbench.ts` 或对应类型文件：补充工作台汇总的逾期字段。

### 7.2 任务看板和详情

- `src/views/project/detail/components/TaskKanban.vue`：显示任务排期标签，保存截止日期后刷新派生状态。
- `src/views/project/detail/components/TaskWorkPanel.vue`：增加排期历史区域，空历史不显示空白面板。
- `src/views/project/detail/index.vue`：不增加新的项目级依赖数据，只负责现有任务数据刷新和路由回跳。
- `src/styles/index.css` 或已有项目语义样式：复用浅橙和浅红 token，保持与项目优先级标签一致。

### 7.3 甘特图和日历

- `src/views/project/detail/schedule.ts`：扩展 `ScheduleTone`，让任务标记按 `scheduleState` 生成 `overdue`、`active`、`completed` 等色调。
- `src/views/project/detail/components/ProjectScheduleChart.vue`：更新图例、任务标记和悬浮提示；不增加依赖线层。
- `src/views/project/detail/components/ProjectScheduleCalendar.vue`：复用任务排期色调。

### 7.4 工作台

- `src/views/workbench/index.vue`：增加逾期概览卡片和任务行标签。
- 工作台点击行为保持不变，继续通过 `?task={id}` 定位到项目任务详情。

### 7.5 国际化

在 `src/locales/zh-CN.ts` 和 `src/locales/en-US.ts` 增加完整 key：

- `task.scheduleState.noDueDate`
- `task.scheduleState.dueToday`
- `task.scheduleState.onTime`
- `task.scheduleState.overdue`
- `task.scheduleState.completed`
- `task.rescheduleHistory`
- `task.scheduleChange.set`
- `task.scheduleChange.rescheduled`
- `task.scheduleChange.movedEarlier`
- `task.scheduleChange.cleared`
- `workbench.overdueTasks`

不要在模板中直接写中文排期状态。新增 key 必须同时提供中英文文本，并通过现有 locale 测试。

## 8. 数据流

```text
用户修改截止日期
        |
        v
现有 PUT /tasks/{id}
        |
        +--> 版本和权限校验
        |
        +--> 更新 project_task.due_date
        |
        +--> dueDate 变化时写入 schedule_history
        |
        +--> 写入 TASK_DUE_DATE_CHANGED 审计事件
        |
        v
返回任务 + scheduleState + overdueDays + rescheduled
        |
        +--> 看板更新标签
        +--> 详情更新排期记录
        +--> 甘特图/日历重新计算任务颜色
        +--> 工作台下次加载显示实时状态
```

逾期状态不依赖定时任务写回数据库；日期跨天后，下一次读取任务时自动得到新状态。现有定时提醒继续负责发送一次性的站内通知。

## 9. 错误处理与边界

- 任务没有截止日期：不显示逾期，也不写改期记录。
- 任务截止日期为今天：显示“今日到期”，不显示逾期。
- 任务完成：排期状态为 `COMPLETED`，不显示逾期。
- 完成任务重新打开：如果截止日期早于当天，重新显示逾期。
- 用户重复保存同一日期：不生成历史记录。
- 任务更新发生版本冲突：不写排期历史，前端保留现有冲突提示。
- 更新任务失败：前端不保留乐观的排期标签，重新使用服务端任务数据。
- 删除任务：沿用现有任务的软删除和附件删除事务，排期历史保留用于审计，但普通任务详情、项目视图和历史查询都不展示已删除任务的记录。
- 终止项目：沿用现有只读规则，不能通过任务编辑产生改期记录。
- 管理员和项目治理人看到的历史与普通项目成员遵循同一项目读取范围，不开放跨项目搜索。

## 10. 测试策略

### 后端单元测试

- 未完成任务且截止日期早于上海当天返回 `OVERDUE` 和正确的 `overdueDays`。
- 截止日期为当天返回 `DUE_TODAY`。
- 未来日期返回 `ON_TIME`。
- 空日期返回 `NO_DUE_DATE`。
- 已完成且日期已过返回 `COMPLETED`，不是 `OVERDUE`。
- 有日期改到更晚时写入 `RESCHEDULED`。
- 有日期改到更早时写入 `MOVED_EARLIER`。
- 首次设置日期写入 `SET`，创建任务本身不写历史。
- 清除日期写入 `CLEARED`。
- 相同日期更新不写历史。
- 版本冲突、无权限和终止项目更新均不写历史。
- 任务列表批量加载改期标记，不产生逐任务历史查询。
- 工作台逾期汇总与任务 DTO 使用同一天的时区规则。

### 前端单元和视图测试

- 各 `scheduleState` 使用正确文案和颜色。
- 已完成任务不显示逾期标签。
- 任务卡、任务详情、甘特图、日历和工作台使用同一状态字段。
- 任务详情能展示排期历史的日期、类型、操作人和时间。
- 保存截止日期后，失败时不留下错误的本地状态。
- 中英文 locale 均能找到新增 key，不产生缺失 key 警告。
- 甘特图只显示状态色和任务标记，不渲染任务依赖连线。

### 验收场景

1. 创建一个截止日期为今天的进行中任务，页面显示“今日到期”。
2. 将日期推进到明天并切换到下一自然日，页面显示“已逾期 1 天”。
3. 将任务日期从今天改到三天后，详情中出现一条“延期”记录。
4. 将延期后的任务改回更早日期，详情中出现一条“提前”记录。
5. 将任务完成，逾期标签消失，但排期历史仍保留。
6. 刷新页面、切换节点、进入甘特图、日历和工作台，状态保持一致。
7. 使用英文界面操作上述流程，不出现中文回退或国际化 key 警告。

## 11. 实施批次与顺序

第一批（P0）先交付实时排期状态：

1. 后端增加 `scheduleState` 和 `overdueDays` 的统一计算，并补充任务列表、任务详情和工作台任务返回值。
2. 前端接入任务卡片、任务详情、甘特图任务标记和日历事件的逾期展示。
3. 完成跨天、完成、重新打开、无截止日期和时区边界测试。

第二批（P1）交付改期追溯：

1. 增加排期历史迁移、领域对象、Mapper 和事务写入。
2. 任务详情增加排期记录，工作台增加逾期任务汇总。
3. 完成设置、延期、提前、清除日期、重复保存和版本冲突测试。

第三批（P2）交付时间线视觉同步：

1. 甘特图只给顶层任务标记增加逾期和今日到期色调及悬浮提示。
2. 日历事件复用同一排期状态色调。
3. 验证不产生任务依赖连线，不改变节点排期拖拽。

所有批次完成后，再用真实项目验证只读项目、节点切换、任务详情深链和中英文界面，并通过后端测试、前端测试、类型检查、构建和浏览器回归验证。

## 12. 方案结论

本期的核心不是增加一种复杂任务关系，而是把“截止日期”变成可信的项目管理信号：状态自动计算，改期可追溯，展示跨页面一致。任务仍然只归属于流程节点，流程节点仍然负责项目生命周期推进；任务逾期只用于提醒和风险识别，不自动阻断节点或改变项目状态。
