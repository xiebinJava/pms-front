<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { previewImport, commitImport, downloadImportTemplate } from '/@/api/admin-import'
import type { ImportPreview } from '/@/types/api'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
const type = ref<'organizations'|'users'>('organizations'); const preview = ref<ImportPreview>(); const loading = ref(false); const step = ref(0); const resultMessage = ref('')
watch(type, () => { preview.value = undefined; resultMessage.value = ''; step.value = 0 })
async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  loading.value = true
  try {
    preview.value = await previewImport(type.value, file)
    step.value = 1
  } catch (error) {
    message.error((error as Error).message || '文件解析失败，请检查模板后重试')
  } finally { loading.value = false }
}
async function commit() {
  if (!preview.value || preview.value.errors.length) return
  loading.value = true
  try {
    await commitImport(preview.value.jobId)
    resultMessage.value = `已成功导入 ${preview.value.rowCount} 行${type.value === 'organizations' ? '组织' : '员工'}数据`
    step.value = 2
    message.success('导入已提交')
    preview.value = undefined
  } catch (error) {
    message.error((error as Error).message || '导入失败，请稍后重试')
  } finally { loading.value = false }
}
function downloadErrors() {
  if (!preview.value?.errors.length) return
  const content = `行,字段,错误\n${preview.value.errors.map(error => [error.row, error.field, error.message].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')}`
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${type.value}-import-errors.csv`; anchor.click(); URL.revokeObjectURL(url)
}
async function downloadTemplate() {
  try {
    const blob = await downloadImportTemplate(type.value)
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${type.value}-template.csv`; anchor.click(); URL.revokeObjectURL(url)
  } catch (error) {
    message.error((error as Error).message || '模板下载失败，请重试')
  }
}
</script>
<template>
  <section class="admin-page pms-admin-page">
    <PmsPageHeader :title="$t('route.adminImport')" description="支持 CSV / Excel；先预览校验，错误为零后一次性提交。">
      <template #actions><a-space><a-button class="pms-secondary-button" @click="downloadTemplate">下载当前模板</a-button><a-radio-group v-model:value="type" button-style="solid"><a-radio-button value="organizations">组织</a-radio-button><a-radio-button value="users">员工</a-radio-button></a-radio-group></a-space></template>
    </PmsPageHeader>
    <a-steps :current="step" size="small"><a-step title="上传" /><a-step title="预览校验" /><a-step title="完成" /></a-steps>
    <div class="import-panel pms-panel"><a-alert type="info" show-icon message="模板字段" :description="type === 'organizations' ? '组织编码、组织名称、组织类型编码、父组织编码、负责人邮箱（兼容旧负责人英文名）、排序' : '邮箱（必填）、中文名/英文名（可选）、手机号、主组织编码、岗位编码、角色编码、直属上级邮箱（兼容旧英文名）'" /><label class="upload"><input type="file" accept=".csv,.xlsx" :disabled="loading" @change="choose" /><span>{{ loading ? '正在解析…' : '选择 CSV / Excel 文件' }}</span></label></div>
    <template v-if="preview"><div class="preview-head"><strong>预览 {{ preview.rowCount }} 行</strong><a-tag :color="preview.errors.length ? 'red' : 'green'">{{ preview.errors.length ? `${preview.errors.length} 个错误` : '校验通过' }}</a-tag><a-space><a-button v-if="preview.errors.length" @click="downloadErrors">下载错误行</a-button><a-button class="pms-primary-button" :disabled="!!preview.errors.length" @click="commit">确认导入</a-button></a-space></div><div class="pms-table-scroll pms-import-table-scroll"><a-table class="pms-admin-table" :data-source="preview.errors" row-key="row" size="small"><a-table-column title="行" data-index="row" /><a-table-column title="字段" data-index="field" /><a-table-column title="错误" data-index="message" /></a-table></div></template>
    <a-result v-if="step === 2" status="success" title="导入完成" :sub-title="resultMessage" />
  </section>
</template>
<style scoped>.admin-page{display:grid;gap:16px}.page-heading,.preview-head{display:flex;align-items:center;justify-content:space-between;gap:16px}h1{margin:0;font-size:var(--pms-font-size-display)}p{margin:6px 0 0;color:var(--pms-text-muted);font-size:var(--pms-font-size-compact)}.import-panel{display:grid;gap:16px;padding:20px;background:var(--pms-surface);border:1px solid var(--pms-border);border-radius:var(--pms-radius)}.upload{display:grid;place-items:center;min-height:140px;color:var(--pms-primary);border:1px dashed var(--pms-border-strong);border-radius:var(--pms-radius);cursor:pointer}.upload input{display:none}</style>
