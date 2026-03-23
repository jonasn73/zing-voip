# AI receptionist (Telnyx Voice AI)

Zing uses **Telnyx** for telephony and **Telnyx Voice AI** for the no-answer fallback. There is **no Vapi or ElevenLabs** in the app path.

## How to confirm AI is active **for a specific business number**

Zing saves **per-number** routing (or a **default** row that applies when there is no row for that DID). To see what actually applies:

1. **Dashboard** — Under “Calls Are Being Routed”, each business line shows a chip:
   - **AI fallback live** — Effective `fallback_type` is `ai` for that line **and** `users.telnyx_ai_assistant_id` is set (callers should get Voice AI after no-answer).
   - **AI — finish setup** — Line is set to AI but no assistant is linked yet; open **AI fallback** and **Save**.
   - **Voicemail fallback** / **Ring phone fallback** — No AI on no-answer for that line.
2. **Settings → Business numbers** — The same labels appear next to **Active** (data from `GET /api/routing?all=true` + `GET /api/ai-assistant`).
3. **API** — `GET /api/numbers/mine` returns each number with `routing_summary`: `fallback_type`, `ai_fallback_selected`, `telnyx_assistant_linked`, `ai_fallback_live`.

## What the business owner does (in Zing only)

1. In **Fallback Settings**, choose **AI receptionist**. Zing immediately calls **Telnyx `POST /v2/ai/assistants`** (via `PUT /api/routing`), stores the assistant id, and returns `voiceAi` in the JSON response — **no separate “Activate” step**.
2. Open **AI call flow** (same sheet or full page) to tune the playbook, greeting, and optional **Voice & model** — **Save** pushes updates to Telnyx (`POST /v2/ai/assistants/{id}`).
3. **Play preview** calls **`POST /api/ai-assistant/voice-preview`**, which uses Telnyx **`POST /v2/text-to-speech/speech`** (not `/text-to-speech`, which 404s). If TTS still fails, the UI falls back to the **browser’s text-to-speech**. **Live calls** use Telnyx Voice AI on the phone.
4. No-answer handoff uses **two TeXML steps**: `<Say>` + short **`<Pause>`** + **`<Redirect method="GET">`** to `/api/voice/telnyx/ai-bridge/u/{userId}`, then that URL returns **only** `<Connect><AIAssistant id="…"/>`. Putting `<Say>` and `<Connect><AIAssistant>` in one document often results in **no audio** or voicemail-like behavior on Telnyx. Telnyx expects **`assistant-{uuid}`**; Zing normalizes bare UUIDs in `buildTelnyxAiAssistantTexml`.
5. **Default inbound (AI + no receptionist):** when **AI fallback** is on, the caller usually hears a short line **before** `<Dial>` that **mentions ringing** (so it matches what happens next). Your **line rings**, then after no-answer `/fallback` returns **Say + Pause + Redirect** to **`/api/voice/telnyx/ai-bridge/u/{userId}`** (“…connect you to our assistant…”). To **disable** the pre-ring line only, set **`ZING_VOICE_SKIP_PRE_DIAL_GREETING=true`** in Vercel.
6. **Optional:** set **`ZING_AI_DIRECT_NO_RECEPTIONIST=true`** in Vercel to **skip** ringing your cell and connect straight to Voice AI (see **`PRODUCTION.md`**) — only if your carrier keeps answering the Dial with **cell voicemail**.
7. **“It still sounds like normal voicemail”:** If **your carrier’s voicemail picks up** the outbound `<Dial>` to your cell, the caller is connected to **carrier VM** until that leg ends. The **assistant handoff** TeXML runs in **`/fallback` after `<Dial>` completes** — so you may never hear that line while you’re still on carrier VM. Use item 6, reduce ring time, or adjust phone/forwarding so VM does not answer that leg.
8. **“Pre-line plays, then voicemail instead of AI”:** Dial `action` webhooks often send **`To` = your cell**, not the public DID. Zing must **not** treat that as the business line, or routing can fall back to the **default** row (e.g. voicemail) instead of the **per-number AI** row. The handler uses **`/fallback/u/{userId}/n/{digits}/{mode}`** with **`mode=owner-ai`** (or **`recv-ai`**) in the **path** so AI intent survives stripped queries; plus **`zingFbMode=`** when the DID is too short for a path segment. **`fb=ai`** is redundant but still sent. The “long call” hang-up guard requires **`DialBridgedTo`** (10+ digits) **and** 2+ minute duration so a **reject / completed-without-bridge** does not drop the caller before AI.

No Telnyx Mission Control account is required for the business owner.

## Voice & model (power users)

On **AI call flow**, expand **Voice & model (power users)** to set:

- **LLM model** — Telnyx model id (datalist from `GET /api/ai-assistant/models`); empty = `TELNYX_AI_DEFAULT_MODEL` / built-in default (`openai/gpt-4o`). Some ids (e.g. `openai/gpt-4o-mini`) may be rejected for Voice AI — Zing retries with fallbacks on create.
- **Speaking voice** — Telnyx TTS voice id (from `GET /api/ai-assistant/voices`); empty = `TELNYX_AI_VOICE` / built-in default.
- **Extra instructions** — appended to the playbook in Telnyx under “Additional instructions (from Zing)”.

On **Save** / **Activate**, Zing syncs instructions; if model/voice are set, they are pushed on update too (create always applies resolved defaults or your overrides).

## Advanced (support / migrations)

- **AI call flow → Advanced — link an existing assistant id** can paste a Telnyx assistant instead of creating one.
- **`TELNYX_AI_ASSISTANT_ID`** — optional shared id used only if **programmatic creation** fails (502 path). Prefer fixing API permissions instead of relying on this long-term.

## Debugging with evidence (not guessing)

1. Set **`ZING_TELNYX_FALLBACK_DIAGNOSTIC=true`** in Vercel, redeploy, place one test call, then copy the log line **`"zing":"telnyx-fallback-diagnostic"`** (numbers are redacted).
2. Locally run **`npm run test`** — Vitest replays committed fixtures in **`tests/fixtures/telnyx-fallback/`** against the same handler. Add a new scenario there when you have a real callback shape (see **`tests/fixtures/telnyx-fallback/README.md`**).

## Operator env (Vercel)

| Variable | Purpose |
|----------|---------|
| `TELNYX_API_KEY` | Required — must allow **AI Assistants** API on your Telnyx project. |
| `TELNYX_AI_DEFAULT_MODEL` | Optional — default `openai/gpt-4o`; use Telnyx **GET /v2/ai/models** for ids. |
| `TELNYX_AI_VOICE` | Optional — default `Telnyx.KokoroTTS.af_heart`. |

## API notes

- `GET /api/ai-assistant` returns `hasAssistant`, `assistantId`, and intake JSON.
- `POST /api/ai-assistant` saves intake and **creates** a Telnyx assistant unless `telnyxAiAssistantId` is sent (advanced).
- `PATCH /api/ai-assistant` updates intake/routing and **syncs** instructions to Telnyx when an assistant is linked.
- `GET /api/ai-assistant/voices` remains a stub — default voice comes from `TELNYX_AI_VOICE` / built-in default at create time.

## Database

Run **`scripts/012-telnyx-ai-assistant.sql`** in Neon so `users.telnyx_ai_assistant_id` exists.
