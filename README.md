# Fitness Year Calendar

A minimalist yearly workout calendar for tracking fitness check-ins by date and muscle group.

Live site: [fitness-year-calendar.gentleming.chatgpt.site](https://fitness-year-calendar.gentleming.chatgpt.site)

## Features

- Year-at-a-glance calendar with compact monthly cards
- Check in for today or past dates
- Select up to 3 workout categories per day
- Built-in categories: Full Body, Chest, Arms, Shoulders, Back, Legs, Core, Cardio
- Workout summary with total workout days and per-category counts
- Year selector, including historical data from 2025 onward
- English / Chinese language toggle
- Light / dark theme toggle
- Share button that exports the calendar as an image
- CSV import and export for all years
- ChatGPT sign-in with database-backed cross-device sync

## Data and sync behavior

The app uses ChatGPT sign-in to identify the current user. Workout records are stored in a Cloudflare D1 database through OpenAI Sites.

When the page loads:

1. Local browser data is shown immediately as a temporary fallback.
2. The app fetches the latest database records.
3. If the cloud sync succeeds, database data becomes the source of truth and overwrites local cache.
4. If sync fails, the app stays in `Local only` mode and keeps browser-local data.

This means additions, edits, and deletions sync across devices after the page reaches `Synced`.

## CSV format

CSV import/export uses two columns:

```csv
date,groups
2026-01-01,default
2026-01-05,chest|arms
2026-01-06,back|core|cardio
```

Rules:

- `date` must use `YYYY-MM-DD`
- `groups` uses category IDs separated by `|`
- Supported group IDs: `default`, `chest`, `arms`, `shoulders`, `back`, `legs`, `core`, `cardio`
- Each date supports up to 3 groups
- Import/export includes all supported years, not only the currently selected year

## Tech stack

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Vinext](https://github.com/cloudflare/vinext)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [OpenAI Sites](https://chatgpt.com/)
- [`html-to-image`](https://github.com/bubkoo/html-to-image)

## Local development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Tests:

```bash
npm test
```

Generate database migrations after schema changes:

```bash
npm run db:generate
```

## Project structure

```text
app/
  api/checkins/route.ts   Database-backed check-in API
  chatgpt-auth.ts         ChatGPT sign-in helpers
  fitness-calendar.tsx    Main calendar UI
  globals.css             App styles and responsive layout
  page.tsx                Sign-in-gated page entry
db/
  schema.ts               D1 table schema
drizzle/
  *.sql                   Generated database migrations
public/icons/
  *.png                   Workout category icons
```

## Deployment

This project is configured for OpenAI Sites. The Sites project metadata lives in:

```text
.openai/hosting.json
```

The app expects a D1 binding named `DB`.

## Notes

- Browser `localStorage` is used only as a loading/offline cache and for UI preferences.
- Cloud database records are scoped per signed-in ChatGPT user.
- The deployed site requires ChatGPT sign-in before showing the calendar.
