import { useEffect, useState } from 'react'
import { Building2, Copy, Globe2, MessageCircle, NotebookTabs, Radio, Save, Smartphone, Trash2, UserRound } from 'lucide-react'
import { ApiError, get, put, remove } from '../api'
import { useAuth } from '../auth'
import { Badge, Button } from '../components'

type ChannelType='feishu'|'lark'|'dingtalk'|'notion'|'wecom'|'wechat_official'|'web'|'personal_wechat'
type Scope='member'|'tenant'
type Account={id:string;channel_type:ChannelType;name:string;public_config:Record<string,string>;callback_url:string|null;secret_configured:boolean;is_tenant_default:boolean}
type Definition={label:string;description:string;icon:typeof MessageCircle;publicFields:Array<{key:string;label:string;placeholder:string}>;secretFields:Array<{key:string;label:string;placeholder:string}>}
const channels:Record<ChannelType,Definition>={
  feishu:{label:'飞书',description:'飞书企业自建应用',icon:MessageCircle,publicFields:[{key:'appId',label:'App ID',placeholder:'cli_xxx'}],secretFields:[{key:'appSecret',label:'App Secret',placeholder:'仅保存时填写'},{key:'verificationToken',label:'Verification Token',placeholder:'事件订阅校验令牌'}]},
  lark:{label:'Lark',description:'Lark 国际版自建应用',icon:MessageCircle,publicFields:[{key:'appId',label:'App ID',placeholder:'cli_xxx'}],secretFields:[{key:'appSecret',label:'App Secret',placeholder:'仅保存时填写'},{key:'verificationToken',label:'Verification Token',placeholder:'事件订阅校验令牌'}]},
  dingtalk:{label:'钉钉',description:'钉钉企业内部应用',icon:Radio,publicFields:[{key:'clientId',label:'Client ID',placeholder:'应用 Client ID'}],secretFields:[{key:'clientSecret',label:'Client Secret',placeholder:'仅保存时填写'}]},
  notion:{label:'Notion',description:'Notion 工作空间集成',icon:NotebookTabs,publicFields:[{key:'databaseId',label:'Database ID',placeholder:'可选的目标数据库 ID'}],secretFields:[{key:'integrationToken',label:'Integration Token',placeholder:'secret_xxx'}]},
  wecom:{label:'企业微信',description:'企业微信自建应用',icon:Building2,publicFields:[{key:'corpId',label:'Corp ID',placeholder:'企业 ID'},{key:'agentId',label:'Agent ID',placeholder:'应用 Agent ID'}],secretFields:[{key:'secret',label:'应用 Secret',placeholder:'仅保存时填写'},{key:'token',label:'回调 Token',placeholder:'回调校验 Token'},{key:'encodingAesKey',label:'EncodingAESKey',placeholder:'消息加密密钥'}]},
  wechat_official:{label:'微信公众号',description:'微信公众号开发者模式',icon:Radio,publicFields:[{key:'appId',label:'App ID',placeholder:'公众号 App ID'}],secretFields:[{key:'appSecret',label:'App Secret',placeholder:'仅保存时填写'},{key:'token',label:'服务器 Token',placeholder:'消息校验 Token'},{key:'encodingAesKey',label:'EncodingAESKey',placeholder:'消息加密密钥'}]},
  web:{label:'网页',description:'网页嵌入式通知入口',icon:Globe2,publicFields:[{key:'allowedOrigins',label:'允许来源',placeholder:'https://example.com，多个用逗号分隔'},{key:'themeColor',label:'主题色',placeholder:'#6956e8'}],secretFields:[]},
  personal_wechat:{label:'个人微信',description:'个人微信桥接配置',icon:Smartphone,publicFields:[{key:'bridgeUrl',label:'桥接服务地址',placeholder:'https://bridge.example.com'}],secretFields:[{key:'bridgeToken',label:'桥接 Token',placeholder:'仅保存时填写'}]},
}
const order=Object.keys(channels) as ChannelType[]
const errorText=(error:unknown)=>error instanceof ApiError?error.message:'操作失败，请稍后重试'

