import type pg from 'pg'

const permissions=['models:read','models:write','apikeys:manage','members:manage','plans:manage','payments:manage','dictionaries:manage','settings:manage','tenants:manage'] as const
const ownerPermissions=permissions.filter(code=>code!=='tenants:manage')
const planDefinitions=[
  ['newer','Newer 体验版','基础模型与团队管理能力',0,0,'month',{providers:3,models:20,members:3}],
  ['personal-monthly','专享套餐-月','适合个人与小型团队',49,7,'month',{providers:5,models:100,members:5}],
  ['enterprise-monthly','企业套餐-月','适合企业团队',598,83,'month',{providers:10,models:500,members:10}],
  ['enterprise-yearly','企业套餐-年','适合企业团队的年度订阅',5980,830,'year',{providers:10,models:500,members:50}],
  ['unlimited-monthly','无限制套餐','模型与团队额度不设上限',9999,1399,'month',{}],
] as const
const providers=[
  ['openai','OpenAI','https://api.openai.com/v1','official','openai','bearer'],
  ['anthropic','Anthropic','https://api.anthropic.com/v1','official','anthropic','x-api-key'],
  ['deepseek','DeepSeek','https://api.deepseek.com/v1','official','openai','bearer'],
  ['qwen','通义千问','https://dashscope.aliyuncs.com/compatible-mode/v1','official','openai','bearer'],
  ['zhipu','智谱 AI','https://open.bigmodel.cn/api/paas/v4','official','openai','bearer'],
  ['siliconflow','硅基流动','https://api.siliconflow.cn/v1','relay','openai','bearer'],
  ['openrouter','OpenRouter','https://openrouter.ai/api/v1','relay','openai','bearer'],
  ['aihubmix','AiHubMix','https://aihubmix.com/v1','relay','openai','bearer'],
  ['oneapi','One API / New API','http://127.0.0.1:3000/v1','relay','openai','bearer'],
  ['ollama','Ollama 本地服务','http://127.0.0.1:11434','local','ollama','none'],
  ['lmstudio','LM Studio','http://127.0.0.1:1234/v1','local','openai','none'],
  ['vllm','vLLM','http://127.0.0.1:8000/v1','local','openai','none'],
] as const

export async function seed(client:pg.PoolClient,ownerEmail:string,ownerPasswordHash:string){
  for(const code of permissions)await client.query(`INSERT INTO app.permissions(code,name,category) VALUES($1::varchar,$1::varchar,split_part($1::text,':',1)) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category`,[code])
  for(const [code,name,description,priceCny,priceUsd,billingPeriod,entitlements] of planDefinitions)await client.query(`INSERT INTO app.plans(code,name,description,price_cny,price_usd,billing_period,entitlements) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,price_cny=EXCLUDED.price_cny,price_usd=EXCLUDED.price_usd,billing_period=EXCLUDED.billing_period,entitlements=EXCLUDED.entitlements,active=true`,[code,name,description,priceCny,priceUsd,billingPeriod,JSON.stringify(entitlements)])
  const platformTenant=(await client.query<{id:string}>(`INSERT INTO app.tenants(name,slug,description) VALUES('SkillPort AI','skillport-platform','平台管理工作空间') ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`)).rows[0]
  const platformRole=(await client.query<{id:string}>(`INSERT INTO app.roles(tenant_id,name,description,is_system,permissions) VALUES($1,'平台所有者','平台超级管理员全部权限',true,$2) ON CONFLICT(tenant_id,name) DO UPDATE SET description=EXCLUDED.description,permissions=EXCLUDED.permissions RETURNING id`,[platformTenant.id,JSON.stringify(['*'])])).rows[0]
  let platformOwner=(await client.query<{id:string}>(`SELECT id FROM app.users WHERE lower(email)=lower($1)`,[ownerEmail])).rows[0]
  if(!platformOwner)platformOwner=(await client.query<{id:string}>(`INSERT INTO app.users(email,name,password_hash,status) VALUES($1,'SkillPort Admin',$2,'active') RETURNING id`,[ownerEmail,ownerPasswordHash])).rows[0]
  await client.query(`INSERT INTO app.memberships(tenant_id,user_id,role_id) VALUES($1,$2,$3) ON CONFLICT(tenant_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id`,[platformTenant.id,platformOwner.id,platformRole.id])
  const tenants=(await client.query<{id:string}>(`SELECT id FROM app.tenants`)).rows
  for(const tenant of tenants){
    await client.query(`INSERT INTO app.roles(tenant_id,name,description,is_system,permissions) VALUES($1,'所有者','租户工作空间全部权限',true,$2) ON CONFLICT(tenant_id,name) DO UPDATE SET permissions=EXCLUDED.permissions`,[tenant.id,JSON.stringify(ownerPermissions)])
    await client.query(`INSERT INTO app.roles(tenant_id,name,description,is_system,permissions) VALUES($1,'成员','默认只读权限',true,$2) ON CONFLICT(tenant_id,name) DO UPDATE SET permissions=EXCLUDED.permissions`,[tenant.id,JSON.stringify(['models:read'])])
    for(const provider of providers)await client.query(`INSERT INTO app.model_providers(tenant_id,code,name,base_url,provider_type,protocol,auth_type,is_builtin) VALUES($1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT(tenant_id,code) DO UPDATE SET name=EXCLUDED.name,base_url=EXCLUDED.base_url,provider_type=EXCLUDED.provider_type,protocol=EXCLUDED.protocol,auth_type=EXCLUDED.auth_type,is_builtin=true`,[tenant.id,...provider])
  }
}
