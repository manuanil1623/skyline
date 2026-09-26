# Skyline Beauty Parlour Accounting & Checkout System

A lightweight two-role accounting system: a **Handler (front desk)** checkout
flow with dynamic UPI QR billing, and an **Admin** dashboard for revenue
reporting, pricing, and staff management.

## Stack
- **Frontend:** React / Next.js + Tailwind CSS, `qrcode.react` for QR generation, `recharts` for charts
- **Backend:** Node.js + Express, deployed separately or as Next.js API routes
- **Database/Auth:** Supabase (Postgres + Auth), Row Level Security enforces RBAC at the DB layer
- **Payments:** Standard UPI deep-link payload (`upi://pay?...`), gateway webhook for auto-verification

## Project layout
```
database/schema.sql          → tables, roles, RLS policies, seed services
backend/middleware/rbac.js   → JWT auth + role-guard middleware
backend/routes/*.js          → services / transactions / dashboard / staff APIs
backend/server.js            → Express app wiring routes together
frontend/components/
  HandlerCheckout.jsx        → front desk screen (service grid, QR, ledger)
  AdminDashboard.jsx         → owner dashboard (revenue, audit log, CRUD)
frontend/lib/supabaseClient.js → shared client + authenticated fetch helper
.env.example                 → all required environment variables
```

## Setup
1. **Supabase:** create a project, run `database/schema.sql` in the SQL editor.
   Set `SALON_UPI_VPA` details later via env vars — the schema doesn't hardcode them.
2. **Backend:** `cd backend && npm install && cp ../.env.example .env` (fill in values) `&& npm run dev`
3. **Frontend:** create a Next.js app, copy `frontend/components` and `frontend/lib` in,
   install `@supabase/supabase-js qrcode.react recharts`, add the same `.env` values
   prefixed `NEXT_PUBLIC_...`, then render `<HandlerCheckout />` on the staff route and
   `<AdminDashboard />` behind an admin-only route guard.
4. **Roles:** the first admin must be created manually (via Supabase dashboard, set
   `role = 'admin'` on their profile row). After that, admins create handler logins
   from the Staff tab (`POST /api/staff`).

## RBAC model
- Enforced **twice**: Express middleware (`requireRole`) blocks the wrong role before
  a request is processed, and Postgres RLS policies block it again at the data layer —
  so even a leaked anon key can't bypass permissions.
- **Handler:** can create bills, confirm QR payments, and see only *their own, today's*
  transactions.
- **Admin:** full read/write on all transactions (search/filter/void/edit), services
  (CRUD), and staff accounts (create/deactivate/reassign roles).

## QR payment flow
1. Handler builds the bill → taps **UPI/QR Payment** → `POST /api/transactions`
   creates a `pending` transaction and returns a UPI payload sized to the exact total.
2. Screen shows **"Awaiting Confirmation"** with the QR rendered client-side.
3. Resolves one of two ways:
   - Handler taps **Confirm Payment** once they see it land → `POST /:id/confirm`
   - Payment gateway calls the webhook → `POST /api/transactions/webhooks/upi-confirm`
     (verify the provider's signature before trusting it — see the placeholder in the code)
