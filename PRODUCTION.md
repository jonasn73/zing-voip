# Running Zing on your live domain

For the app to work in production (sign up, login, settings, call routing), you need a database and env vars set in Vercel.

## 1. Database (Neon)

1. Go to [neon.tech](https://neon.tech) and create a project (free tier is fine).
2. In the Neon dashboard, open **SQL Editor** and run these in order:
   - Copy/paste and run **`scripts/001-create-schema.sql`**
   - Then run **`scripts/002-add-password-hash.sql`**
   - Run any other numbered scripts in `scripts/` you have not applied yet, e.g. **`scripts/010-ai-leads-intake.sql`** (AI lead capture) and **`scripts/011-user-industry.sql`** (signup industry → default AI script).
3. In Neon, go to **Connection details** and copy the connection string (URI). It looks like:
   `postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`

## 2. Vercel environment variables

In your Vercel project: **Settings → Environment Variables**. Add:

| Variable           | Description |
|--------------------|-------------|
| `DATABASE_URL`     | The Neon connection string from step 1. |
| `SESSION_SECRET`   | Random string for signing cookies (e.g. run `openssl rand -base64 32` and paste). |
| `TELNYX_API_KEY`   | Your Telnyx API key (for numbers and voice). |
| `VAPI_API_KEY`     | Your Vapi **private** API key (AI receptionist on fallback / assistant). |
| `ELEVENLABS_API_KEY` | **Platform** ElevenLabs key — powers voice **preview** and the **voice picker** (premade catalog). Customers do not enter this. |
| `NEXT_PUBLIC_APP_URL` | Your live site base URL (e.g. `https://your-app.vercel.app`) — used for Vapi tool webhooks. |
| `VAPI_WEBHOOK_SECRET` | Optional: random string; append `?s=YOUR_SECRET` to the Server URL you configure on the Vapi assistant (must match). |
| `TELNYX_MESSAGING_FROM_E164` | Optional: your Telnyx number in E.164, enabled for **outbound SMS** — sends **AI lead** alerts to the owner’s main line. |

Save and **redeploy** the project (Deployments → … → Redeploy).

### AI receptionist (optional tuning)

- Default assistant LLM is **`gpt-4o`** for best spoken quality. To save cost, set `ZING_AI_LLM_MODEL=gpt-4o-mini` in Vercel and redeploy.
- See **`docs/AI-RECEPTIONIST.md`** for how voices and preview work.
- **Lead capture:** the assistant calls your app at **`/api/webhooks/vapi`** when a caller’s details are saved. Run **`scripts/010-ai-leads-intake.sql`**, set `NEXT_PUBLIC_APP_URL`, and (recommended) `VAPI_WEBHOOK_SECRET`. For SMS alerts, set `TELNYX_MESSAGING_FROM_E164` and turn on **Text me new leads** in Settings → AI Receptionist.

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
