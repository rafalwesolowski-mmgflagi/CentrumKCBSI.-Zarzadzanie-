# AI Project Hub — Centrum

A web-based project management application with an AI Copilot, built with React, Vite, TypeScript, Tailwind CSS, and Supabase.

## Features

### Project Management
- **Dashboard** — portfolio overview with risk summary, deadline importance scores, and project health indicators
- **Gantt** — lightweight timeline view built on Supabase data; phases and tasks plotted against a scrollable calendar
- **Kanban** — drag-free board across `backlog → in_progress → review → done` columns
- **Tasks** — filterable task list with priority, impact, risk status, and due date; supports notes and image attachments
- **Notes** — project folder notes with urgent/non-urgent marking
- **Today / Weekly** — focused views showing tasks due today or within the current week
- **Workload** — per-assignee workload summary across active projects
- **Mind Map** — interactive visual map of project relationships
- **CRM** — client relationship view for project customers, with contact details, stage, pipeline value, next follow-up, notes, and Excel export
- **CRM client card** (`/crm/client/:id`) — full customer card: company details (website, address, NIP, price group, bank account, next contact date and reminder, invoice note, CC e-mails, reminder language, delivery addresses), contact people, and an activity timeline with tabs for files, e-mails, notes, sales opportunities, invoices, offers, orders, warehouse documents, reminders, calls, meetings and change history; tabs can be pinned or hidden; previous/next client navigation
- **CRM contacts** (`/crm/contacts`) — all contact people across clients with search, position and client filters, sorting, multi-select, copy e-mails and CSV export. Requires migrations `202610170001_crm_client_card.sql` and `202610220001_crm_client_card_delivery.sql`

### Business Designer
- **Business Canvas** — 10-section lean canvas (Customer Segments, Problem, Solution, Unique Value, Channels, Revenue, Costs, Key Metrics, Advantage, Experiments)
- **Visual Business Map** — drag-and-drop node canvas; supports nodes of type: business, project, area, goal, task, risk, segment, problem, solution, channel, revenue, cost, metric, experiment, note; nodes can be linked with labeled edges
- **AI Business Analysis** — Claude-powered analysis of a canvas via the `ai-business-analyze` Edge Function; results injected back into the canvas

### AI Copilot
- **AI Quick Add** (`ai-quick-add` Edge Function) — describe a project in natural language; Claude generates a full project draft (phases, tasks, risks) which must be explicitly approved before saving
- **Portfolio Scan** (`ai-portfolio-scan` Edge Function) — scans all user projects and returns risks, upcoming deadlines, resource conflicts, and actionable proposals; no changes are made automatically
- **Copilot Panel** — persistent side panel for conversation with Claude about the current project context

### MCP Server (`centrum-mcp`)
A Supabase Edge Function exposing an MCP-compatible Streamable HTTP endpoint. Supports the following tools:

| Tool | Description |
|------|-------------|
| `get_portfolio` | Portfolio state: priorities, overdue tasks, project health, workload |
| `list_projects` | All active projects with name, status, and strategic goal |
| `create_task` | Add a task to a project by name |
| `complete_task` | Mark a task as done |

Use with any MCP-compatible client (Claude Code, Claude Desktop, etc.) by pointing it at `https://<project>.supabase.co/functions/v1/centrum-mcp`.

### WhatsApp Control Assistant
The `whatsapp-assistant` Edge Function is a lightweight command router for AI Project Hub. It can receive Twilio WhatsApp webhooks or test JSON payloads, classify the message with Claude, then execute project actions server-side:

- portfolio brief and priority list
- active project list
- task search
- task creation
- marking tasks as done
- sending an existing task to Google Calendar through the configured n8n fallback workflow

### Google Calendar & Gmail Integration
Users can connect their Google account from the account card in the sidebar. When a Google token is active, clicking the calendar icon next to a task:

1. Creates an all-day event in the user's primary Google Calendar
2. Sends a reminder email via Gmail API
3. Records the audit trail in `task_calendar_notifications` with workflow `google-user-api`

If no Google token is present, the function falls back to posting to the configured n8n webhook (`n8n-google-calendar` workflow).

### n8n Fallback Webhook
A ready-to-import n8n workflow is included at `docs/n8n-task-calendar-workflow.json`. Import it in n8n, wire up Google Calendar OAuth2 credentials in the `Create Google Calendar event` node, activate, then copy the production webhook URL.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions in Deno) |
| AI | Anthropic Claude (server-side only via Edge Functions) |
| Auth | Supabase Auth with Google OAuth2 (calendar + Gmail scopes) |
| Deployment | Vercel (frontend), Supabase Cloud (backend) |
| Analytics | Vercel Analytics |

