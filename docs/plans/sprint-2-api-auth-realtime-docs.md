# Sprint 2 — API, Auth & Real-time : Documentation & Guide de Test

## Résumé

Sprint 2 implémente l'API REST complète : authentification (JWT + anonyme), CRUD parcours/sessions/scoring, positions GPS (batch + WebSocket), et suivi temps réel via Socket.io.

**Modules** : `apps/api/src/` (auth, courses, sessions, scoring, positions, ws)

---

## Ce qui a été implémenté

### 1. Authentification (`auth/`)
- Inscription email/mot de passe (bcrypt 12 rounds)
- Connexion anonyme (par deviceId, sans mot de passe)
- Login avec email/mot de passe
- Refresh token avec rotation atomique (ancien révoqué, nouveau émis)
- Logout (révocation du refresh token)
- JWT HS256 : access 15 min, refresh 7 jours

### 2. Parcours (`courses/`)
- Localisation GPS : envoie lat/lng → reçoit le parcours (requête PostGIS `ST_Within`)
- Données complètes du parcours : 18 trous avec positions tee/green, obstacles, géofences

### 3. Sessions (`sessions/`)
- Démarrer une session sur un parcours (auto-groupement par jour, max 4/groupe)
- Terminer une session (finished/abandoned)
- Consulter une session (propriétaire ou admin du parcours)

### 4. Scoring (`scoring/`)
- Créer un round (scorecard)
- Saisir/modifier les scores par trou (upsert)
- Consulter ses rounds et le détail avec scores

### 5. Positions GPS (`positions/`)
- Batch insert (max 2000 positions/requête)
- Déduplication par `recordedAt`
- PositionBuffer : flush mémoire → DB toutes les 2 secondes

### 6. WebSocket (`ws/`)
- Connexion authentifiée (JWT dans handshake)
- Rooms : `course:{id}:positions` et `course:{id}:dashboard`
- `position:update` → buffered + broadcast vers dashboard
- `auth:refresh` → rafraîchir le token en cours de connexion
- Détection automatique du trou (PostGIS)

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

---

## Tests manuels

### A. Tests automatisés (recommandé en premier)

```bash
# Tous les tests
pnpm test

# Tests d'un module spécifique
pnpm --filter @golfix/api test -- --grep "auth"
pnpm --filter @golfix/api test -- --grep "course"
pnpm --filter @golfix/api test -- --grep "session"
pnpm --filter @golfix/api test -- --grep "scoring"
pnpm --filter @golfix/api test -- --grep "position"
```

### B. Authentification

```bash
# 1. Inscription
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123", "displayName": "Test User"}'
# → 201 { user: { id, displayName, email }, accessToken, refreshToken }

# 2. Connexion
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
# → 200 { user, accessToken, refreshToken }

# 3. Inscription anonyme
curl -X POST http://localhost:3000/api/v1/auth/anonymous \
  -H "Content-Type: application/json" \
  -d '{"displayName": "Joueur Anonyme", "deviceId": "device-abc-12345"}'
# → 201 { user: { id, displayName, email: null }, accessToken, refreshToken }

# 4. Refresh token
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "$REFRESH_TOKEN"}'
# → 200 { accessToken (nouveau), refreshToken (nouveau) }

# 5. Logout
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "$REFRESH_TOKEN"}'
# → 200 { message: "Logged out" }
```

**Vérifications :**
- [ ] Inscription → 201 avec tokens
- [ ] Email dupliqué → 409
- [ ] Email invalide → 400
- [ ] Mot de passe < 8 caractères → 400
- [ ] Login correct → 200 avec tokens
- [ ] Login mauvais mot de passe → 401
- [ ] Login email inexistant → 401
- [ ] Anonyme avec deviceId valide → 201
- [ ] Anonyme deviceId < 8 chars → 400
- [ ] Refresh avec token valide → nouveaux tokens
- [ ] Refresh avec ancien token (après rotation) → 401
- [ ] Logout puis refresh → 401

### C. Parcours

```bash
# 1. Localiser un parcours par GPS
curl -X POST http://localhost:3000/api/v1/courses/locate \
  -H "Content-Type: application/json" \
  -d '{"lat": 48.8566, "lng": 2.3522}'
# → 200 { courseId, name, slug } si le point est dans un parcours
# → 404 si aucun parcours trouvé

# 2. Données complètes du parcours
curl http://localhost:3000/api/v1/courses/$SLUG/data
# → 200 { id, name, slug, holesCount, par, holes: [...], ... }
```

