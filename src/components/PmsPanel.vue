<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'default' | 'muted' }>(), { tone: 'default' })
</script>

<template>
  <section class="pms-panel" :class="{ 'pms-panel--muted': tone === 'muted' }">
    <slot />
  </section>
</template>
