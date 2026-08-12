# AI-Content：SkillPort AI 项目跨窗口上下文

> 用途：为后续 AI/开发窗口提供可复用的项目上下文、当前实现边界和工作交接信息。
>
> 快照日期：2026-08-12
>
> 快照分支：`develop`
>
> 当前版本：`1.2.1`
>
> 当前提交：`141dbf9`（`tag_V1.0`，与 `origin/develop` 同步）

## 1. 项目定位

SkillPort AI 是面向企业的多租户 AI 模型资源管理平台。核心目标是集中管理模型服务商、模型目录和租户 API 凭证，并提供租户生命周期、成员/RBAC、套餐订阅、支付订单、系统配置和操作审计能力。

### 当前产品范围

- 模型服务商：OpenAI-compatible、Anthropic-compatible、Ollama、自定义服务；支持连接检测、模型同步/发现、启停和租户级配置。
- 模型目录：语言、Embedding、重排序、图像等模型的列表、状态、分类和价格/上下文信息。
- API Keys：租户凭证创建、编辑、撤销、权限范围和有效期；原始 Key 只在创建响应中返回。
- 多租户治理：租户创建/生命周期、成员、角色、权限、品牌 Logo、审计。
- 订阅与计费：套餐、订阅、用量、支付订单；当前支付实现重点为微信支付 Native，另保留 Stripe/其他 provider 的数据模型或配置入口。
- 平台设置：字典、工作空间信息、安全策略、渠道通知和微信支付配置。

### 明确不属于当前范围

最近一次裁剪提交删除了 Skill、Agent、MCP、项目工作区、知识库/RAG、聊天导出、AI Bot 等后端代码、测试、文档和数据库结构。不要依据历史分支、旧构建产物或旧需求自行恢复这些模块；产品范围以 `src/data.ts`、`src/App.tsx`、`server/index.ts`/`server/payment-routes.ts` 的当前实现和 `db/schema.sql` 为准。

## 2. 仓库与技术栈

```text
E:\gitee\project-mesh\
├─ src/                 React 前端、页面、组件、样式和 API 客户端
├─ server/              Fastify API、鉴权、数据库、种子、支付、集成测试
├─ db/schema.sql        PostgreSQL Schema、裁剪旧表、约束、索引和迁移标记
├─ scripts/             工程检查脚本（当前主要是样式检查）
├─ dist/                Vite 前端构建产物（生成文件）
├─ server-dist/         服务端 TypeScript 构建产物（生成文件）
├─ uploads/             运行时上传目录（不应提交）
├─ README.md            中文产品/运行说明（主要事实来源）
├─ README.en.md         英文产品/运行说明
├─ .env.example         环境变量模板
└─ AI-Content.md        本跨窗口上下文文档
```

技术栈：React + TypeScript + Vite + Lucide React；Node.js + Fastify + Zod；PostgreSQL + Redis；pnpm 11.10.0；`tsx` 用于开发、初始化和集成测试。前端使用原生 `fetch` 封装 API，没有 React Router；后端路由集中注册在 `server/index.ts`，支付路由在 `server/payment-routes.ts`。

## 3. 当前 Git 状态与注意事项

- 分支：`develop`，HEAD 与 `origin/develop` 同步。
- 最近提交：`141dbf9 - 删除 Skill、Agent、MCP、项目工作区、知识库/RAG、聊天导出、AI Bot 等后端代码、测试、文档和数据库结构。`
- 生成本文档前工作区仅有未跟踪目录 `E:\gitee\project-mesh\input\`；该目录不是本次任务产物，不应擅自删除、修改或纳入文档内容。
- `dist/`、`server-dist/`、`uploads/` 属于生成/运行数据；改源码后不要手工编辑构建产物。
- `local.md` 含本机 PostgreSQL/Redis 连接信息，属于本地敏感资料；不要复制其中的密码或连接串到提交、Issue 或 AI 上下文中。

## 4. 前端结构与页面权限

入口链路：`src/main.tsx` → `AuthProvider` → `src/App.tsx`。`App` 根据 `useAuth().can()` 过滤导航并直接切换页面组件。

| 页面 | 前端组件 | 导航权限 |
|---|---|---|
| 模型服务商 | `src/pages/ModelServices.tsx` | `models:read` |
| 模型列表 | `src/pages/ModelList.tsx` | `models:read` |
| API Keys | `src/pages/Resources.tsx` | `apikeys:manage` |
| 租户与成员 | `src/pages/Admin.tsx` | `members:manage` |
| 订阅与套餐 | `src/pages/Admin.tsx` | `plans:manage` |
| 支付订单 | `src/pages/PaymentOrders.tsx` | `payments:manage` |
| 字典配置 | `src/pages/Admin.tsx` | `dictionaries:manage` |
| 系统设置 | `src/pages/SettingsPage.tsx` 等 | `authenticated`（写操作仍由服务端 `settings:manage` 控制） |

前端 API 基址为 `import.meta.env.VITE_API_URL ?? ''`。开发时 Vite 将 `/api` 和 `/mcp` 代理到 `http://127.0.0.1:3001`，但当前产品范围不包含 MCP 页面/业务。

