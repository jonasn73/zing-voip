/** Demo inventory rows for onboarding + buy-number previews. */

export type OnboardingNumberOption = {
  id: string
  number: string
  type: "Local" | "Toll-Free"
  price: string
}

export const ONBOARDING_INVENTORY_SIZE = 4

function normalizeAreaCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 3)
  return digits.length === 3 ? digits : digits.padStart(3, "5")
}

export function buildOnboardingNumberInventory(areaCode: string, count = ONBOARDING_INVENTORY_SIZE): OnboardingNumberOption[] {
  const ac = normalizeAreaCode(areaCode)
  const used = new Set<string>()
  const out: OnboardingNumberOption[] = []

  for (let i = 0; i < count; i++) {
    let display = ""
    for (let attempt = 0; attempt < 64; attempt++) {
      const exchange = String(Math.floor(200 + Math.random() * 800))
      const last4 = String(Math.floor(1000 + Math.random() * 9000))
      display = `(${ac}) ${exchange}-${last4}`
      if (!used.has(display)) break
    }
    used.add(display)
    const tollFree =
      i === count - 1 || exchangeStartsTollFree(display) || Math.random() < 0.12
    out.push({
      id: `${ac}-${display}-${i}-${Math.random().toString(36).slice(2, 9)}`,
      number: display,
      type: tollFree ? "Toll-Free" : "Local",
      price: tollFree ? "$4.99/mo" : "$2.99/mo",
    })
  }

  return out
}

function exchangeStartsTollFree(display: string): boolean {
  const match = display.match(/\(\d{3}\)\s(\d{3})-/)
  if (!match) return false
  const ex = match[1]
  return ex.startsWith("8") && (ex[1] === "0" || ex[1] === "8")
}
