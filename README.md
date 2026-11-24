# DocuSet

Mobile-first web app (installable as a PWA) to organise and manage documents and processes in audiovisual productions: collecting forms and signatures from the crew and keeping production paperwork in one place.

Part of [SmartSet](https://github.com/nicolocaloni-hub), digital tools for film, TV and documentary production. Created by Nicolò Caloni.

## Stack

React 18, Vite, Tailwind CSS 4, Supabase (Postgres with Row Level Security, auth and storage).

## Run locally

```bash
npm install
cp .env.example .env   # add your own Supabase URL and publishable key
npm run dev
```

Database schema and policies are in `supabase/migrations/`, apply them to your own Supabase project. Use only the **publishable** key in the browser; never put a `service_role` or secret key in the client or in this repository. See `REGRESSION_CHECKLIST.md` for the manual checks to run before a release.

## License

[MIT](LICENSE)
