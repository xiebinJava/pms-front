# 项目详情页与项目操作按钮视觉 QA

## 比较目标

- Source visual truth: `/tmp/pms-demo-reference.png`（由 `http://127.0.0.1:4174/project-detail-governance-prototype.html` 截取）
- Implementation: `/tmp/pms-project-detail-header-compact-final-clean.png`（`http://127.0.0.1:5173/projects/2`）
- Responsive implementation: `/tmp/pms-project-detail-header-compact-mobile-final-clean.png`
- Viewport: desktop `1280 × 900` CSS px；mobile `390 × 844` CSS px
- Device scale factor: `1`
- State: zh-CN、管理员登录态、项目详情页顶部、当前节点为项目立项与启动

## 比较证据

### Full view

头部从原先约 `962 × 202` 收紧为约 `976 × 169`，左边缘与 demo 的内容起点对齐；白色卡片、14px 圆角、轻阴影、标题/标签/操作按钮和底部摘要栏的层级与 demo 一致。

### Focused region

本轮只对头部做视觉还原，重点检查标题字号、标签色、操作按钮、元信息分隔线和摘要栏。流程区是现有业务组件，本轮按用户要求保持原样，不作为本轮 demo 视觉还原目标。

## Fidelity surfaces

- Fonts and typography: 继续使用现有 Inter + 中文系统字体栈；头部标题调整为 24px，标签与摘要维持紧凑字号和明确字重。
- Spacing and layout rhythm: 头部采用 demo 的 24px 上内边距、26px 横向内边距、19px 下内边距；元信息和摘要栏间距收紧。
- Colors and visual tokens: 头部局部使用 demo 的深色文字、`#1769e0` 蓝色、橙色状态、紫色等级和白色表面；没有修改全局页面主题，避免影响其他模块。
- Image quality and asset fidelity: 本区域没有图片资产；使用现有图标库图标，没有新增占位图或 CSS 绘图。
- Copy and content: 文案走现有 i18n；项目名称、负责人、周期、等级和优先级来自真实项目数据，因此可能与 demo 示例文本不同。

## Comparison history

1. Initial comparison: implementation header约 `962 × 202`，demo约 `975 × 165`；真实页面纵向间距偏大、边框和灰色层级偏重。
2. Fix: 将头部改为紧凑三层结构，调整局部颜色 token、圆角、阴影、元信息分隔和摘要栏布局。
3. Scope correction: 初版同时调整了流程区；用户确认流程区暂不改后，已恢复原流程标题、节点卡片尺寸、8px 圆角和橙色进行中状态。桌面截图复核显示流程卡片仍为原来的 `230px` 节点宽度和 `8px` 圆角。
4. Post-fix evidence: 桌面头部高度约 `169px`；点击第二个流程节点后，当前节点详情和节点进度数据正确切换；移动端页面 `scrollWidth = clientWidth = 390`，无页面级横向溢出；控制台无错误。
5. Header refinement: 项目周期改为跟在业务线元信息后自然排列；移除“编辑项目”文字按钮，将生命周期操作收进无文字三点菜单；节点负责人/节点排期区域移除上下装饰边框，流程节点卡片本身保持不变。
6. Progress semantics: 项目进度按已完成节点数 / 节点总数计算；节点进度按当前节点任务看板中已完成任务数 / 任务总数计算，并在任务新增、状态移动、编辑或删除后刷新头部摘要。
7. Summary refinement: 顶部摘要移除重复的“当前节点”和“健康度”，节点上下文继续由流程选中态与当前节点详情承载；节点进度统一显示为“节点进度 百分比（已完成/总任务数）”，百分比加粗、标签保持常规字重。
8. Badge refinement: 任务卡片优先级标签改为复用头部项目标签的基础样式；紧急仍使用危险语义色，但改为浅红背景和深色文字，避免与头部标签形成两套视觉语言。
9. Gantt schedule editing: 对具备编辑权限且已有排期的进行中节点，甘特条支持整条移动和左右边缘缩放；按天吸附、保存成功同步节点详情/流程卡片、失败回滚。项目条、任务/里程碑标记、无排期节点和只读节点保持不可拖动。

## Findings

- No actionable P0/P1/P2 findings remain for the approved header scope.
- P3 / intentional deviation: demo 使用 5 个示例节点，真实项目保留后端返回的 9 个流程节点；按本轮范围，流程区不做 demo 化重构。
- P3 / data difference: demo 示例为“高优先级”等固定展示，真实项目展示当前数据库中的等级和优先级，这是数据差异，不写死到 UI。
- P3 / summary choice: 顶部不重复展示当前节点和健康度；当前节点仍通过流程选中态与详情区表达，健康状态不作为本页头部摘要指标。

## Button system iteration

- Scope: 项目列表、项目详情头部、节点操作、任务看板、子任务/评论/附件、里程碑、成员、日历和甘特图工具栏。
- Shared contract: 主操作使用实心蓝色；次操作使用白底描边；低优先级操作使用文字按钮；删除/终止使用红色危险语义；图标按钮保留紧凑尺寸。
- Geometry: 常规按钮 `36px` 高、`8px` 圆角；紧凑按钮 `32px` 高；按钮统一使用 `#1769e0` / `#1258bf` 主色、`#eaf2ff` 悬停底色，并补充键盘焦点环和禁用态。
- Modal coverage: Ant Design teleport 到 body 的项目弹窗通过 `.pms-project-modal` 单独覆盖 footer，避免弹窗内保存/取消/删除按钮回退到旧样式。
- Intentional exception: 流程节点、日历事件、甘特条和甘特标记仍保持各自的数据/状态卡片交互，不强行套用普通业务按钮外观。
- Evidence: `/tmp/pms-project-header-refined-node2.png`（详情页、切换到第二个流程节点后）、`/tmp/pms-project-header-refined-mobile.png`（移动端）。

### Button verification

- 头部生命周期操作改为无文字三点菜单；节点完成、任务添加、里程碑新建和排期工具栏继续使用统一的主/次按钮颜色、边框和圆角。
- 任务弹窗 footer 的删除/取消/保存分别为危险/次要/主要语义，实测均为 `36px` 高、`8px` 圆角。
- 桌面 `1280 × 900` 与移动 `390 × 844` 均无页面级横向溢出；移动端三点菜单保持 `32px` 宽并贴齐头部右侧。
- 点击第二个流程节点后，流程选中态、节点详情和节点进度数据区域仍正确切换，证明本轮头部收口没有改变原流程交互。
- 甘特联调验证：临时为可编辑节点设置日期后，整条拖动产生日期移动且工期不变，右边缘拖动只改变结束日期；两次请求均返回成功，节点日期选择器显示服务端返回的新日期，随后恢复临时数据为空；当前完成节点因只读状态不显示可拖动样式。
- 空白节点联调：没有日期的可编辑节点在时间轴空白行按住并拖动后，显示按天吸附的范围预览并提交新排期；反向拖动会规范日期，同日拖动生成单日排期，普通点击仍只选中节点；保存成功同步节点详情，失败恢复为空白状态。
- 日期密度联调：甘特工具栏提供日期宽度减号/加号，默认宽度可在 14px～52px 之间按 8px 调整；实际验证 `24px → 32px → 24px` 时，日期网格宽度同步变化且项目/节点日期不变，控制台无错误。

## Final result

passed
