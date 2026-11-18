import { describe, expect, it } from "vitest";
import { validateUrl } from "./validateUrl";

describe("validateUrl", () => {
  it("allows empty or null or undefined values as optional", () => {
    expect(validateUrl("")).toBe(true);
    expect(validateUrl(null)).toBe(true);
    expect(validateUrl(undefined)).toBe(true);
    expect(validateUrl("   ")).toBe(true);
  });

  it("accepts valid HTTPS and HTTP URLs", () => {
    expect(validateUrl("https://www.genztestcollege.edu.in")).toBe(true);
    expect(validateUrl("https://www.linkedin.com/school/example-college/")).toBe(true);
    expect(validateUrl("https://www.instagram.com/examplecollege/")).toBe(true);
    expect(validateUrl("https://www.facebook.com/examplecollege")).toBe(true);
    expect(validateUrl("https://www.youtube.com/@examplecollege")).toBe(true);
    expect(validateUrl("https://x.com/examplecollege")).toBe(true);
    expect(validateUrl("http://example.org/path?q=1")).toBe(true);
  });

  it("rejects invalid URLs without throwing errors", () => {
    expect(validateUrl("not-a-url")).toBe("Enter a valid website address, e.g. https://example.com");
    expect(validateUrl("ftp://example.com")).toBe("URL must start with https:// or http://");
    expect(validateUrl("javascript:alert(1)")).toBe("URL must start with https:// or http://");
    expect(validateUrl("http://nodotdomain")).toBe("Enter a valid website address, e.g. https://example.com");
  });
});