export function ChannelNotifications({notify}:{notify:(message:string)=>void}){
  const{can}=useAuth(),canManageTenant=can('settings:manage')
  const[scope,setScope]=useState<Scope>('member'),[accounts,setAccounts]=useState<Account[]>([]),[selected,setSelected]=useState<ChannelType>('feishu'),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true)
  const[name,setName]=useState(''),[publicConfig,setPublicConfig]=useState<Record<string,string>>({}),[secretConfig,setSecretConfig]=useState<Record<string,string>>({}),[callbackUrl,setCallbackUrl]=useState('')
  const load=async()=>{setLoading(true);try{setAccounts(await get<Account[]>('/api/settings/channel-notifications'))}catch(error){notify(errorText(error))}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  const account=accounts.find(item=>item.channel_type===selected&&item.is_tenant_default===(scope==='tenant')),definition=channels[selected]
  useEffect(()=>{setName(account?.name??`${definition.label}${scope==='tenant'?'默认':'个人'}配置`);setPublicConfig(account?.public_config??{});setSecretConfig({});setCallbackUrl(account?.callback_url??'')},[account?.id,selected,scope])
  const save=async()=>{setBusy(true);try{await put(`/api/settings/channel-notifications/${scope}/${selected}`,{name,publicConfig,secretConfig,callbackUrl});await load();notify(scope==='tenant'?'租户默认渠道已保存':'个人渠道覆盖已保存')}catch(error){notify(errorText(error))}finally{setBusy(false)}}
  const clear=async()=>{if(!account||!confirm(`确认删除${scope==='tenant'?'租户默认':'个人覆盖'}「${definition.label}」配置？`))return;setBusy(true);try{await remove(`/api/settings/channel-notifications/${scope}/${selected}`);await load();notify(scope==='tenant'?'租户默认配置已删除':'个人覆盖已移除，将使用租户默认配置')}catch(error){notify(errorText(error))}finally{setBusy(false)}}
  const copyInbound=async()=>{if(!account)return;await navigator.clipboard.writeText(`${location.origin}/api/channel-notification-webhooks/${selected}/${account.id}`);notify('系统入站地址已复制')}
  return <section className="card settings-card channel-settings-card">
    <div className="settings-heading-row"><div><h2>渠道通知</h2><p>每种渠道可配置一个租户默认值；成员保存个人配置后，将覆盖同渠道默认值。</p></div>{canManageTenant&&<div className="channel-scope-tabs"><button className={scope==='member'?'active':''} onClick={()=>setScope('member')}><UserRound/>我的覆盖</button><button className={scope==='tenant'?'active':''} onClick={()=>setScope('tenant')}><Building2/>租户默认</button></div>}</div>
    {!canManageTenant&&<div className="channel-inheritance-note"><UserRound/><span><b>个人覆盖配置</b><small>未配置的渠道会自动使用租户管理员提供的默认配置。</small></span></div>}
    <div className="channel-settings-layout"><nav className="channel-type-list" aria-label="渠道类型">{order.map(type=>{const item=accounts.find(value=>value.channel_type===type&&value.is_tenant_default===(scope==='tenant')),Icon=channels[type].icon;return <button key={type} className={selected===type?'active':''} onClick={()=>setSelected(type)}><Icon/><span><b>{channels[type].label}</b><small>{item?'已配置':'未配置'}</small></span>{item&&<i/>}</button>})}</nav>
      <div className="channel-settings-form"><div className="channel-form-title"><div><h3>{definition.label}</h3><p>{definition.description} · {scope==='tenant'?'所有未覆盖成员共用':'仅覆盖当前成员'}</p></div><Badge tone={account?'green':'gray'}>{loading?'加载中':account?'已配置':'未配置'}</Badge></div>
        <div className="form-grid channel-form"><label className="field full"><span>配置名称</span><input maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>{definition.publicFields.map(field=><label className="field" key={field.key}><span>{field.label}</span><input value={publicConfig[field.key]??''} onChange={event=>setPublicConfig(current=>({...current,[field.key]:event.target.value}))} placeholder={field.placeholder}/></label>)}{definition.secretFields.map(field=><label className="field" key={field.key}><span>{field.label}</span><input type="password" autoComplete="new-password" value={secretConfig[field.key]??''} onChange={event=>setSecretConfig(current=>({...current,[field.key]:event.target.value}))} placeholder={account?.secret_configured?'留空保留已加密凭证':field.placeholder}/></label>)}<label className="field full"><span>业务转发回调地址（可选）</span><input type="url" value={callbackUrl} onChange={event=>setCallbackUrl(event.target.value)} placeholder="https://business.example.com/notification-callback"/><small>清空并保存即可移除；敏感凭证加密保存且不会回显。</small></label></div>
        {account&&<div className="channel-callback"><b>系统入站 Webhook</b><code>{location.origin}/api/channel-notification-webhooks/{selected}/{account.id}</code><button onClick={()=>void copyInbound()}><Copy/>复制</button></div>}
        <div className="inline-editor-actions">{account&&<Button variant="danger" icon={false} disabled={busy} onClick={()=>void clear()}><Trash2/>删除配置</Button>}<Button icon={false} disabled={busy||loading} onClick={()=>void save()}><Save/> {busy?'保存中...':'保存配置'}</Button></div>
      </div></div>
  </section>
}