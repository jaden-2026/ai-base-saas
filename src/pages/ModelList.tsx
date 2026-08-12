import { useEffect, useState } from 'react'
import { Boxes, Search } from 'lucide-react'
import { ApiError, get } from '../api'
import { Badge, EmptyState, PageHeader } from '../components'
import { CategoryFilter, CategoryManager, CategoryTags } from '../components/CategoryControls'
import { useAuth } from '../auth'
import { pageMeta } from '../data'
import { ModelCategoryBadge, modelCategoryOptions, type ModelCategory } from '../modelCategories'
import type { Category } from '../types'

type Provider={id:string;name:string}
type Model={id:string;external_id:string;name:string;model_category:ModelCategory;provider:string;provider_status:string;context_window:number;input_price:number|string;output_price:number|string;enabled:boolean;available:boolean;categories:Category[]}
type Availability='available'|'all'|'disabled'

export function ModelList({notify}:{notify:(message:string)=>void}){
  const {can}=useAuth(),canWrite=can('models:write')
  const[providers,setProviders]=useState<Provider[]>([]),[models,setModels]=useState<Model[]>([])
  const[search,setSearch]=useState(''),[providerId,setProviderId]=useState(''),[modelCategory,setModelCategory]=useState<ModelCategory|''>(''),[categoryId,setCategoryId]=useState(''),[availability,setAvailability]=useState<Availability>('available'),[manageCategories,setManageCategories]=useState(false)
  const fail=(error:unknown)=>notify(error instanceof ApiError?error.message:'模型列表加载失败')
  useEffect(()=>{void get<Provider[]>('/api/providers').then(setProviders).catch(fail)},[])
  useEffect(()=>{const timer=window.setTimeout(()=>{const params=new URLSearchParams({availability});if(search.trim())params.set('search',search.trim());if(providerId)params.set('providerId',providerId);if(modelCategory)params.set('modelCategory',modelCategory);if(categoryId)params.set('categoryId',categoryId);void get<Model[]>(`/api/models?${params}`).then(setModels).catch(fail)},250);return()=>window.clearTimeout(timer)},[search,providerId,modelCategory,categoryId,availability])
  return <div className="page model-list-page"><PageHeader {...pageMeta.models}/><div className="toolbar model-filter-toolbar">
    <div className="filter-search"><Search size={16}/><input placeholder="搜索模型名称、模型 ID 或服务商" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <label className="compact-filter"><span>服务商</span><select value={providerId} onChange={e=>setProviderId(e.target.value)}><option value="">全部服务商</option>{providers.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <label className="compact-filter"><span>模型类型</span><select value={modelCategory} onChange={e=>setModelCategory(e.target.value as ModelCategory|'')}><option value="">全部类型</option>{modelCategoryOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    <label className="compact-filter"><span>可用状态</span><select value={availability} onChange={e=>setAvailability(e.target.value as Availability)}><option value="available">仅可用模型</option><option value="all">全部模型</option><option value="disabled">不可用模型</option></select></label>
    <CategoryFilter type="model" value={categoryId} onChange={setCategoryId} onManage={canWrite?()=>setManageCategories(true):undefined}/>
  </div><div className="card table-card model-list-table"><div className="card-heading"><div><h2>{availability==='available'?'可用模型':'模型查询结果'}</h2><p>共 {models.length} 个模型 · 模型类型为行业标准分类，自定义标签由当前租户维护</p></div></div><table><thead><tr><th>模型</th><th>模型服务商</th><th>模型类型</th><th>自定义标签</th><th>上下文窗口</th><th>价格（输入 / 输出）</th><th>状态</th></tr></thead><tbody>{models.map(m=><tr key={m.id}><td><b>{m.name}</b><code className="model-id-line">{m.external_id}</code></td><td>{m.provider}<small className="model-provider-state">{m.provider_status==='connected'?'服务商已连接':m.provider_status==='paused'?'服务商已暂停':'服务商未连接'}</small></td><td><ModelCategoryBadge value={m.model_category}/></td><td><CategoryTags items={m.categories??[]}/></td><td>{m.context_window?m.context_window.toLocaleString():'未设置'}</td><td>¥{Number(m.input_price).toFixed(6)} / ¥{Number(m.output_price).toFixed(6)}</td><td><Badge tone={m.available?'green':'gray'}>{m.available?'可用':'不可用'}</Badge></td></tr>)}</tbody></table>{!models.length&&<EmptyState icon={<Boxes/>} title="没有匹配的模型" text="请调整搜索词、服务商、模型类型、状态或自定义标签筛选。"/>}</div>{manageCategories&&canWrite&&<CategoryManager type="model" notify={notify} onClose={()=>setManageCategories(false)}/>}</div>
}