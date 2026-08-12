import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, LockKeyhole, RefreshCw, Sparkles } from 'lucide-react'
import { ApiError, get } from '../api'
import { useAuth } from '../auth'

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [captcha, setCaptcha] = useState<{ id: string; svg: string } | null>(null)
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(true)

  const refreshCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    setCaptchaCode('')
    try {
      setCaptcha(await get<{ id: string; svg: string }>('/api/auth/captcha'))
    } catch (reason) {
      setCaptcha(null)
      setError(reason instanceof ApiError ? reason.message : '验证码加载失败，请确认服务已启动后重试')
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  useEffect(() => { void refreshCaptcha() }, [refreshCaptcha])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!email.trim() || !password) throw new ApiError('请输入邮箱和密码', 400, 'credentials_required')
      if (!captcha || !captchaCode.trim()) throw new ApiError('请输入图形验证码', 400, 'captcha_unavailable')
      await login(email, password, captcha.id, captchaCode)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : '无法连接服务端')
      await refreshCaptcha()
    } finally {
      setBusy(false)
    }
  }

  return <div className="login-page">
    <section className="login-hero">
      <div className="brand login-brand">
        <div className="brand-mark"><span /><span /><span /></div>
        <span>SkillPort</span><b>AI</b>
      </div>
      <div className="login-value">
        <span className="eyebrow"><Sparkles /> 企业 AI 落地与增长平台</span>
        <h1>把企业的 AI 能力，<br /><strong>变成增长和收入。</strong></h1>
        <p>从内部提效到对外服务，一套平台统一沉淀、管理和交付，让每一份 AI 投入都能持续创造业务价值。</p>
        <ul>
          <li><CheckCircle2 /><span><b>更快落地</b>成熟 AI 能力一处沉淀，全公司随时复用</span></li>
          <li><CheckCircle2 /><span><b>更低成本</b>减少重复采购和重复开发，把预算花在业务增长上</span></li>
          <li><CheckCircle2 /><span><b>更放心</b>权限、用量和费用全程可管，企业数据边界清晰</span></li>
        </ul>
      </div>
      <div className="login-hero-footer"><small>© 2026 SkillPort AI · 让企业 AI 投入持续产生回报</small></div>
    </section>
    <main className="login-form-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-icon"><LockKeyhole /></div>
        <h2>欢迎回来</h2>
        <p>登录企业 AI 工作空间</p>
        {error && <div className="login-error">{error}</div>}
        <label className="field"><span>邮箱地址</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
        <label className="field"><span>密码</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} /></label>
        <label className="field"><span>图形验证码</span><div className="captcha-field"><input aria-label="图形验证码" autoComplete="off" value={captchaCode} onChange={event => setCaptchaCode(event.target.value)} required maxLength={12} placeholder="输入图中字符" /><button type="button" onClick={() => void refreshCaptcha()} disabled={captchaLoading} aria-label="刷新验证码" title="看不清？点击刷新">{captcha ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(captcha.svg)}`} alt="图形验证码" /> : <span>{captchaLoading ? '加载中...' : '点击刷新'}</span>}<RefreshCw /></button></div></label>
        <button className="login-submit" disabled={busy || captchaLoading || !captcha}>{busy ? '正在验证...' : <>进入工作空间 <ArrowRight /></>}</button>
        <div className="demo-account"><b>本地超级管理员</b><span>admin@skillport.local / SkillPort@123456</span></div>
      </form>
    </main>
  </div>
}