**Vérifications :**
- [ ] Coordonnées dans un parcours seedé → 200 avec courseId
- [ ] Coordonnées hors parcours (0, 0) → 404
- [ ] lat > 90 → 400
- [ ] Données parcours par slug → 200 avec 18 trous
- [ ] Chaque trou a teePosition et greenCenter
- [ ] Obstacles regroupés par trou
- [ ] Slug inexistant → 404

### D. Sessions

```bash
# 1. Démarrer une session (requiert auth)
curl -X POST http://localhost:3000/api/v1/sessions/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId": "$COURSE_ID"}'
# → 201 { sessionId, groupId, courseId }

# 2. Terminer une session
curl -X PATCH http://localhost:3000/api/v1/sessions/$SESSION_ID/finish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "finished"}'
# → 200 { id, status: "finished", finishedAt, ... }

# 3. Consulter une session
curl http://localhost:3000/api/v1/sessions/$SESSION_ID \
  -H "Authorization: Bearer $TOKEN"
# → 200 { id, userId, courseId, groupId, status, startedAt, ... }
```

**Vérifications :**
- [ ] Démarrer session → 201 avec sessionId et groupId
- [ ] Même parcours 2× → 409 (session active existante)
- [ ] Parcours différent → 201 (autorisé)
- [ ] Sans token → 401
- [ ] Auto-groupement : 4 utilisateurs même jour → même groupe
- [ ] 5ème utilisateur → nouveau groupe
- [ ] Terminer session → 200 avec finishedAt
- [ ] Terminer 2× → 409
- [ ] Terminer session d'un autre → 403
- [ ] Consulter comme propriétaire → 200
- [ ] Consulter comme autre utilisateur → 403

### E. Scoring

```bash
# 1. Créer un round
curl -X POST http://localhost:3000/api/v1/rounds \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId": "$COURSE_ID"}'
# → 201 { id, userId, courseId, status: "in_progress", ... }

# 2. Saisir un score (upsert)
curl -X PUT http://localhost:3000/api/v1/rounds/$ROUND_ID/scores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"holeNumber": 1, "strokes": 4, "putts": 2, "fairwayHit": true, "greenInRegulation": false}'
# → 200 { id, roundId, holeNumber, strokes, putts, ... }

# 3. Modifier un score (même endpoint, même trou)
curl -X PUT http://localhost:3000/api/v1/rounds/$ROUND_ID/scores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"holeNumber": 1, "strokes": 5}'
# → 200 { strokes: 5 } (mis à jour, pas de doublon)

# 4. Consulter mes rounds
curl http://localhost:3000/api/v1/rounds/users/me/rounds \
  -H "Authorization: Bearer $TOKEN"
# → 200 [{ id, status, computedTotalStrokes, ... }]

# 5. Détail d'un round avec scores
curl http://localhost:3000/api/v1/rounds/$ROUND_ID \
  -H "Authorization: Bearer $TOKEN"
# → 200 { id, scores: [{ holeNumber, strokes, ... }] }
```

**Vérifications :**
- [ ] Créer round → 201
- [ ] Round avec sessionId → 201 avec sessionId lié
- [ ] SessionId d'un autre → 403
- [ ] Saisir score trou 1 → 200
- [ ] Modifier score trou 1 (upsert) → 200, pas de doublon
- [ ] Saisir score avec seulement strokes (putts/FIR/GIR optionnels) → 200
- [ ] holeNumber > 18 → 400
- [ ] strokes = 0 → 400
- [ ] Lister mes rounds → tableau avec computedTotalStrokes
- [ ] Détail round → scores triés par holeNumber
- [ ] Round d'un autre → 403

### F. Positions GPS (batch)

```bash
# Batch insert de positions
curl -X POST http://localhost:3000/api/v1/positions/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "$SESSION_ID",
    "positions": [
      {"lat": 48.8566, "lng": 2.3522, "accuracy": 5.0, "recordedAt": "2026-02-18T10:00:00Z"},
      {"lat": 48.8567, "lng": 2.3523, "accuracy": 4.5, "recordedAt": "2026-02-18T10:00:05Z"},
      {"lat": 48.8568, "lng": 2.3524, "accuracy": 6.0, "recordedAt": "2026-02-18T10:00:10Z"}
    ]
  }'
# → 201 { inserted: 3 }
```

