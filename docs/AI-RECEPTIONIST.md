# AI receptionist (Telnyx Voice AI)

Zing uses **Telnyx** for telephony and **Telnyx Voice AI** for the no-answer fallback. There is **no Vapi or ElevenLabs** in the app path.

## What the business owner does

1. In **Telnyx Mission Control**, create/configure a **Voice AI Assistant** (voice, model, instructions, tools).
2. Copy the assistant **id** (UUID-style string).
3. In Zing → **AI call flow**, paste the id and tap **Activate** (or **Save**).

## Optional platform default

Set **`TELNYX_AI_ASSISTANT_ID`** in Vercel if you want a single assistant used when a user has not saved their own id.

## API notes

- `GET /api/ai-assistant` returns `hasAssistant`, `assistantId` (Telnyx id), and saved intake JSON for your in-app playbook copy.
- `POST /api/ai-assistant` links `telnyxAiAssistantId` + saves intake.
- `GET /api/ai-assistant/voices` returns an empty list — voice selection is **in Telnyx**, not Zing.

## Database

Run **`scripts/012-telnyx-ai-assistant.sql`** in Neon so `users.telnyx_ai_assistant_id` exists.
