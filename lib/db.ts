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
let cachedSql: ReturnType<typeof neon> | null = null
function getSql(): ReturnType<typeof neon> {
  if (cachedSql) return cachedSql
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables (and in .env.local for local dev).")
  cachedSql = neon(url)
  return cachedSql
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

// Cache for incoming voice routing to reduce per-request DB latency.
// In serverless, the module can stay warm briefly, so this helps most traffic bursts.
type IncomingRoutingByNumber =
  | {
    user_id: string
    user_name: string
    owner_phone: string
    selected_receptionist_id: string | null
    fallback_type: RoutingConfig["fallback_type"]
    ring_timeout_seconds: number
    receptionist_name: string | null
    receptionist_phone: string | null
  }
  | null

const incomingRoutingCache = new Map<string, { expiresAt: number; value: IncomingRoutingByNumber }>()
const INCOMING_ROUTING_CACHE_TTL_MS = 10_000

// Normalize to E.164 (+1XXXXXXXXXX) so it matches how we store numbers in `phone_numbers.number`.
function normalizeToE164(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (phone.startsWith("+")) return phone
  return `+${digits}`
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

// Normalize a US phone number to E.164 format (+1XXXXXXXXXX)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (phone.startsWith("+")) return phone
  return `+${digits}`
}

// Create a receptionist
export async function insertReceptionist(params: {
  user_id: string
  name: string
  phone: string
}): Promise<Receptionist> {
  const sql = getSql()
  const id = crypto.randomUUID()
  const phone = normalizePhone(params.phone)
  const nameParts = params.name.trim().split(/\s+/)
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : params.name.slice(0, 2).toUpperCase()
  const colors = ["bg-primary", "bg-chart-2", "bg-chart-5", "bg-chart-3", "bg-chart-4"]
  const color = colors[Math.floor(Math.random() * colors.length)]

  await sql`
    INSERT INTO receptionists (id, user_id, name, phone, initials, color, rate_per_minute, is_active, created_at)
    VALUES (${id}, ${params.user_id}, ${params.name}, ${phone}, ${initials}, ${color}, 0.25, true, now())
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

// Fast routing lookup for incoming voice webhooks.
// Returns user + resolved routing + receptionist in one query to reduce latency.
export async function getIncomingRoutingByNumber(toNumber: string): Promise<{
  user_id: string
  user_name: string
  owner_phone: string
  selected_receptionist_id: string | null
  fallback_type: RoutingConfig["fallback_type"]
  ring_timeout_seconds: number
  receptionist_name: string | null
  receptionist_phone: string | null
} | null> {
  const normalized = normalizeToE164(toNumber)

  // Return cached result if it is still fresh.
  const cached = incomingRoutingCache.get(normalized)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const sql = getSql()
  const rows = await sql`
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      u.phone AS owner_phone,
      -- Use the specific per-number config if it exists, even if it sets fields to NULL.
      CASE WHEN rc_spec.id IS NOT NULL THEN rc_spec.selected_receptionist_id ELSE rc_def.selected_receptionist_id END
        AS selected_receptionist_id,
      COALESCE(
        CASE WHEN rc_spec.id IS NOT NULL THEN rc_spec.fallback_type ELSE rc_def.fallback_type END,
        'owner'
      ) AS fallback_type,
      COALESCE(
        CASE WHEN rc_spec.id IS NOT NULL THEN rc_spec.ring_timeout_seconds ELSE rc_def.ring_timeout_seconds END,
        30
      ) AS ring_timeout_seconds,
      CASE WHEN rc_spec.id IS NOT NULL THEN rs.name ELSE rd.name END AS receptionist_name,
      CASE WHEN rc_spec.id IS NOT NULL THEN rs.phone ELSE rd.phone END AS receptionist_phone
    FROM phone_numbers pn
    JOIN users u ON u.id = pn.user_id
    LEFT JOIN routing_config rc_spec
      ON rc_spec.user_id = u.id
      AND rc_spec.business_number = pn.number
    LEFT JOIN routing_config rc_def
      ON rc_def.user_id = u.id
      AND rc_def.business_number IS NULL
    LEFT JOIN receptionists rs ON rs.id = rc_spec.selected_receptionist_id
    LEFT JOIN receptionists rd ON rd.id = rc_def.selected_receptionist_id
    WHERE pn.number = ${normalized} AND pn.status = 'active'
    LIMIT 1
  `

  const row = rows[0]
  if (!row) {
    incomingRoutingCache.set(normalized, { expiresAt: Date.now() + INCOMING_ROUTING_CACHE_TTL_MS, value: null })
    return null
  }

  const value: IncomingRoutingByNumber = {
    user_id: String(row.user_id),
    user_name: String(row.user_name),
    owner_phone: String(row.owner_phone),
    selected_receptionist_id: row.selected_receptionist_id ? String(row.selected_receptionist_id) : null,
    fallback_type: (row.fallback_type as RoutingConfig["fallback_type"]) || "owner",
    ring_timeout_seconds: Number(row.ring_timeout_seconds ?? 30),
    receptionist_name: row.receptionist_name ? String(row.receptionist_name) : null,
    receptionist_phone: row.receptionist_phone ? String(row.receptionist_phone) : null,
  }

  incomingRoutingCache.set(normalized, { expiresAt: Date.now() + INCOMING_ROUTING_CACHE_TTL_MS, value })
  return value
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
      user_id, provider_call_sid, from_number, to_number, caller_name,
      call_type, status, duration_seconds, routed_to_receptionist_id,
      routed_to_name, has_recording, recording_url, recording_duration_seconds, first_ring_at
    ) VALUES (
      ${log.user_id}, ${log.provider_call_sid}, ${log.from_number}, ${log.to_number}, ${log.caller_name},
      ${log.call_type}, ${log.status}, ${log.duration_seconds}, ${log.routed_to_receptionist_id},
      ${log.routed_to_name}, ${log.has_recording}, ${log.recording_url}, ${log.recording_duration_seconds}, now()
    )
  `
}

// Update a call log (e.g., when status callback arrives)
export async function updateCallLog(
  providerCallSid: string,
  updates: Partial<Pick<CallLog, "status" | "duration_seconds" | "call_type" | "has_recording" | "recording_url" | "recording_duration_seconds" | "answered_at" | "ended_at" | "setup_duration_ms" | "post_dial_delay_ms">>
): Promise<void> {
  const sql = getSql()
  if (updates.status !== undefined) {
    await sql`UPDATE call_logs SET status = ${updates.status} WHERE provider_call_sid = ${providerCallSid} OR twilio_call_sid = ${providerCallSid}`
  }
  if (updates.duration_seconds !== undefined) {
    await sql`UPDATE call_logs SET duration_seconds = ${updates.duration_seconds} WHERE provider_call_sid = ${providerCallSid} OR twilio_call_sid = ${providerCallSid}`
  }
  if (updates.call_type !== undefined) {
    await sql`UPDATE call_logs SET call_type = ${updates.call_type} WHERE provider_call_sid = ${providerCallSid} OR twilio_call_sid = ${providerCallSid}`
  }
  if (updates.has_recording !== undefined) {
    await sql`UPDATE call_logs SET has_recording = ${updates.has_recording}, recording_url = ${updates.recording_url ?? null}, recording_duration_seconds = ${updates.recording_duration_seconds ?? null} WHERE provider_call_sid = ${providerCallSid} OR twilio_call_sid = ${providerCallSid}`
  }
  if (updates.answered_at !== undefined) {
    await sql`UPDATE call_logs SET answered_at = ${updates.answered_at ?? null} WHERE provider_call_sid = ${providerCallSid} OR twilio_call_sid = ${providerCallSid}`
  }
  if (updates.ended_at !== undefined) {
    await sql`UPDATE call_logs SET ended_at = ${updates.ended_at ?? null} WHERE provider_call_sid = ${providerCallSid} OR twilio_call_sid = ${providerCallSid}`
  }
  if (updates.setup_duration_ms !== undefined) {
    await sql`UPDATE call_logs SET setup_duration_ms = ${updates.setup_duration_ms ?? null} WHERE provider_call_sid = ${providerCallSid} OR twilio_call_sid = ${providerCallSid}`
  }
  if (updates.post_dial_delay_ms !== undefined) {
    await sql`UPDATE call_logs SET post_dial_delay_ms = ${updates.post_dial_delay_ms ?? null} WHERE provider_call_sid = ${providerCallSid} OR twilio_call_sid = ${providerCallSid}`
  }
}

// Record a provider status event and derive setup timing metrics.
export async function recordCallStatusEvent(
  providerCallSid: string,
  callStatus: string,
  durationSeconds: number,
  occurredAtIso?: string
): Promise<void> {
  const sql = getSql()
  const occurredAt = occurredAtIso ? new Date(occurredAtIso) : new Date()
  await sql`
    UPDATE call_logs
    SET
      status = ${callStatus},
      duration_seconds = ${durationSeconds},
      answered_at = CASE
        WHEN ${callStatus} IN ('answered', 'in-progress', 'completed') AND answered_at IS NULL THEN ${occurredAt}
        ELSE answered_at
      END,
      ended_at = CASE
        WHEN ${callStatus} IN ('completed', 'busy', 'failed', 'no-answer', 'canceled') THEN ${occurredAt}
        ELSE ended_at
      END,
      setup_duration_ms = CASE
        WHEN ${callStatus} IN ('answered', 'in-progress', 'completed') AND first_ring_at IS NOT NULL THEN
          EXTRACT(EPOCH FROM (${occurredAt} - first_ring_at))::int * 1000
        ELSE setup_duration_ms
      END,
      post_dial_delay_ms = CASE
        WHEN ${callStatus} IN ('answered', 'in-progress', 'completed') AND first_ring_at IS NOT NULL THEN
          EXTRACT(EPOCH FROM (${occurredAt} - first_ring_at))::int * 1000
        ELSE post_dial_delay_ms
      END
    WHERE provider_call_sid = ${providerCallSid} OR twilio_call_sid = ${providerCallSid}
  `
}

export async function getCallQualitySummary(userId: string, days = 7): Promise<{
  total_calls: number
  answered_calls: number
  answer_rate_percent: number
  avg_setup_ms: number | null
  p95_setup_ms: number | null
  avg_post_dial_delay_ms: number | null
}> {
  const sql = getSql()
  const rows = await sql`
    WITH base AS (
      SELECT status, setup_duration_ms, post_dial_delay_ms
      FROM call_logs
      WHERE user_id = ${userId}
        AND created_at >= now() - (${days}::int || ' days')::interval
    ),
    stats AS (
      SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE status IN ('answered', 'completed', 'in-progress'))::int AS answered_calls,
        AVG(setup_duration_ms)::float8 AS avg_setup_ms,
        AVG(post_dial_delay_ms)::float8 AS avg_post_dial_delay_ms
      FROM base
    ),
    p95 AS (
      SELECT
        percentile_cont(0.95) WITHIN GROUP (ORDER BY setup_duration_ms)::float8 AS p95_setup_ms
      FROM base
      WHERE setup_duration_ms IS NOT NULL
    )
    SELECT
      stats.total_calls,
      stats.answered_calls,
      CASE
        WHEN stats.total_calls = 0 THEN 0
        ELSE ROUND((stats.answered_calls::numeric / stats.total_calls::numeric) * 100, 2)::float8
      END AS answer_rate_percent,
      stats.avg_setup_ms,
      p95.p95_setup_ms,
      stats.avg_post_dial_delay_ms
    FROM stats, p95
  `

  const row = rows[0]
  if (!row) {
    return {
      total_calls: 0,
      answered_calls: 0,
      answer_rate_percent: 0,
      avg_setup_ms: null,
      p95_setup_ms: null,
      avg_post_dial_delay_ms: null,
    }
  }

  return {
    total_calls: Number(row.total_calls ?? 0),
    answered_calls: Number(row.answered_calls ?? 0),
    answer_rate_percent: Number(row.answer_rate_percent ?? 0),
    avg_setup_ms: row.avg_setup_ms == null ? null : Number(row.avg_setup_ms),
    p95_setup_ms: row.p95_setup_ms == null ? null : Number(row.p95_setup_ms),
    avg_post_dial_delay_ms: row.avg_post_dial_delay_ms == null ? null : Number(row.avg_post_dial_delay_ms),
  }
}

export async function getVoiceOperationsInsights(userId: string, days = 7): Promise<{
  daily_quality: {
    day: string
    total_calls: number
    answered_calls: number
    answer_rate_percent: number
    avg_setup_ms: number | null
  }[]
  number_quality: {
    number: string
    total_calls: number
    answered_calls: number
    answer_rate_percent: number
    avg_setup_ms: number | null
  }[]
  top_missed_callers: {
    caller_number: string
    missed_calls: number
    last_missed_at: string
  }[]
}> {
  const sql = getSql()

  const dailyRows = await sql`
    SELECT
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS total_calls,
      COUNT(*) FILTER (WHERE status IN ('answered', 'completed', 'in-progress'))::int AS answered_calls,
      CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE status IN ('answered', 'completed', 'in-progress'))::numeric / COUNT(*)::numeric) * 100, 2)::float8
      END AS answer_rate_percent,
      AVG(setup_duration_ms)::float8 AS avg_setup_ms
    FROM call_logs
    WHERE user_id = ${userId}
      AND created_at >= now() - (${days}::int || ' days')::interval
    GROUP BY date_trunc('day', created_at)
    ORDER BY date_trunc('day', created_at) ASC
  `

  const numberRows = await sql`
    SELECT
      to_number AS number,
      COUNT(*)::int AS total_calls,
      COUNT(*) FILTER (WHERE status IN ('answered', 'completed', 'in-progress'))::int AS answered_calls,
      CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE status IN ('answered', 'completed', 'in-progress'))::numeric / COUNT(*)::numeric) * 100, 2)::float8
      END AS answer_rate_percent,
      AVG(setup_duration_ms)::float8 AS avg_setup_ms
    FROM call_logs
    WHERE user_id = ${userId}
      AND created_at >= now() - (${days}::int || ' days')::interval
    GROUP BY to_number
    ORDER BY COUNT(*) DESC
    LIMIT 8
  `

  const missedRows = await sql`
    SELECT
      from_number AS caller_number,
      COUNT(*)::int AS missed_calls,
      MAX(created_at) AS last_missed_at
    FROM call_logs
    WHERE user_id = ${userId}
      AND created_at >= now() - (${days}::int || ' days')::interval
      AND status IN ('no-answer', 'busy', 'failed', 'canceled')
    GROUP BY from_number
    ORDER BY COUNT(*) DESC, MAX(created_at) DESC
    LIMIT 5
  `

  return {
    daily_quality: dailyRows.map((r) => ({
      day: String(r.day),
      total_calls: Number(r.total_calls ?? 0),
      answered_calls: Number(r.answered_calls ?? 0),
      answer_rate_percent: Number(r.answer_rate_percent ?? 0),
      avg_setup_ms: r.avg_setup_ms == null ? null : Number(r.avg_setup_ms),
    })),
    number_quality: numberRows.map((r) => ({
      number: String(r.number ?? ""),
      total_calls: Number(r.total_calls ?? 0),
      answered_calls: Number(r.answered_calls ?? 0),
      answer_rate_percent: Number(r.answer_rate_percent ?? 0),
      avg_setup_ms: r.avg_setup_ms == null ? null : Number(r.avg_setup_ms),
    })),
    top_missed_callers: missedRows.map((r) => ({
      caller_number: String(r.caller_number ?? ""),
      missed_calls: Number(r.missed_calls ?? 0),
      last_missed_at: r.last_missed_at instanceof Date ? r.last_missed_at.toISOString() : String(r.last_missed_at),
    })),
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
    provider_call_sid: String(row.provider_call_sid ?? row.twilio_call_sid ?? ""),
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
    first_ring_at: row.first_ring_at ? String(row.first_ring_at) : null,
    answered_at: row.answered_at ? String(row.answered_at) : null,
    ended_at: row.ended_at ? String(row.ended_at) : null,
    setup_duration_ms: row.setup_duration_ms == null ? null : Number(row.setup_duration_ms),
    post_dial_delay_ms: row.post_dial_delay_ms == null ? null : Number(row.post_dial_delay_ms),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }))
}

