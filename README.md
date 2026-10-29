# LANCER Campaign Site

A character tracker for a LANCER campaign: players submit characters and changes, GMs approve them.
Built with Vue, Vite and TypeScript, using Supabase for the database and logins, and hosted on Vercel.

## Running it locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key.
3. Start the dev server: `npm run dev`, then open http://localhost:5173

## Credits

LANCER is by Massif Press. The login screen's boot text and h0r_os ASCII art come from COMP/CON's HORUS start-up log
([massif-press/compcon](https://github.com/massif-press/compcon), GPL-3.0).
The stat, range and damage symbols in `src/assets/icons/` are COMP/CON's (same repo and licence), except the hp heart and armour shield,
which are from [Material Design Icons](https://pictogrammers.com/library/mdi/) (Apache-2.0), as COMP/CON uses them.
Game data comes from Massif Press's `lancer-data` and expansion packages (GPL-3.0-or-later).

## Database

The `supabase/` folder holds the Supabase config and, later, the database migrations.
It's linked to the hosted project through Supabase's GitHub integration.
You need the [Supabase CLI](https://supabase.com/docs/guides/local-development) and Docker to work with it.

- `supabase start` runs a local copy of Supabase, with Studio at http://127.0.0.1:55323.
- `supabase test db` checks the security rules by trying to break them as each kind of user.
- `supabase db reset` rebuilds the local database from the migrations, and adds a local-only test account from `supabase/seed.sql`.
- `npm run dev -- --mode localdb --port 5174` runs the site against the local database (put the local URL and publishable key from `supabase status` in `.env.localdb.local`).
- `npm test` runs the app's unit tests (currently the formatted-text sanitiser).
