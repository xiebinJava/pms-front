# PMS × fs-insight 视觉迁移回归记录

## 参考基线

- 参考项目：`/Users/fs/Desktop/Project/fs-insight-front`
- 核对文件：`src/styles/base.css`、`src/styles/layout.css`、`src/styles/components.css`、`src/layouts/AppShell.tsx`、`src/components/ui.tsx`
- 关键基线：62px 顶栏、236px 侧栏、1460px 内容宽度、`#f7f8fa` 页面底色、白色面板、8px 圆角、fs-blue 主色、1px 边框和双层轻阴影。

## 已完成映射

| 区域 | 迁移结果 |
| --- | --- |
| 令牌 | PMS 全局颜色、圆角、字体、阴影和控件高度对齐 fs-insight；保留 Ant Design 作为行为层。 |
| 应用壳 | 顶栏、侧栏、内容区、移动端抽屉和遮罩改为 fs-insight 几何关系。 |
| 认证 | 登录、激活、重置密码统一使用 `pms-auth-page` / `pms-auth-card`，按钮、输入焦点和提示文本统一。 |
| 项目 | 列表页使用共享页头和表格面板；详情页的头部、流程、节点和协作区使用统一面板层。 |
| 管理后台 | 人员、角色、组织、批量导入、审计统一页头、筛选条、表格和组织工作区。 |

## 第二轮深度视觉重构

本轮继续保持 Vue、Ant Design Vue、Pinia、API、路由和权限状态不变，只调整模板语义层、共享 class 和 CSS：

- 应用壳改为可控的分组导航（`.pms-nav-list` / `.pms-nav-link`），保留原有路由映射和权限条件。
- 项目详情补齐 hero、section heading、assignment grid、流程轨道和任务卡片的组件级视觉契约。
- 后台页面统一 admin toolbar、表格操作链接、组织属性侧栏和全高画布。
- 全局 Ant 控件统一为 fs-insight 的 36px 控件、8px 面板、1px 边框、轻阴影和焦点态。
- 增加减少动效媒体查询，保证键盘焦点与窄屏布局可用。

## 浏览器回归

- 桌面视口：1280×720，已登录态检查 `/projects`、`/projects/1`、`/admin/users`、`/admin/roles`、`/admin/org`，页面内容非空，导航高亮正确。
- 移动视口：390×844，登录卡片在窄屏下保持居中、输入和按钮不溢出。
- 交互：使用 `admin / admin123` 登录成功；项目列表、项目详情和配置导航可切换，组织画布可显示负责人并保持连线，项目详情流程横向滚动不挤压。
- 页面身份：登录页标题为“PMS 项目管理系统”，DOM 快照包含用户名、密码和登录按钮。
- 框架检查：未出现 Vite/Vue 错误覆盖层。

## 自动化检查

- `node --test src/views/visual-depth.test.mjs ...`：17 个视觉、权限和组织画布用例通过。
- `pnpm typecheck`：通过。
- `git diff --check`：通过。

本地 Vite 代理同时移除同源开发请求的 `Origin` 头，避免 OceanBase 后端的 CORS 策略误判本地登录请求；不涉及业务接口或权限逻辑。

## 已知限制

当前视觉回归使用的是本地 OceanBase 后端和管理员账号；未对业务数据、组织关系、角色权限或项目流程做写入操作。
