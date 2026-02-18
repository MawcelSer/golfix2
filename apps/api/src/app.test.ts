import { describe, it, expect } from "vitest";
import { buildApp } from "./app";

describe("API health check", () => {
  it("GET /api/v1/health returns status ok", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();

    await app.close();
  });
});
