import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

import {
  getDerivedProjectStatus,
  getDerivedTopicStatus,
  getDevelopmentSummary,
  getProjectStatusPresentation,
  getStoryProgress,
  getTopicProgress,
  resolveSelectedTopicId,
} from './development-control.ts'

const topics = [
  {
    id: 1,
    title: '订单中心专题',
    testStatus: 'TESTING',
    status: 'IN_PROGRESS',
    progress: 0,
    stories: [
      { id: 11, title: '订单状态', status: 'IN_PROGRESS', progress: 60, storyPoints: 8 },
      { id: 12, title: '异常提醒', status: 'BLOCKED', progress: 40, storyPoints: 5 },
      { id: 13, title: '查询优化', status: 'DONE', progress: 100, storyPoints: 5 },
    ],
  },
  {
    id: 2,
    title: '商品专题',
    testStatus: 'NOT_STARTED',
    status: 'IN_PROGRESS',
    progress: 0,
    stories: [
      { id: 21, title: '商品模型', status: 'DONE', progress: 100, storyPoints: 3 },
      { id: 22, title: '商品资料', status: 'IN_PROGRESS', progress: 50, storyPoints: 8 },
      { id: 23, title: '商品分类', status: 'NOT_STARTED', progress: 0, storyPoints: 5 },
    ],
  },
]

test('summarizes development progress from topic stories', () => {
  const summary = getDevelopmentSummary(topics)

  assert.deepEqual(summary, {
    topicCount: 2,
    storyCount: 6,
    completedStoryCount: 2,
    blockedStoryCount: 1,
    progress: 58,
  })
})

test('calculates a topic progress from its stories instead of trusting a display total', () => {
  const topic = topics[1]

  assert.equal(getTopicProgress(topic), 50)
})

test('derives a three-state topic status from story statuses', () => {
  assert.equal(getDerivedTopicStatus([]), 'NOT_STARTED')
  assert.equal(getDerivedTopicStatus([{ status: 'NOT_STARTED', progress: 0, storyPoints: 1, title: 'todo' }]), 'NOT_STARTED')
  assert.equal(getDerivedTopicStatus([{ status: 'TESTING', progress: 60, storyPoints: 1, title: 'testing' }]), 'IN_PROGRESS')
  assert.equal(getDerivedTopicStatus([{ status: 'BLOCKED', progress: 40, storyPoints: 1, title: 'blocked' }]), 'IN_PROGRESS')
  assert.equal(getDerivedTopicStatus([{ status: 'DONE', progress: 0, storyPoints: 1, title: 'done' }]), 'DONE')
  assert.equal(getDerivedTopicStatus(topics[0].stories), 'IN_PROGRESS')
  assert.equal(getDerivedTopicStatus([{ status: 'DONE', progress: 100, storyPoints: 1, title: 'done' }]), 'DONE')
})

test('project row status follows story progress instead of only checking topic count', () => {
  assert.equal(getDerivedProjectStatus([]), 'NOT_STARTED')
  assert.equal(getDerivedProjectStatus([{ title: '空专题', stories: [] }]), 'NOT_STARTED')
  assert.equal(getDerivedProjectStatus(topics), 'IN_PROGRESS')
  assert.deepEqual(getProjectStatusPresentation('IN_PROGRESS'), { label: '开发中', className: 'in-progress' })
  assert.equal(getDerivedProjectStatus([{
    title: '已完成专题',
    stories: [
      { id: 1, title: '故事A', status: 'DONE', progress: 100, storyPoints: 3 },
      { id: 2, title: '故事B', status: 'DONE', progress: 100, storyPoints: 5 },
    ],
  }]), 'DONE')
  assert.deepEqual(getProjectStatusPresentation('DONE'), { label: '已完成', className: 'done' })
  assert.equal(getDevelopmentSummary([{
    title: '已完成专题',
    stories: [
      { id: 1, title: '故事A', status: 'DONE', progress: 100, storyPoints: 3 },
      { id: 2, title: '故事B', status: 'DONE', progress: 100, storyPoints: 5 },
    ],
  }]).progress, 100)
})

test('project row no longer hard-codes in-progress from topic count', () => {
  const workbench = fs.readFileSync(path.join(path.resolve(import.meta.dirname), 'components/DevelopmentControlWorkbench.vue'), 'utf8')
  assert.match(workbench, /getDerivedProjectStatus/)
  assert.match(workbench, /projectStatus\.label/)
  assert.doesNotMatch(workbench, /topics\.length \? '开发中' : '未开始'/)
})

test('counts completed stories as fully complete even when persisted progress is stale', () => {
  assert.equal(getStoryProgress({ status: 'DONE', progress: 0 }), 100)
  assert.equal(getTopicProgress({
    title: '订单中心专题',
    status: 'DONE',
    progress: 0,
    stories: [{ status: 'DONE', progress: 0, storyPoints: 1, title: 'done' }],
  }), 100)
})

