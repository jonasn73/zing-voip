# AI receptionist (platform model)

End users **never** add Vapi or ElevenLabs keys in the app. Zing runs voice + preview on the server using **your** environment variables.

## Operator (Vercel) environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `VAPI_API_KEY` | Yes (for AI calls) | Create/update assistants, live agent on fallback calls |
| `ELEVENLABS_API_KEY` | Strongly recommended | Voice preview + `/api/ai-assistant/voices` premade catalog (same IDs as live TTS) |
| `ZING_AI_LLM_MODEL` | No | OpenAI model id (default `gpt-4o`). Set `gpt-4o-mini` to reduce cost |

## Voice list behavior

- `GET /api/ai-assistant/voices` uses the **platform** ElevenLabs key to **match labels** to Zing’s **curated premade ID list** only.
- Extra premades returned by ElevenLabs are **not** exposed in the app — many are “library” voices that **fail in-app preview** on free API tiers while still confusing users in the dropdown.
- If the key is missing or the API fails, the UI uses the full curated list from `lib/ai-voice-catalog.ts`.

## Quality defaults

- Assistants use `gpt-4o` by default (override with `ZING_AI_LLM_MODEL`).
- ElevenLabs block uses tuned `stability` / `similarityBoost` for natural phone speech.
- System prompt emphasizes concise speech, confirming numbers, and no “I’m an AI” language.
