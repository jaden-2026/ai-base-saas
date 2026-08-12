import { useState } from 'react'
import { Bell, CreditCard, Globe2, LockKeyhole, Radio, Save, SlidersHorizontal } from 'lucide-react'
import { ApiError, patch, post, remove } from '../api'
import { useAuth } from '../auth'
import { Button, PageHeader } from '../components'
import { pageMeta } from '../data'
import { WechatPaySettings } from './WechatPaySettings'
import { ChannelNotifications } from './ChannelNotifications'

type Section='workspace'|'security'|'payment'|'channel-notifications'|'notifications'|'advanced'
const sections:[Section,string,typeof Globe2][]=[['workspace','工作空间',Globe2],['security','安全设置',LockKeyhole],['payment','支付设置',CreditCard],['channel-notifications','渠道通知',Radio],['notifications','通知偏好',Bell],['advanced','高级设置',SlidersHorizontal]]
const settingRows:Record<'notifications'|'advanced',[string,string,string][]>={
  notifications:[['failure_email','调用异常邮件提醒','模型调用异常时通知管理员']],
  advanced:[['allow_api_keys','允许成员创建 API Key','允许具有相应权限的成员创建访问凭证'],['sync_models','自动同步模型列表','连接供应商后自动发现可用模型']],
}

export function SettingsPage({notify}:{notify:(message:string)=>void}){
  const{identity,refresh,can}=useAuth(),isSuperAdmin=identity!.user.permissions.includes('*'),canManageSettings=can('settings:manage')
  const[section,setSection]=useState<Section>(canManageSettings?'workspace':'channel-notifications')
  const[name,setName]=useState(identity!.tenant.name)
  const[description,setDescription]=useState(identity!.tenant.description)
  const[brandLogoUrl,setBrandLogoUrl]=useState(identity!.tenant.brand_logo_url??'')
  const[settings,setSettings]=useState(identity!.tenant.settings)
  const fail=(e:unknown)=>notify(e instanceof ApiError?e.message:'操作失败')
  const saveGeneral=async()=>{try{await patch('/api/settings',{name,description,locale:identity!.tenant.locale,timezone:identity!.tenant.timezone,settings});await refresh();notify('系统设置已保存')}catch(e){fail(e)}}
  const uploadBrandLogo=async(file:File)=>{try{const form=new FormData();form.append('file',file);const result=await post<{brand_logo_url:string}>('/api/settings/brand-logo',form);setBrandLogoUrl(result.brand_logo_url);await refresh();notify('企业 Logo 已更新')}catch(e){fail(e)}}
  const removeBrandLogo=async()=>{try{await remove('/api/settings/brand-logo');setBrandLogoUrl('');await refresh();notify('企业 Logo 已移除')}catch(e){fail(e)}}
  const toggle=(key:string)=>setSettings(current=>({...current,[key]:!current[key]}))
  const preferenceRows=section==='notifications'||section==='advanced'?settingRows[section]:[]
  return <div className="page settings-page">
    <PageHeader {...pageMeta.settings}>{canManageSettings&&section!=='security'&&section!=='payment'&&section!=='channel-notifications'&&<Button icon={false} onClick={()=>void saveGeneral()}><Save size={16}/>保存更改</Button>}</PageHeader>
    <div className="settings-layout">
      <aside className="settings-nav" aria-label="系统设置分区">{sections.filter(([id])=>id==='channel-notifications'||canManageSettings).map(([id,label,Icon])=><button key={id} className={section===id?'active':''} aria-current={section===id?'page':undefined} onClick={()=>setSection(id)}><Icon/>{label}</button>)}</aside>
      {section==='workspace'&&<section className="card settings-card">
        <div className="settings-heading-row"><div><h2>工作空间信息</h2><p>配置保存到当前租户记录。</p></div></div>
        <div className="form-grid"><label className="field"><span>企业名称</span><input maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label className="field"><span>工作空间标识</span><input value={identity!.tenant.slug} disabled/></label><div className="field full brand-logo-field"><span>企业 Logo</span><div className="brand-logo-control">{brandLogoUrl?<img src={brandLogoUrl} alt="当前企业 Logo"/>:<div className="brand-logo-placeholder">{name.slice(0,1)||'企'}</div>}<div><input id="brand-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadBrandLogo(file);e.currentTarget.value=''}}/><small>支持 PNG、JPG、WebP、SVG，文件不超过 2MB。</small></div>{brandLogoUrl&&<Button variant="secondary" icon={false} onClick={()=>void removeBrandLogo()}>移除 Logo</Button>}</div></div><label className="field full"><span>简介</span><textarea maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></label></div>
      </section>}
      {section==='security'&&<section className="card settings-card">
        <div className="settings-section-heading"><div className="settings-section-icon"><LockKeyhole/></div><div><h2>安全设置</h2><p>{isSuperAdmin?'支付凭证已移至“支付设置”页面。':'支付渠道由平台超级管理员统一维护。'}</p></div></div>
        <div className="security-note"><LockKeyhole/><span><b>最小权限原则</b><small>普通租户管理员无法读取或修改微信支付凭证；所有敏感操作都会写入审计日志。</small></span></div>
      </section>}
      {section==='payment'&&(isSuperAdmin?<WechatPaySettings notify={notify}/>:<section className="card settings-card"><div className="settings-section-heading"><div className="settings-section-icon"><CreditCard/></div><div><h2>支付设置</h2><p>当前平台使用微信支付 API v3 Native 直连完成国内订阅支付。</p></div></div><div className="security-note"><LockKeyhole/><span><b>微信支付由平台统一配置</b><small>商户号、商户私钥、API v3 密钥、微信支付公钥和回调地址仅允许平台超级管理员维护。如需变更，请联系平台管理员。</small></span></div></section>)}
      {section==='channel-notifications'&&<ChannelNotifications notify={notify}/>}
      {(section==='notifications'||section==='advanced')&&<section className="card settings-card"><h2>{section==='notifications'?'通知偏好':'高级设置'}</h2><p>{section==='notifications'?'选择希望接收的租户级系统通知。':'配置影响工作空间行为的功能开关。'}</p>{preferenceRows.map(([key,label,help])=><div className="setting-row" key={key}><div><b>{label}</b><span>{help}</span></div><button type="button" role="switch" aria-checked={!!settings[key]} aria-label={label} className={`switch ${settings[key]?'on':''}`} onClick={()=>toggle(key)}><i/></button></div>)}</section>}
    </div>
  </div>
}