test('restores the selected topic by title when the response contains regenerated ids', () => {
  assert.equal(resolveSelectedTopicId([
    { id: 101, title: '订单中心专题', stories: [] },
    { id: 102, title: '商品专题', stories: [] },
  ], 2, '商品专题'), 102)
})

test('reloads when node editability changes after rollback without changing node id', () => {
  const workbench = fs.readFileSync(path.join(path.resolve(import.meta.dirname), 'components/DevelopmentControlWorkbench.vue'), 'utf8')
  assert.match(workbench, /props\.nodeReadOnly,\s*props\.canEdit/)
  assert.match(workbench, /immediate:\s*true/)
  assert.match(
    workbench,
    /editable = computed\(\(\) => Boolean\(props\.canEdit && !props\.nodeReadOnly && !saving\.value\)\)/,
  )
  assert.doesNotMatch(
    workbench,
    /editable = computed\(\(\) => Boolean\(props\.canEdit && !props\.nodeReadOnly && state\.canEdit/,
  )
})

test('topic editor closes after save and ignores stale refresh while open', () => {
  const workbench = fs.readFileSync(path.join(path.resolve(import.meta.dirname), 'components/DevelopmentControlWorkbench.vue'), 'utf8')
  assert.match(workbench, /if \(saving\.value \|\| editorOpen\.value\)/)
  assert.match(workbench, /deferredRefresh = true/)
  assert.match(workbench, /flushDeferredRefresh/)
  assert.match(workbench, /destroy-on-close/)
  assert.match(workbench, /editorOpen\.value = false/)
  assert.match(workbench, /draftTopic\.value = null/)
  assert.match(workbench, /id: topic\.id != null && topic\.id > 0 \? topic\.id : undefined/)
  assert.match(workbench, /const sequence = \+\+loadSequence/)
})

test('mounts the development tree inside the develop node detail', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const page = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/DevelopmentControlWorkbench.vue'), 'utf8')

  assert.match(page, /DevelopmentControlWorkbench/)
  assert.match(page, /nodeHasComponent\(activeNode, 'development-control'\)/)
  assert.match(page, /:project-manager-name="projectManagerDisplay\.label"/)
  assert.match(workbench, /项目开发树/)
  assert.match(workbench, /项目 → 专题 → 故事/)
  assert.match(workbench, /更新开发状态/)
  assert.match(workbench, /新增专题/)
  assert.match(workbench, /@click="saveEditor"/)
  assert.match(workbench, /确认/)
  assert.doesNotMatch(workbench, /测试状态<a-select|testStatusOptions|draftTopic\.testStatus/)
  assert.doesNotMatch(workbench, /shouldAutosaveEditor|watch\(draftTopic|scheduleAutoSave|persistAutoSave/)
  assert.doesNotMatch(workbench, /v-if="editorMode === 'create'" class="development-control__editor-actions"/)
  assert.match(workbench, /getIterationPlans/)
  assert.match(workbench, /所属迭代计划/)
  assert.match(workbench, /迭代计划（可选）/)
  assert.match(workbench, /历史/)
  assert.doesNotMatch(workbench, /getMilestones|所属里程碑|milestoneId|milestoneTitle/)
  assert.match(workbench, /故事负责人/)
  assert.match(workbench, /story\.ownerId/)
  assert.match(workbench, /projectManagerName: string/)
  assert.match(workbench, /projectManagerName \|\| '待分配'/)
  assert.match(workbench, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(workbench, /grid-template-columns: minmax\(180px, 1\.5fr\) minmax\(100px, 0\.8fr\) minmax\(112px, 0\.95fr\) minmax\(86px, 0\.7fr\) minmax\(100px, 0\.8fr\)/)
  assert.match(workbench, /width="min\(1280px, calc\(100vw - 32px\)\)"/)
  assert.match(workbench, /development-control__editor-story \{ display: grid; grid-template-columns: minmax\(200px, 1\.45fr\)/)
  assert.doesNotMatch(workbench, /development-control__editor-story-fields/)
  assert.match(workbench, /getNodeDevelopmentControl/)
  assert.match(workbench, /saveNodeDevelopmentControl/)
  assert.match(workbench, /selectedTopicId/)
  assert.doesNotMatch(workbench, /open-story-tasks|completedTaskCount|查看任务|故事 \/ 任务|developmentStoryId/)
  assert.match(workbench, /故事点/)
  assert.match(workbench, /getStoryProgress\(story\)/)
  assert.match(workbench, /story\.startDate/)
  assert.match(workbench, /story\.dueDate/)
  assert.match(workbench, /DeleteOutlined/)
  assert.match(workbench, /<a-range-picker/)
  assert.match(workbench, /@change="onStoryScheduleChange\(story, \$event\)"/)
  assert.doesNotMatch(workbench, /开始日期<a-date-picker|结束日期<a-date-picker|>删除<\/a-button>/)
  assert.doesNotMatch(workbench, /最近构建|latestBuildVersion/)
  assert.doesNotMatch(workbench, /placeholder="阻塞原因（可选）"/)
  assert.doesNotMatch(workbench, /当前暂无阻塞事项/)
})
