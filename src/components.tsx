import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Building2, Check, ChevronDown, CreditCard, Menu, Plus, Settings, UsersRound, X } from 'lucide-react'
import { adminNav, mainNav } from './data'
import type { PageId } from './types'
import { useAuth } from './auth'
import { get } from './api'

type SidebarBilling = { subscription?: { name: string; period_end: string } }
let openModalCount = 0
let previousBodyOverflow = ''
let previousBodyPaddingRight = ''

export function Sidebar({ page, onNavigate, open, onClose }: { page: PageId; onNavigate: (id: PageId) => void; open: boolean; onClose: () => void }) {
  const { identity, can } = useAuth()
  const [workspaceMenu, setWorkspaceMenu] = useState(false)
  const [billing, setBilling] = useState<SidebarBilling | null>(null)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)
  const canManageMembers = can('members:manage')
  const canManagePlans = can('plans:manage')
  const canManageSettings = can('authenticated')
  const navigate = (id: PageId) => { setWorkspaceMenu(false); onNavigate(id); onClose() }
  useEffect(() => {
    if (!canManagePlans) return
    let active = true
    void get<SidebarBilling>('/api/billing').then(value => { if (active) setBilling(value) }).catch(() => { if (active) setBilling(null) })
    return () => { active = false }
  }, [canManagePlans, identity?.tenant.id])
  useEffect(() => {
    if (!workspaceMenu) return
    const close = (event: MouseEvent) => { if (!workspaceMenuRef.current?.contains(event.target as Node)) setWorkspaceMenu(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setWorkspaceMenu(false) }
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', escape) }
  }, [workspaceMenu])
  const subscription = billing?.subscription
  const subscriptionExpiry = subscription?.period_end ? new Date(subscription.period_end).toLocaleDateString() : ''
  const visibleMainNav = mainNav.filter(item => can(item.permission))
  const visibleAdminNav = adminNav.filter(item => can(item.permission))
  return <>
    {open && <button className="sidebar-backdrop" aria-label="关闭导航" onClick={onClose} />}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><span /><span /><span /></div><span>SkillPort</span><b>AI</b><button className="mobile-close" onClick={onClose}><X size={18} /></button></div>
      <div className="workspace-menu" ref={workspaceMenuRef}>
        <button className="workspace-switch" type="button" aria-haspopup="menu" aria-expanded={workspaceMenu} onClick={() => setWorkspaceMenu(value => !value)}><div className="workspace-logo">{identity?.tenant.brand_logo_url?<img src={identity.tenant.brand_logo_url} alt={`${identity.tenant.name} Logo`}/>:identity?.tenant.name.slice(0,1)}</div><div><strong>{identity?.tenant.name}</strong><span>团队工作空间</span></div><ChevronDown className={workspaceMenu ? 'rotated' : ''} size={16} /></button>
        {workspaceMenu && <div className="workspace-popover" role="menu">
          <div className="workspace-popover-head"><Building2 size={17} /><div><b>{identity?.tenant.name}</b><span>{identity?.tenant.slug}</span></div></div>
          {canManageSettings && <button role="menuitem" onClick={() => navigate('settings')}><Settings size={16} /><span><b>系统设置</b><small>工作空间与渠道通知</small></span></button>}
          {canManageMembers && <button role="menuitem" onClick={() => navigate('members')}><UsersRound size={16} /><span><b>租户与成员</b><small>管理成员、角色和权限</small></span></button>}
          {canManagePlans && <button role="menuitem" onClick={() => navigate('plans')}><CreditCard size={16} /><span><b>订阅与套餐</b><small>{subscription?.name ?? '查看当前订阅'}</small></span></button>}
          {!canManageSettings && !canManageMembers && !canManagePlans && <p>当前账号暂无工作空间管理权限</p>}
        </div>}
      </div>
      <nav>
        {!!visibleMainNav.length && <p className="nav-label">工作台</p>}
        {visibleMainNav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><item.icon size={18} /><span>{item.label}</span></button>)}
        {!!visibleAdminNav.length && <p className="nav-label nav-label-spaced">管理</p>}
        {visibleAdminNav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><item.icon size={18} /><span>{item.label}</span></button>)}
      </nav>
      {canManagePlans && <button className="sidebar-subscription" type="button" onClick={() => navigate('plans')}><div><span>当前订阅</span><ChevronDown size={14} /></div><b>{subscription?.name ?? '查看订阅与套餐'}</b>{subscriptionExpiry && <small>有效期至 {subscriptionExpiry}</small>}</button>}
    </aside>
  </>
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { identity, logout } = useAuth()
  const initials = identity?.user.name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '—'
  return <header className="topbar"><button className="icon-btn menu-btn" onClick={onMenu}><Menu size={20} /></button><div className="top-actions"><button className="topbar-profile" type="button" onClick={()=>void logout()} title="退出登录"><div className="help-avatar">{initials}</div><span><strong>{identity?.user.name}</strong><small>{identity?.user.email}</small></span><b>退出</b></button></div></header>
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="header-actions">{children}</div>}</div>
}

export function Button({ children, variant = 'primary', onClick, icon = true, disabled = false }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger'; onClick?: () => void; icon?: boolean; disabled?: boolean }) {
  return <button className={`btn ${variant}`} onClick={onClick} disabled={disabled}>{icon && variant === 'primary' && <Plus size={16} />}{children}</button>
}

export function Badge({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'amber' | 'purple' | 'gray' | 'red' | 'blue' }) { return <span className={`badge ${tone}`}>{children}</span> }

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) { return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action}</div> }

export function Modal({ title, children, onClose, footer, wide = false, flush = false, fixedContent = false }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean; flush?: boolean; fixedContent?: boolean }) {
  useEffect(() => { const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [onClose])
  useEffect(() => {
    if (openModalCount === 0) {
      previousBodyOverflow = document.body.style.overflow
      previousBodyPaddingRight = document.body.style.paddingRight
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    openModalCount += 1
    return () => {
      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        document.body.style.overflow = previousBodyOverflow
        document.body.style.paddingRight = previousBodyPaddingRight
      }
    }
  }, [])
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className={`modal ${wide?'modal-wide':''} ${flush?'modal-flush':''} ${fixedContent?'modal-fixed-content':''}`}><div className="modal-header"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={19} /></button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</section></div>
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const timer = setTimeout(onDone, 2600); return () => clearTimeout(timer) }, [onDone])
  return <div className="toast"><span><Check size={15} /></span>{message}</div>
}
