import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/lib/db", () => ({ db: {} }));

import { HttpError, sameOrigin } from "../src/lib/http";

afterEach(() => vi.unstubAllEnvs());

const origins = [
  "https://ifbsconsensus.com",
  "https://ifbs-consensus.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

function request(origin?: string) {
  return new Request("https://ifbsconsensus.com/api/auth/login", {
    method: "POST",
    headers: origin === undefined ? {} : { Origin: origin },
  });
}

describe("Website request origins", () => {
  it.each(origins)(
    "accepts %s regardless of the configured canonical URL",
    (origin) => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://canonical.example.com");
      vi.stubEnv("NODE_ENV", "production");
      expect(() => sameOrigin(request(origin))).not.toThrow();
    },
  );

  it("accepts the four website addresses without a configured canonical URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    for (const origin of origins)
      expect(() => sameOrigin(request(origin))).not.toThrow();
  });

  it("continues to trust an explicitly configured canonical origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://canonical.example.com/");
    expect(() =>
      sameOrigin(request("https://canonical.example.com")),
    ).not.toThrow();
  });

  it.each([
    undefined,
    "null",
    "https://evil.example",
    "https://ifbsconsensus.com.evil.example",
    "https://ifbsconsensus.com@evil.example",
    "https://other-project.vercel.app",
    "http://ifbsconsensus.com",
    "http://localhost:3002",
    "https://ifbsconsensus.com:444",
    "https://ifbsconsensus.com/some-path",
  ])("rejects untrusted or missing origin %s", (origin) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ifbsconsensus.com");
    expect(() => sameOrigin(request(origin))).toThrow(HttpError);
    expect(() => sameOrigin(request(origin))).toThrow(
      "Request origin is not allowed.",
    );
    try {
      sameOrigin(request(origin));
    } catch (error) {
      expect((error as HttpError).status).toBe(403);
    }
  });
});
