<script setup lang="ts">
import { computed } from 'vue'
import { getWorkflowRuntimeComponentDefinition } from './workflow-component-registry'

const props = withDefaults(defineProps<{
  componentKey: string
  unknownLabel?: string
  unknownHint?: string
}>(), {
  unknownLabel: '暂不支持的流程组件',
  unknownHint: '该组件尚未注册，已保留为安全占位。',
})

const definition = computed(() => getWorkflowRuntimeComponentDefinition(props.componentKey))
</script>

<template>
  <section class="pms-workflow-component-host" :data-component-key="componentKey">
    <slot v-if="definition" :definition="definition">
      <div class="pms-workflow-component-host__placeholder">
        {{ definition.label }}
      </div>
    </slot>
    <div v-else class="pms-workflow-component-host__unknown" role="status">
      <strong>{{ unknownLabel }}</strong>
      <span>{{ unknownHint }}</span>
      <code>{{ componentKey }}</code>
    </div>
  </section>
</template>
