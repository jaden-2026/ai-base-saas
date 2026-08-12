import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './auth'
import { ErrorBoundary } from './ErrorBoundary'

const root=ReactDOM.createRoot(document.getElementById('root')!)
void import('./App').then(({default:App})=>root.render(
  <React.StrictMode><ErrorBoundary><AuthProvider><App /></AuthProvider></ErrorBoundary></React.StrictMode>,
)).catch(error=>{console.error('SkillPort startup failed',error);root.render(<div className="startup-error"><div className="brand-mark"><span/><span/><span/></div><h1>应用加载失败</h1><p>{error instanceof Error?error.message:'前端模块无法加载'}</p><button onClick={()=>{localStorage.removeItem('skillport_session');location.reload()}}>清理缓存并重新加载</button></div>)})