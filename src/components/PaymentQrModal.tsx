import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Copy, ExternalLink, QrCode, RefreshCw } from 'lucide-react'
import { get } from '../api'
import { Button, Modal } from '../components'

export type PaymentQr = { checkoutUrl:string; qrCodeDataUrl?:string; channel?:string; providerRef?:string|null; orderId?:string; amount?:number|string; currency?:string }

type PaymentStatus = { status: 'pending' | 'paid' | 'cancelled' | 'failed' | 'refunded'; paid_at?: string | null }

export function PaymentQrModal({payment,onClose,onRefresh}:{payment:PaymentQr;onClose:()=>void;onRefresh?:()=>void}){
  const [status,setStatus]=useState<PaymentStatus['status']>('pending')
  const [checking,setChecking]=useState(false)
  const copy=()=>void navigator.clipboard?.writeText(payment.checkoutUrl)
  const check=useCallback(async()=>{
    if(!payment.orderId||status!=='pending')return
    setChecking(true)
    try{const order=await get<PaymentStatus>(`/api/payment-orders/${payment.orderId}`);setStatus(order.status);if(order.status==='paid')onRefresh?.()}catch{/* Temporary polling errors do not interrupt the checkout screen. */}finally{setChecking(false)}
  },[onRefresh,payment.orderId,status])
  useEffect(()=>{if(!payment.orderId||status!=='pending')return;void check();const timer=window.setInterval(()=>void check(),3000);return()=>window.clearInterval(timer)},[check,payment.orderId,status])
  return <Modal title={status==='paid'?'支付成功':'微信扫码支付'} onClose={onClose} footer={<><Button variant={status==='paid'?'primary':'secondary'} icon={false} onClick={onClose}>{status==='paid'?'完成':'关闭'}</Button>{status==='pending'&&payment.orderId&&<Button variant="secondary" icon={false} disabled={checking} onClick={()=>void check()}><RefreshCw size={15}/>{checking?'查询中':'查询支付结果'}</Button>}</>}>
    {status==='paid'?<div className="payment-success"><CheckCircle2/><h3>支付成功</h3><p>套餐已开通，可以关闭此页面继续使用。</p>{payment.orderId&&<code>{payment.orderId}</code>}</div>:
    <div className="payment-qr-modal">
      <div className="payment-qr-box">{payment.qrCodeDataUrl?<img src={payment.qrCodeDataUrl} alt="微信扫码支付二维码"/>:<QrCode/>}</div>
      <div className="payment-qr-info"><h3>请使用微信扫描二维码完成付款</h3><p>支付成功后，微信支付会直接通知平台；系统完成 API v3 验签、解密和金额校验后自动开通订阅。</p></div>
      <dl className="payment-qr-meta">{payment.orderId&&<><dt>订单号</dt><dd><code>{payment.orderId}</code></dd></>}{payment.providerRef&&<><dt>渠道流水号</dt><dd><code>{payment.providerRef}</code></dd></>}{payment.channel&&<><dt>支付渠道</dt><dd>{payment.channel}</dd></>}{payment.amount!==undefined&&payment.currency&&<><dt>金额</dt><dd>{payment.currency} {payment.amount}</dd></>}</dl>
      <div className="payment-qr-actions"><button onClick={copy}><Copy size={14}/>复制二维码内容</button><a href={payment.checkoutUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/>打开支付链接</a></div>
    </div>}
  </Modal>
}