# Sprint 3B — GPS Distances, Course Caching, Hole Detection : Documentation

## Résumé

Sprint 3B ajoute les fonctionnalités GPS core : cache de données parcours (IndexedDB), écran de distances en direct, et détection automatique du trou en cours.

**Modules** : `apps/golfer-app/src/features/gps/`, `hooks/`, `services/`, `stores/`
**Tests** : 77 unit (golfer-app) + 20 E2E (Playwright)
**PR** : #6 — `feat/sprint-3b-gps-scorecard`

---

## Ce qui a été implémenté

### 1. CI Build Step + Validate Script

- Ajout de `pnpm build` dans `.github/workflows/ci.yml` (entre typecheck et migrations)
- Ajout de `pnpm validate` dans `package.json` root (lint + format:check + typecheck + build)
- Hook git pre-push installé localement (`.git/hooks/pre-push`)
- Fix : ajout de `apps/dashboard/index.html` (Vite nécessite un entry point même pour un skeleton)

### 2. Course Data Caching — IndexedDB (`services/course-cache.ts`)

Cache des données parcours avec `idb-keyval` :

| Fonction | Description |
|----------|-------------|
| `getCachedCourse(slug)` | Lecture cache, retourne `null` si TTL expiré (24h) |
| `setCachedCourse(course)` | Écriture cache avec timestamp |
| `clearCachedCourse(slug)` | Suppression cache |
| `isCacheValid(slug, version)` | Vérifie TTL + version |

**Résilience** : Toutes les opérations IndexedDB sont wrappées en try-catch. En cas d'erreur (quota, navigation privée), le cache retourne gracieusement `null`/`false` sans bloquer l'app.

**Store Zustand** (`stores/course-store.ts`) :
- `setCourse(data)` — stocke slug + données (slug extrait de `data.slug`)
- `clearCourse()` — reset à null

### 3. Hook `useCourseData(slug)` (`hooks/use-course-data.ts`)

Pattern stale-while-revalidate :
1. Charge depuis le cache IndexedDB
2. Affiche immédiatement les données cachées
3. Revalide en arrière-plan via l'API
4. Met à jour si `dataVersion` a changé

**Protections** :
- Guard de staleness (annule les requêtes si le slug change)
- Gestion d'erreurs différenciée : 401 → "Session expirée", 404 → "Parcours introuvable", autre → générique
- Logging `console.warn` sur toutes les erreurs (pas de catch silencieux)

### 4. GPS Distance Screen (`features/gps/GpsScreen.tsx`)

Écran principal avec distances en direct :

| Composant | Rôle |
|-----------|------|
| `GpsScreen` | Écran principal, orchestre hooks et affichage |
| `DistanceCard` | Carte distance (avant/centre/arrière) avec variante primary |
| `HoleSelector` | Navigation trou précédent/suivant avec boutons disabled aux limites |
| `distance-calculator.ts` | `computeHoleDistances()` — Haversine depuis position GPS vers green (front/center/back) |

**États UI** :
- Chargement : "Chargement du parcours…"
- Erreur : message + bouton "Réessayer" (appelle `refetch`)
- Aucun parcours : "Aucun parcours sélectionné"
- Normal : distances + infos trou + navigation + précision GPS

**GPS** : Démarré une seule fois au mount via `hasStartedRef` (pas de boucle de retry infinie).

### 5. Auto Hole Detection (`hooks/use-hole-detection.ts`)

Détection automatique du trou en cours basée sur la proximité aux départs :

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `TEE_PROXIMITY_M` | 80m | Seuil de proximité départ |
| `GREEN_PROXIMITY_M` | 30m | Seuil "sur le green" |
| `HYSTERESIS_COUNT` | 2 | Nombre de mesures consécutives avant changement |
| `MANUAL_OVERRIDE_MS` | 3 min | Durée du verrouillage après sélection manuelle |

**Algorithme** :
1. Pour chaque mise à jour GPS, calcule la distance à tous les départs
2. Si le plus proche est < 80m, c'est un candidat
3. Après 2 mesures consécutives sur le même candidat → changement de trou
4. Override manuel : bloque l'auto-détection pendant 3 minutes
5. Détecte `nearGreen` quand < 30m du green du trou en cours

**Validation** : `setManualHole` vérifie `1 <= hole <= holes.length` avant d'appliquer.

---

## Structure des fichiers

```
apps/golfer-app/src/
├── features/gps/
│   ├── GpsScreen.tsx              # Écran principal GPS
│   ├── DistanceCard.tsx           # Composant carte distance
│   ├── HoleSelector.tsx           # Navigation entre trous
│   ├── distance-calculator.ts     # Calcul Haversine distances
│   └── __tests__/
│       ├── GpsScreen.test.tsx     # 6 tests
│       └── distance-calculator.test.ts  # 4 tests
├── hooks/
│   ├── use-course-data.ts         # Hook données parcours + cache
│   ├── use-hole-detection.ts      # Hook détection auto trou
│   └── __tests__/
│       ├── use-course-data.test.ts    # 5 tests
│       └── use-hole-detection.test.ts # 7 tests
├── services/
│   ├── course-cache.ts            # Cache IndexedDB
│   └── __tests__/
│       └── course-cache.test.ts   # 6 tests
└── stores/
    ├── course-store.ts            # Store Zustand parcours
    └── __tests__/
        └── course-store.test.ts   # 3 tests
```

---

## Comment tester

### Tests unitaires
```bash
cd apps/golfer-app && pnpm test
# 77 tests, 17 fichiers
```

### Tests E2E
```bash
cd apps/golfer-app && pnpm test:e2e
# 20 tests Playwright (mobile Chrome)
```

### Validation complète (comme CI)
```bash
pnpm validate
# lint + format:check + typecheck + build
```

### Test manuel (dev server)
```bash
cd apps/golfer-app && pnpm dev
```
Naviguer vers `/gps?course=<slug>` après authentification.

---

## Issues trouvées et corrigées lors du code review

| # | Sévérité | Issue | Fix |
|---|----------|-------|-----|
| 1 | Critique | Race condition `useCourseData` — pas d'annulation au changement de slug | Guard de staleness (`let stale = false` + cleanup) |
| 2 | Critique | Boucle infinie GPS retry — `if (!watching) startWatching()` relance en boucle | `hasStartedRef` pour démarrer une seule fois |
| 3 | Important | Catch vide dans `revalidate` | `console.warn` + gestion ApiError 401 |
| 4 | Important | Catch vide dans `fetchCourse` | Logging + messages différenciés (401, 404) |
| 5 | Important | Cache IndexedDB sans try-catch | Toutes les fonctions wrappées, retour gracieux |
| 6 | Important | Pas de bouton retry sur erreur | Bouton "Réessayer" ajouté |
| 7 | Important | `setManualHole` sans validation | Guard `1 <= hole <= holes.length` |
| 8 | Important | `setCourse(slug, data)` — slug redondant | Changé en `setCourse(data)` |
| 9 | Important | Test mute l'objet fixture | Spread au lieu de mutation directe |
| 10 | Important | `vi.restoreAllMocks()` fragile | Changé en `vi.clearAllMocks()` |
