// ============================================
// Placeholder while a /dashboard/* page streams in
// ============================================
// Shown via app/.../loading.tsx — matches shell padding so it does not “jump” when real content arrives.

export default function DashboardRouteSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 pb-8" aria-busy="true" aria-label="Loading page">
      {/* Title bar mimic — short delay classes stagger pulse for a calmer, less “boring” feel */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary/15 [animation-delay:0ms] motion-safe:animate-pulse" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 w-40 max-w-[55%] rounded-md bg-muted/50 [animation-delay:75ms] motion-safe:animate-pulse" />
          <div className="h-3 w-full max-w-[85%] rounded-md bg-muted/35 [animation-delay:150ms] motion-safe:animate-pulse" />
        </div>
      </div>
      {/* Card blocks */}
      <div className="h-36 w-full rounded-2xl border border-border/40 bg-card/40 [animation-delay:200ms] motion-safe:animate-pulse" />
      <div className="h-24 w-full rounded-2xl border border-border/40 bg-card/30 [animation-delay:260ms] motion-safe:animate-pulse" />
      <div className="h-20 w-full rounded-2xl border border-border/40 bg-card/25 [animation-delay:320ms] motion-safe:animate-pulse" />
    </div>
  )
}
