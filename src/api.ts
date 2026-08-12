const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'skillport_session'
export class ApiError extends Error { constructor(message:string,public status:number,public code:string){super(message)} }
export const session = { get:()=>localStorage.getItem(TOKEN_KEY), set:(v:string)=>localStorage.setItem(TOKEN_KEY,v), clear:()=>localStorage.removeItem(TOKEN_KEY) }
export async function api<T>(path:string,options:RequestInit={}) {
  const token=session.get(),headers=new Headers(options.headers)
  if(token)headers.set('Authorization',`Bearer ${token}`)
  if(options.body && !(options.body instanceof FormData))headers.set('Content-Type','application/json')
  const response=await fetch(`${API_BASE}${path}`,{...options,headers})
  const payload=await response.json().catch(()=>({}))
  if(!response.ok){if(response.status===401){session.clear();window.dispatchEvent(new Event('skillport:unauthorized'))}throw new ApiError(payload.message??'请求失败',response.status,payload.error??'request_failed')}
  return payload.data as T
}
export const get=<T>(path:string)=>api<T>(path)
export const post=<T>(path:string,body:unknown)=>api<T>(path,{method:'POST',body:body instanceof FormData?body:JSON.stringify(body)})
export const patch=<T>(path:string,body:unknown)=>api<T>(path,{method:'PATCH',body:JSON.stringify(body)})
export const put=<T>(path:string,body:unknown)=>api<T>(path,{method:'PUT',body:JSON.stringify(body)})
export const remove=<T>(path:string)=>api<T>(path,{method:'DELETE'})
export async function apiBlob(path:string){const token=session.get(),response=await fetch(`${API_BASE}${path}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!response.ok){const payload=await response.json().catch(()=>({}));throw new ApiError(payload.message??'文件读取失败',response.status,payload.error??'file_error')}return response.blob()}

export async function postStream<T>(path:string,body:unknown,onEvent:(event:T)=>void){
  const token=session.get(),headers=new Headers({'Content-Type':'application/json','Accept':'application/x-ndjson'})
  if(token)headers.set('Authorization',`Bearer ${token}`)
  const response=await fetch(`${API_BASE}${path}`,{method:'POST',headers,body:JSON.stringify(body)})
  if(!response.ok){
    const payload=await response.json().catch(()=>({}))
    if(response.status===401){session.clear();window.dispatchEvent(new Event('skillport:unauthorized'))}
    throw new ApiError(payload.message??'请求失败',response.status,payload.error??'request_failed')
  }
  if(!response.body)throw new ApiError('浏览器不支持流式响应',500,'stream_unavailable')
  const reader=response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer=''
  while(true){
    const {done,value}=await reader.read()
    buffer+=value??''
    const lines=buffer.split('\n');buffer=lines.pop()??''
    for(const line of lines)if(line.trim())onEvent(JSON.parse(line) as T)
    if(done)break
  }
  if(buffer.trim())onEvent(JSON.parse(buffer) as T)
}