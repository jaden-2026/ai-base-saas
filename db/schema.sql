CREATE SCHEMA IF NOT EXISTS app;
SET search_path TO app, public;

-- Remove modules outside the reduced product scope without clearing retained data.
DROP TABLE IF EXISTS app.payment_provider_credentials CASCADE;
DROP TABLE IF EXISTS app.folder_workspace_knowledge_documents CASCADE;
DROP TABLE IF EXISTS app.folder_workspace_skills CASCADE;
DROP TABLE IF EXISTS app.folder_workspace_configs CASCADE;
DROP TABLE IF EXISTS app.knowledge_chunks CASCADE;
DROP TABLE IF EXISTS app.knowledge_index_jobs CASCADE;
DROP TABLE IF EXISTS app.knowledge_collaboration_updates CASCADE;
DROP TABLE IF EXISTS app.knowledge_collaboration_snapshots CASCADE;
DROP TABLE IF EXISTS app.knowledge_error_reports CASCADE;
DROP TABLE IF EXISTS app.knowledge_ratings CASCADE;
DROP TABLE IF EXISTS app.knowledge_comments CASCADE;
DROP TABLE IF EXISTS app.knowledge_reviews CASCADE;
DROP TABLE IF EXISTS app.knowledge_attachments CASCADE;
DROP TABLE IF EXISTS app.knowledge_document_drafts CASCADE;
DROP TABLE IF EXISTS app.knowledge_resource_grants CASCADE;
DROP TABLE IF EXISTS app.knowledge_documents CASCADE;
DROP TABLE IF EXISTS app.knowledge_document_versions CASCADE;
DROP TABLE IF EXISTS app.knowledge_folders CASCADE;
DROP TABLE IF EXISTS app.knowledge_bases CASCADE;
DROP TABLE IF EXISTS app.ai_bot_task_runs CASCADE;
DROP TABLE IF EXISTS app.ai_bot_scheduled_tasks CASCADE;
DROP TABLE IF EXISTS app.ai_bot_channels CASCADE;
DROP TABLE IF EXISTS app.ai_bots CASCADE;
DROP TABLE IF EXISTS app.ai_bot_channel_accounts CASCADE;
DROP TABLE IF EXISTS app.mcp_access_logs CASCADE;
DROP TABLE IF EXISTS app.mcp_service_api_keys CASCADE;
DROP TABLE IF EXISTS app.mcp_services CASCADE;
DROP TABLE IF EXISTS app.chat_message_skills CASCADE;
DROP TABLE IF EXISTS app.chat_messages CASCADE;
DROP TABLE IF EXISTS app.agent_skills CASCADE;
DROP TABLE IF EXISTS app.agents CASCADE;
DROP TABLE IF EXISTS app.project_nodes CASCADE;
DROP TABLE IF EXISTS app.projects CASCADE;
DROP TABLE IF EXISTS app.skill_files CASCADE;
DROP TABLE IF EXISTS app.skill_tenant_grants CASCADE;
DROP TABLE IF EXISTS app.skill_versions CASCADE;
DROP TABLE IF EXISTS app.skill_dictionary_items CASCADE;
DROP TABLE IF EXISTS app.skills CASCADE;

