// ============================================
// Zing - Database Client (Postgres via pg)
// ============================================
// Uses connection pool from DATABASE_URL.
// For serverless (Vercel), consider Neon serverless or PgBouncer if you hit connection limits.

import { Pool } from "pg"
import type {
  RoutingConfig,
  Receptionist,
  User,
  CallLog,
  PhoneNumber,
} from "./types"

// Singleton pool so we reuse connections
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("DATABASE_URL is not set")
    if (url.includes("localhost") && url.includes("postgres")) {
      console.warn(
        "[Zing] DATABASE_URL points to localhost. To use Neon instead: neon.tech → connection string → put in .env.local as DATABASE_URL → run npm run db:schema"
      )
    }
    pool = new Pool({ connectionString: url })
  }
  return pool
}

// --- Auth / Users ---

/** Used by login: returns user row including password_hash */
export async function getAuthUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const res = await getPool().query(
    `SELECT id, email, name, phone, business_name, password_hash, created_at FROM users WHERE email = $1`,
    [email.toLowerCase()]
  )
  const row = res.rows[0]
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    business_name: row.business_name,
    created_at: row.created_at,
    password_hash: row.password_hash,
  }
}

/** Creates user and a default routing_config row. Returns user without password_hash. */
export async function createUser(data: {
  email: string
  name: string
  phone: string
  business_name: string
  password_hash: string
}): Promise<User> {
  const client = await getPool().connect()
  try {
    const userRes = await client.query(
      `INSERT INTO users (email, name, phone, business_name, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, phone, business_name, created_at`,
      [
        data.email.toLowerCase(),
        data.name,
        data.phone,
        data.business_name,
        data.password_hash,
      ]
    )
    const user = userRes.rows[0]
    if (!user) throw new Error("Insert user failed")
    await client.query(
      `INSERT INTO routing_config (user_id) VALUES ($1)`,
      [user.id]
    )
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      business_name: user.business_name,
      created_at: user.created_at,
    }
  } finally {
    client.release()
  }
}

export async function getUser(userId: string): Promise<User | null> {
  const res = await getPool().query(
    `SELECT id, email, name, phone, business_name, created_at FROM users WHERE id = $1`,
    [userId]
  )
  const row = res.rows[0]
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    business_name: row.business_name,
    created_at: row.created_at,
  }
}

/** Find user who owns the given Twilio number (to_number). Accepts active and porting numbers. */
export async function getUserByPhoneNumber(toNumber: string): Promise<User | null> {
  const normalized = normalizePhoneForLookup(toNumber)
  const res = await getPool().query(
    `SELECT u.id, u.email, u.name, u.phone, u.business_name, u.created_at
     FROM users u
     JOIN phone_numbers p ON p.user_id = u.id
     WHERE (p.number = $1 OR p.number = $2) AND p.status IN ('active', 'porting')
     LIMIT 1`,
    [normalized, toNumber]
  )
  const row = res.rows[0]
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    business_name: row.business_name,
    created_at: row.created_at,
  }
}

function normalizePhoneForLookup(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return phone.startsWith("+") ? phone : `+${digits}`
}

// --- Routing ---

export async function getRoutingConfig(userId: string): Promise<RoutingConfig | null> {
  const res = await getPool().query(
    `SELECT id, user_id, selected_receptionist_id, fallback_type, ai_greeting, ring_timeout_seconds, updated_at
     FROM routing_config WHERE user_id = $1`,
    [userId]
  )
  const row = res.rows[0]
  if (!row) return null
  return {
    id: row.id,
    user_id: row.user_id,
    selected_receptionist_id: row.selected_receptionist_id,
    fallback_type: row.fallback_type,
    ai_greeting: row.ai_greeting,
    ring_timeout_seconds: row.ring_timeout_seconds,
    updated_at: row.updated_at,
  }
}

