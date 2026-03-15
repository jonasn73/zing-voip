// ============================================
// Switchr - Database Client
// ============================================
// This file provides database access. Swap the implementation
// based on your provider (Supabase, Neon, etc.)
//
// For Supabase: pnpm add @supabase/supabase-js
// For Neon: pnpm add @neondatabase/serverless
//
// Env vars needed:
//   DATABASE_URL (for Neon)
//   -- or --
//   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (for Supabase)

import type {
  RoutingConfig,
  Receptionist,
  User,
  CallLog,
  PhoneNumber,
} from "./types"

// ---- PLACEHOLDER: Replace with your actual DB client ----
// Example using Neon serverless:
//
// import { neon } from "@neondatabase/serverless"
// const sql = neon(process.env.DATABASE_URL!)
//
// Example using Supabase:
//
// import { createClient } from "@supabase/supabase-js"
// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// )

// --- Query functions ---

// Get routing config for a user
export async function getRoutingConfig(userId: string): Promise<RoutingConfig | null> {
  // TODO: Replace with actual query
  // const result = await sql`SELECT * FROM routing_config WHERE user_id = ${userId}`
  // return result[0] || null
  throw new Error("Not implemented - connect your database")
}

// Update routing config
export async function updateRoutingConfig(
  userId: string,
  updates: Partial<Pick<RoutingConfig, "selected_receptionist_id" | "fallback_type" | "ai_greeting" | "ring_timeout_seconds">>
): Promise<void> {
  // TODO: Replace with actual query
  // await sql`
  //   UPDATE routing_config
  //   SET selected_receptionist_id = COALESCE(${updates.selected_receptionist_id}, selected_receptionist_id),
  //       fallback_type = COALESCE(${updates.fallback_type}, fallback_type),
  //       ai_greeting = COALESCE(${updates.ai_greeting}, ai_greeting),
  //       ring_timeout_seconds = COALESCE(${updates.ring_timeout_seconds}, ring_timeout_seconds),
  //       updated_at = now()
  //   WHERE user_id = ${userId}
  // `
  throw new Error("Not implemented - connect your database")
}

// Get a receptionist by ID
export async function getReceptionist(receptionistId: string): Promise<Receptionist | null> {
  throw new Error("Not implemented - connect your database")
}

// Get all receptionists for a user
export async function getReceptionists(userId: string): Promise<Receptionist[]> {
  throw new Error("Not implemented - connect your database")
}

// Get user by phone number they own
export async function getUserByPhoneNumber(toNumber: string): Promise<User | null> {
  // Look up which user owns the Twilio number being called
  // JOIN phone_numbers ON users
  throw new Error("Not implemented - connect your database")
}

// Get user by ID
export async function getUser(userId: string): Promise<User | null> {
  throw new Error("Not implemented - connect your database")
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
