# Sprint 4 — Pace Engine : Documentation & Guide de Test

## Résumé

Sprint 4 implémente le moteur de rythme (Pace Engine) : détection automatique des groupes, calcul du rythme de jeu, suivi des écarts inter-groupes, détection des goulots d'étranglement et système d'alertes avec escalade.

**Modules** : `apps/api/src/pace/` (6 fichiers) + `apps/api/src/tee-times/` (CRUD)
**Tests** : 186 tests (tous passants)

---

## Ce qui a été implémenté

### 1. Tee Time CRUD (`apps/api/src/tee-times/`)

Gestion des départs programmés sur un parcours.

**Endpoints REST** (tous protégés — JWT + rôle course owner/admin/marshal) :

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/courses/:courseId/tee-times` | Créer un départ |
| GET | `/api/v1/courses/:courseId/tee-times?date=YYYY-MM-DD` | Lister les départs d'un jour |
| GET | `/api/v1/courses/:courseId/tee-times/:id` | Détail d'un départ |
| PUT | `/api/v1/courses/:courseId/tee-times/:id` | Modifier un départ |
| DELETE | `/api/v1/courses/:courseId/tee-times/:id` | Supprimer un départ |

### 2. Détection de groupes (`pace/group-detector.ts`)

Deux signaux de détection :
- **Matching tee time** : session démarrée ±10 min d'un départ programmé → assignée au groupe de ce départ
- **Co-localisation GPS** : sessions sans tee time, démarrées dans une fenêtre de ±3 min → regroupées automatiquement
- **Groupe solo** : si aucun match → groupe d'un seul joueur
- **Taille max** : 4 joueurs par groupe
- **Timeout FORMING** : après 5 min, un groupe ne peut plus recevoir de nouveaux membres

### 3. Calculateur de rythme (`pace/pace-calculator.ts`)

- Compare le temps écoulé au temps attendu par trou (par 3 → 10 min, par 4 → 14 min, par 5 → 18 min)
- **Statuts** : `ahead` (>3 min d'avance), `on_pace` (±3 min), `attention` (+3 à +8 min), `behind` (>+8 min de retard)
- **Hystérésis** : seuils d'entrée/sortie différents pour éviter le clignotement entre statuts
- **Lissage EWMA** (α=0.3) : le facteur de rythme est une moyenne pondérée (30% récent, 70% historique)
- **Projection d'arrivée** : temps restant × facteur de rythme (clampé entre 0.7 et 1.5)

### 4. Suivi des écarts (`pace/gap-tracker.ts`)

Mesure le temps entre groupes consécutifs sur le parcours :
- `severe_compression` : <2 min (critique)
- `compression` : 2–5 min (avertissement)
- `normal` : 5–15 min
- `lagging` : >15 min (retardataire)
- Détecte la **direction** : closing (écart se réduit), stable, widening (écart s'agrandit)

### 5. Détecteur de goulots (`pace/bottleneck-detector.ts`)

- Identifie les trous où 2+ groupes sont présents simultanément
- **Seuils ajustés au par** : par 3 → 5 min (attente normale au départ), par 4-5 → 3 min
- **Analyse racine** : distingue le goulot source (root) des cascades en aval
- **Suivi de résolution** : marque les goulots résolus quand <2 groupes restent

### 6. Moteur d'alertes (`pace/alert-engine.ts`)

- **Alertes rythme** : émises quand un groupe passe en `behind`, avec escalade (warning → critical)
- **Alertes écart** : compression et compression sévère
- **Alertes goulot** : émises une seule fois par goulot
- **Cooldowns** : 15 min (premier retard), 20 min (escaladé), 10 min (compression), 5 min (compression sévère)
- **Récupération** : alerte info quand un groupe revient `on_pace` après avoir été en retard

### 7. Orchestrateur (`pace/pace-engine.ts`)

Classe `PaceEngine` qui coordonne tous les modules :
- `processNewSessions()` — détecte les groupes
- `updatePositions()` — met à jour le trou courant
- `tick()` — cycle complet : rythme → écarts → goulots → alertes
- `reevaluateMembers()` — détecte les abandons et pertes de contact

---

## Prérequis pour tester

### Infrastructure

```bash
# Démarrer PostgreSQL + PostGIS
docker compose -f docker/docker-compose.yml up -d

# Appliquer les migrations
cd apps/api && pnpm drizzle-kit push

# Seeder la base
pnpm --filter @golfix/api seed

# Démarrer l'API
pnpm --filter @golfix/api dev
```

### Variables d'environnement (`apps/api/.env`)

```env
DATABASE_URL=postgresql://golfix:golfix@localhost:5433/golfix
JWT_SECRET=your-dev-secret-min-32-chars-long
PORT=3000
```

### Obtenir un token d'authentification

```bash
# Créer un utilisateur
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "marshal@test.com", "password": "password123", "displayName": "Marshal Test"}'

# Récupérer le accessToken de la réponse
```

> Note : Pour les endpoints tee-times, l'utilisateur doit avoir un rôle sur le parcours (owner, admin ou marshal). Le seed devrait attribuer ce rôle.

---

## Tests manuels

### A. Tests automatisés (recommandé en premier)

```bash
# Tous les tests
pnpm test

# Tests du pace engine uniquement
pnpm --filter @golfix/api test -- --grep "pace"

# Tests des tee times
pnpm --filter @golfix/api test -- --grep "tee-time"
```

### B. Tee Time CRUD (via curl)

Remplacer `$TOKEN` par votre accessToken et `$COURSE_ID` par un UUID de parcours (visible dans le seed).

```bash
# 1. Créer un départ
curl -X POST http://localhost:3000/api/v1/courses/$COURSE_ID/tee-times \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scheduledAt": "2026-02-19T08:00:00Z", "playersCount": 4}'
# → 201 { id, courseId, scheduledAt, playersCount, notes, createdAt }

