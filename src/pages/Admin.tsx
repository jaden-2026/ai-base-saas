import { useEffect, useMemo, useState } from 'react'
import { Building2, CalendarClock, Check, ChevronRight, Copy, CreditCard, Crown, Edit3, Eye, EyeOff, KeyRound, Landmark, MessageCircle, Network, Plus, Search, Shield, Trash2, UserPlus, UsersRound, Wallet } from 'lucide-react'
import { ApiError, get, patch, post, remove } from '../api'
import { useAuth } from '../auth'
import { Badge, Button, Modal, PageHeader } from '../components'
import { PaymentQrModal, type PaymentQr } from '../components/PaymentQrModal'
import { pageMeta } from '../data'
import type { PageId } from '../types'
import { PaymentOrdersPage } from './PaymentOrders'
import { SettingsPage } from './SettingsPage'

export function AdminPages({ page, notify }: { page: PageId; notify: (s: string) => void }) {
  if (page === 'members') return <Members notify={notify} />
  if (page === 'plans') return <SubscriptionPlans notify={notify} />
  if (page === 'payment-orders') return <PaymentOrdersPage notify={notify} />
  if (page === 'dictionary') return <Dictionary notify={notify} />
  return <SettingsPage notify={notify} />
}

const error = (e: unknown, n: (s: string) => void) => n(e instanceof ApiError ? e.message : '操作失败')
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString() : '不限制'
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : '从未'
const toLocalInput = (value?: string | null) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const todayInput = () => toLocalInput(new Date().toISOString())

type TenantStatus = 'active' | 'suspended' | 'archived'
type TenantLifecycle = TenantStatus | 'expired'
type Role = { id: string; name: string; description: string; permissions: string[]; is_system: boolean }
type Member = { id: string; name: string; email: string; role: string; role_id: string; status: 'active' | 'invited' | 'disabled'; created_at: string; joined_at?: string; last_login_at?: string | null }
type Tenant = {
  id: string
  name: string
  slug: string
  description: string
  locale: string
  timezone: string
  settings: Record<string, boolean>
  status: TenantStatus
  lifecycle_status: TenantLifecycle
  valid_from: string
  valid_until: string | null
  max_members: number | null
  created_at: string
  updated_at: string
  members: number
  model_categories: number
}
type TenantForm = { name: string; slug: string; description: string; status: TenantStatus; validFrom: string; validUntil: string; maxMembers: string; ownerEmail: string; ownerName: string; ownerPassword: string; ownerGeneratePassword: boolean }
type MemberTab = 'tenants' | 'members' | 'roles'
type PasswordResult = { title: string; email: string; password: string; note: string }
type WithInitialPassword<T> = T & { initialPassword?: { email: string; password: string } }

const tenantStatusMeta: Record<TenantLifecycle, { label: string; tone: 'green' | 'amber' | 'gray' | 'red' }> = {
  active: { label: '有效', tone: 'green' },
  suspended: { label: '暂停', tone: 'amber' },
  archived: { label: '归档', tone: 'gray' },
  expired: { label: '已过期', tone: 'red' },
}
const memberStatusMeta: Record<Member['status'], { label: string; tone: 'green' | 'amber' | 'gray' }> = {
  active: { label: '正常', tone: 'green' },
  invited: { label: '已邀请', tone: 'amber' },
  disabled: { label: '已禁用', tone: 'gray' },
}
const permissionLabels: Record<string, string> = {
  'models:read': '模型查看',
  'models:write': '模型管理',
  'apikeys:manage': 'API Key 管理',
  'members:manage': '成员管理',
  'plans:manage': '套餐管理',
  'payments:manage': '支付订单',
  'dictionaries:manage': '字典管理',
  'settings:manage': '系统设置',
  'tenants:manage': '平台租户管理',
}
const permissionOptions = Object.keys(permissionLabels)
const emptyTenantForm = (): TenantForm => ({ name: '', slug: '', description: '', status: 'active', validFrom: todayInput(), validUntil: '', maxMembers: '', ownerEmail: '', ownerName: '', ownerPassword: '', ownerGeneratePassword: true })