export async function updateRoutingConfig(
  userId: string,
  updates: Partial<Pick<RoutingConfig, "selected_receptionist_id" | "fallback_type" | "ai_greeting" | "ring_timeout_seconds">>
): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  let i = 1
  if (updates.selected_receptionist_id !== undefined) {
    sets.push(`selected_receptionist_id = $${i++}`)
    values.push(updates.selected_receptionist_id)
  }
  if (updates.fallback_type !== undefined) {
    sets.push(`fallback_type = $${i++}`)
    values.push(updates.fallback_type)
  }
  if (updates.ai_greeting !== undefined) {
    sets.push(`ai_greeting = $${i++}`)
    values.push(updates.ai_greeting)
  }
  if (updates.ring_timeout_seconds !== undefined) {
    sets.push(`ring_timeout_seconds = $${i++}`)
    values.push(updates.ring_timeout_seconds)
  }
  if (sets.length === 0) return
  sets.push(`updated_at = now()`)
  values.push(userId)
  await getPool().query(
    `UPDATE routing_config SET ${sets.join(", ")} WHERE user_id = $${i}`,
    values
  )
}

// --- Receptionists ---

export async function getReceptionist(receptionistId: string): Promise<Receptionist | null> {
  const res = await getPool().query(
    `SELECT id, user_id, name, phone, initials, color, rate_per_minute, is_active, created_at
     FROM receptionists WHERE id = $1`,
    [receptionistId]
  )
  const row = res.rows[0]
  if (!row) return null
  return row as Receptionist
}

export async function getReceptionists(userId: string): Promise<Receptionist[]> {
  const res = await getPool().query(
    `SELECT id, user_id, name, phone, initials, color, rate_per_minute, is_active, created_at
     FROM receptionists WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  )
  return res.rows as Receptionist[]
}

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"
}

export async function insertReceptionist(data: {
  user_id: string
  name: string
  phone: string
  initials?: string
  color?: string
  rate_per_minute?: number
}): Promise<Receptionist> {
  const initials = data.initials ?? initialsFromName(data.name)
  const color = data.color ?? "bg-primary"
  const rate = data.rate_per_minute ?? 0.25
  const res = await getPool().query(
    `INSERT INTO receptionists (user_id, name, phone, initials, color, rate_per_minute)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, name, phone, initials, color, rate_per_minute, is_active, created_at`,
    [data.user_id, data.name, data.phone, initials, color, rate]
  )
  return res.rows[0] as Receptionist
}

export async function updateReceptionist(
  receptionistId: string,
  userId: string,
  updates: Partial<Pick<Receptionist, "name" | "phone" | "is_active" | "rate_per_minute">>
): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  let i = 1
  if (updates.name !== undefined) {
    sets.push(`name = $${i++}`, `initials = $${i++}`)
    values.push(updates.name, initialsFromName(updates.name))
  }
  if (updates.phone !== undefined) {
    sets.push(`phone = $${i++}`)
    values.push(updates.phone)
  }
  if (updates.is_active !== undefined) {
    sets.push(`is_active = $${i++}`)
    values.push(updates.is_active)
  }
  if (updates.rate_per_minute !== undefined) {
    sets.push(`rate_per_minute = $${i++}`)
    values.push(updates.rate_per_minute)
  }
  if (sets.length === 0) return
  values.push(receptionistId, userId)
  await getPool().query(
    `UPDATE receptionists SET ${sets.join(", ")} WHERE id = $${i++} AND user_id = $${i}`,
    values
  )
}

export async function deleteReceptionist(receptionistId: string, userId: string): Promise<void> {
  await getPool().query(
    `DELETE FROM receptionists WHERE id = $1 AND user_id = $2`,
    [receptionistId, userId]
  )
}

// --- Call logs ---

export async function insertCallLog(log: Omit<CallLog, "id" | "created_at">): Promise<void> {
  await getPool().query(
    `INSERT INTO call_logs (
      user_id, twilio_call_sid, from_number, to_number, caller_name, call_type, status,
      duration_seconds, routed_to_receptionist_id, routed_to_name, has_recording, recording_url, recording_duration_seconds
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      log.user_id,
      log.twilio_call_sid,
      log.from_number,
      log.to_number,
      log.caller_name,
      log.call_type,
      log.status,
      log.duration_seconds,
      log.routed_to_receptionist_id,
      log.routed_to_name,
      log.has_recording,
      log.recording_url,
      log.recording_duration_seconds,
    ]
  )
}

