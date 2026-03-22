"use client"

// Re-export panel in page layout — `/dashboard/ai-flow` redirects to `/dashboard?ai=1`.

import { AiIntakeFlowPanel } from "@/components/ai-intake-flow-panel"

export function AiIntakeFlowPage() {
  return <AiIntakeFlowPanel variant="page" />
}
