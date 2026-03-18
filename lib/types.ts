// ============================================
// Zing - Core Types
// ============================================

// --- Users (Business Owners) ---
export interface User {
  id: string
  email: string
  name: string
  phone: string // owner's personal cell
  business_name: string
  created_at: string
}

// --- Receptionists / Agents ---
export interface Receptionist {
  id: string
  user_id: string
  name: string
  phone: string
  initials: string
  color: string
  rate_per_minute: number // e.g. 0.25
  is_active: boolean
  created_at: string
}

// --- Routing Configuration ---
export type FallbackType = "owner" | "ai" | "voicemail"

export interface RoutingConfig {
  id: string
  user_id: string
  business_number: string | null // null = default/global config; E.164 = config for that specific number
  selected_receptionist_id: string | null // null = route to owner
  fallback_type: FallbackType
  ai_greeting: string
  ring_timeout_seconds: number // how long to ring before fallback
  updated_at: string
}

// --- Phone Numbers ---
export interface PhoneNumber {
  id: string
  user_id: string
  twilio_sid: string
  number: string // e.g. "+15551234567"
  friendly_name: string // e.g. "(555) 123-4567"
  label: string // e.g. "Main Line"
  type: "local" | "toll-free"
  status: "active" | "pending" | "porting"
  created_at: string
}

// --- Call Logs ---
export type CallType = "incoming" | "outgoing" | "missed" | "voicemail"

export interface CallLog {
  id: string
  user_id: string
  twilio_call_sid: string
  from_number: string
  to_number: string
  caller_name: string | null
  call_type: CallType
  status: string // twilio status: completed, no-answer, busy, etc.
  duration_seconds: number
  routed_to_receptionist_id: string | null
  routed_to_name: string | null
  has_recording: boolean
  recording_url: string | null
  recording_duration_seconds: number | null
  created_at: string
}

// --- Analytics / Payroll ---
export interface AgentPaySummary {
  receptionist_id: string
  receptionist_name: string
  total_calls: number
  total_minutes: number
  rate_per_minute: number
  total_earnings: number
  daily_breakdown: {
    day: string // e.g. "Mon", "Tue"
    minutes: number
  }[]
}

export interface WeeklyPayroll {
  week_start: string
  week_end: string
  agents: AgentPaySummary[]
  total_payout: number
  total_minutes: number
}

// --- API Request/Response Types ---
export interface UpdateRoutingRequest {
  selected_receptionist_id: string | null
  fallback_type?: FallbackType
  ai_greeting?: string
  ring_timeout_seconds?: number
  business_number?: string | null // E.164 number for per-number routing; omit or null for the default config
}

export interface BuyNumberRequest {
  area_code: string
  type: "local" | "toll-free"
}

export interface PortNumberRequest {
  number: string
  current_carrier?: string // optional; carrier can often be looked up from the number
}

export interface SearchNumbersResponse {
  numbers: {
    number: string
    friendly_name: string
    type: "local" | "toll-free"
    monthly_cost: number
  }[]
}