export async function updateCallLog(
  twilioCallSid: string,
  updates: Partial<Pick<CallLog, "status" | "duration_seconds" | "call_type" | "has_recording" | "recording_url" | "recording_duration_seconds">>
): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  let i = 1
  if (updates.status !== undefined) {
    sets.push(`status = $${i++}`)
    values.push(updates.status)
  }
  if (updates.duration_seconds !== undefined) {
    sets.push(`duration_seconds = $${i++}`)
    values.push(updates.duration_seconds)
  }
  if (updates.call_type !== undefined) {
    sets.push(`call_type = $${i++}`)
    values.push(updates.call_type)
  }
  if (updates.has_recording !== undefined) {
    sets.push(`has_recording = $${i++}`)
    values.push(updates.has_recording)
  }
  if (updates.recording_url !== undefined) {
    sets.push(`recording_url = $${i++}`)
    values.push(updates.recording_url)
  }
  if (updates.recording_duration_seconds !== undefined) {
    sets.push(`recording_duration_seconds = $${i++}`)
    values.push(updates.recording_duration_seconds)
  }
  if (sets.length === 0) return
  values.push(twilioCallSid)
  await getPool().query(
    `UPDATE call_logs SET ${sets.join(", ")} WHERE twilio_call_sid = $${i}`,
    values
  )
}

export async function getCallLogs(
  userId: string,
  options?: { limit?: number; offset?: number; type?: string }
): Promise<CallLog[]> {
  const limit = Math.min(options?.limit ?? 50, 100)
  const offset = options?.offset ?? 0
  let query = `
    SELECT id, user_id, twilio_call_sid, from_number, to_number, caller_name, call_type, status,
           duration_seconds, routed_to_receptionist_id, routed_to_name, has_recording, recording_url, recording_duration_seconds, created_at
    FROM call_logs WHERE user_id = $1
  `
  const params: unknown[] = [userId]
  if (options?.type) {
    params.push(options.type)
    query += ` AND call_type = $${params.length}`
  }
  params.push(limit, offset)
  query += ` ORDER BY created_at DESC LIMIT $${params.length} OFFSET $${params.length + 1}`
  const res = await getPool().query(query, params)
  return res.rows as CallLog[]
}

// --- Phone numbers ---

