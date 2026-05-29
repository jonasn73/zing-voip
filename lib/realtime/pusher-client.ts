// Client-side Pusher singleton for the receptionist HUD.
// Returns null when the public key is not configured (HUD falls back to polling).

"use client"

import Pusher from "pusher-js"

let cached: Pusher | null = null
let resolved = false

export function getPusherClient(): Pusher | null {
  if (resolved) return cached
  resolved = true
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim()
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim() || "us2"
  if (!key) {
    cached = null
    return null
  }
  cached = new Pusher(key, { cluster, forceTLS: true })
  return cached
}

export function isRealtimeClientConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY?.trim())
}
