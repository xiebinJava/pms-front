<script setup lang="ts">
withDefaults(defineProps<{
  nodeName: string
  nodeStatus?: string | number
  statusLabel?: string
  description?: string
  deliverable?: string
}>(), {
  nodeStatus: 'default',
  statusLabel: '',
  description: '',
  deliverable: '',
})
</script>

<template>
  <section class="pms-workflow-node-shell">
    <template v-if="$slots.default">
      <div class="workflow-node-shell__body">
        <slot />
      </div>
    </template>
    <template v-else>
      <header class="workflow-node-shell__header">
        <slot name="header">
          <div class="workflow-node-shell__title">
            <span class="workflow-node-shell__dot" :data-status="nodeStatus" aria-hidden="true" />
            <div class="workflow-node-shell__title-copy">
              <div class="workflow-node-shell__heading">
                <h2>{{ nodeName }}</h2>
                <span v-if="statusLabel" class="pms-status pms-status--neutral">{{ statusLabel }}</span>
              </div>
              <p v-if="description" class="workflow-node-shell__description">{{ description }}</p>
              <p v-if="deliverable" class="workflow-node-shell__deliverable">{{ deliverable }}</p>
            </div>
          </div>
        </slot>
        <div v-if="$slots['header-actions']" class="workflow-node-shell__actions">
          <slot name="header-actions" />
        </div>
      </header>

      <div v-if="$slots.assignments" class="workflow-node-shell__assignments">
        <slot name="assignments" />
      </div>
      <div v-if="$slots.fields" class="workflow-node-shell__fields">
        <slot name="fields" />
      </div>
      <div v-if="$slots.components" class="workflow-node-shell__components">
        <slot name="components" />
      </div>
      <div v-if="$slots.tasks" class="workflow-node-shell__tasks">
        <slot name="tasks" />
      </div>
    </template>
  </section>
</template>

<style scoped>
@media (max-width: 640px) {
  .pms-workflow-node-shell { padding-inline: 16px; }
}
</style>