export async function getPhoneNumbers(userId: string): Promise<PhoneNumber[]> {
  const res = await getPool().query(
    `SELECT id, user_id, twilio_sid, number, friendly_name, label, type, status, created_at
     FROM phone_numbers WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  )
  return res.rows.map((r: { twilio_sid: string }) => ({
    ...r,
    twilio_sid: r.twilio_sid,
  })) as PhoneNumber[]
}

/** Find a phone_numbers row by E.164 number and status (e.g. for porting webhook). */
export async function getPhoneNumberByNumberAndStatus(
  number: string,
  status: "active" | "pending" | "porting"
): Promise<(PhoneNumber & { port_in_request_sid?: string }) | null> {
  const normalized = number.replace(/\D/g, "")
  const e164 = normalized.length === 10 ? `+1${normalized}` : normalized.length === 11 && normalized.startsWith("1") ? `+${normalized}` : number.startsWith("+") ? number : `+${number.replace(/\D/g, "")}`
  const res = await getPool().query(
    `SELECT id, user_id, twilio_sid, number, friendly_name, label, type, status, created_at,
            COALESCE(port_in_request_sid, '') AS port_in_request_sid
     FROM phone_numbers WHERE number = $1 AND status = $2 LIMIT 1`,
    [e164, status]
  )
  const row = res.rows[0]
  if (!row) return null
  return { ...row, port_in_request_sid: row.port_in_request_sid || undefined } as PhoneNumber & { port_in_request_sid?: string }
}

export async function insertPhoneNumber(data: {
  user_id: string
  twilio_sid: string
  number: string
  friendly_name: string
  label?: string
  type?: "local" | "toll-free"
  status?: "active" | "pending" | "porting"
  port_in_request_sid?: string
}): Promise<PhoneNumber> {
  const res = await getPool().query(
    `INSERT INTO phone_numbers (user_id, twilio_sid, number, friendly_name, label, type, status, port_in_request_sid)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, twilio_sid, number, friendly_name, label, type, status, created_at`,
    [
      data.user_id,
      data.twilio_sid,
      data.number,
      data.friendly_name,
      data.label ?? "Main Line",
      data.type ?? "local",
      data.status ?? "active",
      data.port_in_request_sid ?? "",
    ]
  )
  return res.rows[0] as PhoneNumber
}

export async function updatePhoneNumber(
  id: string,
  userId: string,
  data: { twilio_sid?: string; status?: "active" | "pending" | "porting" }
): Promise<void> {
  const updates: string[] = []
  const values: unknown[] = []
  let i = 1
  if (data.twilio_sid !== undefined) {
    updates.push(`twilio_sid = $${i++}`)
    values.push(data.twilio_sid)
  }
  if (data.status !== undefined) {
    updates.push(`status = $${i++}`)
    values.push(data.status)
  }
  if (updates.length === 0) return
  values.push(id, userId)
  await getPool().query(
    `UPDATE phone_numbers SET ${updates.join(", ")} WHERE id = $${i++} AND user_id = $${i}`,
    values
  )
}

// --- Analytics ---

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
  const res = await getPool().query(
    `SELECT r.id AS receptionist_id, r.name AS receptionist_name, r.rate_per_minute,
            COALESCE(SUM(c.duration_seconds), 0)::integer AS total_seconds,
            COUNT(c.id)::integer AS total_calls
     FROM receptionists r
     LEFT JOIN call_logs c ON c.routed_to_receptionist_id = r.id AND c.user_id = $1
       AND c.created_at >= $2::timestamptz AND c.created_at <= $3::timestamptz
       AND c.duration_seconds > 0
     WHERE r.user_id = $1
     GROUP BY r.id, r.name, r.rate_per_minute`,
    [userId, startDate, endDate]
  )
  const agents = res.rows as {
    receptionist_id: string
    receptionist_name: string
    rate_per_minute: number
    total_seconds: number
    total_calls: number
  }[]
  const dailyRes = await getPool().query(
    `SELECT routed_to_receptionist_id AS receptionist_id, date_trunc('day', created_at)::date AS day, SUM(duration_seconds)::integer AS seconds
     FROM call_logs
     WHERE user_id = $1 AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz AND duration_seconds > 0 AND routed_to_receptionist_id IS NOT NULL
     GROUP BY routed_to_receptionist_id, date_trunc('day', created_at)`,
    [userId, startDate, endDate]
  )
  const dailyByAgent: Record<string, { date: string; seconds: number }[]> = {}
  for (const row of dailyRes.rows as { receptionist_id: string; day: string; seconds: number }[]) {
    const date = row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10)
    if (!dailyByAgent[row.receptionist_id]) dailyByAgent[row.receptionist_id] = []
    dailyByAgent[row.receptionist_id].push({ date, seconds: row.seconds })
  }
  return agents.map((a) => ({
    ...a,
    daily: (dailyByAgent[a.receptionist_id] ?? []).sort(
      (x, y) => x.date.localeCompare(y.date)
    ),
  }))
}
