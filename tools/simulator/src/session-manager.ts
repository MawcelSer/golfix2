/**
 * REST client for managing golf sessions.
 * Creates and finishes sessions via the API.
 */
export class SessionManager {
  private readonly baseUrl: string;

  constructor(apiUrl: string) {
    this.baseUrl = apiUrl.replace(/\/$/, "");
  }

  /** Create a new golf session via POST /api/v1/sessions */
  async createSession(
    courseId: string,
    token: string,
  ): Promise<{ sessionId: string; groupId?: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ courseId }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Create session failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { id: string; groupId?: string };
    return { sessionId: data.id, groupId: data.groupId };
  }

  /** Finish a golf session via PATCH /api/v1/sessions/:id */
  async finishSession(sessionId: string, token: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions/${sessionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "finished" }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Finish session failed (${res.status}): ${body}`);
    }
  }
}
