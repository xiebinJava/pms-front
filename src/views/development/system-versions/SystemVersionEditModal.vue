<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'
import {
  createSystemVersion,
  updateSystemVersion,
  type SystemDefinition,
  type SystemVersionRow,
  type SystemVersionStatus,
} from '/@/api/system-version'
import { isSystemVersionTerminal, systemVersionStatusColor, systemVersionStatusLabelKey } from '/@/enums/system-version'

const props = withDefaults(defineProps<{
  open: boolean
  version: SystemVersionRow | null
  systems: SystemDefinition[]
  systemsLoading?: boolean
}>(), {
  systemsLoading: false,
})

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'saved'): void
}>()

const { t } = useI18n()
const formRef = ref()
const saving = ref(false)
const errorMessage = ref('')
const form = reactive({
  systemId: undefined as number | undefined,
  versionNo: '',
  versionName: '',
  status: 'PLANNED' as SystemVersionStatus,
  plannedReleaseDate: '',
  ownerId: undefined as number | undefined,
  releaseNotes: '',
  version: 0,
})

const terminalVersion = computed(() => isSystemVersionTerminal(props.version?.status))
const systemOptions = computed(() => props.systems
  .filter((system) => system.status === 'ACTIVE' || system.id === props.version?.systemId)
  .map((system) => ({
  value: system.id,
  label: system.name,
})))
const rules = computed(() => ({
  systemId: [{ required: true, message: t('systemVersionView.systemRequired') }],
  versionNo: [{ required: true, message: t('systemVersionView.versionNoRequired') }],
  versionName: [{ required: true, message: t('systemVersionView.versionNameRequired') }],
}))

watch(() => [props.open, props.version?.id] as const, ([open]) => {
  if (!open) return
  const version = props.version
  form.systemId = version?.systemId
  form.versionNo = version?.versionNo || ''
  form.versionName = version?.versionName || ''
  form.status = (version?.status as SystemVersionStatus) || 'PLANNED'
  form.plannedReleaseDate = version?.plannedReleaseDate || ''
  form.ownerId = version?.ownerId
  form.releaseNotes = version?.releaseNotes || ''
  form.version = version?.version ?? 0
  errorMessage.value = ''
})

function close() {
  if (!saving.value) emit('update:open', false)
}

async function save() {
  if (saving.value || terminalVersion.value) return
  errorMessage.value = ''
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    const payload = {
      systemId: form.systemId as number,
      versionNo: form.versionNo.trim(),
      versionName: form.versionName.trim(),
       plannedReleaseDate: form.plannedReleaseDate || null,
      releaseNotes: form.releaseNotes.trim() || undefined,
      ownerId: form.ownerId ?? null,
    }
    if (props.version) {
      await updateSystemVersion(props.version.id, { ...payload, version: form.version })
    } else {
      await createSystemVersion(payload)
    }
    message.success(t(props.version ? 'systemVersionView.versionUpdated' : 'systemVersionView.versionCreated'))
    emit('update:open', false)
    emit('saved')
  } catch (error) {
    errorMessage.value = (error as Error).message || t(props.version ? 'systemVersionView.versionUpdateFailed' : 'systemVersionView.versionCreateFailed')
    message.error(errorMessage.value)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <a-modal
    :open="open"
    class="pms-modal pms-project-modal system-version-edit-modal"
    :title="t(version ? 'systemVersionView.editVersionTitle' : 'systemVersionView.createVersionTitle')"
    :width="640"
    :confirm-loading="saving"
    :cancel-text="t('common.cancel')"
    @cancel="close"
  >
    <a-alert v-if="errorMessage" type="error" show-icon :message="errorMessage" class="system-version-edit-modal__error" />
    <a-alert v-if="terminalVersion" type="info" show-icon :message="t('systemVersionView.terminalVersionHint')" class="system-version-edit-modal__hint" />
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item name="systemId" :label="t('systemVersionView.system')" required>
        <a-select
          v-model:value="form.systemId"
          :options="systemOptions"
          :loading="systemsLoading"
          :disabled="terminalVersion"
          allow-clear
          show-search
          option-filter-prop="label"
          :placeholder="t('systemVersionView.systemPlaceholder')"
        />
        <p v-if="!systemsLoading && systemOptions.length === 0" class="system-version-edit-modal__empty-note">{{ t('systemVersionView.systemOptionsEmpty') }}</p>
      </a-form-item>
      <div class="system-version-edit-modal__grid">
        <a-form-item name="versionNo" :label="t('systemVersionView.versionNo')" required>
          <a-input v-model:value="form.versionNo" :disabled="terminalVersion" :placeholder="t('systemVersionView.versionNoPlaceholder')" maxlength="80" />
        </a-form-item>
        <a-form-item name="versionName" :label="t('systemVersionView.versionName')" required>
          <a-input v-model:value="form.versionName" :disabled="terminalVersion" :placeholder="t('systemVersionView.versionNamePlaceholder')" maxlength="200" />
        </a-form-item>
      </div>
      <div class="system-version-edit-modal__grid">
         <a-form-item :label="t('systemVersionView.table.status')">
           <a-tag :color="systemVersionStatusColor(form.status)">{{ t(systemVersionStatusLabelKey(form.status)) }}</a-tag>
        </a-form-item>
        <a-form-item :label="t('systemVersionView.plannedReleaseDate')">
          <a-date-picker
            v-model:value="form.plannedReleaseDate"
            value-format="YYYY-MM-DD"
            :disabled="terminalVersion"
            :placeholder="t('systemVersionView.plannedReleaseDatePlaceholder')"
            class="system-version-edit-modal__date"
          />
        </a-form-item>
      </div>
      <a-form-item :label="t('systemVersionView.owner')">
        <PersonSelect v-model="form.ownerId" allow-clear :disabled="terminalVersion" :placeholder="t('systemVersionView.ownerPlaceholder')" />
      </a-form-item>
      <a-form-item :label="t('systemVersionView.releaseNotes')">
        <a-textarea v-model:value="form.releaseNotes" :disabled="terminalVersion" :placeholder="t('systemVersionView.releaseNotesPlaceholder')" :rows="5" maxlength="10000" show-count />
      </a-form-item>
    </a-form>
    <template #footer>
      <a-button @click="close">{{ t('common.cancel') }}</a-button>
      <a-button v-if="!terminalVersion" type="primary" :loading="saving" @click="save">{{ t('systemVersionView.save') }}</a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.system-version-edit-modal__error, .system-version-edit-modal__hint { margin-bottom: 16px; }
.system-version-edit-modal__empty-note { margin: 7px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.system-version-edit-modal__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
.system-version-edit-modal__date { width: 100%; }
@media (max-width: 640px) {
  .system-version-edit-modal__grid { grid-template-columns: 1fr; gap: 0; }
}
</style>
