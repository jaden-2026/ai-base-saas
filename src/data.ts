import { Boxes, CircleDollarSign, CreditCard, KeyRound, ServerCog, Settings, SlidersHorizontal, UsersRound } from 'lucide-react'
import type { NavItem } from './types'

export const mainNav: NavItem[] = [
  { id: 'model-providers', label: '模型服务商', icon: ServerCog, permission: 'models:read' },
  { id: 'models', label: '模型列表', icon: Boxes, permission: 'models:read' },
  { id: 'apikeys', label: 'API Keys', icon: KeyRound, permission: 'apikeys:manage' },
]
export const adminNav: NavItem[] = [
  { id: 'members', label: '租户与成员', icon: UsersRound, permission: 'members:manage' },
  { id: 'plans', label: '订阅与套餐', icon: CircleDollarSign, permission: 'plans:manage' },
  { id: 'payment-orders', label: '支付订单', icon: CreditCard, permission: 'payments:manage' },
  { id: 'dictionary', label: '字典配置', icon: SlidersHorizontal, permission: 'dictionaries:manage' },
  { id: 'settings', label: '系统设置', icon: Settings, permission: 'authenticated' },
]

export const pageMeta: Record<string, { title: string; subtitle: string }> = {
  'model-providers': { title: '模型服务商', subtitle: '连接、暂停并管理国内外模型服务商。' },
  models: { title: '模型列表', subtitle: '筛选并查看当前工作空间可用的模型。' },
  apikeys: { title: 'API Keys', subtitle: '创建和管理访问平台服务的凭证。' },
  members: { title: '租户与成员', subtitle: '面向 SaaS 多租户管理租户、有效期、成员、角色与权限。' },
  plans: { title: '订阅与套餐', subtitle: '查看当前用量并管理产品订阅。' },
  'payment-orders': { title: '支付订单', subtitle: '查看支付详情并管理订单生命周期。' },
  dictionary: { title: '字典配置', subtitle: '集中维护平台业务枚举和显示规则。' },
  settings: { title: '系统设置', subtitle: '配置工作空间、支付、安全策略与渠道通知。' },
}