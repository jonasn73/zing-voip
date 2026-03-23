# Telnyx Dial `action` fixtures

Use these to **replay** a real callback without guessing what Telnyx sends.

## 1. Capture one failing call

1. In **Vercel** → your project → **Logs**, find the request to  
   `/api/voice/telnyx/fallback/...`
2. Turn on verbose diagnostics (optional but best): set env  
   **`ZING_TELNYX_FALLBACK_DIAGNOSTIC=true`**, redeploy, reproduce once.
3. Copy the JSON line where **`"zing":"telnyx-fallback-diagnostic"`** appears.  
   It includes **`formRedacted`** (safe to share) and **`snapshot`** (routing decisions).

## 2. Add a Vitest scenario

Edit **`tests/telnyx-fallback.handler.test.ts`** (or add a case to the `scenarios` array in **`scenarios.ts`**) with:

- **`url`** — same path/query as production (you can shorten host to `http://test.local`)
- **`form`** — use the **raw** field names/values from Telnyx (not redacted) in your local file only; **do not commit** real phone numbers — use fake E.164 like `+15551110001`.
- **`mocks`** — what `getUser` / `getIncomingRoutingByNumber` / etc. should return
- **`expect.bodyContains` / `bodyNotContains`** — substrings in the TeXML body

## 3. Run tests

```bash
cd /path/to/zing
npm run test
```

This proves the handler still behaves the same for that payload after code changes.
