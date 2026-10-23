import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the register, an empty ledger and the no-payment notice", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Leave a little");
    expect(html).toContain("No payment rail connected. This is a local ledger.");
    expect(html).toContain("NO PAYMENT CONNECTION");
    expect(html).toContain("No receipts yet.");
    expect(html).toContain("฿0");
    for (const value of ["฿50", "฿100", "฿200", "฿500"]) expect(html).toContain(value);
  });
});
