<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { confirmPasswordReset } from '/@/api/auth'
const route = useRoute(); const router = useRouter(); const loading = ref(false); const form = reactive({ password: '', confirm: '' })
async function submit() { if (form.password.length < 12 || form.password !== form.confirm) { message.error('请确认两次密码一致，且至少 12 位'); return }; loading.value = true; try { await confirmPasswordReset(String(route.query.token || ''), form.password); message.success('密码已重置，请登录'); router.replace('/login') } finally { loading.value = false } }
</script>
<template><div class="reset-page"><a-card class="reset-card"><h1>重置密码</h1><p>设置新密码后，使用英文名登录 PMS。</p><a-form layout="vertical" @finish="submit"><a-form-item label="新密码"><a-input-password v-model:value="form.password" size="large" /></a-form-item><a-form-item label="确认密码"><a-input-password v-model:value="form.confirm" size="large" /></a-form-item><a-button class="pms-primary-button" html-type="submit" block :loading="loading">保存新密码</a-button></a-form></a-card></div></template>
<style scoped>.reset-page{display:grid;min-height:100vh;place-items:center;padding:20px;background:var(--pms-bg)}.reset-card{width:min(420px,100%);border:1px solid var(--pms-border);border-radius:var(--pms-radius)}h1{margin:0;font-size:var(--pms-font-size-title)}p{margin:8px 0 24px;color:var(--pms-text-muted);font-size:var(--pms-font-size-compact)}</style>
