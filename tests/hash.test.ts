import { describe, expect, it } from "vitest";
import { sha256 } from "@/lib/hash";

describe("sha256", () => {
  it("matches the known digest of an empty string", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("is deterministic and sensitive to content", () => {
    expect(sha256("tweet")).toBe(sha256("tweet"));
    expect(sha256("tweet")).not.toBe(sha256("tweet "));
  });
});
