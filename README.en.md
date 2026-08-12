# SkillPort AI

**English** | [简体中文](./README.md)

An enterprise-oriented, multi-tenant platform for managing AI model resources. SkillPort AI centralizes model providers, model catalogs, and access credentials, with unified governance through tenants, role-based access control, subscriptions, and auditing.

> Current version: `1.2.1`
>
> This project uses a modified Apache License 2.0 . It includes additional conditions concerning multi-tenant operation and frontend LOGO/copyright information. Read [LICENSE](./LICENSE) in full before use.

## Key Capabilities

- **Model provider management**: connect OpenAI-compatible, Anthropic-compatible, Ollama, and custom services, with connection checks, model discovery, enable/disable controls, and tenant-scoped configuration.
- **Unified model catalog**: manage language, embedding, reranking, image, and other models, filtered by provider, category, and availability.
- **API key management**: create, edit, and revoke tenant credentials. The server stores only key hashes and supports scopes and expiration dates.
- **Multi-tenancy and access governance**: manage tenant lifecycles, members, roles, RBAC, branding, and operation auditing.
- **Subscriptions and payments**: manage plans, subscriptions, usage, and payment orders, with Stripe, WeChat Pay, or manual payment channel configuration.
- **Platform configuration**: centrally maintain business dictionaries, workspace information, security policies, and notification channels.
- **Security controls**: CAPTCHA login, server-side sessions, tenant data boundaries, encrypted provider keys, and fine-grained permission checks.

> **Current scope:** The project retains only system settings, dictionaries, model providers, model lists, subscriptions and plans, payment orders, tenants and members, and API key management. Database setup idempotently removes tables left by the source project.

## Technology Stack

| Layer | Technologies |
|---|---|
| Web | React, TypeScript, Vite, Lucide React |
| API | Node.js, Fastify, Zod |
| Data | PostgreSQL, Redis, local upload directory |
| Tooling | pnpm, tsx, TypeScript Project References |

## Quick Start

### Prerequisites

- Node.js 22 or a compatible current LTS release
- pnpm 11 (the repository declares `11.10.0`)
- PostgreSQL 14+
- Redis 6+

### 1. Install Dependencies

```bash
git clone <your-repository-url>
cd project-mesh
corepack enable
pnpm install
```

### 2. Configure Environment Variables

Copy the example file and put real values only in your local `.env`:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Review at least these variables for development:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Application database connection |
| `POSTGRES_ADMIN_URL` | Used only by `pnpm db:setup` to create the database |
| `REDIS_URL` | Redis connection |
| `APP_URL` | Browser-facing origin; defaults to `http://localhost:5173` in development |
| `APP_SECRET` | Server encryption secret; production requires a random, securely stored value |
| `SEED_OWNER_EMAIL` | Initial super administrator email; local demo value: `admin@skillport.local` |
| `SEED_OWNER_PASSWORD` | Initial super administrator password; local demo value: `SkillPort@123456`, 8–128 characters |

Stripe and WeChat Pay variables are needed only when their payment channels are enabled. Model provider URLs and keys can be maintained per tenant in the platform; never put them in source code or commit them to Git.

### 3. Start PostgreSQL and Redis

Make sure the database administrator connection, application database connection, and Redis address in `.env` are reachable. Setup creates a database named `skillport_ai`. Remove `POSTGRES_ADMIN_URL` from the long-running application environment after initialization.

### 4. Initialize the Database

```bash
pnpm db:setup
```

This creates the database, applies `db/schema.sql`, and idempotently seeds base permissions, roles, and the platform owner.

### 5. Start Development

```bash
pnpm dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:3001>
- Health check: <http://localhost:3001/api/health>

After copying `.env.example`, sign in with these super administrator credentials:

- Account: `admin@skillport.local`
- Password: `SkillPort@123456`

> **Security warning:** These are public local-demo credentials and must only be used for local development. Before running `pnpm db:setup` for the first time in any shared, test, or production deployment, change both `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD`. Never use this demo password in production.

You can also run the two sides separately with `pnpm dev:web` and `pnpm dev:api`.

## Build and Run

```bash
# Type-check, validate styles, and build the frontend and backend
pnpm build

# Run the compiled service in production mode
$env:NODE_ENV = "production" # Windows PowerShell
pnpm start
```

On Linux/macOS, use `NODE_ENV=production pnpm start`. In production mode, Fastify serves both the `dist/` static files and `/api`. Put an HTTPS reverse proxy in front of the application, expose only port 443, and persistently back up PostgreSQL, Redis, and `uploads/`.

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the API and Web development servers |
| `pnpm db:setup` | Create the database, apply the schema, and seed data |
| `pnpm build` | Validate and build the frontend and backend |
| `pnpm start` | Start `server-dist/index.js` |
| `pnpm test:api` | Validate the APIs used by retained pages |
| `pnpm check:styles` | Validate style constraints in source and build output |

> The API integration test accesses PostgreSQL and Redis. Use an isolated test environment and never point it at production data.

## Repository Layout

```text
project-mesh/
├─ src/                 # React frontend, pages, and components
├─ server/              # Fastify API, auth, model management, payments, and tests
├─ db/schema.sql        # PostgreSQL schema, constraints, indexes, and triggers
├─ scripts/             # Style validation script
├─ dist/                # Generated frontend output
├─ server-dist/         # Generated server output
└─ uploads/             # Runtime local uploads; never commit this directory
```

Treat the frontend navigation, registered server routes, and current seed permissions as the source of truth for product scope.

## Security and Pre-Open-Source Checklist

1. **Never commit credentials**: keep `.env`, private keys, payment certificates, database passwords, model API keys, and platform owner passwords in a secrets manager.
2. **Do not use examples in production**: replace `APP_SECRET`, default database passwords, and all seed account details.
3. **Rotate anything exposed in history**: if a secret ever entered Git, deleting the current file is insufficient. Revoke or rotate it first, then clean every branch, tag, remote ref, cache, fork, and CI artifact.
4. **Protect runtime data**: do not commit `uploads/`, database backups, logs, deployment artifacts, or local debug files.
5. **Deploy with least privilege**: remove database creation privileges from the application account after setup, restrict Redis and PostgreSQL network access, and require HTTPS plus signature validation for payment callbacks.
6. **Scan before publication**: secret-scan both the working tree and complete Git history, then manually review domains, email addresses, organization details, and internal design documents.

Report security issues through a private channel provided by the maintainers. Do not include exploitable credentials, personal data, or vulnerability details in a public issue.

## Contributing

1. Fork the repository and create a feature branch from the intended target branch.
2. Follow the existing TypeScript, React, and Fastify conventions.
3. Add or update integration tests and documentation for behavior changes.
4. Run at least `pnpm build` and all tests relevant to your changes.
5. Open a Pull Request describing the scope, validation performed, and compatibility impact.

## License

This project uses a modified Apache License 2.0 following the same model as [Dify](https://github.com/langgenius/dify), with these additional conditions:

- You may not use the SkillPort AI source code to operate a multi-tenant environment without written authorization from SkillPort AI.
- When using the SkillPort AI frontend, you may not remove or modify the LOGO or copyright information in the console or applications.
- Contributors agree that the producer may adjust the license and may use contributed code commercially.

Because it imposes restrictions beyond Apache License 2.0, this is technically a source-available license rather than an OSI-approved open-source license. See [LICENSE](./LICENSE) for the complete terms. Contact the author for written authorization or a commercial license.

## Author

- **Author:** jaden.peng
- **Phone:** [18210659132](tel:18210659132)
- **Email:** [jaden.peng@outlook.com](mailto:jaden.peng@outlook.com)
