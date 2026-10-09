import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'.',testMatch:'system-template-version.spec.mjs',reporter:'line',timeout:30000,outputDir:'/private/tmp/pms-system-template-results',use:{baseURL:'http://127.0.0.1:5191',channel:'chrome',headless:true,viewport:{width:1440,height:1000},locale:'zh-CN'}})
