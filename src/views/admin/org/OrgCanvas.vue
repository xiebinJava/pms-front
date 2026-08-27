<script setup lang="ts">
import type { OrgUnit } from '/@/types/domain'
defineProps<{ units: OrgUnit[]; selected?: number }>()
const emit = defineEmits<{ select: [unit: OrgUnit] }>()
</script>

<template>
  <div class="org-canvas">
    <div v-for="unit in units" :key="unit.id" class="org-branch">
      <button class="org-node" :class="{ selected: selected === unit.id }" @click="emit('select', unit)">
        <strong>{{ unit.name }}</strong><span>{{ unit.typeCode || unit.code }}</span>
      </button>
      <div v-if="unit.children?.length" class="org-children"><OrgCanvas :units="unit.children" :selected="selected" @select="emit('select', $event)" /></div>
    </div>
  </div>
</template>

<style scoped>
.org-canvas { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 28px; min-height: 480px; padding: 38px 24px; background: var(--pms-surface-muted); }
.org-branch { position: relative; display: flex; min-width: 150px; flex-direction: column; align-items: center; gap: 26px; }
.org-node { position: relative; display: grid; min-width: 136px; gap: 3px; padding: 10px 14px; color: var(--pms-text); text-align: center; background: var(--pms-surface); border: 1px solid var(--pms-border-strong); border-radius: 7px; box-shadow: var(--pms-shadow-sm); cursor: pointer; }
.org-node::after { position: absolute; top: 100%; left: 50%; width: 1px; height: 26px; background: var(--pms-border-strong); content: ''; }
.org-node strong { font-size: var(--pms-font-size-body); }
.org-node span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.org-node.selected { color: var(--pms-primary); border-color: var(--pms-primary); box-shadow: 0 0 0 3px var(--pms-primary-soft); }
.org-children { position: relative; display: flex; justify-content: center; width: 100%; padding-top: 2px; }
.org-children::before { position: absolute; top: 0; left: 50%; width: 70%; height: 1px; background: var(--pms-border-strong); transform: translateX(-50%); content: ''; }
</style>