---

## Local Setup

### Prerequisites
- Node.js 20+
- Supabase CLI (`npm i -g supabase`)
- A Supabase project in the EU region

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### 3. Run the dev server

```bash
npm run dev
```

---

## Supabase Setup

### 1. Run migrations

```bash
supabase db push
```

Migrations in `supabase/migrations/` (apply in order):

| File | Description |
|------|-------------|
| `202604300001_ai_project_hub.sql` | Core schema: projects, phases, tasks, ai_sessions |
| `202604300002_project_tags_subprojects.sql` | Tags array and parent project FK |
| `202604300003_validate_project_parent.sql` | Trigger: prevent circular parent references |
| `202604300004_task_notes.sql` | Notes column on tasks |
| `202604300005_project_areas.sql` | Areas array on projects |
| `202604300006_task_area.sql` | Area column on tasks |
| `202604300007_project_goal.sql` | Strategic goal column on projects |
| `202604300008_task_recurrence.sql` | Recurrence rule column on tasks |
| `202604300009_task_completed_at.sql` | Completed timestamp on tasks |
| `202604300010_task_calendar_notifications.sql` | Calendar notification audit log |
| `202604300011_google_user_integrations.sql` | Per-user Google OAuth token storage |
| `202605080001_business_designs.sql` | Business canvas designs |
| `202605080002_business_visual_map.sql` | Visual map nodes and links |
| `202605080003_ai_business_analysis_mode.sql` | AI analysis mode column |
| `202605080004_task_images.sql` | Task image attachments |
| `202506170001_project_finance.sql` | Project budget, invoicing, paid, cost, and currency fields |
| `202606240001_crm_clients.sql` | CRM clients linked to projects |
| `202606240002_project_notes.sql` | Project notes saved into project folders with urgent flag |

### 2. Enable Google OAuth in Supabase Auth

In Google Cloud Console, create an OAuth2 Client and add these scopes:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/gmail.send`

Add the Supabase Auth callback URL as an authorized redirect URI and your app URL as an authorized origin.

### 3. Set Edge Function secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-20250514
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=...
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=...
supabase secrets set GOOGLE_OAUTH_REDIRECT_URL=https://<project>.supabase.co/functions/v1/google-oauth-callback
supabase secrets set APP_URL=https://<your-app>.vercel.app
supabase secrets set N8N_TASK_CALENDAR_WEBHOOK_URL=https://<n8n>/webhook/...
supabase secrets set ALLOWED_ORIGINS=https://<your-app>.vercel.app,http://localhost:5173
```

`ALLOWED_ORIGINS` is optional but recommended in production. If unset, Edge Functions use `Access-Control-Allow-Origin: *`.

For the MCP server, additionally set:

```bash
supabase secrets set AI_READ_API_KEY=<strong-random-key>
supabase secrets set AI_READ_USER_ID=<supabase-user-uuid>
```

For the WhatsApp assistant, set:

```bash
supabase secrets set WHATSAPP_ASSISTANT_API_KEY=<strong-random-key>
supabase secrets set WHATSAPP_ASSISTANT_USER_ID=<supabase-user-uuid>
```

If these are not set, `whatsapp-assistant` falls back to `AI_READ_API_KEY` and `AI_READ_USER_ID`.

### 4. Deploy Edge Functions

```bash
supabase functions deploy ai-quick-add
supabase functions deploy ai-portfolio-scan
supabase functions deploy ai-business-analyze
supabase functions deploy centrum-mcp
supabase functions deploy google-oauth-start
supabase functions deploy google-oauth-callback --no-verify-jwt
supabase functions deploy google-integration-status
supabase functions deploy task-calendar-notify
supabase functions deploy portfolio-api
supabase functions deploy whatsapp-assistant --no-verify-jwt
```

---

## MCP Server

Connect any MCP-compatible client to:

```
https://<project>.supabase.co/functions/v1/centrum-mcp
```