**Vérifications :**
- [ ] Batch 10 positions → 201 { inserted: 10 }
- [ ] Même batch 2× → 201 { inserted: 0 } (déduplication par recordedAt)
- [ ] Session inexistante → 404
- [ ] Session d'un autre → 404
- [ ] Session terminée → 404
- [ ] lat > 90 → 400
- [ ] Tableau vide → 400
- [ ] > 2000 positions → 400
- [ ] accuracy ≤ 0 → 400

### G. WebSocket (Socket.io)

Pour tester, utiliser un client Socket.io (ou un script Node.js) :

```javascript
import { io } from "socket.io-client";

// 1. Connexion avec token
const socket = io("http://localhost:3000", {
  auth: { token: "votre-access-token" }
});

socket.on("connect", () => {
  console.log("Connecté:", socket.id);

  // 2. Rejoindre le room dashboard
  socket.emit("room:join", `course:${courseId}:dashboard`);

  // 3. Écouter les positions
  socket.on("position:broadcast", (data) => {
    console.log("Position reçue:", data);
    // { sessionId, lat, lng, accuracy, holeNumber, recordedAt }
  });
});

// 4. Envoyer une position (depuis un autre client)
const golferSocket = io("http://localhost:3000", {
  auth: { token: "golfer-token" }
});

golferSocket.on("connect", () => {
  golferSocket.emit("room:join", `course:${courseId}:positions`);
  golferSocket.emit("position:update", {
    sessionId: "session-uuid",
    lat: 48.8566,
    lng: 2.3522,
    accuracy: 5.0,
    recordedAt: new Date().toISOString()
  });
});

// 5. Rafraîchir le token
socket.emit("auth:refresh", "nouveau-access-token");
socket.on("auth:refreshed", () => console.log("Token rafraîchi"));

// 6. Erreurs
socket.on("error", (err) => console.error("Erreur:", err.message));
```

**Vérifications :**
- [ ] Connexion avec token valide → `connect` event
- [ ] Connexion sans token → refusée
- [ ] `room:join` format valide → succès
- [ ] `room:join` format invalide → `error` event
- [ ] `position:update` → position broadcastée vers le room dashboard
- [ ] `position:broadcast` contient holeNumber (ou null)
- [ ] `auth:refresh` avec token valide → `auth:refreshed`
- [ ] `auth:refresh` avec token expiré → `error` event
- [ ] Déconnexion → `disconnect` event

---

## Checklist complète

### Setup
- [ ] Docker up (PostgreSQL + PostGIS)
- [ ] Migrations appliquées
- [ ] Base seedée
- [ ] API démarrée (port 3000)

### Auth
- [ ] Inscription email/password → 201
- [ ] Email dupliqué → 409
- [ ] Login → 200
- [ ] Login mauvais password → 401
- [ ] Anonyme → 201
- [ ] Refresh → nouveaux tokens
- [ ] Refresh ancien token → 401
- [ ] Logout → 200

### Parcours
- [ ] Locate GPS dans parcours → 200
- [ ] Locate hors parcours → 404
- [ ] Course data par slug → 200 avec 18 trous

### Sessions
- [ ] Démarrer → 201
- [ ] Doublon même parcours → 409
- [ ] Auto-groupement (4 max)
- [ ] Terminer → 200
- [ ] Consulter → 200 (propriétaire)

### Scoring
- [ ] Créer round → 201
- [ ] Score upsert → 200
- [ ] Mes rounds → liste
- [ ] Détail round → scores inclus

### Positions
- [ ] Batch insert → 201
- [ ] Déduplication → 0 insérés
- [ ] Validation → 400 sur données invalides

### WebSocket
- [ ] Connexion auth → connecté
- [ ] Position update → broadcast
- [ ] Token refresh → rafraîchi
- [ ] Room join/leave → OK

### Rate Limiting
- [ ] Auth : 10 req/min
- [ ] Anonyme : 5 req/heure
- [ ] Locate : 30 req/min
- [ ] Global : 100 req/min
