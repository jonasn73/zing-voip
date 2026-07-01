import { describe, expect, it } from "vitest"
import {
  buildFlatAddressQuery,
  isIntakeAddressReady,
  listIntakeDispatchBlockers,
  parseLooseAddressQuery,
} from "@/lib/intake-address-helpers"

describe("intake address helpers", () => {
  it("builds a geocode query from flat customer fields", () => {
    expect(
      buildFlatAddressQuery({
        addressLine1: "5010 Roy William Place",
        city: "Louisville",
        region: "KY",
        postalCode: "40228",
      })
    ).toBe("5010 Roy William Place, Louisville, KY, 40228")
  })

  it("returns null when street or city is missing", () => {
    expect(buildFlatAddressQuery({ addressLine1: "123 Main", city: "", postalCode: "40228" })).toBeNull()
  })

  it("parses a typed comma-separated address", () => {
    expect(parseLooseAddressQuery("5010 Roy William Place, Louisville, KY 40228")).toEqual({
      addressLine1: "5010 Roy William Place",
      city: "Louisville",
      region: "KY",
      postalCode: "40228",
    })
  })

  it("accepts flat street + city for dispatch readiness", () => {
    expect(
      isIntakeAddressReady({
        serviceAddress: null,
        addressLine1: "5010 Roy William Place",
        city: "Louisville",
      })
    ).toBe(true)
  })

  it("lists dispatch blockers in plain language", () => {
    expect(
      listIntakeDispatchBlockers({
        displayName: "",
        serviceAddress: null,
        addressLine1: "",
        city: "",
      })
    ).toEqual(["Caller name", "Service address (street + city, or pick a suggestion)"])
  })
})
