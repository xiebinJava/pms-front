import {test, expect} from '@playwright/test'

test('initial system template hides version badges; user revisions show v2 and v3', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  const user={id:1,nameZh:'管理员',systemRole:1,permissionCodes:['*']}
  const template={id:30,projectTypeId:3,code:'system-story',name:'故事管理流程',defaultTemplate:true,defaultTemplateVersionId:301,publishedVersionNo:1,publishedVersionId:301,
    publishedVersions:[{id:301,versionNo:1}],versions:[{id:301,versionNo:1,status:'PUBLISHED',isDefault:true}],
    definition:{schemaVersion:2,nodes:[{key:'writing',name:'故事写卡',description:'',fields:[],contentOrder:[]}]}}
  await page.route(url=>url.pathname.startsWith('/api/'),route=>{
    const path=new URL(route.request().url()).pathname
    const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify({code:200,msg:'ok',data})})
    if(path.endsWith('/auth/refresh'))return json({accessToken:'test-token',user})
    if(path.endsWith('/auth/me'))return json(user)
    if(path.endsWith('/project-types'))return json([{id:3,code:'story-management',name:'故事管理',status:1}])
    if(path.endsWith('/templates'))return json([template])
    if(path.endsWith('/templates/30'))return json(template)
    if(path.endsWith('/availability'))return json(false)
    return json([])
  })
  async function open(){
    await page.goto('/admin/workflows')
    await page.getByTestId('workflow-type-picker').getByRole('button').filter({hasText:'故事管理'}).click()
    await page.getByText('故事管理流程',{exact:true}).first().click()
  }
  await open()
  const card=page.locator('.workflow-template-choice').filter({hasText:'故事管理流程'})
  const status=page.locator('.template-current__status')
  await expect(card.locator('.ant-tag')).toHaveCount(0)
  await expect(status.locator('.ant-tag')).toHaveCount(0)
  await page.getByRole('textbox',{name:'模板名称',exact:true}).fill('故事管理流程（修改）')
  await expect(status).toContainText('有未保存的更改')
  await page.screenshot({path:'/private/tmp/pms-system-template-desktop.png',fullPage:false})
  await page.setViewportSize({width:390,height:844})
  await page.locator('[data-mobile-inspector-close]').click()
  if(await page.locator('.pms-sidebar-scrim').isVisible()) await page.locator('.pms-mobile-menu').click()
  await page.screenshot({path:'/private/tmp/pms-system-template-mobile.png',fullPage:false})
  // Discard only this mocked page's unsaved local form before navigating.
  template.publishedVersionNo=2;template.publishedVersionId=302;template.defaultTemplateVersionId=302
  template.publishedVersions.push({id:302,versionNo:2})
  template.versions.push({id:302,versionNo:2,status:'PUBLISHED',isDefault:true})
  await page.reload()
  await page.getByTestId('workflow-type-picker').getByRole('button').filter({hasText:'故事管理'}).click()
  await page.getByText('故事管理流程',{exact:true}).first().click()
  await expect(card).toContainText('默认 v2')
  await expect(status).toContainText('已发布 v2')
  template.draftVersionNo=3
  await page.reload()
  await page.getByTestId('workflow-type-picker').getByRole('button').filter({hasText:'故事管理'}).click()
  await page.getByText('故事管理流程',{exact:true}).first().click()
  await expect(status).toContainText('草稿 v3')
  expect(errors).toEqual([])
})
