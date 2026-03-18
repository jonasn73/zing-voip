// ============================================
// Zing - Database Client
// ============================================
// Uses Neon serverless when DATABASE_URL is set (production / live app).
// Set DATABASE_URL in Vercel → Settings → Environment Variables, then run
// scripts/001-create-schema.sql and scripts/002-add-password-hash.sql in your Neon SQL Editor.

import { neon } from "@neondatabase/serverless"
import type {
  RoutingConfig,
  Receptionist,
  User,
  CallLog,
  PhoneNumber,
} from "./types"

// Lazy Neon client so we only connect when DATABASE_URL is set
function getSql(): ReturnType<typeof neon> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables (and in .env.local for local dev).")
  return neon(url)
}

// --- Query functions ---

// Parse a routing_config row into a RoutingConfig object
function parseRoutingRow(row: Record<string, unknown>): RoutingConfig {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_number: row.business_number != null ? String(row.business_number) : null,
    selected_receptionist_id: row.selected_receptionist_id != null ? String(row.selected_receptionist_id) : null,
    fallback_type: row.fallback_type as RoutingConfig["fallback_type"],
    ai_greeting: String(row.ai_greeting ?? ""),
    ring_timeout_seconds: Number(row.ring_timeout_seconds ?? 30),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }
}

// Get the default (global) routing config for a user (business_number IS NULL)
export async function getRoutingConfig(userId: string): Promise<RoutingConfig | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, user_id, business_number, selected_receptionist_id, fallback_type, ai_greeting, ring_timeout_seconds, updated_at
    FROM routing_config WHERE user_id = ${userId} AND business_number IS NULL LIMIT 1
  `
  return rows[0] ? parseRoutingRow(rows[0]) : null
}

// Get routing config for a specific business number, falling back to the default config
export async function getRoutingConfigForNumber(userId: string, businessNumber: string): Promise<RoutingConfig | null> {
  const sql = getSql()
  // Try number-specific config first
  const specific = await sql`
    SELECT id, user_id, business_number, selected_receptionist_id, fallback_type, ai_greeting, ring_timeout_seconds, updated_at
    FROM routing_config WHERE user_id = ${userId} AND business_number = ${businessNumber} LIMIT 1
  `
  if (specific[0]) return parseRoutingRow(specific[0])
  // Fall back to default config
  return getRoutingConfig(userId)
}

// Get all routing configs for a user (default + per-number)
export async function getAllRoutingConfigs(userId: string): Promise<RoutingConfig[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, user_id, business_number, selected_receptionist_id, fallback_type, ai_greeting, ring_timeout_seconds, updated_at
    FROM routing_config WHERE user_id = ${userId} ORDER BY business_number NULLS FIRST
  `
  return rows.map(parseRoutingRow)
}

// Update routing config (only updates fields that are present)
// If businessNumber is provided, updates (or creates) the config for that number
export async function updateRoutingConfig(
  userId: string,
  updates: Partial<Pick<RoutingConfig, "selected_receptionist_id" | "fallback_type" | "ai_greeting" | "ring_timeout_seconds">>,
  businessNumber?: string | null
): Promise<void> {
  const sql = getSql()
  const bn = businessNumber ?? null

  // Upsert: create per-number config if it doesn't exist yet
  if (bn) {
    const existing = await sql`
      SELECT id FROM routing_config WHERE user_id = ${userId} AND business_number = ${bn} LIMIT 1
    `
    if (!existing[0]) {
      await sql`
        INSERT INTO routing_config (id, user_id, business_number, selected_receptionist_id, fallback_type, ai_greeting, ring_timeout_seconds, updated_at)
        VALUES (${crypto.randomUUID()}, ${userId}, ${bn}, ${updates.selected_receptionist_id ?? null}, ${updates.fallback_type ?? "owner"}, ${updates.ai_greeting ?? ""}, ${updates.ring_timeout_seconds ?? 30}, now())
      `
      return
    }
  }

  // Update existing row
  const whereClause = bn
    ? sql`user_id = ${userId} AND business_number = ${bn}`
    : sql`user_id = ${userId} AND business_number IS NULL`

  if (updates.selected_receptionist_id !== undefined) {
    await sql`UPDATE routing_config SET selected_receptionist_id = ${updates.selected_receptionist_id}, updated_at = now() WHERE ${whereClause}`
  }
  if (updates.fallback_type !== undefined) {
    await sql`UPDATE routing_config SET fallback_type = ${updates.fallback_type}, updated_at = now() WHERE ${whereClause}`
  }
  if (updates.ai_greeting !== undefined) {
    await sql`UPDATE routing_config SET ai_greeting = ${updates.ai_greeting}, updated_at = now() WHERE ${whereClause}`
  }
  if (updates.ring_timeout_seconds !== undefined) {
    await sql`UPDATE routing_config SET ring_timeout_seconds = ${updates.ring_timeout_seconds}, updated_at = now() WHERE ${whereClause}`
  }
}