# 2. Lister les départs du jour
curl http://localhost:3000/api/v1/courses/$COURSE_ID/tee-times?date=2026-02-19 \
  -H "Authorization: Bearer $TOKEN"
# → 200 [{ id, ... }, ...]

# 3. Détail d'un départ
curl http://localhost:3000/api/v1/courses/$COURSE_ID/tee-times/$TEE_TIME_ID \
  -H "Authorization: Bearer $TOKEN"
# → 200 { id, ... }

# 4. Modifier un départ
curl -X PUT http://localhost:3000/api/v1/courses/$COURSE_ID/tee-times/$TEE_TIME_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"playersCount": 2, "notes": "VIP group"}'
# → 200 { updated record }

# 5. Supprimer un départ
curl -X DELETE http://localhost:3000/api/v1/courses/$COURSE_ID/tee-times/$TEE_TIME_ID \
  -H "Authorization: Bearer $TOKEN"
# → 204 No Content
```

**Vérifications :**
- [ ] Créer un départ → 201
- [ ] Lister par date → tableau trié par scheduledAt
- [ ] Détail par ID → 200
- [ ] Modifier (partial update) → 200
- [ ] Supprimer → 204
- [ ] Sans token → 401
- [ ] Sans rôle course → 403
- [ ] Body invalide (playersCount: 5) → 400
- [ ] Départ inexistant → 404

### C. Pace Engine (via tests unitaires/intégration)

Le Pace Engine est principalement testable via les tests automatisés car c'est une couche de logique métier sans endpoints REST directs (sauf tee-times). Voici les scénarios couverts :

#### Scénario 1 : Partie normale (pas d'alertes)
- Groupe de 4 joueurs avec tee time
- Progression trou par trou au rythme attendu
- **Attendu** : statut `on_pace`, aucune alerte émise

#### Scénario 2 : Groupe lent
- Groupe progresse à ~2× le temps attendu
- Delta dépasse +8 min
- **Attendu** : alerte `behind_pace` (warning), puis escalade (critical) après cooldown de 15 min

#### Scénario 3 : Compression d'écart
- 2 groupes avec départs rapprochés
- Groupe arrière rattrape le groupe avant
- **Attendu** : alerte `gap_compression` (warning) à <5 min, `gap_severe` (critical) à <2 min

#### Scénario 4 : Goulot d'étranglement
- 2+ groupes sur le même trou pendant >3 min (par 4) ou >5 min (par 3)
- **Attendu** : alerte `bottleneck` (warning), identification du groupe bloqueur

#### Scénario 5 : Groupe walk-on (sans tee time)
- Sessions démarrées à ±3 min les unes des autres, pas de tee time
- **Attendu** : groupées automatiquement par co-localisation GPS

#### Scénario 6 : Joueur abandonné
- Un joueur ne transmet plus de GPS pendant 20+ min
- **Attendu** : signalé `lostContact` à 10 min, retiré du groupe (`abandoned`) à 20 min

#### Scénario 7 : Récupération
- Groupe en retard (`behind`) revient à un rythme normal
- **Attendu** : alerte info avec `resolved: true`, escalade réinitialisée

### D. Avec le simulateur (tests end-to-end)

Le simulateur (`tools/simulator/`) peut générer des positions GPS réalistes :

```bash
# Mode dry-run (pas d'appel API)
pnpm --filter @golfix/simulator sim --scenario slow-group --dry-run

# Mode live (envoie au serveur)
pnpm --filter @golfix/simulator sim --scenario normal --api-url http://localhost:3000
```

**Scénarios disponibles** : `normal`, `slow-group`, `bottleneck`, `random`

> Note : Le simulateur a été câblé au PositionBuffer dans Sprint 2. Pour tester le pace engine end-to-end, le simulateur doit alimenter les positions ET le PaceEngine doit être instancié (ce qui sera fait quand le PaceEngine sera branché au serveur dans un sprint futur).

---

## Architecture des fichiers

```
apps/api/src/
├── pace/
│   ├── pace-types.ts          # Types, constantes, factories
│   ├── pace-calculator.ts     # Calcul du rythme + hystérésis + EWMA
│   ├── group-detector.ts      # Détection de groupes (tee time + GPS)
│   ├── gap-tracker.ts         # Écarts inter-groupes
│   ├── bottleneck-detector.ts # Goulots d'étranglement
│   ├── alert-engine.ts        # Alertes avec escalade + cooldown
│   └── pace-engine.ts         # Orchestrateur central
├── tee-times/
│   ├── tee-time-routes.ts     # Endpoints REST
│   ├── tee-time-schemas.ts    # Validation Zod
│   └── tee-time-service.ts    # Couche données (Drizzle)
└── ...
```

## Tests existants

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `pace-calculator.test.ts` | ~20 | Statuts, hystérésis, EWMA, projection |
| `group-detector.test.ts` | ~20 | Tee time matching, GPS co-location, abandon |
| `gap-tracker.test.ts` | ~12 | Sévérité, direction, fallback |
| `bottleneck-detector.test.ts` | ~10 | Par-specific thresholds, cascade, résolution |
| `alert-engine.test.ts` | ~15 | Escalade, cooldown, récupération |
| `pace-engine.integration.test.ts` | 9 | Scénarios end-to-end complets |
| `tee-time-routes.test.ts` | 11 | CRUD + auth + validation |
