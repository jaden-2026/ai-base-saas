import { useEffect, useState } from 'react'
import { Sidebar, Toast, Topbar } from './components'
import { adminNav, mainNav, pageMeta } from './data'
import type { PageId } from './types'
import { ResourcePages } from './pages/Resources'
import { AdminPages } from './pages/Admin'
import { useAuth } from './auth'
import { Login } from './pages/Login'
import { ModelProviders } from './pages/ModelServices'
import { ModelList } from './pages/ModelList'

export default function App() {
  const { identity, loading, can } = useAuth()
  const [page, setPage] = useState<PageId>('models')
  const [menu, setMenu] = useState(false)
  const [toast, setToast] = useState('')
  const allowedPages = [...mainNav, ...adminNav].filter(item => can(item.permission)).map(item => item.id)
  const activePage = allowedPages.includes(page) ? page : allowedPages[0]
  useEffect(() => {
    if (activePage && activePage !== page) setPage(activePage)
  }, [activePage, page])
  const notify = (message: string) => setToast(message)
  const navigate = (target: PageId) => { if (allowedPages.includes(target)) setPage(target) }
  const content = activePage === 'model-providers' ? <ModelProviders notify={notify} />
    : activePage === 'models' ? <ModelList notify={notify} />
    : activePage === 'apikeys' ? <ResourcePages notify={notify} />
    : activePage ? <AdminPages page={activePage} notify={notify} />
    : <div className="page"><div className="card empty-state"><h3>暂无可访问功能</h3><p>当前租户角色未分配任何页面权限，请联系租户管理员调整角色权限。</p></div></div>
  if (loading) return <div className="app-loading"><div className="brand-mark"><span/><span/><span/></div><p>正在连接工作空间...</p></div>
  if (!identity) return <Login />
  return <div className="app-shell">
    <Sidebar page={activePage ?? page} onNavigate={navigate} open={menu} onClose={() => setMenu(false)} />
    <div className="main-shell"><Topbar onMenu={() => setMenu(true)} /><main aria-label={activePage ? pageMeta[activePage].title : '暂无可访问功能'}>{content}</main></div>
    {toast && <Toast message={toast} onDone={() => setToast('')} />}
  </div>
}