# Full In-App Porting: Implementation Plan

So Zing has **full control** over number porting (like other VoIP apps): customers start and complete the port entirely in the app. This doc is the roadmap.

---

## What We're Building

1. **Real port from another carrier**  
   When the user chooses "Port Existing" and enters a carrier other than Twilio, we call **Twilio’s Port In API**. Twilio becomes the "gaining" carrier and requests the number from the losing carrier (AT&T, Verizon, etc.). We collect everything Twilio needs (LOA fields + utility bill) and submit one port-in request per number.

2. **Where the number lives**  
   After the port completes, the number **lives in your Twilio account**. We set its voice URL to our app and mark it **active** in the DB—same as for numbers we buy or connect from Twilio.

3. **Flow**  
   - User enters number + current carrier + LOA details + uploads utility bill.  
   - We upload the document to Twilio Documents API → get `document_sid`.  
   - We create a Port In request with Twilio (Numbers API) → get `port_in_request_sid`.  
   - We save the number in our DB with status `porting` and store `port_in_request_sid`.  
   - Twilio sends the LOA to the user’s email for e-signature.  
   - Twilio submits the request to the losing carrier; we get webhooks for status.  
   - On **PortInPhoneNumberCompleted** we find our row by number, fetch the number’s Twilio SID, set voice URL, and set status to `active`.

---

## Prerequisites (Twilio)

