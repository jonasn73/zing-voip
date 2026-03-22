import { redirect } from "next/navigation"

/** Old “AI flow” tab URL — open Routing and the fallback sheet instead. */
export default function AiFlowRoute() {
  redirect("/dashboard?ai=1")
}
