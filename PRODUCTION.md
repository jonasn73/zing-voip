# Running Zing on your live domain

For the app to work in production (sign up, login, settings, call routing), you need a database and env vars set in Vercel.

## 1. Database (Neon)

1. Go to [neon.tech](https://neon.tech) and create a project (free tier is fine).
2. In the Neon dashboard, open **SQL Editor** and run migrations **in order**. See **`scripts/MIGRATE-ALL.md`** for the full checklist (001 → 012). At minimum for a new project: **`001-create-schema.sql`**, **`002-add-password-hash.sql`**, then **`010`**, **`011`**, **`012`** if you use AI call flow / Telnyx Voice AI.
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
| `ZING_AI_DIRECT_NO_RECEPTIONIST` | Optional. If `true` / `1`: when **AI fallback** is on and there is **no receptionist**, skip ringing your cell and connect **straight to Voice AI** (avoids some carriers sending the Dial to cell VM). **Default (unset):** your phone **rings first**, then no-answer goes to AI. |
| `ZING_VOICE_SKIP_PRE_DIAL_GREETING` | Optional. If `true` / `1`: **do not** play the short “thanks for calling…” line **before** ringing (AI fallback flows only). **Default (unset):** that line plays first so callers always hear Zing before ringback. |

Save and **redeploy** the project (Deployments → … → Redeploy).

### AI receptionist (Telnyx Voice AI)

- **Owners do not use Mission Control.** **AI call flow → Activate** creates a Telnyx assistant via API from their playbook. Saving updates that assistant.
- Advanced / support can still paste an existing assistant id; `TELNYX_AI_ASSISTANT_ID` is only an emergency fallback if creation fails.
- On **no answer**, Zing returns TeXML `<Connect><AIAssistant id="…"/></Connect>` on the **same** call (no second carrier).
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
