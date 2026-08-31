<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'

type MediaKind = 'image' | 'gif' | 'video'
type MediaSlot = {
  kind: MediaKind
  label: string
  caption: string
  src?: string
  poster?: string
}

type ManualSection = {
  id: string
  title: string
  lead: string
  icon: Component
  tags: string[]
  relatedPath: string
  media: MediaSlot[]
  purpose: string
  steps: string[]
  notes: string[]
  checklist: string[]
}

const MEDIA_ROOT = '/manual/' // 将 PNG、GIF、MP4 或 WebM 放入 public/manual/ 后填写 src

const sections: ManualSection[] = [
  {
    id: 'quick-start',
    title: '快速开始',
    lead: '从登录、完善账号到进入第一个项目，用最短路径开始工作。',
    icon: CheckCircleOutlined,
    tags: ['首次使用', '账号安全'],
    relatedPath: '/login',
    media: [
      { kind: 'image', label: '登录页截图', caption: '建议展示邮箱输入、错误提示和登录成功后的页面。' },
      { kind: 'video', src: 'manual-navigation.webm', label: '快速开始视频', caption: '视频演示手册入口与模块定位；复杂操作应包含字幕或操作说明。' },
    ],
    purpose: '新成员先确认邮箱、密码和可访问范围，再从工作台查看自己的任务与项目。',
    steps: [
      '使用管理员为你登记的邮箱登录；邮箱地址不区分大小写，系统以邮箱作为账号核心。',
      '首次登录后检查右上角个人信息，确认姓名显示、账号状态和所在组织符合预期。',
      '进入工作台，先看待处理任务、近 7 天到期和参与项目，再从卡片进入具体项目。',
      '需要修改密码时打开右上角菜单，输入当前密码和符合策略的新密码；修改成功后需重新登录。',
    ],
    notes: [
      '中文名和英文名是展示信息，不是登录凭据；没有英文名的企业或人员也可以正常使用。',
      '账号被停用、Token 过期或无权限时，页面会提示重新登录或联系管理员。',
      '不要在截图、录屏或工单中暴露密码、Token、邮件验证码等敏感信息。',
    ],
    checklist: ['可以用邮箱成功登录', '能看到自己的工作台', '知道如何修改密码和退出登录'],
  },
  {
    id: 'workbench',
    title: '工作台',
    lead: '集中查看我负责和参与的项目、任务以及最近协作动态。',
    icon: ToolOutlined,
    tags: ['我的工作', '任务提醒'],
    relatedPath: '/dashboard',
    media: [
      { kind: 'image', src: 'workbench.jpg', label: '工作台截图', caption: '建议标注工作概览、我的任务、项目进展和最近动态四个区域。' },
    ],
    purpose: '工作台是个人入口，不替代项目详情；它只聚合当前账号有权限看到的工作。',
    steps: [
      '查看工作概览：待处理任务、进行中任务、近 7 天到期和参与项目会按实时数据汇总。',
      '在“我的任务”中优先处理临近截止日期或高优先级的任务，点击任务行进入所属项目。',
      '在“项目进展”中查看项目状态、进度和项目经理；项目路径会展示完整业务线层级。',
      '在“最近动态”中查看协作留言，点击项目名称回到对应项目的协作区。',
      '数据异常或部分接口暂时不可用时，点击刷新；页面会保留能够正常加载的内容。',
    ],
    notes: [
      '统计数字基于当前账号的数据权限，不代表全公司的总量。',
      '任务截止日期和项目进度由项目详情维护，工作台只负责聚合展示。',
    ],
    checklist: ['每天先看待处理和到期任务', '从工作台进入项目而不是重复搜索', '发现数据不一致时先刷新再反馈'],
  },
  {
    id: 'rd-management',
    title: '研发管理',
    lead: '研发流程的总入口，当前承载项目管理，后续可扩展需求、测试和缺陷管理。',
    icon: ExperimentOutlined,
    tags: ['模块导航', '研发流程'],
    relatedPath: '/projects',
    media: [
      { kind: 'image', label: '研发管理导航截图', caption: '建议展示一级页签与项目管理子页签的层级关系。' },
    ],
    purpose: '研发管理是业务导航层，不直接保存业务数据；具体数据由项目、任务及后续模块维护。',
    steps: [
      '在左侧展开“研发管理”，点击“项目管理”查看项目列表。',
      '项目详情中维护节点、任务、里程碑、成员和动态；这些内容共同构成研发交付过程。',
      '需求管理、测试管理、缺陷管理会沿用项目与权限体系，模块上线后可从此页签进入。',
      '收起一级页签可以节省空间，当前路由不会因为折叠而丢失。',
    ],
    notes: [
      '研发管理页签不等同于配置管理；前者面向交付过程，后者面向组织、权限和系统治理。',
      '未来模块的权限仍会沿用统一 RBAC 和数据范围校验。',
    ],
    checklist: ['能找到项目管理入口', '理解研发与配置两个一级页签的边界', '知道后续模块会复用项目上下文'],
  },
  {
    id: 'projects',
    title: '项目管理',
    lead: '创建和跟踪项目全生命周期，逐节点推进交付。',
    icon: BookOutlined,
    tags: ['项目列表', '项目详情'],
    relatedPath: '/projects',
    media: [
      { kind: 'image', src: 'project-list.jpg', label: '项目列表截图', caption: '建议展示业务线、项目经理、状态、优先级和日期两行展示。' },
      { kind: 'video', src: 'project-operations.webm', label: '项目详情视频', caption: '演示节点排期、任务卡片、里程碑和终止项目按钮。' },
    ],
    purpose: '项目列表用于全局查找，项目详情用于执行；两处展示的数据来自同一项目记录。',
    steps: [
      '点击“新建项目”，填写项目名称、描述、优先级和项目排期。',
      '选择业务线时按组织树逐层选择到最低层，页面会展示完整路径；若该业务线有负责人，节点负责人会自动带出。',
      '指定项目经理、项目成员和关注人。人员统一以中文名（英文名）展示，没有英文名时只显示中文名或邮箱。',
      '进入项目详情后选择流程节点，维护节点负责人、节点排期、任务看板和里程碑。',
      '需要停止项目时使用“终止项目”按钮；终止属于敏感操作，系统会写入审计日志。',
      '列表中的项目经理、业务线、状态、优先级、进度、任务数、成员数和周期应与详情保持一致。',
    ],
    notes: [
      '节点负责人是节点执行责任人，业务线负责人是组织负责人，两者来源不同但可自动联动。',
      '任务卡片支持悬停显示删除按钮；删除前确认任务是否已产生协作记录。',
      '日期较长时会分两行展示，移动端表格可横向滑动查看完整字段。',
    ],
    checklist: ['项目有明确的最低层业务线', '项目经理和节点负责人已确认', '项目排期、任务和里程碑互相可追溯'],
  },
  {
    id: 'configuration',
    title: '配置管理',
    lead: '统一管理人员、组织、角色、导入和审计能力。',
    icon: SettingOutlined,
    tags: ['系统治理', '管理员'],
    relatedPath: '/admin/users',
    media: [
      { kind: 'image', label: '配置管理截图', caption: '建议展示一级页签与五个配置子页签。' },
    ],
    purpose: '配置管理面向管理员和授权人员，所有写操作都应遵循最小权限和可审计原则。',
    steps: [
      '先在组织架构中建立公司、业务线、部门和团队，再维护组织负责人。',
      '在人员与权限中维护员工邮箱、状态、员工主归属、兼职/项目归属和角色。',
      '在角色管理中维护角色名称、英文编码、权限点和数据范围。',
      '批量变更时使用批量导入，单笔敏感调整则使用人员、组织或角色页面。',
      '在审计日志中追踪组织调整、主归属变化、导入提交和账号状态变更。',
    ],
    notes: [
      '配置管理不可见或按钮不可用，通常是当前账号缺少对应权限，并非页面故障。',
      '生产环境禁止使用默认密码、弱 JWT 密钥或未限制来源的 CORS。',
    ],
    checklist: ['先搭组织再分配人员', '角色只授予必要权限', '敏感调整完成后检查审计日志'],
  },
  {
    id: 'users',
    title: '人员与权限',
    lead: '维护员工账号、邮箱、状态、主归属、兼职归属和角色。',
    icon: TeamOutlined,
    tags: ['员工账号', '主归属'],
    relatedPath: '/admin/users',
    media: [
      { kind: 'image', label: '人员与权限截图', caption: '建议展示邮箱、姓名、主归属、兼职/项目归属和状态。' },
    ],
    purpose: '人员身份以邮箱为核心；中文名和英文名用于友好展示，主归属和组织负责人是两套独立关系。',
    steps: [
      '新增员工时填写唯一邮箱，可选填中文名和英文名；邮箱会统一做大小写归一化。',
      '点击“归属”调整员工主归属，主归属表示员工的组织岗位归属。',
      '兼职/项目归属用于补充项目协作关系，不会覆盖员工主归属。',
      '点击“角色”分配角色；角色权限会受到数据范围限制，不能只看角色名称判断可见数据。',
      '员工离职或暂时不可用时停用账号；停用会阻止登录，但保留历史项目和审计记录。',
    ],
    notes: [
      '组织负责人关系只说明谁负责组织单元，不会自动把该人员的主归属改成该组织。',
      '没有英文名时展示中文名；没有中文名时可展示邮箱本地部分，避免出现空白人员。',
      '账号状态、邮箱和归属变化属于敏感操作，会记录操作者与变更前后值。',
    ],
    checklist: ['邮箱唯一且可接收通知', '主归属与组织负责人分别核对', '停用前确认历史记录不需要删除'],
  },
  {
    id: 'organization',
    title: '组织架构',
    lead: '在可拖拽画布中维护组织层级、业务线、负责人和团队编排。',
    icon: ApartmentOutlined,
    tags: ['可视化画布', '负责人'],
    relatedPath: '/admin/org',
    media: [
      { kind: 'image', src: 'organization-canvas.jpg', label: '组织架构截图', caption: '建议展示节点连线、负责人、缩放和右侧属性面板。' },
      { kind: 'video', src: 'configuration-tour.webm', label: '组织架构视频', caption: '演示组织架构画布、节点和属性面板操作。' },
    ],
    purpose: '组织架构是业务线选择和数据范围的基础。画布只改变组织关系，不直接改变员工主归属。',
    steps: [
      '在画布中按住空白区域拖拽，平移查看完整组织；使用右上角加减调整缩放。',
      '点击组织节点查看右侧属性，包括组织类型、编码、负责人、直属人员和下级组织。',
      '新增组织时先选择父级，再填写中文名称、英文编码和组织类型；保存后检查连线是否正确。',
      '为部门或团队指定负责人；负责人会展示在节点卡片和属性面板中。',
      '调整父子关系前确认下级组织和业务线选择不会产生越权；停用组织前先迁移人员和项目归属。',
    ],
    notes: [
      '组织负责人和员工主归属保持独立；组织负责人变更不会批量改员工主归属。',
      '画布空间不足时应拖拽或缩放，不要依赖浏览器强行压缩节点。',
      '组织层级变更会写入组织变更历史，便于审计和问题追溯。',
    ],
    checklist: ['每个组织节点有清晰父级', '部门/团队负责人已设置', '调整后抽查业务线和人员归属'],
  },
  {
    id: 'roles',
    title: '角色管理',
    lead: '用角色编码权限点和数据范围，控制人员能看什么、能做什么。',
    icon: SafetyCertificateOutlined,
    tags: ['RBAC', '数据范围'],
    relatedPath: '/admin/roles',
    media: [
      { kind: 'image', label: '角色管理截图', caption: '建议展示中文角色名、英文编码、数据范围和权限点。' },
    ],
    purpose: '角色采用中文名称 + 小写英文编码；权限点决定动作，数据范围决定对象边界。',
    steps: [
      '点击“新增角色”或编辑已有角色，填写中文角色名称和小写英文编码。',
      '选择权限点，例如用户读取、组织维护、角色读取、项目维护等。',
      '选择数据范围：个人、本人组织及下级、全公司等，并用小字说明范围含义。',
      '保存后回到人员与权限，为员工分配角色并重新验证其可见页面。',
      '内置角色不可删除；如需差异化权限，复制思路创建自定义角色并保留审计记录。',
    ],
    notes: [
      '英文编码只用于系统识别，展示时优先中文，英文编码用较小字号辅助说明。',
      '权限变更可能立即影响用户访问；建议先用测试账号验证，再分配给生产人员。',
      '不要通过隐藏前端按钮代替后端鉴权，接口仍必须执行 RBAC 与数据范围校验。',
    ],
    checklist: ['编码为小写且唯一', '权限点与数据范围同时检查', '分配后用目标账号验证'],
  },
  {
    id: 'import',
    title: '批量导入',
    lead: '通过 Excel/CSV 批量导入组织和员工，支持预览、校验、错误下载和回滚。',
    icon: CloudUploadOutlined,
    tags: ['Excel/CSV', '幂等校验'],
    relatedPath: '/admin/import',
    media: [
      { kind: 'image', label: '批量导入截图', caption: '建议展示模板、上传、预览校验、错误下载和提交结果。' },
      { kind: 'video', src: 'configuration-tour.webm', label: '批量导入视频', caption: '演示批量导入入口，并提示预览、错误下载、回滚和重新提交流程。' },
    ],
    purpose: '批量导入适合初始化和大批量调整，提交前必须完成预览校验，避免脏数据进入组织和人员关系。',
    steps: [
      '先下载当前版本模板，按模板填写组织或员工数据；邮箱是员工导入的幂等键。',
      '上传 .xlsx、.xls 或 .csv 文件，选择导入类型并等待预览。',
      '检查必填项、重复邮箱、父级组织、编码格式和关系冲突；错误行可下载后修正。',
      '确认预览结果后提交，系统会为同一批次生成导入记录并执行幂等处理。',
      '提交失败时查看错误明细；必要时执行回滚，修正文件后重新预览，不要直接重复提交未知结果的批次。',
    ],
    notes: [
      '员工主归属字段与组织负责人字段分开填写，导入不会把两套关系混为一谈。',
      '导入涉及停用账号、组织调整和主归属变化时，会生成审计日志和变更历史。',
      '大文件建议分批导入，并在低峰期执行；提交前保留原始文件和错误下载记录。',
    ],
    checklist: ['使用当前模板', '预览无阻断错误', '提交后核对导入批次和审计日志'],
  },
  {
    id: 'audit',
    title: '审计日志',
    lead: '追踪组织、人员、角色、导入与账号安全变更，支持按条件检索和查看差异。',
    icon: AuditOutlined,
    tags: ['变更追踪', '安全审计'],
    relatedPath: '/admin/audit',
    media: [
      { kind: 'image', label: '审计日志截图', caption: '建议展示动作、资源、操作人、请求 ID 和查看差异。' },
      { kind: 'video', src: 'configuration-tour.webm', label: '审计追踪视频', caption: '演示审计日志入口，并提示按请求 ID 查看变更前后差异。' },
    ],
    purpose: '审计日志回答“谁在什么时候对什么资源做了什么”，用于排障、合规和责任追踪。',
    steps: [
      '按动作、资源类型、资源 ID、操作人、请求 ID 或时间范围组合筛选。',
      '先查看时间、动作和资源，确认是否是目标变更；再打开“查看差异”。',
      '对照变更前后值，判断组织、人员主归属、角色或导入是否按预期生效。',
      '遇到接口错误时记录请求 ID，与后端日志一起提供给维护人员。',
      '定期导出或归档审计数据时遵循企业保留策略，禁止在日志中写入密码和 Token。',
    ],
    notes: [
      '审计日志是追加型记录，正常情况下不在页面直接修改。',
      '敏感操作应同时具备业务结果、操作者、请求 ID 和差异信息。',
    ],
    checklist: ['能按请求 ID 定位一次操作', '差异信息可读', '日志中没有敏感凭据'],
  },
  {
    id: 'faq',
    title: '常见问题',
    lead: '遇到登录、权限、组织、导入或数据展示问题时，先按下面的顺序排查。',
    icon: QuestionCircleOutlined,
    tags: ['排障', 'FAQ'],
    relatedPath: '/dashboard',
    media: [
      { kind: 'image', label: '问题排查截图', caption: '建议用标注截图说明错误提示、请求 ID 和页面入口。' },
    ],
    purpose: '先确认账号和权限，再确认数据关系，最后检查服务和数据库；这样能减少重复操作。',
    steps: [
      '登录返回 401/500：记录页面提示和请求时间，刷新后重新登录；仍失败时交给管理员查看后端日志。',
      '页面选项无法点击：检查当前账号是否拥有对应权限，配置管理子页签会按权限隐藏。',
      '人员主归属仍显示公司总部：刷新人员页，确认员工主归属是否保存；不要用组织负责人字段代替主归属。',
      '业务线负责人没有自动带出：确认项目选择的是最低层业务线且该节点已配置负责人。',
      '列表和详情不一致：先刷新并核对同一项目 ID，再查看审计日志和接口响应。',
      '导入结果不确定：不要重复提交，先查导入批次和审计日志，必要时执行回滚。',
    ],
    notes: [
      '反馈问题时请提供页面 URL、操作步骤、发生时间、账号邮箱（可脱敏）和请求 ID。',
      '截图或视频应遮挡密码、Token、邮箱验证码和不必要的个人信息。',
      '生产问题不要直接修改数据库；先保留证据，再按运行手册执行恢复流程。',
    ],
    checklist: ['记录可复现步骤', '保留请求 ID', '敏感信息已脱敏后再反馈'],
  },
]

