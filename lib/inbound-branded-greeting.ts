// Branded inbound caller greeting — workspace name from the dialed line's organization context.

import { getTexmlSayVoiceAttributes, texmlSayMessageBody } from "@/lib/texml-say-voice"
import { escapeXmlAttr } from "@/lib/telnyx-inbound-media-quality"

/** Routing row fields used to pick the speakable workspace / brand label. */
export type InboundWorkspaceRoutingLike = {
  organization_name?: string | null
  phone_line_label?: string | null
  business_name?: string | null
}

/** Prefer workspace (organization) name, then non-default line label, then account business name. */
export function resolveWorkspaceDisplayName(routing: InboundWorkspaceRoutingLike): string {
  const org = routing.organization_name?.trim()
  if (org) return org
  const lbl = routing.phone_line_label?.trim() ?? ""
  if (lbl && lbl.toLowerCase() !== "main line") return lbl
  const biz = routing.business_name?.trim()
  if (biz) return biz
  return "our business"
}

/** Caller-facing phrase played before we `<Dial>` the technician / owner leg. */
export function buildInboundCallerGreetingText(workspaceName: string): string {
  const name = workspaceName.trim() || "our business"
  return `Thank you for calling ${name}. Please wait while we connect your call to a team member.`
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Raw TeXML `<Say>` tag with neural Polly voice (matches `texmlSayNatural`). */
export function buildTexmlCallerGreetingSayTag(plainGreeting: string): string {
  const attrs = getTexmlSayVoiceAttributes()
  const body = texmlSayMessageBody(plainGreeting)
  const content = body.startsWith("<prosody") ? body : escapeXmlText(body)
  return `<Say voice="${escapeXmlAttr(attrs.voice)}" language="${escapeXmlAttr(attrs.language)}">${content}</Say>`
}

/** Prepend a branded `<Say>` immediately after the opening `<Response>` tag. */
export function prependInboundCallerGreetingToResponseTexml(texmlXml: string, greetingText: string): string {
  const say = buildTexmlCallerGreetingSayTag(greetingText)
  if (texmlXml.includes("<Response>")) {
    return texmlXml.replace("<Response>", `<Response>\n  ${say}`)
  }
  if (texmlXml.includes("<Response ")) {
    return texmlXml.replace(/<Response\s[^>]*>/, (open) => `${open}\n  ${say}`)
  }
  return texmlXml
}
