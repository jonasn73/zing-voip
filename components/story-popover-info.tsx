"use client"

import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getAppSheetStory } from "@/components/app-sheet-stories"
import { cn } from "@/lib/utils"

/** Compact story layer above sheets/modals (z-[200]) so it stacks above Sheet z-[110]. */
export function StoryPopoverInfo({
  storyKey,
  label = "Learn more",
  className,
  triggerClassName,
}: {
  storyKey: string
  label?: string
  className?: string
  triggerClassName?: string
}) {
  const story = getAppSheetStory(storyKey)
  if (!story) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary",
            triggerClassName
          )}
          aria-label={label}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className={cn(
          "z-[200] w-[min(92vw,22rem)] max-h-[min(58vh,400px)] overflow-y-auto border-border/80 p-0 shadow-xl",
          className
        )}
      >
        <div className="border-b border-primary/20 bg-gradient-to-br from-primary/[0.12] via-card to-card px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{story.eyebrow}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{story.storyline}</p>
          <p className="mt-2 text-sm font-semibold leading-tight text-foreground">{story.title}</p>
        </div>
        <div className="space-y-2 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground [&_p]:mt-2 [&_p:first-child]:mt-0">
          {story.description}
        </div>
      </PopoverContent>
    </Popover>
  )
}
