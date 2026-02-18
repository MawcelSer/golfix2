import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthResponse } from "@golfix/shared";

function generateDeviceId(): string {
  return `device-${crypto.randomUUID().slice(0, 12)}`;
}

export function AnonymousScreen() {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post<AuthResponse>("/auth/anonymous", {
        displayName,
        deviceId: generateDeviceId(),
      });
      setAuth(response);
      navigate("/gps");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-pine px-6">
      <img src="/logo.png" alt="Golfix" className="mb-8 h-10" />
      <h1 className="mb-6 text-2xl font-semibold text-cream">Jouer sans compte</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-cream">
            Nom d&apos;affichage
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full rounded-lg bg-cream/10 px-4 py-3 text-cream placeholder:text-cream/40"
            placeholder="Votre nom"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-green-mid py-3 font-medium text-cream disabled:opacity-50"
        >
          {loading ? "Chargement..." : "Continuer"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-cream/70">
        <Link to="/login" className="text-gold underline">
          Se connecter
        </Link>{" "}
        ou{" "}
        <Link to="/register" className="text-cream/50 underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
