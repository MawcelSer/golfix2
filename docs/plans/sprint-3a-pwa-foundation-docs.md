# Sprint 3A — Golfer PWA Foundation : Documentation & Guide de Test

## Résumé

Sprint 3A met en place les fondations de l'application mobile golfeur : scaffold PWA, authentification, consentement GDPR, géolocalisation et page d'accueil.

**Modules** : `apps/golfer-app/src/` (features/, hooks/, stores/, services/, components/) + `packages/shared/src/types/`
**Tests** : 46 unit (golfer-app) + 4 (shared) + 20 E2E (Playwright) = 70 tests
**PR** : #5 — `feat/sprint-3a-pwa-foundation`

---

## Ce qui a été implémenté

### 1. Package shared — Types & Utilitaires (`packages/shared/`)

Types partagés entre l'API, le dashboard et l'app golfeur, extraits des schémas API existants.

| Fichier | Types exportés |
|---------|---------------|
| `types/auth.ts` | `RegisterInput`, `LoginInput`, `AnonymousInput`, `RefreshInput`, `AuthTokens`, `AuthUser`, `AuthResponse` |
| `types/course.ts` | `LocateInput`, `HazardData`, `HoleData`, `CourseData`, `CourseMatch` |
| `types/session.ts` | `StartSessionInput`, `FinishSessionInput`, `StartSessionResponse`, `SessionResponse` |
| `types/scoring.ts` | `CreateRoundInput`, `UpsertScoreInput`, `ScoreResponse`, `RoundResponse`, `RoundWithScoresResponse`, `RoundSummaryResponse` |
| `types/position.ts` | `PositionInput`, `PositionBatchInput`, `PositionBatchResponse` |
| `types/socket.ts` | `PositionUpdate`, `PositionBroadcast`, `SocketError`, `SOCKET_EVENTS`, `SocketEventName` |
| `utils/haversine.ts` | `haversineDistance(lat1, lng1, lat2, lng2)` — distance great-circle en mètres |

### 2. Scaffold PWA (`apps/golfer-app/`)

Application React 19 + Vite 6 + Tailwind CSS v4 avec support PWA.

**Configuration** :
- `vite.config.ts` : React, Tailwind v4 (`@tailwindcss/vite`), `vite-plugin-pwa` (Workbox), proxy API, HTTPS optionnel
- `playwright.config.ts` : E2E tests sur mobile Chrome (Pixel 7)
- `vitest.config.ts` : jsdom, path aliases, exclusion `e2e/`

**Design tokens** (Tailwind v4 `@theme`) :
| Token | Valeur | Usage |
|-------|--------|-------|
| `pine` | `#0F2818` | Fond principal |
| `cream` | `#FAFDF7` | Texte principal |
| `sage` | `#8FB89A` | Texte secondaire |
| `gold` | `#D4A843` | Accents, liens actifs |
| `green-mid` | `#2D8B47` | Boutons primaires |
| `font-mono` | DM Mono | Distances, scores |

**Layout** :
- `AppShell` : wrapper flex-column avec padding bottom pour les onglets
- `BottomTabs` : 3 onglets (GPS, Carte, Profil) avec état actif gold

### 3. Consentement GDPR (`features/consent/`)

Modal bottom-sheet pour le consentement GPS, requis avant toute localisation.

- `GdprConsentModal` : explique l'usage GPS, boutons Accepter/Refuser
- Accepter → `authStore.acceptGdpr()` (met `gdprConsent: true` + `gdprConsentAt: timestamp`)
- Refuser → ferme le modal sans modifier l'état
- Le consentement persiste à travers les déconnexions (`logout` ne reset pas GDPR)

### 4. Écrans d'authentification (`features/auth/`)

Trois modes d'authentification avec garde de route.

| Écran | Route | Endpoint API | Champs |
|-------|-------|-------------|--------|
| `LoginScreen` | `/login` | `POST /auth/login` | Email, Mot de passe |
| `RegisterScreen` | `/register` | `POST /auth/register` | Nom, Email, Mot de passe (min 8) |
| `AnonymousScreen` | `/anonymous` | `POST /auth/anonymous` | Nom (deviceId auto-généré) |

- `AuthGuard` : vérifie `accessToken` dans le store, redirige vers `/login` si absent
- Après authentification réussie → navigation vers `/gps`
- Liens de navigation entre les écrans (login ↔ register ↔ anonymous)

**Store Zustand** (`stores/auth-store.ts`) :
- `setAuth(response)` — stocke user + tokens
- `updateTokens(tokens)` — rafraîchit les tokens
- `acceptGdpr()` / `revokeGdpr()` — gère le consentement
- `logout()` — efface auth mais conserve GDPR
- `reset()` — remet tout à l'état initial

**Client API** (`services/api-client.ts`) :
- Wrapper fetch avec injection automatique du Bearer token
- `ApiError` class avec `status` pour gestion différenciée des erreurs
- Lit `data.error ?? data.message` pour correspondre au format Fastify

### 5. Géolocalisation & Page d'accueil (`hooks/`, `features/session/`)

**Hook `useGeolocation`** :
- Wraps `navigator.geolocation.watchPosition` avec high accuracy
- Retourne `{ position, error, watching, startWatching, stopWatching }`
- Codes d'erreur mappés : `permission_denied`, `position_unavailable`, `timeout`
- Sur erreur : nettoie le watchId et met `watching: false` pour permettre un retry