// Delete a per-number routing config (reverts to default)
export async function deleteRoutingConfigForNumber(userId: string, businessNumber: string): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM routing_config WHERE user_id = ${userId} AND business_number = ${businessNumber}`
}

// Parse a receptionists row from the database
function parseReceptionistRow(row: Record<string, unknown>): Receptionist {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    phone: String(row.phone),
    initials: String(row.initials ?? ""),
    color: String(row.color ?? "bg-primary"),
    rate_per_minute: Number(row.rate_per_minute ?? 0.25),
    is_active: row.is_active !== false,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

// Get a receptionist by ID
export async function getReceptionist(receptionistId: string): Promise<Receptionist | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, user_id, name, phone, initials, color, rate_per_minute, is_active, created_at
    FROM receptionists WHERE id = ${receptionistId} LIMIT 1
  `
  return rows[0] ? parseReceptionistRow(rows[0]) : null
}

// Get all receptionists for a user
export async function getReceptionists(userId: string): Promise<Receptionist[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, user_id, name, phone, initials, color, rate_per_minute, is_active, created_at
    FROM receptionists WHERE user_id = ${userId} ORDER BY created_at ASC
  `
  return rows.map(parseReceptionistRow)
}

// Create a receptionist
export async function insertReceptionist(params: {
  user_id: string
  name: string
  phone: string
}): Promise<Receptionist> {
  const sql = getSql()
  const id = crypto.randomUUID()
  const nameParts = params.name.trim().split(/\s+/)
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : params.name.slice(0, 2).toUpperCase()
  const colors = ["bg-primary", "bg-chart-2", "bg-chart-5", "bg-chart-3", "bg-chart-4"]
  const color = colors[Math.floor(Math.random() * colors.length)]

  await sql`
    INSERT INTO receptionists (id, user_id, name, phone, initials, color, rate_per_minute, is_active, created_at)
    VALUES (${id}, ${params.user_id}, ${params.name}, ${params.phone}, ${initials}, ${color}, 0.25, true, now())
  `
  return {
    id,
    user_id: params.user_id,
    name: params.name,
    phone: params.phone,
    initials,
    color,
    rate_per_minute: 0.25,
    is_active: true,
    created_at: new Date().toISOString(),
  }
}

// Update a receptionist
export async function updateReceptionist(
  receptionistId: string,
  userId: string,
  updates: Partial<Pick<Receptionist, "name" | "phone" | "is_active" | "rate_per_minute">>
): Promise<void> {
  const sql = getSql()
  if (updates.name !== undefined) {
    await sql`UPDATE receptionists SET name = ${updates.name} WHERE id = ${receptionistId} AND user_id = ${userId}`
  }
  if (updates.phone !== undefined) {
    await sql`UPDATE receptionists SET phone = ${updates.phone} WHERE id = ${receptionistId} AND user_id = ${userId}`
  }
  if (updates.is_active !== undefined) {
    await sql`UPDATE receptionists SET is_active = ${updates.is_active} WHERE id = ${receptionistId} AND user_id = ${userId}`
  }
  if (updates.rate_per_minute !== undefined) {
    await sql`UPDATE receptionists SET rate_per_minute = ${updates.rate_per_minute} WHERE id = ${receptionistId} AND user_id = ${userId}`
  }
}

// Delete a receptionist
export async function deleteReceptionist(receptionistId: string, userId: string): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM receptionists WHERE id = ${receptionistId} AND user_id = ${userId}`
}

// Get user by email (for auth login; includes password_hash)
export async function getAuthUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, email, name, phone, business_name, vapi_assistant_id, password_hash, created_at
    FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    ...parseUserRow(row),
    password_hash: String(row.password_hash),
  }
}

