# Sprint 3D — Round Summary, PWA Install, Notification Preferences

**Date:** 2026-02-19
**Tasks:** 3.13, 3.14, 3.15

---

## 3.13 — Round Summary Screen

### Flow Change

Current: "Terminer la partie" → finishSession → navigate to `/`
New: "Terminer la partie" → save all unsaved scores → finishSession → navigate to `/summary`

### Components

- `features/summary/RoundSummaryScreen.tsx` — route at `/summary`, reads round-store
- `features/summary/HoleBreakdown.tsx` — scrollable per-hole table (hole #, par, strokes, +/−, putts, FIR, GIR)
- `features/summary/StatsSummary.tsx` — computed stats block

### Stats (computed client-side)

- Total strokes + vs par (E, +N, -N)
- Total putts
- FIR% = fairways hit / par 4+ holes played
- GIR% = greens hit / all holes played

### Data Flow

Round-store retains scores after "Terminer" → summary reads from store → "Retour à l'accueil" resets store + navigates to `/`. Direct navigation to `/summary` with empty store → redirect to `/`.

---

## 3.14 — PWA Install Prompt

- `hooks/use-install-prompt.ts` — captures `beforeinstallprompt` event, exposes `canInstall` boolean + `promptInstall()` function
- `components/InstallBanner.tsx` — shown on LandingPage when installable
- Dismissable via `localStorage` key `golfix-install-dismissed`
- Banner text: "Installer Golfix" with install + dismiss buttons

---

## 3.15 — Notification Preferences

### API

New endpoint: `PATCH /users/me/preferences`
- Body: `{ paceReminders: boolean }`
- Updates `notification_prefs` JSONB in users table
- Returns updated prefs

### Shared Types

```ts
interface NotificationPrefs { paceReminders: boolean }
interface UpdatePrefsInput { paceReminders?: boolean }
interface UserPrefsResponse { notificationPrefs: NotificationPrefs }
```

### Frontend

Replace `ProfilePlaceholder` with `features/profile/ProfileScreen.tsx`:
- Display name (read-only)
- Pace reminders toggle (on/off), synced to API
- Logout button

Store prefs in auth-store (`notificationPrefs` field), sync on toggle.