**`LandingPage`** :
- Affiche le logo app + message de bienvenue personnalisé
- Bouton "Démarrer un parcours" :
  1. Vérifie le consentement GDPR → ouvre le modal si absent
  2. Après acceptation GDPR → lance automatiquement la localisation
  3. Vérifie la position GPS → affiche "Acquisition GPS en cours…" si pas de fix
  4. Appelle `POST /courses/locate` → navigue vers `/gps?course={slug}`
  5. Gère le 404 spécifiquement : "Vous n'êtes pas sur un parcours"
- Liste des dernières parties (GET `/users/me/rounds`) avec date + score total

### 6. Assets logo

- `logo.png` (wordmark horizontal) → en-tête des écrans d'authentification
- `app-logo.png` (icône carrée) → page d'accueil + icône PWA manifest
- `favicon.png` → favicon HTML

---

## Comment tester

### Tests unitaires

```bash
cd apps/golfer-app && pnpm test
```

46 tests dans 11 fichiers :
- `auth-store.test.ts` (6) — store Zustand
- `api-client.test.ts` (4) — client REST
- `use-geolocation.test.ts` (6) — hook GPS avec retry après erreur
- `LoginScreen.test.tsx` (5) — formulaire + appel API
- `RegisterScreen.test.tsx` (3) — formulaire + appel API
- `AnonymousScreen.test.tsx` (3) — formulaire + deviceId
- `AuthGuard.test.tsx` (2) — redirection
- `GdprConsentModal.test.tsx` (5) — modal accept/refuse
- `LandingPage.test.tsx` (6) — bienvenue, rounds, 404 locate, erreur générique
- `BottomTabs.test.tsx` (5) — navigation
- `AppShell.test.tsx` (1) — layout

### Tests E2E (Playwright)

```bash
cd apps/golfer-app && pnpm test:e2e
```

20 tests sur mobile Chrome (Pixel 7) avec mocks API par interception de routes :
- **Auth** (14) : guard redirect, login/register/anonymous flows, navigation tabs
- **GDPR** (3) : modal show/accept/refuse
- **Landing** (3) : welcome, past rounds, start button

### Tests shared

```bash
cd packages/shared && pnpm test
```

4 tests : haversine distance (Paris→Londres, même point, antipodes, courte distance).

### Vérification manuelle

```bash
cd apps/golfer-app && pnpm dev
# Ouvrir http://localhost:5173
```

1. Vérifier la redirection vers `/login`
2. Tester connexion / inscription / mode anonyme
3. Vérifier la navigation par onglets (GPS, Carte, Profil)
4. Tester le flux GDPR (bouton Démarrer → modal → accepter)
5. Vérifier les logos sur tous les écrans

---

## Problèmes identifiés et corrigés (Code Review)

8 issues trouvées par code review automatisée et corrigées :

| # | Sévérité | Problème | Correction |
|---|----------|----------|------------|
| 1 | Critique | Mauvais chemin API `/rounds/users/me/rounds` | Corrigé en `/users/me/rounds` |
| 2 | Haute | Client lit `data.message`, API envoie `data.error` | Lit `data.error ?? data.message` |
| 3 | Haute | Mock E2E `id` au lieu de `courseId` | Corrigé + supprimé `distanceMetres` |
| 4 | Moyenne | `/courses/locate` retourne 404, pas null | Catch `ApiError` avec `status === 404` |
| 5 | Moyenne | GPS envoie `{0,0}` si pas de fix | Affiche message "Acquisition GPS" |
| 6 | Moyenne | Erreur avalée dans useEffect (rounds) | Log `console.error` pour non-401 |
| 7 | Moyenne | useGeolocation ne permet pas de retry après erreur | Clear watchId + watching sur erreur |
| 8 | Moyenne | GDPR double-tap requis | Auto-invoque locate après acceptation |

---

## Architecture des fichiers

```
apps/golfer-app/
├── e2e/                          # Playwright E2E tests
│   ├── fixtures.ts               # Mocks API + test fixture
│   ├── auth.spec.ts              # Auth flow tests
│   ├── gdpr.spec.ts              # GDPR consent tests
│   └── landing.spec.ts           # Landing page tests
├── public/
│   ├── favicon.png               # Favicon
│   ├── logo.png                  # Wordmark horizontal
│   └── icons/app-logo.png        # Icône carrée
├── src/
│   ├── components/layout/
│   │   ├── AppShell.tsx           # Layout wrapper
│   │   └── BottomTabs.tsx         # Navigation 3 onglets
│   ├── features/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   ├── AnonymousScreen.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── consent/
│   │   │   └── GdprConsentModal.tsx
│   │   └── session/
│   │       └── LandingPage.tsx
│   ├── hooks/
│   │   └── use-geolocation.ts     # GPS watch hook
│   ├── services/
│   │   └── api-client.ts          # REST client + ApiError
│   ├── stores/
│   │   └── auth-store.ts          # Zustand (auth + GDPR)
│   ├── lib/
│   │   └── constants.ts           # API_BASE_URL, MAPBOX_TOKEN, WS_URL
│   ├── router.tsx                 # React Router config
│   ├── App.tsx                    # RouterProvider
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Tailwind v4 + design tokens
├── playwright.config.ts
├── vite.config.ts
└── vitest.config.ts
```

---

## Prochaine session (3B)

- Persistance IndexedDB (Zustand persist middleware)
- Écran GPS avec carte Mapbox + overlay de trou
- Calculateur de distances (front/centre/back du green)
- Saisie rapide de score
- Navigation entre trous
