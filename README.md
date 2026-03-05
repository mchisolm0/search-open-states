# ZIP Representative Lookup (Vite + React + Convex + OpenStates)

This app lets a visitor enter a US ZIP code and returns representatives plus office contact details. (vibe-coded with Codex)

The choice of OpenStates as a source of information about US lawmakers is the repository seems to be actively maintained (https://github.com/openstates/people). In my testing, it provides up-to-date information about lawmakers and their offices.

Flow:

1. ZIP -> OpenWeather geocoding (`/geo/1.0/zip`) for `lat/lng`
2. `lat/lng` -> OpenStates `people.geo?include=offices`
3. Convex caches results by ZIP + country for 24 hours

## Requirements

- Node 20+
- pnpm
- Convex project (already configured in `.env.local`)
- API keys:
  - `OPENWEATHER_API_KEY`
  - `OPENSTATES_API_KEY`

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Put local variables in `.env.local`:

```bash
VITE_CONVEX_URL=...
CONVEX_DEPLOYMENT=...
OPENWEATHER_API_KEY=...
OPENSTATES_API_KEY=...
```

3. Push Convex functions/schema and generate types:

```bash
npx convex dev --once
```

4. Make sure the two server-side keys exist in Convex env:

```bash
npx convex env set OPENWEATHER_API_KEY "your_key"
npx convex env set OPENSTATES_API_KEY "your_key"
```

5. Run the frontend:

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Notes

- Only US ZIP lookup is enabled right now. (Because we currently only have US states in OpenStates)
- ZIP cache TTL is 24 hours (`convex/representatives.ts`).
- Contact details come from OpenStates `email` and `offices[*].voice/fax/address`.
