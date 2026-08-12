import type { LucideIcon } from 'lucide-react'

export type PageId = 'model-providers' | 'models' | 'apikeys' | 'members' | 'plans' | 'payment-orders' | 'dictionary' | 'settings'
export type NavItem = { id: PageId; label: string; icon: LucideIcon; permission: string }
export type Category = { id:string; name:string; color:string; description?:string; sort_order?:number; resource_type?:ResourceType; usage_count?:number }
export type ResourceType = 'model'
