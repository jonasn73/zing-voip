// Daily call HUD metrics — formatting helpers shared by API + dashboard strip.

/** Format seconds as mm:ss for the HUD chronometer pill. */
export function formatAvgTalkTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${minutes}:${String(remainder).padStart(2, "0")}`
}

export type DailyCallTelemetry = {
  daily_calls: number
  missed_calls: number
  avg_talk_seconds: number
  owner_user_id: string
}
