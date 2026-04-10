# Kitna – Money Clarity Dashboard for Indian Creators

**"Kitna aaya, kitna gaya?"** (How much came in, how much went out?)

A full-stack production MVP for Instagram influencers, YouTubers, UGC creators and their managers to track deals, payments, expenses, receivables, and profit.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TailwindCSS + Recharts + Wouter |
| Backend | Express 5 + Drizzle ORM |
| Database | PostgreSQL (Replit built-in) |
| API Codegen | Orval (OpenAPI → React Query hooks + Zod schemas) |
| Monorepo | pnpm workspaces |

## Architecture

```
/
├── artifacts/
│   ├── kitna/           # React+Vite frontend (port 18869, proxied to /)
│   └── api-server/      # Express API server (port 8080, proxied to /api)
├── lib/
│   ├── db/              # Drizzle ORM schema + migrations
│   ├── api-spec/        # OpenAPI spec (openapi.yaml)
│   └── api-client-react/ # Generated React Query hooks (orval)
└── scripts/             # Seed script and utilities
```

## Key Files

- `artifacts/kitna/src/App.tsx` — React app entry point, routing, auth setup
- `artifacts/kitna/src/contexts/AuthContext.tsx` — JWT auth state management
- `artifacts/kitna/src/lib/api.ts` — `apiFetch` wrapper (used for auth endpoints)
- `artifacts/kitna/src/pages/` — 10 pages: Dashboard, Deals, Payments, Expenses, Receivables, Profit, Activity, Compliance, Settings, Login/Signup
- `artifacts/kitna/src/components/SmartAddModal.tsx` — Smart Add modal: 3 tabs (Screenshot, Import CSV, Email)
- `artifacts/kitna/src/lib/assist.ts` — Fetch helpers for Smart Add API endpoints
- `artifacts/api-server/src/routes/assist.ts` — Smart Add routes: image extraction, CSV import, draft management
- `artifacts/api-server/src/routes/` — Express routes: auth, deals, payments, expenses, dashboard, assist, compliance
- `artifacts/api-server/src/lib/auth.ts` — JWT auth with DB-persisted tokens
- `lib/db/src/schema/` — Drizzle tables: users, deals, payments, expenses, tokens, extraction_drafts
- `lib/integrations-openai-ai-server/` — OpenAI client via Replit AI Integrations proxy
- `lib/api-spec/openapi.yaml` — Full OpenAPI 3.0 spec

## Auth Flow

- JWT tokens stored in PostgreSQL `tokens` table (persist across server restarts)
- Token stored in browser `localStorage` under key `kitna_token`
- `setAuthTokenGetter()` configured at app startup so all generated React Query hooks automatically include `Authorization: Bearer <token>`
- `apiFetch` (in `lib/api.ts`) used for auth routes; generated hooks used for data routes

## Database Schema

- `users` — id, name, email, password_hash, role (creator/manager), currency
- `deals` — id, user_id, brand_name, campaign_name, income_type, amount_agreed, currency, status, is_barter, barter_estimated_value, barter_description, start_date, due_date, notes, invoice_number, invoice_date, invoice_status, invoice_amount, manager_cut_type, manager_cut_value, agency_cut_type, agency_cut_value, gst_applicable, taxable_value, tds_applicable, tds_amount
- `payments` — id, user_id, deal_id (nullable), amount_received, currency, payment_method, received_date, notes, tds_applicable, tds_amount
- `expenses` — id, user_id, deal_id (nullable), title, category, amount, currency, expense_date, notes, is_recurring, recurring_frequency, vendor_or_payee
- `tokens` — id, user_id, token (unique), created_at

## Demo Credentials

- Email: `demo@kitna.app`
- Password: `demo1234`
- User: Aanya Sharma (creator, INR)

## Seed Data

8 deals covering: Mamaearth (paid), Boat Lifestyle (partially_paid), Amazon affiliate (paid), YouTube AdSense (paid), Vedix retainer (pending), Nykaa barter (paid), Mivi UGC (overdue), WOW Skin (active)

4 payments totaling ₹2,25,000

8 expenses: editing, travel, manager commission, equipment, software, styling, ads

## Income Types

`brand_collab`, `ugc`, `affiliate`, `platform_payout`, `retainer`, `subscription`, `barter`, `other`

## Deal Status

`draft` → `active` → `pending_payment` → `partially_paid`/`paid`/`overdue`/`cancelled`

## Design System

- Dark sidebar: `#0F172A` (slate-900)
- Green accent: `#22C55E` (green-500)
- Currency: INR with ₹ symbol
- No emojis in UI
- Status badges color-coded: paid=green, overdue=red, active=blue, pending=orange, partial=yellow, barter=purple
