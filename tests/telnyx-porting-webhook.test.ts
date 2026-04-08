import { describe, it, expect } from "vitest"
import {
  customerRefToUserId,
  findZingCustomerReference,
  extractEventType,
  extractTelnyxEventId,
} from "@/lib/telnyx-porting-webhook"

describe("telnyx-porting-webhook", () => {
  it("finds zing customer_reference in nested payload", () => {
    const ref = findZingCustomerReference({
      data: {
        record: {
          customer_reference: "zing-aaaaaaaa-bbbb-cccc-dddddddddddd",
        },
      },
    })
    expect(ref).toBe("zing-aaaaaaaa-bbbb-cccc-dddddddddddd")
    expect(customerRefToUserId(ref!)).toBe("aaaaaaaa-bbbb-cccc-dddddddddddd")
  })

  it("extracts event type and id", () => {
    const body = {
      meta: { event_type: "porting_order.status_changed", id: "evt_test_1" },
      data: { customer_reference: "zing-u1" },
    }
    expect(extractEventType(body)).toBe("porting_order.status_changed")
    expect(extractTelnyxEventId(body)).toBe("evt_test_1")
  })
})
