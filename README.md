# LANCER Campaign Site

A character tracker for a LANCER campaign: players submit characters and changes, GMs approve them.
Built with Vue, Vite and TypeScript, using Supabase for the database and logins, and hosted on Vercel.

## Running it locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key.
3. Start the dev server: `npm run dev`, then open http://localhost:5173

## Database

The `supabase/` folder holds the Supabase config and, later, the database migrations.
It's linked to the hosted project through Supabase's GitHub integration.
You need the [Supabase CLI](https://supabase.com/docs/guides/local-development) to work with it.
