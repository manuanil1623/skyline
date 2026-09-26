# frontend-app — drop-in files

These files are meant to be copied into a Next.js project created with:
```
npx create-next-app@latest frontend-app
cd frontend-app
npm install @supabase/supabase-js qrcode.react recharts
```
(Answer: TypeScript No, ESLint Yes, Tailwind Yes, src/ dir No, App Router Yes)

## What to copy where
Copy these folders/files into your `frontend-app`, overwriting what's already there:
- `app/page.jsx`
- `app/login/page.jsx`
- `app/checkout/page.jsx`
- `app/admin/page.jsx`
- `lib/supabaseClient.js`
- `lib/useProfile.js`
- `components/HandlerCheckout.jsx`
- `components/AdminDashboard.jsx`

## Environment variables
Copy `.env.local.example` to `.env.local` inside `frontend-app` and fill in the same
Supabase URL/anon key you used in the backend's `.env`, plus your backend's URL
(`http://localhost:4000` while running locally).

## Run it
```
npm run dev
```
Visit `http://localhost:3000` — it'll redirect you to `/login`.

Sign in with the admin account you created in Supabase (Authentication → Users,
with `role` set to `admin` in the `profiles` table). You should land on `/admin`
and see live data pulled through your Express API. Any handler account you create
later from the Staff tab will land on `/checkout` instead.

## How the pieces connect
`app/login/page.jsx` → Supabase Auth (`signInWithPassword`) → reads the `profiles`
row for role → redirects to `/checkout` or `/admin`.

`lib/useProfile.js` → runs on every gated page, confirms there's a live session and
resolves the role, so `/admin` can block non-admins client-side (the real
enforcement is still your Express `requireRole` middleware + Postgres RLS — this
hook is just for a clean redirect instead of a raw 403 in the UI).

`lib/supabaseClient.js`'s `apiFetch()` → attaches the Supabase session's JWT as a
Bearer token on every call to your Express backend, which is what `requireAuth`
in `backend/middleware/rbac.js` expects.
