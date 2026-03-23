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
4. Voice AI handoff is usually **two fetches**: **`/incoming`** then **`/ai-bridge`**. Putting `<Say>` and `<Connect><AIAssistant>` in one document often results in **no audio** on Telnyx. The **`/ai-bridge`** URL returns **only** `<Connect><AIAssistant id="…"/>`. Telnyx expects **`assistant-{uuid}`**; Zing normalizes bare UUIDs in `buildTelnyxAiAssistantTexml`.
5. **Default inbound (AI + no receptionist):** `/incoming` returns a **silent** **`<Redirect method="GET">`** to **`/api/voice/telnyx/ai-bridge/u/{userId}`** (no `<Say>`). That avoids **dead air** that can happen if `<Connect>` is the **first** `/incoming` response, and avoids a **repeating “please hold”** loop from **`ZING_AI_HANDOFF_TWO_STEP`**. Optional: **`ZING_AI_HANDOFF_TWO_STEP=true`** — Say + Pause + Redirect. Optional: **`ZING_AI_CONNECT_DIRECT=true`** — `<Connect>` on `/incoming` (experimental). If Telnyx POSTs `/incoming` again with **`CallStatus`** like **in-progress**, Zing returns **`<Connect>`** inline (no second redirect).
6. **Ring your cell first (legacy):** set **`ZING_AI_RING_OWNER_FIRST=true`** in Vercel — Zing uses `<Dial>` to your phone and **`/fallback`** after no-answer. Only use if you confirm **POST/GET to `/api/voice/telnyx/fallback/...`** appears in logs when you decline a call.
7. **“Vercel shows `/incoming` but never `/fallback`”:** Telnyx did not request the Dial `action` URL — you will **not** see `telnyx-fallback-diagnostic` logs. Use the **default** (direct AI, item 5) or fix TeXML/Telnyx routing for your number.
8. **Ring-first path (`ZING_AI_RING_OWNER_FIRST`):** `/fallback` uses **`/fallback/u/{userId}/n/{digits}/{mode}`**, path **`mode=owner-ai`**, **`zingFbMode=`** fallback, and safe merge rules. Early hang-up only if **`DialBridgedTo`** (10+ digits) **and** duration ≥ 2 minutes.

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

1. **`/fallback` diagnostics** apply only when **`ZING_AI_RING_OWNER_FIRST=true`** (or receptionist `<Dial>`). The **default** direct-AI path hits **`/incoming`** then **`/ai-bridge`** (silent redirect). With **`ZING_AI_HANDOFF_TWO_STEP`** you still hit **`/ai-bridge`** after the Say. Search logs for **`telnyx-incoming-ai-direct`** (`handoff` shows **redirect-silent-ai-bridge**, **connect-aiassistant-repeat-incoming**, etc.). Set **`ZING_TELNYX_FALLBACK_DIAGNOSTIC=true`** when debugging `/fallback`.
2. Locally run **`npm run test`** — Vitest replays fixtures in **`tests/fixtures/telnyx-fallback/`**. Add a scenario when you capture a real Dial `action` body (see **`tests/fixtures/telnyx-fallback/README.md`**).

## Operator env (Vercel)

| Variable | Purpose |
|----------|---------|
| `TELNYX_API_KEY` | Required — must allow **AI Assistants** API on your Telnyx project. |
| `TELNYX_AI_DEFAULT_MODEL` | Optional — default `openai/gpt-4o`; use Telnyx **GET /v2/ai/models** for ids. |
| `TELNYX_AI_VOICE` | Optional — default `Telnyx.KokoroTTS.af_heart`. |
| `ZING_AI_HANDOFF_TWO_STEP` | Optional — Say + Pause + Redirect → `/ai-bridge` instead of **silent** redirect (can repeat if Telnyx re-fetches `/incoming`). |
| `ZING_AI_CONNECT_DIRECT` | Optional — `<Connect><AIAssistant>` on **`/incoming`** (may cause **quiet** on some Telnyx setups). |
| `ZING_AI_RING_OWNER_FIRST` | Optional — ring cell first; **`/fallback`** after no-answer. |

## API notes

- `GET /api/ai-assistant` returns `hasAssistant`, `assistantId`, and intake JSON.
- `POST /api/ai-assistant` saves intake and **creates** a Telnyx assistant unless `telnyxAiAssistantId` is sent (advanced).
- `PATCH /api/ai-assistant` updates intake/routing and **syncs** instructions to Telnyx when an assistant is linked.
- `GET /api/ai-assistant/voices` remains a stub — default voice comes from `TELNYX_AI_VOICE` / built-in default at create time.

## Database

Run **`scripts/012-telnyx-ai-assistant.sql`** in Neon so `users.telnyx_ai_assistant_id` exists.
