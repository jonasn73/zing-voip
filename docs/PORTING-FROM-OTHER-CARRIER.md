# How Number Porting Works (Different Carrier)

## Current behavior in the app

When a customer chooses **Port Existing** and enters a carrier that is **not** Twilio (e.g. AT&T, Verizon, T-Mobile):

- We **save** the number and carrier in our database with status **"porting"**.
- We show **"Porting in progress"** in Settings.
- We **do not** yet submit a port request to any carrier or to Twilio.

So right now we are only **recording** that the customer wants to port. No request is sent to their current carrier or to Twilio.

**Update:** We now support full in-app porting when the user completes the account-details form and uploads a utility bill (see Settings → Port Existing and **docs/PORTING-IMPLEMENTATION-PLAN.md**).

---

## How real porting works (industry)

1. **Who requests the transfer**  
   The **gaining** carrier (the one who will own the number after the port) must request the number from the **losing** carrier (customer’s current provider).  
   For Zing, the gaining carrier is **Twilio** (our telephony provider). So Twilio would request the transfer from AT&T, Verizon, etc., on our behalf.

2. **What’s needed from the customer**  
   - **Letter of Authorization (LOA)** – customer authorizes the losing carrier to release the number to Twilio.  
   - Often: **account number**, **PIN**, and sometimes **bill copy** from the losing carrier.

3. **Where the number lives once ported**  
   After the port completes, the number **lives on your (Zing's) Twilio account**. So:
   - Bought numbers → Twilio  
   - Ported numbers (after port completes) → Twilio  
   All numbers that Zing uses for routing would sit in the same Twilio account; we’d point each number’s voice URL to our app so calls hit `/api/voice/incoming`.

---

## What we’d need to implement real porting

To actually port from another carrier through the app:

1. **Use Twilio’s Port In API** (or Twilio’s manual port process).
   - Create a port-in request with number + losing carrier.
   - Twilio can generate an electronic LOA and send it to the customer for signature.
   - Twilio submits the request to the losing carrier and handles the back-and-forth.

2. **Collect from the customer**  
   - Phone number, current carrier (and possibly account number / PIN if required).  
   - Any extra docs Twilio needs (e.g. proof of ownership).

3. **When the port completes**  
   - Twilio can notify us via webhook (or we poll).  
   - We then:  
     - Update our DB: set the number’s status to **active** and store the Twilio SID.  
     - Set the number’s voice URL in Twilio to our app (e.g. `NEXT_PUBLIC_APP_URL + '/api/voice/incoming'`), same as for bought numbers.

Until that’s built, “Port from different carrier” is intent-only: we show “Porting in progress” and the number would need to be ported via Twilio’s console or support, then manually added/updated in our system if desired.
