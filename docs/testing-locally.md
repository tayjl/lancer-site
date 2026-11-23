# Testing locally with a login

The site only has a Discord button, so for local testing you sign in from the browser console with a seed account. These accounts exist only in the local database (`supabase/seed.sql`), never on the hosted project.

## 1. Start everything
1. Start Docker Desktop (`%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`) and wait until `docker info` answers.
2. In the project folder, run:
   ```
   npm run local
   ```
   This starts the local database and the site on **http://localhost:5174**.
3. If it says "db container is not ready: starting", run it again.
4. If a page fails with a missing function (404), the local database is behind. Run:
   ```
   npx supabase migration up
   ```

## 2. Sign in (browser console)
Open http://localhost:5174, press F12, choose the Console tab, paste one line, then reload the page.

**GM:**
```js
(await import('/src/lib/supabaseClient.ts')).supabase.auth.signInWithPassword({ email: 'test-gm@hor-os.local', password: 'local-test-gm' })
```

**Player:**
```js
(await import('/src/lib/supabaseClient.ts')).supabase.auth.signInWithPassword({ email: 'test-pilot@hor-os.local', password: 'local-test-pilot' })
```

`window.supabase` is not available, so the `import(...)` is needed. To switch accounts, sign out first:
```js
(await import('/src/lib/supabaseClient.ts')).supabase.auth.signOut()
```

## 3. Useful pages
- Pithub: http://localhost:5174/pithub (GMs see drafts, `[ new file ]` and `[ edit file ]`)
- Lore: http://localhost:5174/lore

## Other commands
- `npm run dev` (port 5173) uses the hosted database, so you need a real Discord login.
- `npm test`, `npm run build` (also the typecheck), `npx supabase test db`.
- Owner-only pages (content editor) need an owner account. The seed has none: set a profile's role to `owner` in the local Studio (http://127.0.0.1:54323).
