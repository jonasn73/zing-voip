// ============================================
// Receptionist invitations (dedicated `invitations` table, native Neon SQL — no ORM)
// ============================================
// Self-contained invite store for the admin onboarding flow:
//   admin "Invite receptionist" → POST /api/admin/invite (EMAIL or SMS) → /register?token=…
//
// The table is created on demand via `CREATE TABLE IF NOT EXISTS` (ensureInvitationsTable),
// and every read/write uses parameterized neon tagged-template queries.

import { neon } from "@neondatabase/serverless"
import { resolveNeonDatabaseUrl } from "@/lib/neon-database-url"
import {
  createUser,
  getAuthUserByEmail,
  insertReceptionistPortal,
  normalizePhoneNumberE164,
} from "@/lib/db"
import { LYNCR_ADMIN_EMAIL } from "@/lib/lyncr-admin"
import type { User } from "@/lib/types"

export type InviteType = "EMAIL" | "SMS"
export type InviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED"

export interface Invitation {
  id: string
  target: string
  type: InviteType
  token: string
  status: InviteStatus
  created_at: string
  expires_at: string
}

/** Default invite payout applied to the receptionist row on accept. */
const DEFAULT_PAYOUT_USD = 2.5
/** Invites are valid for 48 hours from creation. */
export const INVITATION_TTL_MS = 48 * 60 * 60 * 1000

// Lazy Neon client (same native driver the rest of the app uses).
let cachedSql: ReturnType<typeof neon> | null = null
function getSql(): ReturnType<typeof neon> {
  if (cachedSql) return cachedSql
  cachedSql = neon(resolveNeonDatabaseUrl())
  return cachedSql
}

// Create the table at most once per server instance (idempotent + cheap thereafter).
let ensured = false
export async function ensureInvitationsTable(): Promise<void> {
  if (ensured) return
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      target TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'EMAIL' CHECK (type IN ('EMAIL', 'SMS')),
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations (token)`
  ensured = true
}

function parseRow(row: Record<string, unknown>): Invitation {
  return {
    id: String(row.id),
    target: String(row.target),
    type: String(row.type).toUpperCase() === "SMS" ? "SMS" : "EMAIL",
    token: String(row.token),
    status: ["ACCEPTED", "EXPIRED"].includes(String(row.status).toUpperCase())
      ? (String(row.status).toUpperCase() as InviteStatus)
      : "PENDING",
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    expires_at: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
  }
}

/** Insert a new pending invitation (parameterized). */
export async function createInvitation(params: {
  target: string
  type: InviteType
  token: string
  expiresAt: string
}): Promise<Invitation> {
  await ensureInvitationsTable()
  const sql = getSql()
  const rows = await sql`
    INSERT INTO invitations (target, type, token, status, expires_at)
    VALUES (${params.target}, ${params.type}, ${params.token}, 'PENDING', ${params.expiresAt}::timestamptz)
    RETURNING *
  `
  return parseRow(rows[0] as Record<string, unknown>)
}

/** Look up an invitation by its token. */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  await ensureInvitationsTable()
  const sql = getSql()
  const rows = await sql`SELECT * FROM invitations WHERE token = ${token.trim()} LIMIT 1`
  return rows[0] ? parseRow(rows[0] as Record<string, unknown>) : null
}

/**
 * Return the invitation only if it's still redeemable (PENDING + not past expiry).
 * Lazily flips a stale PENDING row to EXPIRED so status stays truthful.
 */
export async function getRedeemableInvitation(token: string): Promise<Invitation | null> {
  const invite = await getInvitationByToken(token)
  if (!invite) return null
  if (invite.status === "ACCEPTED") return null
  if (Date.parse(invite.expires_at) < Date.now()) {
    if (invite.status !== "EXPIRED") {
      const sql = getSql()
      await sql`UPDATE invitations SET status = 'EXPIRED' WHERE token = ${token.trim()} AND status = 'PENDING'`
    }
    return null
  }
  return invite
}

/**
 * Redeem an invitation from /register: create linked users + receptionists rows (owned by the
 * Lyncr admin), set a sip_username placeholder, and mark the invitation ACCEPTED.
 *   - EMAIL invites: the login email is the invite target.
 *   - SMS invites: the invitee supplies an email here; the target phone pre-fills the form.
 */
export async function acceptInvitation(params: {
  token: string
  fullName: string
  phone: string
  passwordHash: string
  email?: string | null
}): Promise<{ user: User }> {
  const invite = await getRedeemableInvitation(params.token)
  if (!invite) throw new Error("Invite invalid, expired, or already used")

  const fullName = params.fullName.trim()
  if (fullName.length < 2) throw new Error("Full name is required")

  const email =
    invite.type === "EMAIL" ? invite.target.trim().toLowerCase() : (params.email ?? "").trim().toLowerCase()
  if (!email.includes("@")) throw new Error("A valid email is required to create your login")

  const phone = normalizePhoneNumberE164(params.phone)

  // Receptionists need an owning account; admin-issued invites are owned by the Lyncr admin.
  const owner = await getAuthUserByEmail(LYNCR_ADMIN_EMAIL)
  if (!owner) throw new Error("Lyncr admin account not found — run scripts/032-bootstrap-lyncr-admin.sql")

  const user = await createUser({
    email,
    name: fullName,
    phone,
    business_name: "Lyncr Receptionist",
    industry: "generic",
    password_hash: params.passwordHash,
    account_role: "receptionist",
  })

  const receptionist = await insertReceptionistPortal({
    owner_user_id: owner.id,
    portal_user_id: user.id,
    name: fullName,
    phone,
    flat_rate_usd: DEFAULT_PAYOUT_USD,
  })

  // sip_username placeholder (050) — real Telnyx credential is auto-provisioned on first WEB use.
  try {
    const sql = getSql()
    const placeholder = `lyncr_pending_${receptionist.id.replace(/-/g, "").slice(0, 12)}`
    await sql`UPDATE receptionists SET sip_username = ${placeholder} WHERE id = ${receptionist.id}`
  } catch {
    /* sip_username column may not exist pre-050 — non-critical */
  }

  const sql = getSql()
  await sql`UPDATE invitations SET status = 'ACCEPTED' WHERE token = ${params.token.trim()}`

  return { user: { ...user, account_role: "receptionist" } }
}
