"use server"

// Server action entry point for skill-pool routing queries (used by admin/tools).

export { getAvailableReceptionistsForLine } from "@/lib/routing-pool"
export type { RoutingPoolMatchResult } from "@/lib/routing-pool"
