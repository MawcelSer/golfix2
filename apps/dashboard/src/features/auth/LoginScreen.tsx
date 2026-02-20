import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { apiClient } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthResponse } from "@golfix/shared";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caracteres minimum"),
});

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0]!.message);
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post<AuthResponse>("/auth/login", { email, password });
      setAuth(response);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-pine px-6">
      <h1 className="mb-2 font-display text-3xl text-cream">Golfix Dashboard</h1>
      <p className="mb-8 text-sm text-cream/60">Gestion de parcours</p>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-cream">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-cream/10 bg-cream/8 px-4 py-3 text-cream placeholder:text-cream/40"
            placeholder="votre@email.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-cream">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-cream/10 bg-cream/8 px-4 py-3 text-cream placeholder:text-cream/40"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-green-mid py-3 font-medium text-cream disabled:opacity-50"
        >
          {loading ? "Chargement..." : "Connexion"}
        </button>
      </form>
    </div>
  );
}