For Claude Code, add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "centrum": {
      "type": "http",
      "url": "https://<project>.supabase.co/functions/v1/centrum-mcp",
      "headers": {
        "Authorization": "Bearer <AI_READ_API_KEY>"
      }
    }
  }
}
```

---

## n8n Workflow

1. In n8n go to **Import from File** and select `docs/n8n-task-calendar-workflow.json`
2. Open the `Create Google Calendar event` node and attach your Google Calendar OAuth2 credentials
3. Activate the workflow
4. Copy the production webhook URL and set it in Supabase:

```bash
supabase secrets set N8N_TASK_CALENDAR_WEBHOOK_URL=https://<n8n>/webhook/ai-project-hub/task-calendar
supabase functions deploy task-calendar-notify
```

---

## WhatsApp Assistant

Deploy:

```bash
supabase functions deploy whatsapp-assistant --no-verify-jwt
```

Twilio WhatsApp webhook URL:

```text
https://<project>.supabase.co/functions/v1/whatsapp-assistant?apikey=<WHATSAPP_ASSISTANT_API_KEY>
```

Set it as the inbound message webhook for your Twilio WhatsApp sender. The function returns TwiML for Twilio form payloads.

Local/test JSON call:

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/whatsapp-assistant" \
  -H "Authorization: Bearer <WHATSAPP_ASSISTANT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"message":"status"}'
```

Useful WhatsApp commands:

```text
status
priorytety na 7 dni
projekty
znajdź zadanie faktura
dodaj zadanie do AI Project Hub: test integracji na 2026-07-05
oznacz faktura jako zrobione
wrzuć faktura do kalendarza
```

### Webhook payload schema

```json
{
  "eventType": "task.calendar_request",
  "requestId": "uuid",
  "source": "ai-project-hub",
  "task": {
    "id": "uuid",
    "name": "Task name",
    "dueDate": "YYYY-MM-DD",
    "priority": "high",
    "impact": "strategic"
  },
  "project": {
    "id": "uuid",
    "name": "Project name",
    "color": "#57c7ff"
  },
  "calendar": {
    "title": "Task name",
    "date": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "allDay": true,
    "timezone": "Europe/Oslo",
    "description": "Event description"
  }
}
```

Minimal workflow: `Webhook` → `Google Calendar: Create Event` → `Respond to Webhook`

Field mapping: `summary = calendar.title`, `description = calendar.description`, `start.date = calendar.date`, `end.date = calendar.endDate`

---

## Data Model

### Core entities

```
projects
  id, user_id, name, color, status, tags[], areas[], parent_project_id, goal, created_at

phases
  id, project_id, name, start_date, end_date, order_index

tasks
  id, phase_id, project_id, name, status, due_date, priority, impact,
  deadline_importance, risk_status, area, assignee, notes, recurrence,
  completed_at, created_at

task_images
  id, task_id, user_id, file_name, mime_type, size_bytes, data_url, created_at

crm_clients
  id, user_id, project_id, company, contact_name, email, phone, stage,
  value, currency, next_follow_up, notes, created_at, updated_at

project_notes
  id, user_id, project_id, title, body, is_urgent, created_at, updated_at
```

### Business Designer entities

```
business_designs
  id, user_id, project_id, title, canvas (jsonb), visual_map (jsonb), notes, created_at, updated_at
```

### Integration entities

```
google_user_integrations
  user_id, access_token, refresh_token, expires_at, scope, created_at, updated_at

task_calendar_notifications
  id, user_id, task_id, status, workflow, request_json, response_json, error_message,
  created_at, completed_at
```

### Enums

| Type | Values |
|------|--------|
| `ProjectStatus` | `on_track`, `in_progress`, `at_risk`, `paused`, `done` |
| `TaskStatus` | `backlog`, `in_progress`, `review`, `done` |
| `TaskPriority` | `low`, `medium`, `high`, `critical` |
| `TaskImpact` | `low`, `medium`, `high`, `strategic` |
| `RiskStatus` | `none`, `watch`, `risk`, `blocked` |
| `CRMClientStage` | `lead`, `qualified`, `active`, `follow_up`, `paused`, `closed` |

### Deadline importance score

Calculated server-side in the `centrum-mcp` function and stored on tasks:

```
score = priority_weight × 2 + impact_weight × 2 + proximity_weight
```

Where proximity is: ≤1 day → 5, ≤7 days → 4, ≤14 days → 3, ≤30 days → 2, else 1.

Risk status is derived: score ≥ 18 → `blocked`, ≥ 14 → `risk`, ≥ 10 → `watch`, else `none`.

---

## Security

- All data is protected by Supabase Row-Level Security (RLS); users can only access their own records
- Claude API key is stored only as a Supabase secret and never exposed to the frontend
- Google OAuth tokens are stored encrypted in `google_user_integrations` and never sent to the client
- Edge Functions validate the Supabase JWT on every request before touching the database
- `ALLOWED_ORIGINS` restricts CORS to your domains in production

---

## Verification

After installing dependencies, run:

```bash
npm run build
npm run lint
```
