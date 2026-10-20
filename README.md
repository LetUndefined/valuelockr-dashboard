# valuelockr-dashboard

Ops dashboard for ValueLockr. Signs in with Supabase Auth; every privileged call goes through the `admin-ops` Edge Function (app repo), which checks an admin allowlist and holds all secrets. **Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in this project's env** — never a service key or token: everything `VITE_*` ships to the browser.