function Members({ notify }: { notify: (s: string) => void }) {
  const { identity, can } = useAuth()
  const canManageTenants = can('tenants:manage')
  const [tab, setTab] = useState<MemberTab>(canManageTenants ? 'tenants' : 'members')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantSearch, setTenantSearch] = useState('')
  const [tenantStatus, setTenantStatus] = useState<'all' | TenantLifecycle>('all')
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [modal, setModal] = useState<'tenant' | 'tenant-edit' | 'invite' | 'role' | 'role-edit' | 'member-edit' | null>(null)
  const [tenantForm, setTenantForm] = useState<TenantForm>(emptyTenantForm)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteGeneratePassword, setInviteGeneratePassword] = useState(true)
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('租户自定义角色')
  const [rolePermissions, setRolePermissions] = useState<string[]>(['dashboard:read', 'skills:read', 'projects:read'])
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [memberRole, setMemberRole] = useState('')
  const [memberStatus, setMemberStatus] = useState<Member['status']>('active')
  const [memberPassword, setMemberPassword] = useState('')
  const [memberGeneratePassword, setMemberGeneratePassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordResult, setPasswordResult] = useState<PasswordResult | null>(null)
  const selectedTenant = tenants.find(t => t.id === selectedTenantId) ?? tenants[0]
  const tenantStats = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter(t => t.lifecycle_status === 'active').length,
    expiring: tenants.filter(t => t.valid_until && new Date(t.valid_until).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30 && new Date(t.valid_until).getTime() > Date.now()).length,
  }), [tenants])
  const queryTenant = selectedTenant?.id ? `?tenantId=${encodeURIComponent(selectedTenant.id)}` : ''
  const defaultRoleId = roles.find(r => r.name !== '所有者')?.id ?? roles[0]?.id ?? ''

  const loadTenants = async () => {
    const params = new URLSearchParams({ scope: canManageTenants ? 'all' : 'current' })
    if (tenantSearch.trim()) params.set('search', tenantSearch.trim())
    if (tenantStatus !== 'all') params.set('status', tenantStatus)
    const rows = await get<Tenant[]>(`/api/tenants?${params}`)
    setTenants(rows)
    setSelectedTenantId(current => rows.some(t => t.id === current) ? current : rows[0]?.id ?? '')
  }
  const loadTeam = async () => {
    if (!selectedTenant?.id) return
    const [m, r] = await Promise.all([get<Member[]>(`/api/members${queryTenant}`), get<Role[]>(`/api/roles${queryTenant}`)])
    setMembers(m)
    setRoles(r)
    setInviteRole(current => current && r.some(role => role.id === current) ? current : (r.find(role => role.name !== '所有者')?.id ?? r[0]?.id ?? ''))
  }

  useEffect(() => { void loadTenants().catch(e => error(e, notify)) }, [canManageTenants, tenantSearch, tenantStatus])
  useEffect(() => { void loadTeam().catch(e => error(e, notify)) }, [selectedTenantId])

  const openTenant = (tenant?: Tenant) => {
    setEditingTenant(tenant ?? null)
    setTenantForm(tenant ? {
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      status: tenant.status,
      validFrom: toLocalInput(tenant.valid_from),
      validUntil: toLocalInput(tenant.valid_until),
      maxMembers: tenant.max_members?.toString() ?? '',
      ownerEmail: '',
      ownerName: '',
      ownerPassword: '',
      ownerGeneratePassword: true,
    } : emptyTenantForm())
    setModal(tenant ? 'tenant-edit' : 'tenant')
  }
  const saveTenant = async () => {
    try {
      const isEdit = modal === 'tenant-edit' && editingTenant
      const body = {
        name: tenantForm.name,
        slug: tenantForm.slug || undefined,
        description: tenantForm.description,
        status: tenantForm.status,
        validFrom: tenantForm.validFrom || undefined,
        validUntil: tenantForm.validUntil || null,
        maxMembers: tenantForm.maxMembers ? Number(tenantForm.maxMembers) : null,
        owner: !isEdit && tenantForm.ownerEmail ? { email: tenantForm.ownerEmail, name: tenantForm.ownerName || undefined, password: tenantForm.ownerPassword || undefined, generatePassword: tenantForm.ownerGeneratePassword } : undefined,
      }
      const saved = isEdit ? await patch<WithInitialPassword<Tenant>>(`/api/tenants/${editingTenant.id}`, body) : await post<WithInitialPassword<Tenant>>('/api/tenants', body)
      setModal(null)
      setSelectedTenantId(saved.id)
      await loadTenants()
      if (!isEdit && saved.initialPassword) setPasswordResult({ title: '租户管理员初始密码', email: saved.initialPassword.email, password: saved.initialPassword.password, note: '请立即复制并安全交付给租户管理员；关闭后页面不会再显示该明文密码。' })
      notify(isEdit ? '租户信息已更新' : '租户已创建并初始化默认角色')
    } catch (e) { error(e, notify) }
  }
  const toggleTenant = async (tenant: Tenant) => {
    try {
      const next: TenantStatus = tenant.status === 'active' ? 'suspended' : 'active'
      await patch(`/api/tenants/${tenant.id}`, { status: next })
      await loadTenants()
      notify(next === 'active' ? '租户已恢复' : '租户已暂停')
    } catch (e) { error(e, notify) }
  }
  const deleteTenant = async (tenant: Tenant) => {
    if (!confirm(`确认删除租户“${tenant.name}”？该操作会级联删除该租户下的业务数据。`)) return
    try {
      await remove(`/api/tenants/${tenant.id}`)
      await loadTenants()
      notify('租户已删除')
    } catch (e) { error(e, notify) }
  }
  const openInvite = () => {
    setInviteEmail('')
    setInviteName('')
    setInviteRole(defaultRoleId)
    setInvitePassword('')
    setInviteGeneratePassword(true)
    setShowPasswords(false)
    setModal('invite')
  }
  const inviteMember = async () => {
    if (!selectedTenant) return
    try {
      const saved = await post<WithInitialPassword<Member>>('/api/members/invite', { tenantId: selectedTenant.id, email: inviteEmail, name: inviteName || undefined, roleId: inviteRole || defaultRoleId, password: invitePassword || undefined, generatePassword: inviteGeneratePassword })
      setModal(null)
      await Promise.all([loadTeam(), loadTenants()])
      if (saved.initialPassword) setPasswordResult({ title: '成员初始密码', email: saved.initialPassword.email, password: saved.initialPassword.password, note: '请立即复制并安全交付给成员；关闭后页面不会再显示该明文密码。' })
      notify('成员邀请已保存')
    } catch (e) { error(e, notify) }
  }
  const openMember = (member: Member) => {
    setEditingMember(member)
    setMemberRole(member.role_id)
    setMemberStatus(member.status)
    setMemberPassword('')
    setMemberGeneratePassword(false)
    setShowPasswords(false)
    setModal('member-edit')
  }
  const saveMember = async () => {
    if (!selectedTenant || !editingMember) return
    try {
      await patch(`/api/members/${editingMember.id}`, { tenantId: selectedTenant.id, roleId: memberRole, status: memberStatus })
      setModal(null)
      await loadTeam()
      notify('成员状态与角色已更新')
    } catch (e) { error(e, notify) }
  }
  const resetMemberPassword = async () => {
    if (!selectedTenant || !editingMember) return
    try {
      const result = await post<{ email: string; password: string }>(`/api/members/${editingMember.id}/password`, { tenantId: selectedTenant.id, password: memberPassword || undefined, generatePassword: memberGeneratePassword })
      setMemberPassword('')
      setMemberGeneratePassword(false)
      setModal(null)
      setPasswordResult({ title: '成员新登录密码', email: result.email, password: result.password, note: '请立即复制并安全交付给成员；关闭后页面不会再显示该明文密码。' })
      await loadTeam()
      notify('成员登录密码已重置')
    } catch (e) { error(e, notify) }
  }
  const copyPassword = async () => {
    if (!passwordResult) return
    try { await navigator.clipboard.writeText(passwordResult.password); notify('密码已复制到剪贴板') } catch { notify('复制失败，请手动选择密码') }
  }
  const removeMember = async (member: Member) => {
    if (!selectedTenant || !confirm(`确认从租户“${selectedTenant.name}”移除 ${member.email}？`)) return
    try {
      await remove(`/api/members/${member.id}?tenantId=${encodeURIComponent(selectedTenant.id)}`)
      await Promise.all([loadTeam(), loadTenants()])
      notify('成员已移除')
    } catch (e) { error(e, notify) }
  }
  const openRole = (role?: Role) => {
    setEditingRole(role ?? null)
    setRoleName(role?.name ?? '')
    setRoleDescription(role?.description || '租户自定义角色')
    setRolePermissions(role?.permissions ?? ['dashboard:read', 'skills:read', 'projects:read'])
    setModal(role ? 'role-edit' : 'role')
  }
  const saveRole = async () => {
    if (!selectedTenant) return
    try {
      const body = { tenantId: selectedTenant.id, name: roleName, description: roleDescription, permissions: rolePermissions }
      if (editingRole) await patch(`/api/roles/${editingRole.id}`, body)
      else await post('/api/roles', body)
      setModal(null)
      await loadTeam()
      notify('角色与权限已保存')
    } catch (e) { error(e, notify) }
  }
  const togglePermission = (permission: string) => setRolePermissions(current => current.includes(permission) ? current.filter(x => x !== permission) : [...current, permission])
  const isProtectedPlatformOwner = (role?: Role | null) => !!role?.permissions.includes('*')

  return <div className="page members-page">
    <PageHeader {...pageMeta.members}>
      {canManageTenants && <Button variant="secondary" icon={false} onClick={() => openTenant()}><Building2 size={15} />新建租户</Button>}
      <Button onClick={openInvite}>邀请成员</Button>
    </PageHeader>

    <div className="tenant-summary-grid">
      <div className="card"><Building2 /><span>租户总数</span><b>{tenantStats.total}</b><small>{canManageTenants ? '平台可管理租户' : '当前工作空间'}</small></div>
      <div className="card"><Check /><span>有效租户</span><b>{tenantStats.active}</b><small>状态 active 且在有效期内</small></div>
      <div className="card"><CalendarClock /><span>30 天内到期</span><b>{tenantStats.expiring}</b><small>用于续费和客户成功跟进</small></div>
      <div className="card"><UsersRound /><span>当前租户成员</span><b>{selectedTenant?.members ?? members.length}</b><small>{selectedTenant?.max_members ? `上限 ${selectedTenant.max_members} 人` : '不设置租户级上限'}</small></div>
    </div>

    <div className="admin-tabs">
      <button className={tab === 'tenants' ? 'active' : ''} onClick={() => setTab('tenants')}>租户</button>
      <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>成员</button>
      <button className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>角色与权限</button>
    </div>

    {tab === 'tenants' && <div className="tenant-management-layout">
      <aside className="card tenant-list-panel">
        <div className="tenant-toolbar"><div className="tenant-search"><Search size={14} /><input value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} placeholder="搜索租户名称、标识" /></div><select value={tenantStatus} onChange={e => setTenantStatus(e.target.value as 'all' | TenantLifecycle)}><option value="all">全部状态</option><option value="active">有效</option><option value="suspended">暂停</option><option value="expired">已过期</option><option value="archived">归档</option></select></div>
        <div className="tenant-list">{tenants.map(t => <button key={t.id} className={selectedTenant?.id === t.id ? 'active' : ''} onClick={() => setSelectedTenantId(t.id)}><span><b>{t.name}</b><small>{t.slug}</small></span><Badge tone={tenantStatusMeta[t.lifecycle_status].tone}>{tenantStatusMeta[t.lifecycle_status].label}</Badge></button>)}</div>
      </aside>
      <section className="card tenant-detail-card">
        {selectedTenant ? <>
          <div className="tenant-detail-head"><div><h2>{selectedTenant.name}</h2><p>{selectedTenant.description || `租户标识：${selectedTenant.slug}`}</p></div><Badge tone={tenantStatusMeta[selectedTenant.lifecycle_status].tone}>{tenantStatusMeta[selectedTenant.lifecycle_status].label}</Badge></div>
          <div className="tenant-detail-meta"><div><span>有效期开始</span><b>{date(selectedTenant.valid_from)}</b></div><div><span>有效期结束</span><b>{date(selectedTenant.valid_until)}</b></div><div><span>成员上限</span><b>{selectedTenant.max_members ?? '不限制'}</b></div><div><span>最近更新</span><b>{date(selectedTenant.updated_at)}</b></div></div>
          <div className="tenant-resource-grid"><div><span>成员</span><b>{selectedTenant.members}</b></div><div><span>模型标签</span><b>{selectedTenant.model_categories}</b></div></div>
          <div className="tenant-actions">{canManageTenants && <Button variant="secondary" icon={false} onClick={() => openTenant(selectedTenant)}><Edit3 size={15} />编辑租户</Button>}{canManageTenants && <Button variant="secondary" icon={false} onClick={() => void toggleTenant(selectedTenant)}>{selectedTenant.status === 'active' ? '暂停租户' : '恢复租户'}</Button>}{canManageTenants && selectedTenant.id !== identity?.user.tenantId && <Button variant="danger" icon={false} onClick={() => void deleteTenant(selectedTenant)}><Trash2 size={15} />删除租户</Button>}</div>
          <p className="field-help">租户状态、有效期和成员上限由服务端强制校验；跨租户成员和角色操作必须携带目标租户并通过 tenants:manage 权限。</p>
        </> : <div className="tenant-empty"><Building2 /><b>暂无租户</b><span>创建租户后会自动初始化默认角色、字典和体验订阅。</span></div>}
      </section>
    </div>}

    {tab === 'members' && <>
      <div className="member-management-bar"><div><b>{selectedTenant?.name ?? '未选择租户'}</b><span>成员查询、邀请和禁用均限定在选中的租户内。</span></div><Button icon={false} onClick={openInvite}><UserPlus size={15} />邀请成员</Button></div>
      <div className="card table-card"><table><thead><tr><th>成员</th><th>角色</th><th>状态</th><th>加入时间</th><th>最近登录</th><th /></tr></thead><tbody>{members.map((m, i) => <tr key={m.id}><td><div className="member-cell"><span className={`member-avatar ${['purple', 'pink', 'teal', 'amber'][i % 4]}`}>{m.name.slice(0, 2)}</span><div><b>{m.name}</b><small>{m.email}</small></div></div></td><td><Badge tone={m.role === '所有者' ? 'purple' : 'gray'}>{m.role === '所有者' && <Crown size={11} />} {m.role}</Badge></td><td><Badge tone={memberStatusMeta[m.status].tone}>{memberStatusMeta[m.status].label}</Badge></td><td>{date(m.joined_at ?? m.created_at)}</td><td>{dateTime(m.last_login_at)}</td><td><button className="icon-btn" title="编辑成员" onClick={() => openMember(m)}><Edit3 /></button><button className="icon-btn" title="移除成员" onClick={() => void removeMember(m)}><Trash2 /></button></td></tr>)}</tbody></table></div>
    </>}

    {tab === 'roles' && <>
      <div className="permission-summary"><div><Shield /><span><b>{roles.length} 个租户角色</b><small>页面入口可隐藏，但 API 权限与租户边界由服务端强制执行</small></span></div><Button variant="secondary" icon={false} onClick={() => openRole()}>创建角色 <ChevronRight size={15} /></Button></div>
      <div className="role-card-grid">{roles.map(role => <article className="card role-card" key={role.id}><div><h3>{role.name}</h3><p>{role.description || (role.is_system ? '系统内置角色' : '租户自定义角色')}</p></div><Badge tone={role.is_system ? 'purple' : 'gray'}>{role.is_system ? '系统角色' : '自定义'}</Badge><div className="role-permissions">{role.permissions.includes('*') ? <span>全部权限</span> : role.permissions.slice(0, 8).map(p => <span key={p}>{permissionLabels[p] ?? p}</span>)}</div><Button variant="secondary" icon={false} disabled={isProtectedPlatformOwner(role)} onClick={() => openRole(role)}><Edit3 size={15} />{isProtectedPlatformOwner(role) ? '平台所有者已保护' : '编辑权限'}</Button></article>)}</div>
    </>}

    {(modal === 'tenant' || modal === 'tenant-edit') && <Modal wide title={modal === 'tenant' ? '新建 SaaS 租户' : '编辑租户'} onClose={() => setModal(null)} footer={<><Button variant="secondary" icon={false} onClick={() => setModal(null)}>取消</Button><Button onClick={() => void saveTenant()}>保存租户</Button></>}>
      <div className="form-grid">
        <label className="field"><span>租户名称</span><input autoFocus value={tenantForm.name} onChange={e => setTenantForm(v => ({ ...v, name: e.target.value }))} /></label>
        <label className="field"><span>租户标识</span><input value={tenantForm.slug} onChange={e => setTenantForm(v => ({ ...v, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="自动生成" /></label>
        <label className="field"><span>状态</span><select value={tenantForm.status} onChange={e => setTenantForm(v => ({ ...v, status: e.target.value as TenantStatus }))}><option value="active">启用</option><option value="suspended">暂停</option><option value="archived">归档</option></select></label>
        <label className="field"><span>成员上限</span><input type="number" min="1" value={tenantForm.maxMembers} onChange={e => setTenantForm(v => ({ ...v, maxMembers: e.target.value }))} placeholder="不限制" /></label>
        <label className="field"><span>有效期开始</span><input type="datetime-local" value={tenantForm.validFrom} onChange={e => setTenantForm(v => ({ ...v, validFrom: e.target.value }))} /></label>
        <label className="field"><span>有效期结束</span><input type="datetime-local" value={tenantForm.validUntil} onChange={e => setTenantForm(v => ({ ...v, validUntil: e.target.value }))} placeholder="不限制" /></label>
        <label className="field full"><span>租户简介</span><textarea value={tenantForm.description} onChange={e => setTenantForm(v => ({ ...v, description: e.target.value }))} /></label>
        {modal === 'tenant' && <>
          <label className="field"><span>初始管理员邮箱（可选）</span><input type="email" value={tenantForm.ownerEmail} onChange={e => setTenantForm(v => ({ ...v, ownerEmail: e.target.value }))} /></label>
          <label className="field"><span>管理员姓名</span><input value={tenantForm.ownerName} onChange={e => setTenantForm(v => ({ ...v, ownerName: e.target.value }))} /></label>
          <label className="field full password-field"><span>管理员登录密码</span><div><input type={showPasswords ? 'text' : 'password'} value={tenantForm.ownerPassword} disabled={tenantForm.ownerGeneratePassword} onChange={e => setTenantForm(v => ({ ...v, ownerPassword: e.target.value }))} placeholder={tenantForm.ownerGeneratePassword ? '系统自动生成并在创建后展示一次' : '至少 8 位'} /><button type="button" onClick={() => setShowPasswords(v => !v)}>{showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}</button></div><small>明文密码不会持久化保存；创建后仅展示一次。</small></label>
          <label className="check-row full"><input type="checkbox" checked={tenantForm.ownerGeneratePassword} onChange={e => setTenantForm(v => ({ ...v, ownerGeneratePassword: e.target.checked, ownerPassword: e.target.checked ? '' : v.ownerPassword }))} /><span>自动生成初始密码</span></label>
        </>}
      </div>
      <p className="field-help">新租户会初始化所有者/成员角色、基础字典和体验订阅；未填写有效期结束表示长期有效。</p>
    </Modal>}

    {modal === 'invite' && <Modal title="邀请团队成员" onClose={() => setModal(null)} footer={<><Button variant="secondary" icon={false} onClick={() => setModal(null)}>取消</Button><Button onClick={() => void inviteMember()}>保存邀请</Button></>}>
      <label className="field"><span>目标租户</span><input value={selectedTenant?.name ?? ''} disabled /></label>
      <label className="field"><span>邮箱</span><input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></label>
      <label className="field"><span>姓名</span><input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="默认取邮箱前缀" /></label>
      <label className="field"><span>角色</span><select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>{roles.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
      <label className="field password-field"><span>初始登录密码</span><div><input type={showPasswords ? 'text' : 'password'} value={invitePassword} disabled={inviteGeneratePassword} onChange={e => setInvitePassword(e.target.value)} placeholder={inviteGeneratePassword ? '系统自动生成并在保存后展示一次' : '至少 8 位'} /><button type="button" onClick={() => setShowPasswords(v => !v)}>{showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}</button></div><small>设置后成员状态会变为正常，可直接登录。</small></label>
      <label className="check-row"><input type="checkbox" checked={inviteGeneratePassword} onChange={e => { setInviteGeneratePassword(e.target.checked); if (e.target.checked) setInvitePassword('') }} /><span>自动生成初始密码</span></label>
    </Modal>}

    {modal === 'member-edit' && editingMember && <Modal title="编辑成员" onClose={() => setModal(null)} footer={<><Button variant="secondary" icon={false} onClick={() => setModal(null)}>取消</Button><Button onClick={() => void saveMember()}>保存成员</Button></>}>
      <label className="field"><span>成员</span><input value={`${editingMember.name} · ${editingMember.email}`} disabled /></label>
      <label className="field"><span>角色</span><select value={memberRole} onChange={e => setMemberRole(e.target.value)}>{roles.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
      <label className="field"><span>状态</span><select value={memberStatus} onChange={e => setMemberStatus(e.target.value as Member['status'])}><option value="active">正常</option><option value="invited">已邀请</option><option value="disabled">已禁用</option></select></label>
      <div className="password-reset-box">
        <div><KeyRound size={16} /><span><b>登录密码</b><small>重置后只在当前页面展示一次，请复制给成员。</small></span></div>
        <label className="field password-field"><span>新密码</span><div><input type={showPasswords ? 'text' : 'password'} value={memberPassword} disabled={memberGeneratePassword} onChange={e => setMemberPassword(e.target.value)} placeholder={memberGeneratePassword ? '系统自动生成' : '至少 8 位'} /><button type="button" onClick={() => setShowPasswords(v => !v)}>{showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
        <label className="check-row"><input type="checkbox" checked={memberGeneratePassword} onChange={e => { setMemberGeneratePassword(e.target.checked); if (e.target.checked) setMemberPassword('') }} /><span>自动生成新密码</span></label>
        <Button variant="secondary" icon={false} onClick={() => void resetMemberPassword()}><KeyRound size={15} />重置登录密码</Button>
      </div>
    </Modal>}

    {passwordResult && <Modal title={passwordResult.title} onClose={() => setPasswordResult(null)} footer={<><Button variant="secondary" icon={false} onClick={() => setPasswordResult(null)}>关闭</Button><Button icon={false} onClick={() => void copyPassword()}><Copy size={15} />复制密码</Button></>}>
      <div className="password-result-card"><span>账号</span><b>{passwordResult.email}</b><span>登录密码</span><code>{passwordResult.password}</code><p>{passwordResult.note}</p></div>
    </Modal>}

    {(modal === 'role' || modal === 'role-edit') && <Modal wide title={modal === 'role' ? '创建自定义角色' : '编辑角色权限'} onClose={() => setModal(null)} footer={<><Button variant="secondary" icon={false} onClick={() => setModal(null)}>取消</Button><Button onClick={() => void saveRole()}>保存角色</Button></>}><div className="form-grid role-editor"><label className="field"><span>角色名称</span><input value={roleName} onChange={e => setRoleName(e.target.value)} disabled={!!editingRole?.is_system} /></label><label className="field"><span>角色描述</span><input value={roleDescription} onChange={e => setRoleDescription(e.target.value)} /></label><div className="field full"><span>权限</span><div className="permission-grid">{permissionOptions.map(p => <label key={p} className={rolePermissions.includes(p) ? 'active' : ''}><input type="checkbox" checked={rolePermissions.includes(p)} onChange={() => togglePermission(p)} /><b>{permissionLabels[p]}</b><small>{p}</small></label>)}</div></div></div></Modal>}
  </div>
}

type Entitlements = Record<string, number>
type Billing = { subscription?: { plan_id: string; name: string; price_cny: number; billing_period: string; entitlements: Entitlements; period_end: string; status: string }; plans: { id: string; name: string; description: string; price_cny: number; price_usd: number; billing_period: string; entitlements: Entitlements; purchased: boolean }[]; orders: { id: string; provider: string; amount: number; currency: string; status: string; created_at: string }[]; isSuperAdmin: boolean }
type CheckoutOrder = { id: string; provider: 'wechat' | 'stripe' | 'manual'; amount: number; currency: string; status: string; provider_ref: string | null; checkout_url: string | null; provider_channel: string | null; payment_payload: { qrCodeDataUrl?: string } | null }
type BillingPlan = Billing['plans'][number]
type PaymentMethod = 'wechat' | 'alipay' | 'bank_card' | 'stripe'
const entitlementLabels: Record<string, string> = { providers: '模型供应商', models: '模型总数', members: '成员总数' }
const entitlementText = (value: number | undefined) => value === undefined ? '无限制' : value.toLocaleString()
const paymentMethods: { id: PaymentMethod; name: string; description: string; icon: typeof CreditCard; available: boolean }[] = [
  { id: 'wechat', name: '微信支付', description: '直连微信支付 API v3 Native 扫码支付', icon: MessageCircle, available: true },
  { id: 'alipay', name: '支付宝', description: '支付宝网页或扫码支付', icon: Wallet, available: false },
  { id: 'bank_card', name: '银行卡', description: '使用借记卡或信用卡完成付款', icon: Landmark, available: false },
  { id: 'stripe', name: 'Stripe 国际支付', description: '国际银行卡与美元支付', icon: Network, available: false },
]
function SubscriptionPlans({ notify }: { notify: (s: string) => void }) {
  const [data, setData] = useState<Billing | null>(null)
  const [modal, setModal] = useState<'plans' | 'payment' | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wechat')
  const [checkingOut, setCheckingOut] = useState('')
  const [payment, setPayment] = useState<PaymentQr | null>(null)
  const load = () => get<Billing>('/api/billing').then(setData)
  useEffect(() => { void load() }, [])
  if (!data) return <div className="page"><PageHeader {...pageMeta.plans} /></div>
  const s = data.subscription, e = s?.entitlements ?? {}
  const selectPlan = (plan: BillingPlan) => {
    if (data.isSuperAdmin) {
      if (!confirm(`确认立即将当前工作空间更换为“${plan.name}”？此操作不会创建支付订单。`)) return
      setCheckingOut(plan.id)
      void post('/api/billing/switch-plan', { planId: plan.id }).then(async () => { await load(); setModal(null); notify('套餐已直接更换，无需订阅支付') }).catch(x => error(x, notify)).finally(() => setCheckingOut(''))
      return
    }
    if (plan.purchased) {
      if (!confirm(`确认将当前套餐切换为已支付的“${plan.name}”并保存？当前订阅到期时间不会延长。`)) return
      setCheckingOut(plan.id)
      void post('/api/billing/activate-paid-plan', { planId: plan.id }).then(async () => { await load(); setModal(null); notify('已切换并保存已支付套餐') }).catch(x => error(x, notify)).finally(() => setCheckingOut(''))
      return
    }
    setSelectedPlan(plan); setPaymentMethod('wechat'); setModal('payment')
  }
  const checkout = async () => {
    if (!selectedPlan || paymentMethod !== 'wechat') return
    setCheckingOut(selectedPlan.id)
    try {
      const order = await post<CheckoutOrder>('/api/billing/checkout', { planId: selectedPlan.id, region: 'CN', paymentMethod })
      await load()
      if (order.checkout_url) {
        setModal(null)
        setPayment({ checkoutUrl: order.checkout_url, qrCodeDataUrl: order.payment_payload?.qrCodeDataUrl, channel: order.provider_channel === 'native' ? '微信扫码' : order.provider_channel ?? undefined, providerRef: order.provider_ref, orderId: order.id, amount: order.amount, currency: order.currency })
        notify('支付订单已创建，请使用微信扫码完成支付')
      } else notify('支付订单已创建，请前往支付订单继续处理')
    } catch (x) { error(x, notify) } finally { setCheckingOut('') }
  }
  return <div className="page"><PageHeader {...pageMeta.plans}><Button onClick={() => setModal('plans')}>查看可用套餐</Button></PageHeader><div className="current-plan"><div><span className="plan-logo"><Crown /></span><div><span>当前套餐</span><h2>{s?.name ?? '未订阅或已到期'}</h2><p>{s ? `到期时间 ${new Date(s.period_end).toLocaleDateString()}` : '请从可用套餐中选择并完成订阅'}</p></div></div>{s && <div className="plan-price"><b>¥{s.price_cny}</b><span>/ {s.billing_period === 'year' ? '年' : '月'}</span></div>}</div><div className="billing-grid"><div className="card"><div className="card-heading"><div><h2>套餐权益</h2><p>服务端实时执行额度限制；以下为当前套餐额度</p></div></div>{Object.entries(entitlementLabels).map(([key, label]) => <div className="plan-usage" key={key}><div><b>{label}</b><span>{entitlementText(e[key])}</span></div></div>)}</div><div className="card invoice-card"><div className="card-heading"><div><h2>支付订单</h2><p>微信支付已接入，其他支付方式将陆续开放</p></div></div>{data.orders.map(o => <div className="invoice-row" key={o.id}><span>{o.provider} · {new Date(o.created_at).toLocaleDateString()}</span><b>{o.currency} {o.amount}</b><Badge tone={o.status === 'paid' ? 'green' : o.status === 'pending' ? 'amber' : 'gray'}>{o.status}</Badge></div>)}{!data.orders.length && <div className="payment-method"><CreditCard /><div><b>暂无支付订单</b><span>选择套餐创建安全结账</span></div></div>}</div></div>{modal === 'plans' && <Modal wide flush title="选择订阅套餐" onClose={() => setModal(null)} footer={<div className="plan-modal-footer"><span>{data.isSuperAdmin ? '超级管理员选择后立即更换套餐，不创建支付订单。' : '已支付套餐可直接切换并保存；未支付套餐需先完成微信支付。'}</span><Button variant="secondary" icon={false} onClick={() => setModal(null)}>关闭</Button></div>}><div className="plan-picker"><div className="plan-picker-toolbar"><div><b>选择适合你的套餐</b><span>升级后立即获得更高的模型和成员额度</span></div><b>人民币结算 · ¥ CNY</b></div><div className="plan-card-grid">{data.plans.map(p => { const current = p.id === s?.plan_id, free = Number(p.price_cny) === 0, unit = p.billing_period === 'year' ? '年' : '月'; return <article className={`plan-choice-card ${current ? 'current' : ''}`} key={p.id}><div className="plan-choice-head"><div><h3>{p.name}</h3><p>{p.description}</p></div>{current ? <Badge tone="purple">当前套餐</Badge> : p.purchased && !data.isSuperAdmin ? <Badge tone="green">已支付</Badge> : null}</div><div className="plan-choice-price">{free ? <><strong>免费</strong><span>体验使用</span></> : <><strong><small>¥</small>{Number(p.price_cny).toLocaleString()}</strong><span>/ {unit}</span></>}</div><div className="plan-choice-divider" /><ul className="plan-entitlements">{['providers', 'models', 'members'].map(key => <li key={key}><Check /><span>{entitlementLabels[key]}</span><b>{entitlementText(p.entitlements[key])}</b></li>)}</ul><button className="plan-select" disabled={current || (!data.isSuperAdmin && free) || !!checkingOut} onClick={() => selectPlan(p)}>{current ? '正在使用' : data.isSuperAdmin ? '直接更换' : p.purchased ? '切换并保存' : free ? '体验套餐' : '选择并支付'}</button></article> })}</div></div></Modal>}{modal === 'payment' && selectedPlan && <Modal title="设置支付方式" onClose={() => setModal('plans')} footer={<><Button variant="secondary" icon={false} onClick={() => setModal('plans')}>返回选择套餐</Button><Button icon={false} disabled={!!checkingOut || paymentMethod !== 'wechat'} onClick={() => void checkout()}>{checkingOut ? '正在创建订单...' : '确认并微信支付'}</Button></>}><div className="checkout-summary"><span>已选套餐</span><div><b>{selectedPlan.name}</b><strong>¥{Number(selectedPlan.price_cny).toLocaleString()} / {selectedPlan.billing_period === 'year' ? '年' : '月'}</strong></div></div><fieldset className="payment-method-picker"><legend>选择支付方式</legend>{paymentMethods.map(method => { const Icon = method.icon; return <label className={`${paymentMethod === method.id ? 'active' : ''} ${!method.available ? 'disabled' : ''}`} key={method.id}><input type="radio" name="payment-method" value={method.id} checked={paymentMethod === method.id} disabled={!method.available} onChange={() => setPaymentMethod(method.id)} /><span className="payment-method-icon"><Icon /></span><span className="payment-method-copy"><b>{method.name}</b><small>{method.description}</small></span>{method.available ? <Badge tone="green">可用</Badge> : <Badge tone="gray">待接入</Badge>}</label> })}</fieldset><div className="checkout-security-note"><Shield /><span><b>安全支付</b><small>微信订单由微信支付直连创建。支付成功后，仅由验签 Webhook 更新订单并开通订阅。</small></span></div></Modal>}{payment && <PaymentQrModal payment={payment} onClose={() => setPayment(null)} onRefresh={() => void load()} />}</div>
}

type Dict = { id: string; code: string; name: string; description: string; items: { id: string; label: string; value: string; color: string; enabled: boolean }[] }
function Dictionary({ notify }: { notify: (s: string) => void }) {
  const [rows, setRows] = useState<Dict[]>([])
  const [selected, setSelected] = useState<Dict | null>(null)
  const [modal, setModal] = useState<'dict' | 'item' | null>(null)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const load = () => get<Dict[]>('/api/dictionaries').then(x => { setRows(x); setSelected(s => x.find(d => d.id === s?.id) ?? x[0] ?? null) })
  useEffect(() => { void load() }, [])
  const save = async () => { try { if (modal === 'dict') await post('/api/dictionaries', { name, code: value, description: '' }); else if (selected) await post(`/api/dictionaries/${selected.id}/items`, { label: name, value, color: '#6366f1' }); setModal(null); setName(''); setValue(''); await load(); notify('字典配置已持久化') } catch (e) { error(e, notify) } }
  const toggleItem=async(item:Dict['items'][number])=>{try{await patch(`/api/dictionary-items/${item.id}`,{enabled:!item.enabled});await load();notify(item.enabled?'字典项已禁用':'字典项已启用')}catch(e){error(e,notify)}}
  return <div className="page"><PageHeader {...pageMeta.dictionary}><Button onClick={() => setModal('dict')}>新建字典</Button></PageHeader><div className="dictionary-layout"><aside className="card dictionary-list">{rows.map(d => <button className={selected?.id === d.id ? 'active' : ''} onClick={() => setSelected(d)} key={d.id}><span><b>{d.name}</b><small>{d.items.length} 个字典项</small></span><ChevronRight /></button>)}</aside><section className="card dictionary-detail"><div className="dictionary-head"><div><h2>{selected?.name}</h2><p>{selected?.description || `业务代码：${selected?.code}`}</p></div><Button icon={false} onClick={() => setModal('item')}><Plus size={15} />添加字典项</Button></div><table><thead><tr><th>显示名称</th><th>字典值</th><th>颜色</th><th>状态</th></tr></thead><tbody>{selected?.items.map(i => <tr key={i.id}><td><b>{i.label}</b></td><td><code>{i.value}</code></td><td><span className="color-dot" style={{ background: i.color }} />{i.color}</td><td><button className={`dictionary-status ${i.enabled?'enabled':''}`} onClick={()=>void toggleItem(i)}><Badge tone={i.enabled ? 'green' : 'gray'}>{i.enabled ? '启用' : '禁用'}</Badge></button></td></tr>)}</tbody></table></section></div>{modal && <Modal title={modal === 'dict' ? '新建字典' : '添加字典项'} onClose={() => setModal(null)} footer={<><Button variant="secondary" icon={false} onClick={() => setModal(null)}>取消</Button><Button onClick={() => void save()}>保存</Button></>}><label className="field"><span>{modal === 'dict' ? '字典名称' : '显示名称'}</span><input value={name} onChange={e => setName(e.target.value)} /></label><label className="field"><span>{modal === 'dict' ? '字典代码' : '字典值'}</span><input value={value} onChange={e => setValue(e.target.value)} /></label></Modal>}</div>
}