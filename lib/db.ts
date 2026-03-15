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

// Get routing config for a user
export async function getRoutingConfig(userId: string): Promise<RoutingConfig | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, user_id, selected_receptionist_id, fallback_type, ai_greeting, ring_timeout_seconds, updated_at
    FROM routing_config WHERE user_id = ${userId} LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    selected_receptionist_id: row.selected_receptionist_id != null ? String(row.selected_receptionist_id) : null,
    fallback_type: row.fallback_type as RoutingConfig["fallback_type"],
    ai_greeting: String(row.ai_greeting ?? ""),
    ring_timeout_seconds: Number(row.ring_timeout_seconds ?? 30),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }
}

// Update routing config (only updates fields that are present in updates; null clears e.g. selected_receptionist_id)
export async function updateRoutingConfig(
  userId: string,
  updates: Partial<Pick<RoutingConfig, "selected_receptionist_id" | "fallback_type" | "ai_greeting" | "ring_timeout_seconds">>
): Promise<void> {
  const sql = getSql()
  if (updates.selected_receptionist_id !== undefined) {
    await sql`UPDATE routing_config SET selected_receptionist_id = ${updates.selected_receptionist_id}, updated_at = now() WHERE user_id = ${userId}`
  }
  if (updates.fallback_type !== undefined) {
    await sql`UPDATE routing_config SET fallback_type = ${updates.fallback_type}, updated_at = now() WHERE user_id = ${userId}`
  }
  if (updates.ai_greeting !== undefined) {
    await sql`UPDATE routing_config SET ai_greeting = ${updates.ai_greeting}, updated_at = now() WHERE user_id = ${userId}`
  }
  if (updates.ring_timeout_seconds !== undefined) {
    await sql`UPDATE routing_config SET ring_timeout_seconds = ${updates.ring_timeout_seconds}, updated_at = now() WHERE user_id = ${userId}`
  }
}

// Get a receptionist by ID
export async function getReceptionist(receptionistId: string): Promise<Receptionist | null> {
  throw new Error("Not implemented - connect your database")
}

// Get all receptionists for a user
export async function getReceptionists(userId: string): Promise<Receptionist[]> {
  throw new Error("Not implemented - connect your database")
}

// Create a receptionist
export async function insertReceptionist(params: {
  user_id: string
  name: string
  phone: string
}): Promise<Receptionist> {
  throw new Error("Not implemented - connect your database")
}

// Update a receptionist
export async function updateReceptionist(
  receptionistId: string,
  userId: string,
  updates: Partial<Pick<Receptionist, "name" | "phone" | "is_active" | "rate_per_minute">>
): Promise<void> {
  throw new Error("Not implemented - connect your database")
}

// Delete a receptionist
export async function deleteReceptionist(receptionistId: string, userId: string): Promise<void> {
  throw new Error("Not implemented - connect your database")
}

// Get user by email (for auth login; includes password_hash)
export async function getAuthUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, email, name, phone, business_name, password_hash, created_at
    FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    phone: String(row.phone),
    business_name: String(row.business_name ?? "My Business"),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
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

// Get user by phone number they own
export async function getUserByPhoneNumber(toNumber: string): Promise<User | null> {
  // Look up which user owns the Twilio number being called
  // JOIN phone_numbers ON users
  throw new Error("Not implemented - connect your database")
}

// Get user by ID
export async function getUser(userId: string): Promise<User | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, email, name, phone, business_name, created_at
    FROM users WHERE id = ${userId} LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    phone: String(row.phone),
    business_name: String(row.business_name ?? "My Business"),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

// Insert a call log
export async function insertCallLog(log: Omit<CallLog, "id" | "created_at">): Promise<void> {
  throw new Error("Not implemented - connect your database")
}

// Update a call log (e.g., when status callback arrives)
export async function updateCallLog(
  twilioCallSid: string,
  updates: Partial<Pick<CallLog, "status" | "duration_seconds" | "call_type" | "has_recording" | "recording_url" | "recording_duration_seconds">>
): Promise<void> {
  throw new Error("Not implemented - connect your database")
}

// Get call logs for a user (paginated)
export async function getCallLogs(
  userId: string,
  options?: { limit?: number; offset?: number; type?: string }
): Promise<CallLog[]> {
  throw new Error("Not implemented - connect your database")
}

// Get phone numbers for a user
export async function getPhoneNumbers(userId: string): Promise<PhoneNumber[]> {
  throw new Error("Not implemented - connect your database")
}

// Get a phone number by number and status (e.g. for porting webhook)
export async function getPhoneNumberByNumberAndStatus(
  number: string,
  status: string
): Promise<PhoneNumber | null> {
  throw new Error("Not implemented - connect your database")
}

// Update a phone number (e.g. after port complete)
export async function updatePhoneNumber(
  phoneNumberId: string,
  userId: string,
  updates: Partial<Pick<PhoneNumber, "twilio_sid" | "status">>
): Promise<void> {
  throw new Error("Not implemented - connect your database")
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