## 5. 后端架构与关键流程

### 启动与依赖

`server/config.ts` 读取根目录 `.env` 并生成配置；`server/db.ts` 创建 PostgreSQL 连接池（最多 12 个连接）和 Redis 客户端。`server/setup.ts` 负责建库、执行 Schema 和调用 `server/seed.ts` 写入基础数据。

### 登录与权限

1. `GET /api/auth/captcha` 创建验证码。
2. `POST /api/auth/login` 校验邮箱、密码和验证码，从用户所属租户/角色生成会话。
3. 会话 token 存 Redis，Key 为 token 的 SHA-256 摘要，默认有效期 24 小时。
4. 前端 token 保存在浏览器 `localStorage` 的 `skillport_session` 中，请求通过 `Authorization: Bearer ...` 发送。
5. `auth` 负责会话和租户可用性检查；`permit(permission)` 执行细粒度 RBAC；`*` 表示超级管理员。
6. 跨租户管理必须额外具备 `tenants:manage`；写入/删除等行为通常会写入 `app.audit_logs`。

### 安全实现

- 用户密码：Node `scrypt` 加随机 salt 哈希。
- 服务商 API Key、微信支付私钥/API v3 Key/公钥等：使用基于 `APP_SECRET` 派生的 AES-256-GCM 加密保存。
- 平台 API Key：数据库仅保存 SHA-256 hash；原始 Key 形如 `sk_live_...`，只返回一次。
- 输入校验：Fastify 路由内使用 Zod；统一错误处理将校验错误返回 400，生产环境隐藏内部错误详情。
- 支付回调：微信回调需验证签名、解密资源，并校验商户、订单、状态、金额和币种。

## 6. API 分组索引

完整实现以源码为准，以下用于快速定位：

- 健康与身份：`/api/health`、`/api/auth/*`、`/api/me`、`/api/tenant-brand/:tenantId/logo`
- 租户/RBAC：`/api/tenants`、`/api/members`、`/api/roles`
- 模型资源：`/api/providers`、`/api/providers/:id/connect`、`/api/providers/:providerId/models`、`/api/models`、`/api/categories`、`/api/category-assignments`
- 凭证：`/api/api-keys` 及 `/api/api-keys/:id`
- 字典：`/api/dictionaries`、`/api/dictionaries/:id/items`、`/api/dictionary-items/:id`
- 订阅/订单：`/api/billing`、`/api/billing/switch-plan`、`/api/billing/activate-paid-plan`、`/api/plans`、`/api/payment-orders`、`/api/billing/checkout`
- 设置/通知：`/api/settings`、`/api/settings/brand-logo`、`/api/settings/channel-notifications/*`、`/api/channel-notification-webhooks/*`
- 微信支付：`/api/settings/payment/wechat`、`/api/billing/webhooks/wechat`

统一成功响应格式为 `{ data: ... }`；前端 `src/api.ts` 自动解包 `data`。错误通常包含 `{ error, message }`，401 会清除本地会话并触发 `skillport:unauthorized`。

## 7. 数据模型概览

`db/schema.sql` 当前保留的主要表：

`tenants`、`users`、`permissions`、`roles`、`memberships`、`dictionaries`、`dictionary_items`、`resource_categories`、`resource_category_assignments`、`plans`、`subscriptions`、`payment_orders`、`model_providers`、`models`、`api_keys`、`usage_events`、`audit_logs`、`wechat_pay_credentials`、`channel_notification_accounts`。

租户是核心隔离边界；业务表普遍带 `tenant_id` 并通过外键级联。`server/seed.ts` 幂等写入权限、平台租户 `skillport-platform`、超级管理员、所有者/成员角色、套餐和内置模型服务商。初始化 Schema 会主动删除旧项目遗留表，因此执行 `pnpm db:setup` 前必须确认数据库目标正确并已备份。

## 8. 本地运行与验证

