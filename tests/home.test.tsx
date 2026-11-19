import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import RootLayout, { metadata } from "@/app/layout";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "font-geist" }) }));

describe("home page", () => {
  it("renders the record form, an empty ledger and the no-payment notice on the App shell", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("<h1>Tip jar</h1>");
    expect(html).toContain("No payment rail connected. This is a local ledger.");
    expect(html).toContain("No tips yet");
    expect(html).toContain("฿0");
    expect(html).toContain("Record tip");
    for (const value of ["฿50", "฿100", "฿200", "฿500"]) expect(html).toContain(value);
    expect(html).toContain('href="https://bookchaowalit.com/"');
  });

  it("puts the font variable on <html> and the site's own domain in metadata", () => {
    const html = renderToString(<RootLayout><p>child</p></RootLayout>);
    expect(html).toContain('<html lang="en" class="font-geist"');
    expect(String(metadata.metadataBase)).toBe("https://donation-tip-jar.bookchaowalit.com/");
  });
});
