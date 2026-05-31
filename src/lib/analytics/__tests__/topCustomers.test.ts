import { describe, it, expect } from "vitest";
import { computeTopCustomers } from "@/lib/analytics/topCustomers";

describe("computeTopCustomers", () => {
  it("classe par nombre de visites desc, top N", () => {
    const rows = [
      { customer_id: "a", full_name: "Alice" }, { customer_id: "a", full_name: "Alice" },
      { customer_id: "b", full_name: "Bob" },
    ];
    const top = computeTopCustomers(rows, 5);
    expect(top[0]).toEqual({ customerId: "a", name: "Alice", visits: 2 });
    expect(top[1]).toEqual({ customerId: "b", name: "Bob", visits: 1 });
  });
});
