import { describe, expect, it } from "vitest"

describe("routingSkillTagFromCertCode", () => {
  it("maps automotive_core to automotive", async () => {
    const { routingSkillTagFromCertCode } = await import("@/lib/routing-pool-skills")
    expect(routingSkillTagFromCertCode("automotive_core")).toBe("automotive")
  })
})
