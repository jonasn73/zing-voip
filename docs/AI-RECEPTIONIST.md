# AI receptionist (Telnyx Voice AI)

Zing uses **Telnyx** for telephony and **Telnyx Voice AI** for the no-answer fallback. There is **no Vapi or ElevenLabs** in the app path.

## What the business owner does (in Zing only)

1. Set the dashboard to **If no answer: AI receptionist** (when you want the AI to pick up).
2. Open **AI call flow**, fill in the playbook / greeting, and tap **Activate voice assistant**.
3. Zing calls **Telnyx `POST /v2/ai/assistants`** with your **platform** `TELNYX_API_KEY`, stores the returned id on the user, and uses TeXML `<Connect><AIAssistant id="…"/></Connect>` on no-answer.
4. **Save** on that page later pushes updated instructions + greeting to the same assistant (`POST /v2/ai/assistants/{id}`).

No Telnyx Mission Control account is required for the business owner.

## Voice & model (power users)

On **AI call flow**, expand **Voice & model (power users)** to set:

- **LLM model** — Telnyx model id (datalist from `GET /api/ai-assistant/models`); empty = `TELNYX_AI_DEFAULT_MODEL` / built-in default.
- **Speaking voice** — Telnyx TTS voice id (from `GET /api/ai-assistant/voices`); empty = `TELNYX_AI_VOICE` / built-in default.
- **Extra instructions** — appended to the playbook in Telnyx under “Additional instructions (from Zing)”.

On **Save** / **Activate**, Zing syncs instructions; if model/voice are set, they are pushed on update too (create always applies resolved defaults or your overrides).

## Advanced (support / migrations)

- **AI call flow → Advanced — link an existing assistant id** can paste a Telnyx assistant instead of creating one.
- **`TELNYX_AI_ASSISTANT_ID`** — optional shared id used only if **programmatic creation** fails (502 path). Prefer fixing API permissions instead of relying on this long-term.

## Operator env (Vercel)

| Variable | Purpose |
|----------|---------|
| `TELNYX_API_KEY` | Required — must allow **AI Assistants** API on your Telnyx project. |
| `TELNYX_AI_DEFAULT_MODEL` | Optional — default `openai/gpt-4o-mini`; use Telnyx **GET /v2/ai/models** for ids. |
| `TELNYX_AI_VOICE` | Optional — default `Telnyx.KokoroTTS.af_heart`. |

## API notes

- `GET /api/ai-assistant` returns `hasAssistant`, `assistantId`, and intake JSON.
- `POST /api/ai-assistant` saves intake and **creates** a Telnyx assistant unless `telnyxAiAssistantId` is sent (advanced).
- `PATCH /api/ai-assistant` updates intake/routing and **syncs** instructions to Telnyx when an assistant is linked.
- `GET /api/ai-assistant/voices` remains a stub — default voice comes from `TELNYX_AI_VOICE` / built-in default at create time.

## Database

Run **`scripts/012-telnyx-ai-assistant.sql`** in Neon so `users.telnyx_ai_assistant_id` exists.
