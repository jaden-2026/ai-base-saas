# SkillPort AI

[English](./README.en.md) | **简体中文**

面向企业的多租户 AI 模型资源管理平台。SkillPort AI 集中管理模型服务商、模型目录和访问凭证，并通过租户、角色权限、套餐订阅与审计能力提供统一治理。

参考项目平台：https://www.zhihu.com/project/detail/60350

体验地址：https://43.139.33.247/  

> 当前版本：`1.2.1`
>
> 本项目采用修改版 Apache License 2.0。该协议包含多租户运营及前端 LOGO/版权信息方面的附加条件，使用前请完整阅读 [LICENSE](./LICENSE)。

## 核心能力

- **模型服务商管理**：接入 OpenAI-compatible、Anthropic-compatible、Ollama 和自定义服务，支持连接检测、模型发现、启停和租户级配置。
- **统一模型目录**：管理语言、Embedding、重排序、图像等模型，并按服务商、分类和可用状态筛选。
- **API Key 管理**：创建、编辑和撤销租户凭证，服务端仅保存密钥哈希，并支持权限范围与有效期配置。
- **多租户与权限治理**：管理租户生命周期、成员、角色、RBAC、品牌配置和操作审计。
- **订阅与支付运营**：管理套餐、订阅、用量和支付订单，并配置 Stripe、微信支付或手工支付渠道。
- **平台配置**：集中维护业务字典、工作空间信息、安全策略和通知渠道。
- **安全设计**：验证码登录、服务端会话、租户数据边界、供应商密钥加密存储和细粒度权限校验。

> **当前功能边界：** 项目仅保留系统设置、字典配置、模型服务商、模型列表、订阅与套餐、支付订单、租户与成员以及 API Key 管理。数据库初始化会幂等移除旧项目遗留的数据表。

## 技术栈

| 层级 | 技术 |
|---|---|
| Web | React、TypeScript、Vite、Lucide React |
| API | Node.js、Fastify、Zod |
| 数据 | PostgreSQL、Redis、本地上传目录 |
| 工程化 | pnpm、tsx、TypeScript Project References |

## 快速开始

### 环境要求

- Node.js 22 或兼容的当前 LTS 版本
- pnpm 11（仓库声明版本为 `11.10.0`）
- PostgreSQL 14+
- Redis 6+

### 1. 安装依赖

```bash
git clone <your-repository-url>
cd project-mesh
corepack enable
pnpm install
```

### 2. 配置环境变量

复制示例文件，并只在本地 `.env` 中填写真实配置：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

开发环境至少应核对以下变量：

| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | 应用数据库连接地址 |
| `POSTGRES_ADMIN_URL` | 仅供 `pnpm db:setup` 创建数据库使用 |
| `REDIS_URL` | Redis 连接地址 |
| `APP_URL` | 浏览器访问来源，开发环境默认为 `http://localhost:5173` |
| `APP_SECRET` | 服务端加密密钥；生产环境必须使用随机且安全保存的值 |
| `SEED_OWNER_EMAIL` | 初始化超级管理员邮箱；本地演示值为 `admin@skillport.local` |
| `SEED_OWNER_PASSWORD` | 初始化超级管理员密码；本地演示值为 `SkillPort@123456`，长度须为 8–128 个字符 |

Stripe、微信支付等变量仅在启用对应支付渠道时配置。模型供应商地址和密钥可在平台中按租户维护，不应写入源码或提交到 Git。

### 3. 启动 PostgreSQL 与 Redis

确保 `.env` 中的数据库管理员连接、应用数据库连接和 Redis 地址均可访问。初始化程序会创建名为 `skillport_ai` 的数据库；运行初始化后，应从长期运行环境中移除 `POSTGRES_ADMIN_URL`。

### 4. 初始化数据库

```bash
pnpm db:setup
```

该命令会创建数据库、应用 `db/schema.sql`，并幂等写入基础权限、角色和平台所有者数据。

### 5. 启动开发环境

```bash
pnpm dev
```

- Web：<http://localhost:5173>
- API：<http://localhost:3001>
- 健康检查：<http://localhost:3001/api/health>

复制 `.env.example` 后可使用以下超级管理员凭据登录：

- 账号：`admin@skillport.local`
- 密码：`SkillPort@123456`

