# Brand Protection & Trademark Strategy

Formal roadmap for protecting the **lyncr** brand name and identity. Use this to file a federal trademark, run clearance searches, and keep our IP documentation in sync with what is actually deployed in code.

> ⚠️ **Not legal advice.** This is an internal operational checklist. Engage a licensed trademark attorney before filing — they can confirm the correct classes, handle USPTO Office Actions, and run a professional clearance opinion. The USPTO does **not** allow refunds if a filing is rejected.

---

## 1. Trademark Filing Checklist (USPTO)

A step-by-step roadmap for filing a federal trademark for the **lyncr** word mark.

### Step 1 — Decide what you're filing
- **Mark type:** Start with the **standard character (word) mark** for `lyncr` — this protects the name itself regardless of font, color, or styling. (You can file a separate **design/logo mark** later once the logo is final.)
- **Owner:** File under the legal business entity (LLC / Inc.), **not** a personal name, so the asset stays with the company.

### Step 2 — Pick the filing basis
- **"Use in Commerce" (§1(a))** — if lyncr is already live and serving paying/real customers (it is, at `lyncr.app`). Requires a specimen showing the mark in actual use.
- **"Intent to Use" (§1(b))** — only if you haven't launched yet. Costs more over time (extra filing + fee once you start using it).
- ➡️ **Recommended: §1(a) Use in Commerce**, since the dashboard is live.

### Step 3 — Identify the correct International Class
- **Class 42 — primary.** Covers Software-as-a-Service (SaaS), platform-as-a-service, and the design/development of computer software. This is the right class for our **automated call-routing platform and cloud dashboard utility**.
  - Example identification of goods/services: *"Software as a service (SAAS) services featuring software for cloud-based telephone call routing, call dispatch, and virtual receptionist management."*
- **Class 38 — strongly consider adding.** Covers **telecommunications services** (transmission of voice/calls, VoIP). Because lyncr literally routes and connects phone calls, a 38 filing protects the telecom side of the offering.
  - Example identification: *"Telecommunications services, namely, routing of telephone calls; voice-over-internet-protocol (VoIP) services."*
- **Note:** Each additional class = an additional government filing fee (currently ~$350/class on TEAS, subject to change). Confirm current fees on USPTO before filing.

