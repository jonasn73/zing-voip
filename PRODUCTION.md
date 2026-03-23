# Running Zing on your live domain

For the app to work in production (sign up, login, settings, call routing), you need a database and env vars set in Vercel.

## 1. Database (Neon)

1. Go to [neon.tech](https://neon.tech) and create a project (free tier is fine).
2. In the Neon dashboard, open **SQL Editor** and run migrations **in order**. See **`scripts/MIGRATE-ALL.md`** for the full checklist (001 → 014). At minimum for a new project: **`001`**, **`002`**, then **`010`**, **`011`**, **`012`**, **`013`**, **`014`** if you use Telnyx Voice AI direct-to-assistant (013 + 014 fix redirect loops and repeat-`/incoming` behavior).
3. In Neon, go to **Connection details** and copy the connection string (URI). It looks like:
   `postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`

## 2. Vercel environment variables

In your Vercel project: **Settings → Environment Variables**. Add:

| Variable           | Description |
|--------------------|-------------|
| `DATABASE_URL`     | The Neon connection string from step 1. |
| `SESSION_SECRET`   | Random string for signing cookies (e.g. run `openssl rand -base64 32` and paste). |
| `TELNYX_API_KEY`   | Your Telnyx API key (for numbers and voice). |
| `NEXT_PUBLIC_APP_URL` | Your live site base URL (e.g. `https://your-app.vercel.app`) — used for Telnyx voice webhooks. |
| `TELNYX_AI_ASSISTANT_ID` | Optional **fallback** only: shared assistant id if **creating** an assistant via API fails (prefer fixing API access). |
| `TELNYX_AI_DEFAULT_MODEL` | Optional: LLM id for auto-created assistants (default `openai/gpt-4o`). List: Telnyx **GET /v2/ai/models**. Avoid `openai/gpt-4o-mini` if Telnyx says it is not available for AI assistants. |
| `TELNYX_AI_VOICE` | Optional: Telnyx TTS voice string for new assistants (default `Telnyx.KokoroTTS.af_heart`). |
| `TELNYX_MESSAGING_FROM_E164` | Optional: your Telnyx number in E.164, enabled for **outbound SMS** — sends **AI lead** alerts to the owner’s main line. |
| `ZING_AI_RING_OWNER_FIRST` | Optional. If `true` / `1`: when **AI fallback** is on and there is **no receptionist**, **ring your cell first** and use the Dial `action` URL (`/fallback`) for Voice AI after no-answer. **Default (unset):** connect **straight to Voice AI** (no ring) — recommended because Telnyx often **does not call** `/fallback`, so ring-first + AI appears “stuck” on voicemail. |
| `ZING_AI_HANDOFF_TWO_STEP` | Optional. If `true` / `1`: **Say + Pause + Redirect** to **`/ai-bridge`** from `/incoming`. Default is a **silent** Redirect (no Say) to **`/ai-bridge`** — avoids **dead air** from `<Connect>` on the first `/incoming` response and avoids a **repeating hold line** if Telnyx re-requests `/incoming`. |
| `ZING_AI_CONNECT_DIRECT` | Optional. If `true` / `1`: return **`<Connect><AIAssistant>`** on **`/incoming`** (skip silent redirect). **Experimental** — Telnyx may go **quiet**; prefer unset (default). |
| `ZING_AI_DIRECT_NO_RECEPTIONIST` | Legacy no-op (still accepted). Direct-to-AI is now the **default** when AI fallback + no receptionist; use **`ZING_AI_RING_OWNER_FIRST`** if you need the old ring-first behavior. |
| `ZING_TELNYX_FALLBACK_DIAGNOSTIC` | Optional. If `true` / `1`: log **`zing: telnyx-fallback-diagnostic`** per Dial `action` request (PII-redacted form fields + routing snapshot). Use when debugging; turn off after. See **`tests/fixtures/telnyx-fallback/README.md`**. |

Save and **redeploy** the project (Deployments → … → Redeploy).

### AI receptionist (Telnyx Voice AI)

- **Owners do not use Mission Control.** **AI call flow → Activate** creates a Telnyx assistant via API from their playbook. Saving updates that assistant.
- Advanced / support can still paste an existing assistant id; `TELNYX_AI_ASSISTANT_ID` is only an emergency fallback if creation fails.
- **AI + no receptionist:** `/incoming` **redirects** to `/ai-bridge`, which returns `<Connect><AIAssistant id="…"/></Connect>` (same call leg; second HTTP fetch).
- See **`docs/AI-RECEPTIONIST.md`**. Lead webhooks from tools are **not** wired to Vapi anymore; use Telnyx tool/webhook features when you need structured lead capture.

## 3. Sign up on the live site

After redeploying, open your live URL and use **Sign up** (not the dev login). Enter:

- Your real **email**
- Your **cell phone** (main line — calls default here)
- A **password** (at least 8 characters)
- Name and business name

Then you can log in with that email and password on the live app. You do **not** need to “re-sign up” if you already have a user in the database; just use the same email/password to log in.

## Troubleshooting

- **“DATABASE_URL is not set”** — Add `DATABASE_URL` in Vercel and redeploy.
- **“Invalid email or password”** — Either no user exists yet (sign up first) or the password is wrong.
- **Login works but dashboard errors** — Ensure you ran both `001-create-schema.sql` and `002-add-password-hash.sql` so `users` has `password_hash` and `routing_config` exists.
- **Logged out on every refresh** — Ensure the app is served over **HTTPS** in production (so the secure session cookie is stored). Keep **SESSION_SECRET** set in Vercel and avoid changing it (changing it invalidates existing sessions).
- **“Something went wrong” on login after a deploy** — Often the database is missing a new column. In Neon, run **`scripts/011-user-industry.sql`** (and **`010-ai-leads-intake.sql`** if you use AI leads). The app can fall back without `industry` for login, but running the scripts is still recommended.