CREATE TABLE IF NOT EXISTS app.migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS app.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(100) NOT NULL, slug varchar(80) NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '', locale varchar(20) NOT NULL DEFAULT 'zh-CN', timezone varchar(50) NOT NULL DEFAULT 'Asia/Shanghai',
  settings jsonb NOT NULL DEFAULT '{}', status varchar(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','archived')),
  valid_from timestamptz NOT NULL DEFAULT now(), valid_until timestamptz, max_members int, brand_logo_path text,
  brand_logo_mime_type varchar(100), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(valid_until IS NULL OR valid_until > valid_from), CHECK(max_members IS NULL OR max_members > 0)
);
CREATE TABLE IF NOT EXISTS app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(255) NOT NULL UNIQUE, name varchar(100) NOT NULL,
  password_hash text NOT NULL, status varchar(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','invited','disabled')),
  last_login_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app.permissions (code varchar(100) PRIMARY KEY, name varchar(100) NOT NULL, category varchar(50) NOT NULL);
CREATE TABLE IF NOT EXISTS app.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  name varchar(60) NOT NULL, description text NOT NULL DEFAULT '', is_system boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,name)
);
CREATE TABLE IF NOT EXISTS app.memberships (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.roles(id), joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE IF NOT EXISTS app.dictionaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  code varchar(80) NOT NULL, name varchar(100) NOT NULL, description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,code)
);
CREATE TABLE IF NOT EXISTS app.dictionary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  dictionary_id uuid NOT NULL REFERENCES app.dictionaries(id) ON DELETE CASCADE, label varchar(100) NOT NULL, value varchar(100) NOT NULL,
  color varchar(20) NOT NULL DEFAULT '#64748b', sort_order int NOT NULL DEFAULT 0, enabled boolean NOT NULL DEFAULT true,
  UNIQUE(dictionary_id,value)
);
CREATE TABLE IF NOT EXISTS app.resource_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  resource_type varchar(20) NOT NULL CHECK(resource_type='model'), name varchar(80) NOT NULL, color varchar(20) NOT NULL DEFAULT '#6366f1',
  description text NOT NULL DEFAULT '', sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,resource_type,name)
);
CREATE TABLE IF NOT EXISTS app.resource_category_assignments (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES app.resource_categories(id) ON DELETE CASCADE,
  resource_type varchar(20) NOT NULL CHECK(resource_type='model'), resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(category_id,resource_type,resource_id)
);
CREATE TABLE IF NOT EXISTS app.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(60) NOT NULL UNIQUE, name varchar(100) NOT NULL,
  description text NOT NULL DEFAULT '', price_cny numeric(12,2) NOT NULL DEFAULT 0, price_usd numeric(12,2) NOT NULL DEFAULT 0,
  billing_period varchar(20) NOT NULL DEFAULT 'month' CHECK(billing_period IN ('month','year')),
  entitlements jsonb NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES app.plans(id), provider varchar(20) NOT NULL DEFAULT 'manual', provider_ref text,
  status varchar(20) NOT NULL DEFAULT 'active', period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL DEFAULT now() + interval '1 month', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES app.plans(id), provider varchar(20) NOT NULL CHECK(provider IN ('stripe','pingpp','wechat','manual')),
  amount numeric(12,2) NOT NULL, currency varchar(3) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled','failed','refunded')),
  provider_ref text, checkout_url text, provider_channel varchar(40), provider_event_id text,
  payment_payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz, cancelled_at timestamptz
);
CREATE TABLE IF NOT EXISTS app.model_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  code varchar(60) NOT NULL, name varchar(100) NOT NULL, base_url text NOT NULL, encrypted_api_key text,
  status varchar(20) NOT NULL DEFAULT 'disconnected' CHECK(status IN ('connected','disconnected','testing','error','paused')),
  is_builtin boolean NOT NULL DEFAULT false, provider_type varchar(20) NOT NULL DEFAULT 'official' CHECK(provider_type IN ('official','relay','local','custom')),
  protocol varchar(20) NOT NULL DEFAULT 'openai' CHECK(protocol IN ('openai','anthropic','ollama','custom')),
  auth_type varchar(20) NOT NULL DEFAULT 'bearer' CHECK(auth_type IN ('bearer','x-api-key','none')),
  config jsonb NOT NULL DEFAULT '{}', last_synced_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,code)
);
CREATE TABLE IF NOT EXISTS app.models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES app.model_providers(id) ON DELETE CASCADE, external_id varchar(150) NOT NULL,
  name varchar(150) NOT NULL, model_category varchar(30) NOT NULL DEFAULT 'language', context_window int NOT NULL DEFAULT 0,
  input_price numeric(16,8) NOT NULL DEFAULT 0, output_price numeric(16,8) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider_id,external_id)
);
CREATE TABLE IF NOT EXISTS app.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.users(id), name varchar(100) NOT NULL, key_prefix varchar(20) NOT NULL,
  key_hash varchar(64) NOT NULL UNIQUE, scopes jsonb NOT NULL DEFAULT '["*"]', last_used_at timestamptz,
  expires_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app.usage_events (
  id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  resource_type varchar(30) NOT NULL, resource_id uuid, api_calls int NOT NULL DEFAULT 1,
  input_tokens int NOT NULL DEFAULT 0, output_tokens int NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS app.audit_logs (
  id bigserial PRIMARY KEY, tenant_id uuid REFERENCES app.tenants(id) ON DELETE SET NULL,
  user_id uuid REFERENCES app.users(id) ON DELETE SET NULL, action varchar(100) NOT NULL,
  resource_type varchar(50) NOT NULL, resource_id text, ip inet, details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app.wechat_pay_credentials (
  tenant_id uuid PRIMARY KEY REFERENCES app.tenants(id) ON DELETE CASCADE, app_id varchar(64) NOT NULL,
  merchant_id varchar(32) NOT NULL, merchant_serial_no varchar(128) NOT NULL, encrypted_private_key text NOT NULL,
  encrypted_api_v3_key text NOT NULL, wechat_pay_public_key_id varchar(128) NOT NULL,
  encrypted_wechat_pay_public_key text NOT NULL, notify_url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app.channel_notification_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES app.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES app.users(id) ON DELETE CASCADE,
  channel_type varchar(30) NOT NULL CHECK(channel_type IN ('feishu','lark','dingtalk','notion','wecom','wechat_official','web','personal_wechat')),
  name varchar(120) NOT NULL, public_config jsonb NOT NULL DEFAULT '{}', encrypted_secret_config text,
  callback_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

DELETE FROM app.resource_category_assignments WHERE resource_type<>'model';
DELETE FROM app.resource_categories WHERE resource_type<>'model';

CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_notification_member ON app.channel_notification_accounts(tenant_id,user_id,channel_type) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_notification_tenant ON app.channel_notification_accounts(tenant_id,channel_type) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_models_tenant_category ON app.models(tenant_id,model_category);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_type ON app.resource_categories(tenant_id,resource_type,sort_order,name);
CREATE INDEX IF NOT EXISTS idx_category_assignments_resource ON app.resource_category_assignments(tenant_id,resource_type,resource_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_provider_ref ON app.payment_orders(provider,provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_orders_tenant_created ON app.payment_orders(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_time ON app.usage_events(tenant_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON app.audit_logs(tenant_id,created_at DESC);
INSERT INTO app.migrations(version) VALUES ('002_reduced_scope') ON CONFLICT DO NOTHING;