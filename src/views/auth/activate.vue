<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { activate } from '/@/api/auth'
const route = useRoute(); const router = useRouter(); const loading = ref(false)
const form = reactive({ password: '', confirm: '' })
async function submit() { if (form.password.length < 12 || form.password !== form.confirm) { message.error('请确认两次密码一致，且至少 12 位'); return }; loading.value = true; try { await activate(String(route.query.token || ''), form.password); message.success('账号已激活，请登录'); router.replace('/login') } catch (error) { message.error((error as Error).message || '激活失败，请检查链接是否有效') } finally { loading.value = false } }
</script>
<template><div class="pms-auth-page activate-page"><div class="pms-auth-card activate-card"><h1>激活账号</h1><p>设置登录密码后，使用邀请中的邮箱登录 PMS。</p><a-form layout="vertical" @finish="submit"><a-form-item label="新密码"><a-input-password v-model:value="form.password" size="large" /></a-form-item><a-form-item label="确认密码"><a-input-password v-model:value="form.confirm" size="large" /></a-form-item><a-button class="pms-primary-button" html-type="submit" block :loading="loading">完成激活</a-button></a-form></div></div></template>
<style scoped>.activate-card{width:min(420px,100%)}h1{margin:0 0 6px;font-size:22px;font-weight:720;color:var(--pms-text)}p{margin:0 0 24px;color:var(--pms-text-muted);font-size:13px;line-height:1.6}</style>
