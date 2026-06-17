# JEE Test Simulator

A secure, BYOK (Bring-Your-Own-Key) NTA-style JEE Main computer-based test simulator.

Upload a question paper PDF + answer key PDF, parse them with the LLM provider of your choice (Anthropic Claude, OpenAI, or Google Gemini), and take a full timed test with a real exam interface.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **NextAuth.js** with Google sign-in (JWT sessions)
- **pdfjs-dist** — client-side PDF text extraction
- **Zustand** — exam state (persisted to `sessionStorage` for resume)
- **Recharts** — results visualisations
- **Zod** — strict request + LLM-output validation
- **AES-256-GCM** — encrypted at-rest API keys (httpOnly cookie, bound to user via AAD)

## Security

- **Auth gate.** Every API route requires a valid NextAuth session. Unauthenticated requests return `401`. Middleware also redirects `/exam`, `/results`, `/settings` to `/signin`.
- **BYOK with server-side decryption.** Provider API keys are encrypted server-side with AES-256-GCM, stored in an httpOnly + secure + sameSite=strict cookie, and decrypted in memory per request. Keys are never sent to the client and never logged.
- **Constrained server payload.** `/api/parse` accepts a fixed structured payload (`testType`, `questionPaperText`, `answerKeyText`). It is **not** an open passthrough to any provider — no arbitrary prompt or model is accepted.
- **Rate limiting.** `/api/parse` is rate-limited per user (10 req / 60 s). On Vercel serverless, the in-memory limiter is per-instance — for production, swap `lib/rate-limit.ts` for Upstash Redis.
- **Input validation.** Uploads are checked client-side for MIME, size (≤ 10 MB), and PDF magic bytes (`%PDF-`). Extracted text is capped at 180 KB before being sent to the model.
- **Output validation.** Model output is `JSON.parse`d inside try/catch and validated against a Zod schema before use — never `eval`. Bad output returns `502`.
- **Security headers.** CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS, set in `next.config.ts`.
- **CSRF.** NextAuth's built-in CSRF + sameSite=strict cookies; mutating routes are session-checked.

## Local setup

```bash
npm install
cp .env.example .env.local
# Fill in the env vars (see below)
npm run dev
```

App runs at `http://localhost:3000`.

### Required env vars

| Var | Notes |
|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` in dev; your full URL in prod. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | From Google Cloud → APIs & Services → Credentials. |
| `GOOGLE_CLIENT_SECRET` | Same screen. |
| `ENCRYPTION_KEY` | 32-byte hex (64 chars). Generate with `openssl rand -hex 32`. |

### Setting up Google OAuth

1. https://console.cloud.google.com/apis/credentials → Create Credentials → OAuth Client ID → Web application.
2. **Authorized JavaScript origins**: `http://localhost:3000` (+ your prod origin).
3. **Authorized redirect URIs**:
   - Dev: `http://localhost:3000/api/auth/callback/google`
   - Prod: `https://<your-vercel-domain>/api/auth/callback/google`
4. Paste the Client ID + Client Secret into `.env.local` / Vercel env.

## Deploy to Vercel

1. Push this repo to GitHub.
2. https://vercel.com/new → import the repo.
3. In Vercel → Project → Settings → Environment Variables, add all five vars above (set `NEXTAUTH_URL` to the deployed URL).
4. Add the production redirect URI in Google Cloud (step 3 above).
5. Deploy.

Notes for Vercel:
- API routes use `runtime = "nodejs"` and `maxDuration = 60` (Pro tier). On Hobby, drop to `10`.
- The encrypted-cookie BYOK store is stateless and works well on Vercel serverless.
- The in-memory rate limiter is per-instance only; for production replace with Upstash Redis.

## Usage

1. Sign in with Google.
2. Go to **Settings**, pick a provider, paste your API key, **Save**.
   - Anthropic: `console.anthropic.com` (model: `claude-sonnet-4-6`)
   - OpenAI: `platform.openai.com` (model: `gpt-4.1-mini`)
   - Gemini: `aistudio.google.com` (model: `gemini-2.0-flash`)
3. From the home page, upload **Question Paper PDF** + **Answer Key / Solutions PDF**.
4. Click **Parse PDFs** → **Start Test**.
5. Take the test (3 hr · 75 Q · Maths / Physics / Chemistry · +4 / −1).
6. Submit to see your subject-wise score, charts, and per-question review.

## File layout

```
app/
  page.tsx                  Upload screen
  signin/                   Sign-in page
  exam/                     NTA-style exam interface
  results/                  Score + charts + review
  settings/                 BYOK provider + key
  api/
    auth/[...nextauth]/     NextAuth handler
    keys/                   GET / POST / DELETE — encrypted key store
    parse/                  Auth-gated, rate-limited LLM call
components/
  Dropzone, Timer, QuestionPalette, QuestionView, ResultsCharts,
  NavBar, Providers
lib/
  auth.ts                   NextAuth options
  crypto.ts                 AES-256-GCM encrypt/decrypt
  key-store.ts              httpOnly-cookie BYOK store
  pdf-extract.ts            client-side text extraction + magic-byte check
  providers/                Anthropic / OpenAI / Gemini adapters
  rate-limit.ts             in-memory limiter
  store.ts                  Zustand exam state
  grading.ts                +4/-1 scoring
  validation.ts             Zod schemas
  types.ts
middleware.ts               withAuth gate for /exam, /results, /settings
```

## Caveats

- **Math/equation fidelity.** `pdfjs-dist` text extraction can garble integrals, subscripts, chemical structures. For best results use papers exported as digital PDFs (not scans). A future vision-based parser would handle math better at higher cost.
- **Rate limit on serverless.** The in-memory limiter does not share state across Vercel function instances. Acceptable for personal use; swap to Upstash Redis if you open the app to others.
- **Single-key per user.** Only one provider key is stored at a time; saving a new one replaces it.

## License

MIT.