const currentSection = ref('quick-start')
const route = useRoute()
const router = useRouter()

function syncFromHash() {
  const id = route.hash.replace(/^#/, '')
  if (sections.some((section) => section.id === id)) currentSection.value = id
  else currentSection.value = 'quick-start'
}

function scrollToSection(id: string) {
  currentSection.value = id
  router.replace({ path: '/manual', hash: `#${id}` })
  nextTick(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function mediaTypeLabel(kind: MediaKind) {
  if (kind === 'image') return 'PNG / JPG'
  if (kind === 'gif') return 'GIF'
  return 'MP4 / WebM'
}

onMounted(() => {
  syncFromHash()
  nextTick(() => {
    if (route.hash) document.getElementById(currentSection.value)?.scrollIntoView({ block: 'start' })
  })
})
watch(() => route.hash, syncFromHash)
onBeforeUnmount(() => window.scrollTo({ top: 0, behavior: 'auto' }))
</script>

<template>
  <div class="manual-page pms-page-stack">
    <PmsPageHeader title="使用手册" description="按左侧模块快速定位，了解每项功能的使用方法、边界和常见排障路径。">
      <template #actions>
        <a-button class="pms-secondary-button" @click="scrollToSection('quick-start')">
          <BookOutlined /> 从快速开始阅读
        </a-button>
      </template>
    </PmsPageHeader>

    <div class="manual-layout">
      <aside class="manual-index pms-panel" aria-label="使用手册目录">
        <div class="manual-index__heading">
          <span>目录</span>
          <small>{{ sections.length }} 个模块</small>
        </div>
        <nav class="manual-index__nav">
          <button
            v-for="section in sections"
            :key="section.id"
            class="manual-index__item"
            :class="{ 'manual-index__item--active': currentSection === section.id }"
            type="button"
            :aria-current="currentSection === section.id ? 'location' : undefined"
            @click="scrollToSection(section.id)"
          >
            <component :is="section.icon" />
            <span>{{ section.title }}</span>
          </button>
        </nav>
        <div class="manual-index__tip">
          <SettingOutlined />
          <p>目录与左侧系统导航保持一致。点击模块后可直接跳到对应说明。</p>
        </div>
      </aside>

      <main class="manual-content" aria-label="使用手册正文">
        <section class="manual-intro pms-panel">
          <div class="manual-intro__icon"><BookOutlined /></div>
          <div>
            <h2>先理解系统的三条主线</h2>
            <p>工作台看个人工作，研发管理推进交付，配置管理维护组织与权限。使用手册中的截图、GIF 和视频均可替换为企业自己的操作素材。</p>
          </div>
          <div class="manual-intro__rules">
            <span><strong>邮箱</strong> 是账号核心</span>
            <span><strong>组织负责人</strong> 与员工主归属独立</span>
            <span><strong>权限点</strong> 与数据范围同时生效</span>
          </div>
        </section>

        <article v-for="section in sections" :id="section.id" :key="section.id" class="manual-section pms-panel">
          <header class="manual-section__header">
            <div class="manual-section__title-wrap">
              <div class="manual-section__icon"><component :is="section.icon" /></div>
              <div>
                <div class="manual-section__eyebrow">{{ section.id }}</div>
                <h2>{{ section.title }}</h2>
                <p>{{ section.lead }}</p>
              </div>
            </div>
            <RouterLink class="manual-related-link" :to="section.relatedPath">打开相关功能 <span aria-hidden="true">→</span></RouterLink>
          </header>

          <div class="manual-tags">
            <span v-for="tag in section.tags" :key="tag" class="manual-tag">{{ tag }}</span>
          </div>

          <div class="manual-section__body">
            <section class="manual-block manual-block--purpose">
              <h3>这部分解决什么问题</h3>
              <p>{{ section.purpose }}</p>
            </section>
            <section class="manual-block">
              <h3>操作步骤</h3>
              <ol class="manual-steps">
                <li v-for="(step, index) in section.steps" :key="step">
                  <span class="manual-step-index">{{ index + 1 }}</span>
                  <span>{{ step }}</span>
                </li>
              </ol>
            </section>
            <div class="manual-detail-grid">
              <section class="manual-block">
                <h3>使用要点</h3>
                <ul class="manual-list">
                  <li v-for="note in section.notes" :key="note">{{ note }}</li>
                </ul>
              </section>
              <section class="manual-block manual-block--checklist">
                <h3>完成后自查</h3>
                <ul class="manual-checklist">
                  <li v-for="item in section.checklist" :key="item"><CheckCircleOutlined />{{ item }}</li>
                </ul>
              </section>
            </div>
          </div>

          <section class="manual-media" aria-label="操作媒体">
            <div class="manual-media__heading">
              <div>
                <h3>配套操作素材</h3>
                <p>可放截图、GIF 或操作视频；没有素材时保留占位，不影响正文阅读。</p>
              </div>
              <span>素材目录：public/manual/</span>
            </div>
            <div class="manual-media__grid">
              <figure v-for="media in section.media" :key="media.label" class="manual-media-card">
                <img v-if="media.kind !== 'video' && media.src" :src="`${MEDIA_ROOT}${media.src}`" :alt="media.label" />
                <video v-else-if="media.kind === 'video' && media.src" controls preload="metadata" :poster="media.poster ? `${MEDIA_ROOT}${media.poster}` : undefined">
                  <source :src="`${MEDIA_ROOT}${media.src}`" />
                  您的浏览器不支持视频播放。
                </video>
                <div v-else class="manual-media-placeholder">
                  <component :is="media.kind === 'video' ? ToolOutlined : media.kind === 'gif' ? ExperimentOutlined : BookOutlined" />
                  <strong>{{ media.label }}</strong>
                  <small>{{ mediaTypeLabel(media.kind) }} 媒体插槽</small>
                </div>
                <figcaption><strong>{{ media.label }}</strong><span>{{ media.caption }}</span></figcaption>
              </figure>
            </div>
          </section>
        </article>
      </main>
    </div>
  </div>
</template>