> **安全警告：** 以上是公开的本地演示凭据，仅限本地开发。共享、测试或生产部署前，必须在首次执行 `pnpm db:setup` 前修改 `SEED_OWNER_EMAIL` 和 `SEED_OWNER_PASSWORD`；切勿在生产环境使用该演示密码。

前后端也可分别通过 `pnpm dev:web` 和 `pnpm dev:api` 启动。

## 构建与运行

```bash
# 类型检查、样式检查并构建前后端
pnpm build

# 生产模式运行已构建服务
$env:NODE_ENV = "production" # Windows PowerShell
pnpm start
```

Linux/macOS 可使用 `NODE_ENV=production pnpm start`。生产模式下 Fastify 同时提供 `dist/` 静态文件和 `/api` 接口。建议在应用前部署 HTTPS 反向代理，仅对外暴露 443，并持久化备份 PostgreSQL、Redis 和 `uploads/`。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 同时启动 API 和 Web 开发服务 |
| `pnpm db:setup` | 创建数据库、执行 Schema 并写入种子数据 |
| `pnpm build` | 检查并构建前端与服务端 |
| `pnpm start` | 启动 `server-dist/index.js` |
| `pnpm test:api` | 验证保留页面对应的 API |
| `pnpm check:styles` | 检查源码和产物中的样式约束 |

> API 集成测试会访问 PostgreSQL 和 Redis，请使用隔离的测试环境，不要指向生产数据。

## 目录结构

```text
project-mesh/
├─ src/                 # React 前端、页面与组件
├─ server/              # Fastify API、鉴权、模型管理、支付与测试
├─ db/schema.sql        # PostgreSQL Schema、约束、索引和触发器
├─ scripts/             # 样式检查脚本
├─ dist/                # 前端构建产物（自动生成）
├─ server-dist/         # 服务端构建产物（自动生成）
└─ uploads/             # 本地上传数据（运行时生成，不应提交）
```

功能边界以前端导航、服务端已注册路由和当前种子权限为准。

## 安全与开源前检查

1. **绝不提交凭据**：`.env`、私钥、支付证书、数据库口令、模型 API Key 和平台所有者密码必须保存在密钥管理系统中。
2. **示例值不能用于生产**：替换 `APP_SECRET`、数据库默认口令和所有初始化账号信息。
3. **历史泄露必须轮换**：如果凭据曾进入 Git，即使当前文件已删除，也应先在服务端吊销或轮换，再清洗全部分支、标签、远端引用、缓存、Fork 和 CI 产物。
4. **保护运行数据**：不要提交 `uploads/`、数据库备份、日志、部署产物或本地调试文件。
5. **最小权限部署**：数据库初始化后撤销应用账号的建库权限；限制 Redis 和 PostgreSQL 的网络访问；支付回调必须使用 HTTPS 并验证签名。
6. **公开前扫描**：对当前文件和完整 Git 历史执行 secret scan，并人工复核域名、邮箱、企业资料和内部设计文档。

安全问题请通过仓库维护者提供的私密渠道报告，不要在公开 Issue 中附带可利用的凭据、个人数据或漏洞细节。

## 贡献

1. Fork 仓库并从目标分支创建功能分支。
2. 保持现有 TypeScript、React 和 Fastify 代码风格。
3. 为行为变更补充或更新集成测试和文档。
4. 提交前至少运行 `pnpm build`，并执行与改动相关的测试。
5. 创建 Pull Request，说明改动范围、验证方式及兼容性影响。

## 许可证

本项目采用 Apache License 2.0，并包含以下附加条件：

- 未经 SkillPort AI 书面授权，不得使用本项目源码运营多租户环境。
- 使用 SkillPort AI 前端时，不得移除或修改控制台及应用中的 LOGO 或版权信息。
- 贡献者同意项目方可调整协议，且贡献代码可用于商业用途。

该协议包含 Apache License 2.0 之外的使用限制，因此严格来说属于 source-available 协议，而非 OSI 认证的开源许可证。完整条款以 [LICENSE](./LICENSE) 为准；如需书面授权或商业许可证，请联系作者。

## 作者

- **作者：** jaden.peng
- **电话：** [18210659132](tel:18210659132)
- **邮箱：** [jaden.peng@outlook.com](mailto:jaden.peng@outlook.com)
