<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { previewImport, commitImport, downloadImportErrors, downloadImportTemplate } from '/@/api/admin-import'
import type { ImportPreview } from '/@/types/api'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
const { t } = useI18n()
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
    message.error((error as Error).message || t('admin.import.parseFailed'))
  } finally { loading.value = false }
}
async function commit() {
  if (!preview.value || preview.value.errors.length) return
  loading.value = true
  try {
    await commitImport(preview.value.jobId)
    resultMessage.value = t(type.value === 'organizations' ? 'admin.import.successOrg' : 'admin.import.successUser', { count: preview.value.rowCount })
    step.value = 2
    message.success(t('admin.import.committed'))
    preview.value = undefined
  } catch (error) {
    message.error((error as Error).message || t('admin.import.commitFailed'))
  } finally { loading.value = false }
}
async function downloadErrors() {
  if (!preview.value?.errors.length) return
  try {
    const blob = await downloadImportErrors(preview.value.jobId)
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${type.value}-import-errors.csv`; anchor.click(); URL.revokeObjectURL(url)
  } catch (error) {
    message.error((error as Error).message || t('admin.import.downloadErrorsFailed'))
  }
}
async function downloadTemplate() {
  try {
    const blob = await downloadImportTemplate(type.value)
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${type.value}-template.csv`; anchor.click(); URL.revokeObjectURL(url)
  } catch (error) {
    message.error((error as Error).message || t('admin.import.templateFailed'))
  }
}
</script>
<template>
  <section class="admin-page pms-admin-page">
    <PmsPageHeader :title="$t('route.adminImport')" :description="$t('admin.import.description')">
      <template #actions><a-space><a-button class="pms-secondary-button" @click="downloadTemplate">{{ $t('admin.import.downloadTemplate') }}</a-button><a-radio-group v-model:value="type" button-style="solid"><a-radio-button value="organizations">{{ $t('admin.import.typeOrg') }}</a-radio-button><a-radio-button value="users">{{ $t('admin.import.typeUser') }}</a-radio-button></a-radio-group></a-space></template>
    </PmsPageHeader>
    <a-steps :current="step" size="small"><a-step :title="$t('admin.import.stepUpload')" /><a-step :title="$t('admin.import.stepPreview')" /><a-step :title="$t('admin.import.stepDone')" /></a-steps>
    <div class="import-panel pms-panel"><a-alert type="info" show-icon :message="$t('admin.import.fieldsTitle')" :description="type === 'organizations' ? $t('admin.import.orgFields') : $t('admin.import.userFields')" /><label class="upload"><input type="file" accept=".csv,.xlsx" :disabled="loading" @change="choose" /><span>{{ loading ? $t('admin.import.parsing') : $t('admin.import.chooseFile') }}</span></label></div>
    <template v-if="preview"><div class="preview-head"><strong>{{ $t('admin.import.previewRows', { count: preview.rowCount }) }}</strong><a-tag :color="preview.errors.length ? 'red' : 'green'">{{ preview.errors.length ? $t('admin.import.errorCount', { count: preview.errors.length }) : $t('admin.import.valid') }}</a-tag><a-space><a-button v-if="preview.errors.length" @click="downloadErrors">{{ $t('admin.import.downloadErrors') }}</a-button><a-button class="pms-primary-button" :disabled="!!preview.errors.length" @click="commit">{{ $t('admin.import.confirm') }}</a-button></a-space></div><div class="pms-table-scroll pms-import-table-scroll"><a-table class="pms-admin-table" :data-source="preview.errors" row-key="row" size="small"><a-table-column :title="$t('admin.import.colRow')" data-index="row" /><a-table-column :title="$t('admin.import.colField')" data-index="field" /><a-table-column :title="$t('admin.import.colError')" data-index="message" /></a-table></div></template>
    <a-result v-if="step === 2" status="success" :title="$t('admin.import.done')" :sub-title="resultMessage" />
  </section>
</template>
<style scoped>.admin-page{display:grid;gap:16px}.page-heading,.preview-head{display:flex;align-items:center;justify-content:space-between;gap:16px}h1{margin:0;font-size:var(--pms-font-size-display)}p{margin:6px 0 0;color:var(--pms-text-muted);font-size:var(--pms-font-size-compact)}.import-panel{display:grid;gap:16px;padding:20px;background:var(--pms-surface);border:1px solid var(--pms-border);border-radius:var(--pms-radius)}.upload{display:grid;place-items:center;min-height:140px;color:var(--pms-primary);border:1px dashed var(--pms-border-strong);border-radius:var(--pms-radius);cursor:pointer}.upload input{display:none}</style>
