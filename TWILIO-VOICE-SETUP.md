# Twilio voice setup – why AI didn’t answer

## What “Port” does in Zing

When you use **Port Existing** and enter a number (e.g. 5025571219) that’s **already on Twilio**:

- Zing **saves** that number in your account and shows it in Settings.
- It does **not** move the number from Twilio to another carrier.
- It does **not** tell Twilio to send calls to Zing.

So the number appears in Settings because it’s in our database, but **Twilio is still the one receiving the call**. For Zing (and the AI) to handle calls, Twilio must be configured to send those calls to your Zing app.

---

## What you need for AI to answer

1. **App must be on a public URL**  
   Twilio can’t call `localhost`. Deploy the app (e.g. Vercel) and set `NEXT_PUBLIC_APP_URL` in `.env` to that URL (e.g. `https://your-app.vercel.app`).

2. **Point the number to Zing in Twilio**  
   - Go to [Twilio Console](https://console.twilio.com) → **Phone Numbers** → **Manage** → **Active numbers**.
   - Click the number you’re using (e.g. 5025571219).
   - Under **Voice & Fax** → **A call comes in**:
     - Set to **Webhook**.
     - URL: `https://YOUR_DEPLOYED_URL/api/voice/incoming` (use your real app URL).
     - Method: **POST**.
   - Save.

3. **Set fallback to AI in Zing**  
   In the Zing app, open the **Routing** (dashboard) screen and set **When no one answers** to **AI Assistant**. That makes unanswered calls go to the AI instead of only to you or voicemail.

After this, when someone calls your Twilio number and no one answers, Twilio will request your app’s fallback URL and Zing will connect the call to the AI.

---

## Code change made

- Numbers you add via **Port** are now treated as routable even while status is **porting**, and the incoming number is normalized so lookup works whether Twilio sends `5025571219` or `+15025571219`.

If you want, we can next add a “Connect this number to Twilio” step in the app that opens Twilio’s number config or shows your webhook URL in one place.
