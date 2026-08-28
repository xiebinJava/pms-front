<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  eyebrow?: string
}>()
</script>

<template>
  <header class="pms-page-header">
    <div>
      <p v-if="eyebrow" class="pms-page-header__eyebrow">{{ eyebrow }}</p>
      <h1 class="pms-page-header__title">{{ title }}</h1>
      <p v-if="description" class="pms-page-header__description">{{ description }}</p>
    </div>
    <div class="pms-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>
