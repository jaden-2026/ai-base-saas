import { useEffect, useState } from 'react'
import { Check, Filter, Pencil, Settings2, Tag, Trash2, X } from 'lucide-react'
import { ApiError, get, patch, post, put, remove } from '../api'
import type { Category } from '../types'
import { Button, Modal } from '../components'

type ModelResourceType = 'model'

export function useCategories(type: ModelResourceType) {
  const [items, setItems] = useState<Category[]>([])
  const load = () => get<Category[]>(`/api/categories?resourceType=${type}`).then(setItems)
  useEffect(() => {
    void load()
    const refresh = (event: Event) => {
      if ((event as CustomEvent<ModelResourceType>).detail === type) void load()
    }
    window.addEventListener('skillport:categories-changed', refresh)
    return () => window.removeEventListener('skillport:categories-changed', refresh)
  }, [type])
  return { items, load }
}

export function CategoryFilter({ type, value, onChange, onManage }: { type: ModelResourceType; value: string; onChange: (id: string) => void; onManage?: () => void }) {
  const { items } = useCategories(type)
  return <div className="category-filter"><Filter /><select value={value} onChange={event => onChange(event.target.value)}><option value="">全部模型分类</option>{items.map(category => <option value={category.id} key={category.id}>{category.name}（{category.usage_count ?? 0}）</option>)}</select>{onManage && <button onClick={onManage} title="管理分类"><Settings2 /></button>}</div>
}

export function CategoryTags({ items }: { items: Category[] | undefined }) {
  if (!items?.length) return null
  return <div className="category-tags">{items.map(category => <span key={category.id} style={{ color: category.color, background: `${category.color}15`, borderColor: `${category.color}35` }}><i style={{ background: category.color }} />{category.name}</span>)}</div>
}

export function CategoryManager({ type, onClose, notify, onChanged }: { type: ModelResourceType; onClose: () => void; notify: (message: string) => void; onChanged?: () => Promise<void> | void }) {
  const { items, load } = useCategories(type)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [editing, setEditing] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#6366f1')
  const [busy, setBusy] = useState(false)
  const changed = async () => {
    window.dispatchEvent(new CustomEvent<ModelResourceType>('skillport:categories-changed', { detail: type }))
    await onChanged?.()
  }
  const add = async () => {
    setBusy(true)
    try {
      await post('/api/categories', { resourceType: type, name: name.trim(), color, description: '' })
      setName('')
      await load()
      await changed()
      notify('分类已创建')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : '创建分类失败')
    } finally {
      setBusy(false)
    }
  }
  const startEdit = (category: Category) => {
    setEditing(category)
    setEditName(category.name)
    setEditColor(category.color)
  }
  const save = async () => {
    if (!editing || !editName.trim()) return
    setBusy(true)
    try {
      await patch(`/api/categories/${editing.id}`, { name: editName.trim(), color: editColor })
      setEditing(null)
      await load()
      await changed()
      notify('分类已更新')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : '分类更新失败')
    } finally {
      setBusy(false)
    }
  }
  const del = async (category: Category) => {
    if (category.usage_count && !confirm(`「${category.name}」已被 ${category.usage_count} 个模型使用，删除后会清除这些关联，确认删除？`)) return
    setBusy(true)
    try {
      await remove(`/api/categories/${category.id}`)
      if (editing?.id === category.id) setEditing(null)
      await load()
      await changed()
      notify('分类已删除')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : '删除分类失败')
    } finally {
      setBusy(false)
    }
  }
  return <Modal title="管理模型分类" onClose={onClose} footer={<Button variant="secondary" icon={false} onClick={onClose}>完成</Button>}><div className="category-create"><input maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="分类名称" /><input aria-label="分类颜色" type="color" value={color} onChange={event => setColor(event.target.value)} /><Button icon={false} disabled={busy || !name.trim()} onClick={() => void add()}>创建</Button></div><div className="category-list">{items.map(category => editing?.id === category.id ? <div className="category-edit" key={category.id}><input maxLength={80} value={editName} onChange={event => setEditName(event.target.value)} /><input aria-label="分类颜色" type="color" value={editColor} onChange={event => setEditColor(event.target.value)} /><button disabled={busy || !editName.trim()} onClick={() => void save()}><Check /></button><button onClick={() => setEditing(null)}><X /></button></div> : <div className="category-item" key={category.id}><span><i style={{ background: category.color }} />{category.name}</span><small>{category.usage_count ?? 0} 个模型</small><button onClick={() => startEdit(category)}><Pencil /></button><button className="danger" disabled={busy} onClick={() => void del(category)}><Trash2 /></button></div>)}{!items.length && <div className="category-empty"><Tag /><span>尚未创建模型分类</span></div>}</div></Modal>
}

export function CategoryAssigner({ type, resourceId, current, onClose, onSaved, notify }: { type: ModelResourceType; resourceId: string; current: Category[]; onClose: () => void; onSaved: () => Promise<void> | void; notify: (message: string) => void }) {
  const { items } = useCategories(type)
  const [selected, setSelected] = useState<string[]>(current.map(category => category.id))
  const toggle = (id: string) => setSelected(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id])
  const save = async () => {
    try {
      await put('/api/category-assignments', { resourceType: type, resourceId, categoryIds: selected })
      await onSaved()
      onClose()
      notify('模型分类已更新')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : '模型分类更新失败')
    }
  }
  return <Modal title="设置模型分类" onClose={onClose} footer={<><Button variant="secondary" icon={false} onClick={onClose}>取消</Button><Button icon={false} onClick={() => void save()}><Check />保存分类</Button></>}><div className="category-options">{items.map(category => <button className={selected.includes(category.id) ? 'active' : ''} onClick={() => toggle(category.id)} key={category.id}><i style={{ background: category.color }} /><span>{category.name}</span>{selected.includes(category.id) && <Check />}</button>)}{!items.length && <div className="category-empty"><Tag /><span>请先创建一个模型分类</span></div>}</div></Modal>
}