import { getAppUrl } from "@/lib/telnyx"

/** G.711 μ-law (PCMU) — best PSTN clarity; comma-list allows Telnyx to offer only these codecs. */
export function readInboundDialPreferredCodecs(): string {
  const raw = (process.env.ZING_INBOUND_DIAL_PREFERRED_CODECS || "PCMU").trim()
  return raw || "PCMU"
}

/**
 * Symmetric RTP on the outbound PSTN leg — keeps media paths aligned after the bridge.
 * Set `ZING_INBOUND_DIAL_RTP_SYMMETRIC=0` to disable if a carrier rejects the attribute.
 */
export function readInboundDialRtpSymmetric(): boolean {
  const raw = (process.env.ZING_INBOUND_DIAL_RTP_SYMMETRIC || "").trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "no") return false
  return true
}

/** US ringback while the B-leg is ringing (`answerOnBridge` preserves caller-side ringing). */
export function readInboundDialRingTone(): string {
  const raw = (process.env.ZING_INBOUND_DIAL_RING_TONE || "us").trim()
  return raw || "us"
}

/**
 * Two-phase inbound: instant TeXML redirect before DB routing (pass 2 adds `<Dial>`).
 * Disable with `ZING_INBOUND_EARLY_MEDIA=0` if you need single-hop debugging.
 */
export function readInboundEarlyMediaEnabled(): boolean {
  const raw = (process.env.ZING_INBOUND_EARLY_MEDIA || "").trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "no") return false
  return true
}

/** Optional hosted ringback MP3/WAV played on pass 1 while pass 2 loads routing (see `ZING_INBOUND_EARLY_MEDIA_RING_URL`). */
export function readInboundEarlyMediaRingUrl(): string | null {
  const custom = process.env.ZING_INBOUND_EARLY_MEDIA_RING_URL?.trim()
  if (custom) return custom
  return null
}

export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** Pass 1 — return immediately so Telnyx can keep the caller in ringing / early-media while we load routing. */
export function buildInboundEarlyMediaTexml(continueUrl: string): string {
  const ringUrl = readInboundEarlyMediaRingUrl()
  const safeUrl = escapeXmlAttr(continueUrl)
  if (ringUrl) {
    const safeRing = escapeXmlAttr(ringUrl)
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play loop="999">${safeRing}</Play>
  <Redirect method="POST">${safeUrl}</Redirect>
</Response>`
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${safeUrl}</Redirect>
</Response>`
}

/** Build continue URL for routing pass 2 (preserves query string, adds zingRoute=1). */
export function buildInboundRoutingContinueUrl(reqUrl: string): string {
  const url = new URL(reqUrl)
  url.searchParams.set("zingRoute", "1")
  return url.toString()
}

/** Shared `<Dial>` attributes for inbound PSTN forwarding — ringback + bridge timing. */
export function buildInboundPstnDialAttributes(opts: {
  callerId?: string
  fromDisplayName?: string
  answerOnBridge: boolean
  timeout: number
  action: string
  method?: "GET" | "POST"
}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {
    answerOnBridge: opts.answerOnBridge,
    ringTone: readInboundDialRingTone(),
    timeout: opts.timeout,
    action: opts.action,
    method: opts.method ?? "POST",
  }
  if (opts.callerId) out.callerId = opts.callerId
  if (opts.fromDisplayName) out.fromDisplayName = opts.fromDisplayName
  return out
}

/** Telnyx-extended `<Number>` attributes for codec + symmetric RTP on the forwarded leg. */
export function buildInboundPstnNumberAttributes(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {
    preferred_codecs: readInboundDialPreferredCodecs(),
  }
  if (readInboundDialRtpSymmetric()) {
    out.rtp_symmetric = true
  }
  return out
}

/** Inject Telnyx media attributes onto `<Number>` tags in generated TeXML. */
export function finalizeInboundTexmlXml(xml: string): string {
  const codecs = readInboundDialPreferredCodecs()
  const symmetric = readInboundDialRtpSymmetric()
  if (!codecs && !symmetric) return xml

  return xml.replace(/<Number(\s[^>]*>|>)/g, (match) => {
    let extra = ""
    if (codecs && !/preferred_codecs=/.test(match)) {
      extra += ` preferred_codecs="${escapeXmlAttr(codecs)}"`
    }
    if (symmetric && !/rtp_symmetric=/.test(match)) {
      extra += ` rtp_symmetric="true"`
    }
    if (!extra) return match
    return match.replace("<Number", `<Number${extra}`)
  })
}

/** Log-friendly app base URL (used when building early-media continue links). */
export function inboundVoiceAppBaseUrl(): string {
  return getAppUrl()
}