### Step 4 — Choose the filing system
- File electronically via **USPTO TEAS** (Trademark Electronic Application System) at <https://www.uspto.gov/trademarks>.
- Use the **base application** option (more flexible than the reduced-fee "Plus" tier if our service description doesn't fit the pre-approved ID Manual entries exactly).

### Step 5 — Gather "Specimens of Use"
A specimen must show the mark **actively providing the service to customers** — not just a logo on a business card. Collect clean, full-resolution captures of:
- [ ] **Live dashboard canvas** — screenshot of the call-routing dashboard with the `lyncr` wordmark visible in the header/nav (e.g. `/dashboard`).
- [ ] **Active login / signup interface** — the `/login` and `/signup` screens showing the brand name where users access the service.
- [ ] **Marketing / landing page** — the public homepage (`lyncr.app`) showing the brand name actively offering call-routing services, ideally with a visible URL bar.
- [ ] **In-context service screen** — e.g. a screen showing the service being delivered (routing config, activity log) to demonstrate the mark used "in connection with" the Class 42/38 services.
- **Specimen rules of thumb:** must show the mark + a clear association with the listed service, must be a real screenshot (not a mockup), and the URL/browser chrome should be visible to prove it's a live web service.

### Step 6 — File and monitor
- [ ] Submit the application; record the **serial number**.
- [ ] Watch for an assigned **Examining Attorney** (~3–8 months).
- [ ] Respond to any **Office Action** within the deadline (currently 3 months, extendable once for a fee).
- [ ] After approval, the mark publishes for **opposition** (30 days for third parties to object).
- [ ] On registration, calendar the **maintenance deadlines**: §8 Declaration of Use between years 5–6, and §8 + §9 renewal every 10 years.

---

## 2. Trademark Search & Clearance Strategy

**Do this BEFORE filing.** A confusingly similar existing mark can get the application rejected (and burns the non-refundable fee).

- [ ] **Search USPTO TESS** (Trademark Electronic Search System) at <https://tmsearch.uspto.gov/>.
- [ ] Search for **literal matches**: `lyncr`.
- [ ] Search for **phonetic / confusingly similar** marks — the USPTO rejects on *likelihood of confusion*, not just identical spelling. Check variants such as:
  - `lynk`, `link`, `linker`, `lyncr`, `lyncer`, `linc`, `lincr`, `lynx`, `lings`, `lyncro`
- [ ] **Scope the search to the relevant space** — telecommunications (Class 38) and cloud/software utilities (Class 42). A similar mark selling unrelated goods (e.g. clothing) is generally less of a conflict than one in telecom/SaaS.
- [ ] **Check common-law use** beyond the USPTO: Google, app stores (Apple App Store / Google Play), domain registrars, and state business registrations — unregistered marks can still create priority rights.
- [ ] Document the search results (date, screenshots, terms used) so we have a record of due diligence.
- [ ] If anything close surfaces in Class 38/42, **stop and consult counsel** before filing.

---

## 3. Brand Identity Inventory

Track core brand elements and keep this table in sync with the **live code deployment** (`lib/brand.ts`, deployed at `lyncr.app`). Update the status column as filings progress.

### Names & wordmarks

| Asset | Value | Source in code | Usage status | Protection status |
|-------|-------|----------------|--------------|-------------------|
| Primary brand name | `lyncr` | `SITE_NAME` (`lib/brand.ts`) | ✅ Active — live in production | ☐ Trademark not yet filed |
| Wordmark (styling) | `lyncr` (always lowercase) | `SITE_WORDMARK` (`lib/brand.ts`) | ✅ Active — navbar + auth screens | ☐ Pending word-mark filing |
| Tagline | "Link every call to the right answer." | `SITE_TAGLINE` (`lib/brand.ts`) | ✅ Active — metadata + hero | ☐ Optional separate slogan mark |
| Prior / alternate names | HeySigo, Hey Sigo, Sigo, Zing | `SITE_ALTERNATE_NAMES` (`lib/brand.ts`) | ⚠️ Legacy — SEO `alternateName` only | ☐ Decide: abandon or defensively hold |

### Logo & visual identity

| Asset | Description | Location | Usage status | Protection status |
|-------|-------------|----------|--------------|-------------------|
| Primary logo / wordmark lockup | _TBD — confirm final file_ | _e.g. `public/` or `mobile/assets/`_ | ⏳ Verify before filing design mark | ☐ Design mark not filed |
| App icon (mobile) | 1024×1024 icon | `mobile/assets/icon.png` | ✅ Used for store builds | ☐ Not separately filed |
| Brand color signal | Deep ink bg + violet–indigo signal | `BRAND_GUIDE.look` (`lib/brand.ts`) | ✅ Active design system | n/a (not trademarkable alone) |

### Domains & handles

| Asset | Value | Usage status | Protection status |
|-------|-------|--------------|-------------------|
| Canonical domain | `lyncr.app` | ✅ Live production (Vercel alias) | ✅ Registered — confirm auto-renew + lock |
| Canonical URL constant | `https://lyncr.app` | `SITE_CANONICAL_URL` (`lib/brand.ts`) | ✅ In code | n/a |
| Defensive domains | _e.g. `lyncr.com`, `getlyncr.com`, `lyncr.io`_ | ⏳ TBD — acquire if available | ☐ Pending registration |
| Social handles | _e.g. @lyncr / @getlyncr_ | ⏳ TBD — reserve | ☐ Pending |

> **Sync rule:** Whenever `lib/brand.ts` changes (name, tagline, alternate names) or a new domain/deployment goes live, update this inventory so our IP documentation always matches the active code deployment.

---

## Quick reference

| Item | Detail |
|------|--------|
| Brand name | **lyncr** |
| Filing system | USPTO TEAS — <https://www.uspto.gov/trademarks> |
| Search system | USPTO TESS — <https://tmsearch.uspto.gov/> |
| Primary class | **Class 42** (SaaS / software utilities) |
| Secondary class | **Class 38** (telecommunications / call routing) |
| Recommended basis | §1(a) Use in Commerce (service is live) |
| Live deployment | `https://lyncr.app` |

---

_Last reviewed: keep this date current whenever the inventory or filing status changes._