// Create user (for auth signup); also creates routing_config row
export async function createUser(params: {
  email: string
  name: string
  phone: string
  business_name: string
  password_hash: string
}): Promise<User> {
  const sql = getSql()
  const id = crypto.randomUUID()
  await sql`
    INSERT INTO users (id, email, name, phone, business_name, password_hash, created_at)
    VALUES (${id}, ${params.email}, ${params.name}, ${params.phone}, ${params.business_name}, ${params.password_hash}, now())
  `
  await sql`
    INSERT INTO routing_config (id, user_id, selected_receptionist_id, fallback_type, ai_greeting, ring_timeout_seconds, updated_at)
    VALUES (${crypto.randomUUID()}, ${id}, NULL, 'owner', '', 30, now())
  `
  return {
    id,
    email: params.email,
    name: params.name,
    phone: params.phone,
    business_name: params.business_name,
    created_at: new Date().toISOString(),
  }
}

function parseUserRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    phone: String(row.phone),
    business_name: String(row.business_name ?? "My Business"),
    vapi_assistant_id: row.vapi_assistant_id ? String(row.vapi_assistant_id) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

// Get user by phone number they own (joins phone_numbers → users)
export async function getUserByPhoneNumber(toNumber: string): Promise<User | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.phone, u.business_name, u.vapi_assistant_id, u.created_at
    FROM users u
    JOIN phone_numbers pn ON pn.user_id = u.id
    WHERE pn.number = ${toNumber} AND pn.status = 'active'
    LIMIT 1
  `
  return rows[0] ? parseUserRow(rows[0]) : null
}

// Get user by ID
export async function getUser(userId: string): Promise<User | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, email, name, phone, business_name, vapi_assistant_id, created_at
    FROM users WHERE id = ${userId} LIMIT 1
  `
  return rows[0] ? parseUserRow(rows[0]) : null
}

// Update current user profile
export async function updateUser(
  userId: string,
  updates: { phone?: string; name?: string; business_name?: string; vapi_assistant_id?: string | null }
): Promise<void> {
  const sql = getSql()
  if (updates.phone !== undefined) {
    await sql`UPDATE users SET phone = ${updates.phone} WHERE id = ${userId}`
  }
  if (updates.name !== undefined) {
    await sql`UPDATE users SET name = ${updates.name} WHERE id = ${userId}`
  }
  if (updates.business_name !== undefined) {
    await sql`UPDATE users SET business_name = ${updates.business_name} WHERE id = ${userId}`
  }
  if (updates.vapi_assistant_id !== undefined) {
    await sql`UPDATE users SET vapi_assistant_id = ${updates.vapi_assistant_id} WHERE id = ${userId}`
  }
}

// Insert a call log
export async function insertCallLog(log: Omit<CallLog, "id" | "created_at">): Promise<void> {
  const sql = getSql()
  await sql`
    INSERT INTO call_logs (
      user_id, twilio_call_sid, from_number, to_number, caller_name,
      call_type, status, duration_seconds, routed_to_receptionist_id,
      routed_to_name, has_recording, recording_url, recording_duration_seconds
    ) VALUES (
      ${log.user_id}, ${log.twilio_call_sid}, ${log.from_number}, ${log.to_number}, ${log.caller_name},
      ${log.call_type}, ${log.status}, ${log.duration_seconds}, ${log.routed_to_receptionist_id},
      ${log.routed_to_name}, ${log.has_recording}, ${log.recording_url}, ${log.recording_duration_seconds}
    )
  `
}

// Update a call log (e.g., when status callback arrives)
export async function updateCallLog(
  twilioCallSid: string,
  updates: Partial<Pick<CallLog, "status" | "duration_seconds" | "call_type" | "has_recording" | "recording_url" | "recording_duration_seconds">>
): Promise<void> {
  const sql = getSql()
  if (updates.status !== undefined) {
    await sql`UPDATE call_logs SET status = ${updates.status} WHERE twilio_call_sid = ${twilioCallSid}`
  }
  if (updates.duration_seconds !== undefined) {
    await sql`UPDATE call_logs SET duration_seconds = ${updates.duration_seconds} WHERE twilio_call_sid = ${twilioCallSid}`
  }
  if (updates.call_type !== undefined) {
    await sql`UPDATE call_logs SET call_type = ${updates.call_type} WHERE twilio_call_sid = ${twilioCallSid}`
  }
  if (updates.has_recording !== undefined) {
    await sql`UPDATE call_logs SET has_recording = ${updates.has_recording}, recording_url = ${updates.recording_url ?? null}, recording_duration_seconds = ${updates.recording_duration_seconds ?? null} WHERE twilio_call_sid = ${twilioCallSid}`
  }
}