环境要求：Node.js 22/current LTS、pnpm 11、PostgreSQL 14+、Redis 6+。根目录复制 `.env.example` 为 `.env`，至少配置数据库、Redis、`APP_SECRET` 和种子管理员账号；真实凭据不得提交。

```powershell
Copy-Item .env.example .env
pnpm install
pnpm db:setup
pnpm dev                 # Web http://localhost:5173，API http://localhost:3001
```

常用命令：

| 命令 | 用途 |
|---|---|
| `pnpm dev:web` / `pnpm dev:api` | 分别启动前端/后端 |
| `pnpm build` | 样式检查、前后端类型检查、前端构建 |
| `pnpm test:api` | 访问 PostgreSQL/Redis 的保留功能集成测试 |
| `pnpm check:styles` | 检查源码样式约束 |
| `pnpm start` | 运行 `server-dist/index.js` 生产服务 |

`server/integration.ts` 当前覆盖：健康检查、错误验证码、登录与超级管理员身份、服务商、模型、分类、租户、成员、角色、字典、套餐/订阅、支付订单、API Key 创建撤销、渠道通知持久化和退出登录。集成测试必须使用隔离数据库，不能连接生产环境。

## 9. 开发约定与改动检查清单

- 保持现有 TypeScript、React、Fastify、Zod 风格；不要无必要引入新依赖。
- 新增页面时同步更新 `src/types.ts`、`src/data.ts`、`src/App.tsx` 和对应服务端 API/权限。
- 新增或改变数据库字段时同步修改 `db/schema.sql`、seed、查询类型、前端类型和集成测试；确保初始化幂等。
- 所有租户查询必须确认 `tenant_id` 过滤和跨租户权限；所有敏感写操作应有审计记录。
- 修改支付逻辑时同时检查金额单位（数据库金额转分）、回调签名/解密、幂等更新和订单状态迁移。
- 不要提交 `.env`、密钥、`uploads/`、日志、数据库备份、`dist/`/`server-dist/` 生成物或本地调试文件。
- 提交前至少运行：`pnpm build`；后端/数据行为变化再运行隔离环境下的 `pnpm test:api`。

## 10. 当前已知风险与待确认项

- README 宣称支持 Stripe、微信支付和手工支付，但当前专门支付路由实际重点是微信支付 Native；新增支付渠道前应先确认产品需求和已有数据模型是否足够。
- `server/index.ts` 和部分页面文件体量较大且存在压缩式单行代码；改动时优先做局部、低风险修改，避免无关格式化。
- `.env.example` 与 `server/config.ts` 带有本地默认值；共享/生产部署必须替换 `APP_SECRET`、数据库凭据和种子账号密码。
- 当前工作区的 `input/` 为未跟踪目录，来源和用途未在仓库文档中说明；后续任务如涉及它，应先核实再处理。
- 文档生成时 `pnpm build` 已通过；未执行数据库初始化、开发服务或 API 集成测试，因为这些操作会读写本机 PostgreSQL/Redis，后续应在确认隔离环境后执行。

## 11. 跨窗口工作交接模板

每次完成任务后建议在本文件末尾或独立任务记录中追加：

```text
### YYYY-MM-DD / 任务标题
- 目标：
- 已修改：绝对路径列表
- 行为变化：
- 数据库/环境变量变化：
- 权限/安全影响：
- 已验证：命令 + 结果
- 未验证/阻塞：
- 下一步：
```

## 12. AI 工作指引

开始任何新任务时，先读取本文件、`README.md`、目标模块源码和 `git status`；先确认当前产品范围，再设计改动。不要因为历史代码、构建产物或搜索结果出现旧模块名称就恢复已删除功能。完成后必须复查所有改动文件，运行可行的构建/测试，并更新“当前 Git 状态”“已知风险”或交接记录中的相关内容。

## 13. 最近交接记录

### 2026-08-12 / 生成项目上下文文档

- 目标：梳理当前项目信息，形成可跨窗口追踪的 AI 上下文。
- 已修改：`E:\gitee\project-mesh\AI-Content.md`。
- 行为变化：无业务代码或运行时行为变化。
- 数据库/环境变量变化：无。
- 权限/安全影响：无；文档未记录本机密码或真实业务密钥。
- 已验证：`git diff --check` 通过；`pnpm build` 通过（源码/产物样式检查、前后端 TypeScript 编译和 Vite 构建均成功）。
- 未验证：未运行 `pnpm db:setup`、开发服务和 `pnpm test:api`，避免在未确认隔离环境时读写 PostgreSQL/Redis。
- 下一步：后续窗口开始任务前先读取本文档，并在任务结束时更新本节或追加新的交接记录。