<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'success' | 'warning' | 'danger' | 'neutral'
}>(), { tone: 'neutral' })
</script>

<template>
  <span class="pms-status" :class="`pms-status--${tone}`"><slot /></span>
</template>