- **Twilio account** with Numbers/Porting API access (Port In API is in [Public Beta](https://www.twilio.com/docs/phone-numbers/port-in/port-in-request-api)).
- **Env**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `NEXT_PUBLIC_APP_URL` (must be a public URL for webhooks).

---

## 1. Database

- **Migration** `scripts/004-phone-numbers-port-in-request-sid.sql`: add `port_in_request_sid` to `phone_numbers` (optional but useful for linking to Twilio and for "check status").
- **Lookup**: we need to find a `phone_numbers` row by **number** and **status = 'porting'** when the webhook fires (webhook has no user id). Add `getPhoneNumberByNumberAndStatus(number, status)` in `lib/db.ts`.
- **Update**: when port completes, set `twilio_sid` and `status = 'active'` (and clear or keep `port_in_request_sid`).

---

## 2. Twilio APIs (Backend Helpers)

Twilio uses two hosts:

- **Documents (upload)**  
  `POST https://numbers-upload.twilio.com/v1/Documents`  
  - Auth: Basic with Account SID + Auth Token.  
  - Body: multipart form with `document_type: "utility_bill"` and `File` (PDF/image, max 10MB).  
  - Response: document SID (e.g. `RD...`). Use this in the Port In request.

- **Port In (Numbers)**  
  `POST https://numbers.twilio.com/v1/Porting/PortIn`  
  - Auth: Basic with Account SID + Auth Token.  
  - Body (JSON):  
    - `account_sid`: your Twilio account.  
    - `target_port_in_date`: at least **7 days** in the future (US).  
    - `losing_carrier_information`:  
      - `customer_type`: `"Business"` or `"Individual"`.  
      - `customer_name`, `account_number`, `account_telephone_number`.  
      - `authorized_representative`, `authorized_representative_email`.  
      - `address`: `{ street, street_2?, city, state, zip, country }`.  
    - `phone_numbers`: `[{ "phone_number": "+1...", "pin": "..." }]` (pin required for mobile).  
    - `documents`: `["RD..."]` (at least one utility bill SID).  
    - Optional: `notification_emails`, `target_port_in_time_range_start/end`.  
  - Response: `port_in_request_sid` (KW...), status, and per-number `port_in_phone_number_sid` (PU...).

- **Porting webhook**  
  `POST https://numbers.twilio.com/v1/Porting/Configuration/Webhook`  
  - Set `port_in_target_url` to e.g. `https://your-app.com/api/numbers/porting-webhook`.  
  - Subscribe to at least: `PortInPhoneNumberCompleted`, `PortInPhoneNumberRejected`, `PortInActionRequired`, `PortInCompleted`.  
  - Webhook payload includes: `phone_number`, `status`, `port_in_request_sid`, `port_in_phone_number_sid`.  
  - When `status` is the event equivalent of "completed", we activate the number and set the voice URL.

Implement in `lib/twilio-porting.ts`:

- `uploadUtilityBill(file: Buffer, filename: string): Promise<string>` → document SID.  
- `createPortInRequest(params): Promise<{ port_in_request_sid, ... }>`.  
- `configurePortingWebhook(url: string): Promise<void>` (call once at deploy or first port).

Use `fetch()` with Basic auth; the main Twilio Node client may not expose the Numbers/Porting endpoints the same way.

---

## 3. API Routes

- **POST /api/numbers/port**  
  - If carrier is **Twilio**: keep current behavior (look up number, set voice URL, insert as active).  
  - If carrier is **other**:  
    - Validate body: number, current_carrier, LOA fields (customer_type, customer_name, account_number, account_telephone_number, authorized_representative, authorized_representative_email, address), and either `document_sid` or a file upload (then upload to Twilio and get document_sid).  
    - Compute `target_port_in_date` (e.g. 7 days from now).  
    - Call `createPortInRequest`, then `insertPhoneNumber` with status `porting` and `port_in_request_sid`.  
    - Return success and tell user to check email to sign the LOA.

- **POST /api/numbers/porting-webhook**  
  - No auth by cookie; validate using Twilio’s webhook signature if available for Numbers API (check Twilio docs).  
  - Parse body; if event is number completed (e.g. `PortInPhoneNumberCompleted` / status indicating completed):  
    - Find `phone_numbers` by `phone_number` and `status = 'porting'`.  
    - Call Twilio to list IncomingPhoneNumbers for that number → get SID.  
    - Update the number’s voice URL to `NEXT_PUBLIC_APP_URL + '/api/voice/incoming'` (and status callback if desired).  
    - Update our row: `twilio_sid = <sid>`, `status = 'active'`.  
  - Return 200 quickly so Twilio doesn’t retry.

- **Optional: POST /api/numbers/upload-port-document**  
  - Accept multipart file upload (utility bill).  
  - Call `uploadUtilityBill`, return `{ document_sid }` so the client can send it in the port request.

---

## 4. Types

- Extend `PortNumberRequest` (or add `PortFromOtherCarrierRequest`) with:  
  `customer_type`, `customer_name`, `account_number`, `account_telephone_number`, `authorized_representative`, `authorized_representative_email`, `address` (street, city, state, zip, country), `pin` (optional), `document_sid` (or omit if we upload in the same request).

---

## 5. UI (Settings + Onboarding)

- **When "Port Existing" is selected and carrier is not Twilio**, show the full LOA form:  
  - Number, current carrier (already there).  
  - Customer type: Business / Individual.  
  - Customer name (or business name).  
  - Account number, account telephone number.  
  - Authorized representative name, email (for LOA signature).  
  - Billing address: street, street_2, city, state, zip, country.  
  - PIN (optional; required for mobile).  
  - **Utility bill upload**: file input (PDF/image), then either:  
    - Call `POST /api/numbers/upload-port-document` and use returned `document_sid` in the port request, or  
    - Send file in same request as port (if API accepts multipart).  
- After submit: show “Port requested. Check your email to sign the Letter of Authorization. We’ll notify you when the number is active.”  
- Keep showing “Porting in progress” in Settings for numbers with status `porting`; when webhook sets them active, they flip to “Active” (and optionally show a one-time “Number is now active” message).

---

## 6. One-Time Setup

- **Configure porting webhook**  
  Once per environment (or once per Twilio account), call Twilio to set `port_in_target_url` to your `POST /api/numbers/porting-webhook` URL.

  **Option A – API route (recommended)**  
  Set `PORTING_WEBHOOK_SECRET` in env, then:

  ```bash
  curl -X POST https://YOUR_APP_URL/api/admin/configure-porting-webhook \
    -H "Authorization: Bearer YOUR_PORTING_WEBHOOK_SECRET"
  ```

  **Option B – From code**  
  Call `configurePortingWebhook(getAppUrl() + '/api/numbers/porting-webhook')` once (e.g. from a deploy script or admin page).

---

## 7. Environment

Add to `.env.local` (or your deploy env):

- `PORTING_WEBHOOK_SECRET` – Optional. If set, `POST /api/admin/configure-porting-webhook` requires `Authorization: Bearer <value>` so only you can trigger webhook config.
- Existing: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`.

---

## 8. Order of Implementation

1. Run migration `004-phone-numbers-port-in-request-sid.sql`.  
2. Add `getPhoneNumberByNumberAndStatus` and optional `updatePhoneNumberByNumber` (or reuse existing update by id).  
3. Implement `lib/twilio-porting.ts` (upload document, create port-in, configure webhook).  
4. Implement `POST /api/numbers/port` for non-Twilio with real Port In API call; store `port_in_request_sid`.  
5. Implement `POST /api/numbers/porting-webhook` and configure the webhook URL in Twilio.  
6. Extend types and UI for LOA fields + utility bill upload.  
7. Test with a real number (or Twilio’s sandbox if they offer one) and confirm webhook receives completed event and number goes active.

---

## Summary

- **Do we request the transfer?** Yes—by calling Twilio’s Port In API, Twilio requests the number from the losing carrier.  
- **Full control?** Yes—we collect LOA + document in the app, submit the port, and react to webhooks to activate the number and set the voice URL.  
- **Where does the number live?** In your Twilio account, configured to route calls to Zing like any other number we buy or connect.

This plan gets you to parity with other VoIP apps for in-app porting.
