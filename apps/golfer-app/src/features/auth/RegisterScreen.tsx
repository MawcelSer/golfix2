import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { apiClient } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthResponse } from "@golfix/shared";

const registerSchema = z.object({
  displayName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
});

export function RegisterScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const result = registerSchema.safeParse({ displayName, email, password });
    if (!result.success) {
      setError(result.error.errors[0]!.message);
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post<AuthResponse>("/auth/register", {
        displayName,
        email,
        password,
      });
      setAuth(response);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-pine px-6">
      <img src="/icons/app-logo.png" alt="Golfix" className="mb-8 h-16" />
      <h1 className="mb-6 font-display text-3xl text-cream">Créer un compte</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-cream">
            Nom
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full rounded-xl border border-cream/10 bg-cream/8 px-4 py-3 text-cream placeholder:text-cream/40"
            placeholder="Votre nom"
          />
        </div>
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
            minLength={8}
            className="w-full rounded-xl border border-cream/10 bg-cream/8 px-4 py-3 text-cream placeholder:text-cream/40"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-green-mid py-3 font-medium text-cream disabled:opacity-50"
        >
          {loading ? "Chargement..." : "Créer mon compte"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-cream/70">
        Déjà un compte ?{" "}
        <Link to="/login" className="text-gold underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
