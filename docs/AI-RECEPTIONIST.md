# AI receptionist (platform model)

End users **never** add Vapi or ElevenLabs keys in the app. Zing runs voice + preview on the server using **your** environment variables.

## Operator (Vercel) environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `VAPI_API_KEY` | Yes (for AI calls) | Create/update assistants, live agent on fallback calls |
| `ELEVENLABS_API_KEY` | Strongly recommended | Voice preview + `/api/ai-assistant/voices` premade catalog (same IDs as live TTS) |
| `ZING_AI_LLM_MODEL` | No | OpenAI model id (default `gpt-4o`). Set `gpt-4o-mini` to reduce cost |

## Voice list behavior

- `GET /api/ai-assistant/voices` loads **ElevenLabs premade** voices for the **platform** key, merges with Zing’s curated order, and caches ~30 minutes.
- If the key is missing or the API fails, the UI uses `lib/ai-voice-catalog.ts` fallback IDs (still valid premades).

## Quality defaults

- Assistants use `gpt-4o` by default (override with `ZING_AI_LLM_MODEL`).
- ElevenLabs block uses tuned `stability` / `similarityBoost` for natural phone speech.
- System prompt emphasizes concise speech, confirming numbers, and no “I’m an AI” language.
