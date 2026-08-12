import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, post, session } from './api'
export type Identity={user:{userId:string;tenantId:string;email:string;name:string;role:string;permissions:string[]};tenant:{id?:string;name:string;slug:string;description:string;locale:string;timezone:string;settings:Record<string,boolean>;brand_logo_url?:string|null;status?:'active'|'suspended'|'archived';valid_from?:string;valid_until?:string|null}}
type Auth={identity:Identity|null;loading:boolean;login:(email:string,password:string,captchaId:string,captchaCode:string)=>Promise<void>;logout:()=>Promise<void>;can:(permission:string)=>boolean;refresh:()=>Promise<boolean>}
const Context=createContext<Auth|null>(null)
export function AuthProvider({children}:{children:ReactNode}){const[identity,setIdentity]=useState<Identity|null>(null),[loading,setLoading]=useState(true)
  const refresh=async()=>{if(!session.get()){setIdentity(null);setLoading(false);return false}try{setIdentity(await api<Identity>('/api/me'));return true}catch{setIdentity(null);return false}finally{setLoading(false)}}
  useEffect(()=>{void refresh();const clear=()=>setIdentity(null);window.addEventListener('skillport:unauthorized',clear);return()=>window.removeEventListener('skillport:unauthorized',clear)},[])
  const login=async(email:string,password:string,captchaId:string,captchaCode:string)=>{const result=await post<{token:string}>('/api/auth/login',{email:email.trim(),password,captchaId,captchaCode:captchaCode.trim()});session.set(result.token);if(!await refresh()){session.clear();setIdentity(null);throw new ApiError('登录成功，但无法初始化工作空间，请检查服务后重试',503,'identity_refresh_failed')}}
  const logout=async()=>{try{await post('/api/auth/logout',{})}finally{session.clear();setIdentity(null)}}
  const can=(p:string)=>!!identity&&(p==='authenticated'||identity.user.permissions.includes('*')||identity.user.permissions.includes(p))
  return <Context.Provider value={{identity,loading,login,logout,can,refresh}}>{children}</Context.Provider>}
export const useAuth=()=>{const value=useContext(Context);if(!value)throw new Error('AuthProvider missing');return value}