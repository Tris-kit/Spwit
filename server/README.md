# Spwit backend

Next.js (App Router) service deployed on **Vercel**. Two jobs:

1. **OCR proxy** — receipt scanning runs server-side with the org's Google AI
   (Gemini) key, so app users never enter their own key.
2. **Shareable bill links** — persist a split behind an unguessable id and
   render a public web page (`/s/:id`) anyone can open without the app.

Storage is **Upstash Redis** (via the Vercel Marketplace) — a share link is just
JSON behind a short id, so no relational schema is needed. When accounts + sync
land later, that's when Postgres earns its place.

## Layout

```
.                          (repo root)
  app/
    api/
      health/route.ts        GET   — liveness + config check (startup ping)
      ocr/route.ts           POST  — receipt image -> parsed line items
      bills/route.ts         POST  — create a share link
      bills/[id]/route.ts    GET/PATCH/DELETE — read / update / delete a bill
    s/[id]/page.tsx          public server-rendered share page
    page.tsx                 landing page
  lib/
    ocr.ts        Gemini vision call (server key)
    split.ts      per-person math, ported from the app (keep in sync)
    store.ts      Redis read/write + edit-token check
    rateLimit.ts  per-IP fixed-window limiter
    validate.ts   incoming-bill shape checks
    http.ts       JSON + CORS helpers
    ids.ts        short id + edit token
    format.ts     currency / avatar / Venmo-link helpers
    types.ts      bill data model (mirror of app src/types.ts)
```

## Endpoints

### `GET /api/health`
```jsonc
// 200
{ "ok": true, "service": "spwit-backend", "ocr": true, "storage": true }
```
`ocr`/`storage` report whether the Gemini and Upstash env vars are set (booleans
only — no secret values). The app pings this on startup.

### `POST /api/ocr`
```jsonc
// body
{ "imageBase64": "<base64 JPEG, no data: prefix>", "mediaType": "image/jpeg" }
// 200
{ "items": [{ "name": "Burger", "price": 14.5 }], "taxAmount": 2.1, "subtotal": 14.5, "total": 16.6 }
```
Rate limit: 30 / hour / IP.

### `POST /api/bills`
```jsonc
// body
{ "bill": { /* app Bill */ }, "receiptImageUrl": null, "unpaid": ["p_2"] }
// 201
{ "id": "k4f9x2ab", "url": "https://.../s/k4f9x2ab", "editToken": "…" }
```
Store the `editToken` with the bill on the device — it's required for updates.

### `GET /api/bills/:id`
Public. Returns `{ id, bill, receiptImageUrl, unpaid, createdAtISO, updatedAtISO }`
(never the edit token).

### `PATCH /api/bills/:id`
```jsonc
{ "editToken": "…", "bill": { /* ... */ }, "unpaid": ["p_2"] }
```
Creator-only. Use it to push late edits (added phone/Venmo, paid status).

### `DELETE /api/bills/:id`
```jsonc
{ "editToken": "…" }
```

### `GET /s/:id`
The human-facing share page.

## Local development

```bash
cd Spwit-Backend
npm install
cp .env.example .env.local   # fill in the three secrets
npm run dev                  # http://localhost:3000
```

Get the Upstash vars from the Upstash console (or `vercel env pull` once the
integration is linked). `GEMINI_API_KEY` is your Google AI Studio key.

Smoke test:
```bash
curl -X POST localhost:3000/api/bills -H 'content-type: application/json' -d '{
  "bill": {
    "people": [{"id":"me","name":"Tristan","color":"#FDBA8C","isMe":true},
               {"id":"p2","name":"Sam","color":"#FCD34D"}],
    "items": [{"id":"i1","name":"Pizza","price":20}],
    "assignments": {"i1":["me","p2"]},
    "charges": {"taxAmount":2,"tipMode":"percent","tipPercent":18,"tipAmount":0}
  }
}'
# -> open the returned url
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project** → import the repo. Framework preset auto-detects
   **Next.js**; leave **Root Directory** at the default `./`.
3. Add the **Upstash for Redis** integration (Marketplace) — it injects
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
4. Add `GEMINI_API_KEY` in Project → Settings → Environment Variables.
5. (Optional) `NEXT_PUBLIC_BASE_URL` if you want share links on a custom domain.
6. Deploy.

## Wiring the app

Point the Expo app at the deployment (e.g. `EXPO_PUBLIC_API_BASE`) and call
`POST /api/ocr` instead of the on-device Gemini path, and `POST /api/bills`
from the results screen's share action. The device keeps its local history as-is;
the backend only holds the copies you explicitly share. The app repo
(`Tris-kit/Spwit-App`) ships a ready-made client at `src/backend.ts`.
