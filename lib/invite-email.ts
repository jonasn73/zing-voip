// Receptionist invite email payload — ready for Resend (or any HTTP email API).

export type ReceptionistInviteEmailPayload = {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

/** Build a Resend-compatible JSON body for a receptionist invite. */
export function buildReceptionistInviteEmailPayload(params: {
  toEmail: string
  firstName: string
  signupUrl: string
  payoutRateUsd: number
}): ReceptionistInviteEmailPayload {
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Lyncr <onboarding@lyncr.app>"
  const name = params.firstName.trim() || "there"
  const rate = params.payoutRateUsd.toFixed(2)

  const text = [
    `Hi ${name},`,
    "",
    "You've been invited to join Lyncr as a receptionist.",
    `Your default payout rate is $${rate} per answered call.`,
    "",
    `Create your account here (link expires in 7 days):`,
    params.signupUrl,
    "",
    "— Lyncr",
  ].join("\n")

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>You've been invited to join <strong>Lyncr</strong> as a receptionist.</p>
    <p>Your default payout rate is <strong>$${rate}</strong> per answered call.</p>
    <p><a href="${escapeHtml(params.signupUrl)}">Create your receptionist account</a></p>
    <p style="color:#666;font-size:12px;">This link expires in 7 days.</p>
  `.trim()

  return {
    from,
    to: params.toEmail.trim().toLowerCase(),
    subject: "You're invited to Lyncr — receptionist account",
    html,
    text,
  }
}

/** Send via Resend when RESEND_API_KEY is configured; otherwise no-op. */
export async function sendReceptionistInviteEmail(
  payload: ReceptionistInviteEmailPayload
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY not configured — copy signup link manually" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string }
      return { sent: false, error: json.message ?? `Resend HTTP ${res.status}` }
    }
    return { sent: true }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Email send failed" }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