// Get call logs for a user (paginated)
export async function getCallLogs(
  userId: string,
  options?: { limit?: number; offset?: number; type?: string }
): Promise<CallLog[]> {
  const sql = getSql()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let rows
  if (options?.type) {
    rows = await sql`
      SELECT * FROM call_logs
      WHERE user_id = ${userId} AND call_type = ${options.type}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `
  } else {
    rows = await sql`
      SELECT * FROM call_logs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `
  }

  return rows.map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    twilio_call_sid: String(row.twilio_call_sid),
    from_number: String(row.from_number),
    to_number: String(row.to_number),
    caller_name: row.caller_name ? String(row.caller_name) : null,
    call_type: String(row.call_type) as CallLog["call_type"],
    status: String(row.status),
    duration_seconds: Number(row.duration_seconds),
    routed_to_receptionist_id: row.routed_to_receptionist_id ? String(row.routed_to_receptionist_id) : null,
    routed_to_name: row.routed_to_name ? String(row.routed_to_name) : null,
    has_recording: Boolean(row.has_recording),
    recording_url: row.recording_url ? String(row.recording_url) : null,
    recording_duration_seconds: row.recording_duration_seconds ? Number(row.recording_duration_seconds) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }))
}

function parsePhoneNumberRow(row: Record<string, unknown>): PhoneNumber {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    twilio_sid: String(row.twilio_sid ?? ""),
    number: String(row.number),
    friendly_name: String(row.friendly_name ?? ""),
    label: String(row.label ?? "Business Line"),
    type: (row.type as "local" | "toll-free") || "local",
    status: (row.status as "active" | "pending" | "porting") || "active",
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

// Get phone numbers for a user
export async function getPhoneNumbers(userId: string): Promise<PhoneNumber[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, user_id, twilio_sid, number, friendly_name, label, type, status, created_at
    FROM phone_numbers WHERE user_id = ${userId} ORDER BY created_at ASC
  `
  return rows.map(parsePhoneNumberRow)
}

// Insert a phone number (after purchase or port)
export async function insertPhoneNumber(params: {
  user_id: string
  number: string
  friendly_name: string
  label?: string
  type?: "local" | "toll-free"
  status?: "active" | "pending" | "porting"
  twilio_sid?: string
}): Promise<PhoneNumber> {
  const sql = getSql()
  const id = crypto.randomUUID()
  await sql`
    INSERT INTO phone_numbers (id, user_id, twilio_sid, number, friendly_name, label, type, status, created_at)
    VALUES (
      ${id},
      ${params.user_id},
      ${params.twilio_sid || ""},
      ${params.number},
      ${params.friendly_name},
      ${params.label || "Business Line"},
      ${params.type || "local"},
      ${params.status || "active"},
      now()
    )
  `
  return {
    id,
    user_id: params.user_id,
    twilio_sid: params.twilio_sid || "",
    number: params.number,
    friendly_name: params.friendly_name,
    label: params.label || "Business Line",
    type: params.type || "local",
    status: params.status || "active",
    created_at: new Date().toISOString(),
  }
}

// Get a phone number by number and status (e.g. for porting webhook)
export async function getPhoneNumberByNumberAndStatus(
  number: string,
  status: string
): Promise<PhoneNumber | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, user_id, twilio_sid, number, friendly_name, label, type, status, created_at
    FROM phone_numbers WHERE number = ${number} AND status = ${status} LIMIT 1
  `
  return rows[0] ? parsePhoneNumberRow(rows[0]) : null
}

// Update a phone number (e.g. after port complete)
export async function updatePhoneNumber(
  phoneNumberId: string,
  userId: string,
  updates: Partial<Pick<PhoneNumber, "twilio_sid" | "status">>
): Promise<void> {
  const sql = getSql()
  if (updates.twilio_sid !== undefined) {
    await sql`UPDATE phone_numbers SET twilio_sid = ${updates.twilio_sid} WHERE id = ${phoneNumberId} AND user_id = ${userId}`
  }
  if (updates.status !== undefined) {
    await sql`UPDATE phone_numbers SET status = ${updates.status} WHERE id = ${phoneNumberId} AND user_id = ${userId}`
  }
}

// Get talk time analytics for a date range
export async function getAgentTalkTime(
  userId: string,
  startDate: string,
  endDate: string
): Promise<
  {
    receptionist_id: string
    receptionist_name: string
    rate_per_minute: number
    total_seconds: number
    total_calls: number
    daily: { date: string; seconds: number }[]
  }[]
> {
  throw new Error("Not implemented - connect your database")
}
