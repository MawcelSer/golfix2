/**
 * REST client for authenticating simulated golfers.
 * Creates anonymous users and obtains JWT tokens.
 */
export class AuthClient {
  private readonly baseUrl: string;

  constructor(apiUrl: string) {
    this.baseUrl = apiUrl.replace(/\/$/, "");
  }

  /**
   * Register an anonymous golfer and get a JWT token.
   * Uses POST /api/v1/auth/anonymous
   */
  async registerAnonymous(displayName: string, deviceId: string): Promise<AuthResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, deviceId }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Auth failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      user: { id: string };
    };

    return {
      userId: data.user.id,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  }
}

export interface AuthResult {
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}