function parsePhoneNumberRow(row: Record<string, unknown>): PhoneNumber {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    provider_number_sid: String(row.provider_number_sid ?? row.twilio_sid ?? ""),
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
    SELECT id, user_id, provider_number_sid, twilio_sid, number, friendly_name, label, type, status, created_at
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
  provider_number_sid?: string
}): Promise<PhoneNumber> {
  const sql = getSql()
  const id = crypto.randomUUID()
  await sql`
    INSERT INTO phone_numbers (id, user_id, provider_number_sid, twilio_sid, number, friendly_name, label, type, status, created_at)
    VALUES (
      ${id},
      ${params.user_id},
      ${params.provider_number_sid || ""},
      ${params.provider_number_sid || ""},
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
    provider_number_sid: params.provider_number_sid || "",
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
    SELECT id, user_id, provider_number_sid, twilio_sid, number, friendly_name, label, type, status, created_at
    FROM phone_numbers WHERE number = ${number} AND status = ${status} LIMIT 1
  `
  return rows[0] ? parsePhoneNumberRow(rows[0]) : null
}

// Update a phone number (e.g. after port complete)
export async function updatePhoneNumber(
  phoneNumberId: string,
  userId: string,
  updates: Partial<Pick<PhoneNumber, "provider_number_sid" | "status">>
): Promise<void> {
  const sql = getSql()
  if (updates.provider_number_sid !== undefined) {
    await sql`UPDATE phone_numbers SET provider_number_sid = ${updates.provider_number_sid}, twilio_sid = ${updates.provider_number_sid} WHERE id = ${phoneNumberId} AND user_id = ${userId}`
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
