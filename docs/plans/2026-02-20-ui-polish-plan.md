# UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework all golfer-app screens to match the Augusta Caddie aesthetic — Playfair Display headings, DM Sans body, stylized SVG hole view, polished cards, consistent color palette.

**Architecture:** Pure frontend CSS/component changes across ~15 files. One new component (HoleIllustration.tsx). No backend changes, no new business logic, no store/hook changes. All existing tests must pass unchanged.

**Tech Stack:** React, Tailwind v4, Google Fonts (Playfair Display, DM Sans, DM Mono), SVG for hole illustration.

**Design doc:** `docs/plans/2026-02-19-ui-polish-design.md`

---

### Task 1: Design System — Fonts + CSS Tokens

**Files:**
- Modify: `apps/golfer-app/index.html`
- Modify: `apps/golfer-app/src/index.css`

**Step 1: Add Google Fonts to index.html**

Replace the existing DM Mono font link with the full font stack:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

**Step 2: Update Tailwind theme tokens in index.css**

```css
@import "tailwindcss";

@theme {
  --color-pine: #0f2818;
  --color-cream: #fafdf7;
  --color-sage: #8fb89a;
  --color-gold: #d4a843;
  --color-water: #4a9fd4;
  --color-sand: #d4b968;
  --color-forest: #1b6b2e;
  --color-green-mid: #2d8b47;
  --color-green-light: #5cb85c;
  --color-fairway: #1a4a25;
  --color-fairway-light: #3a7a4a;

  --font-display: "Playfair Display", Georgia, serif;
  --font-sans: "DM Sans", system-ui, sans-serif;
  --font-mono: "DM Mono", ui-monospace, monospace;
}

/* GPS player dot pulse animation */
@keyframes gps-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.8); opacity: 0; }
}

.animate-gps-pulse {
  animation: gps-pulse 2s ease-in-out infinite;
}
```

**Step 3: Run tests to verify no regressions**

Run: `cd apps/golfer-app && pnpm test`
Expected: All 201 tests pass.

**Step 4: Commit**

```bash
git add apps/golfer-app/index.html apps/golfer-app/src/index.css
git commit -m "feat(ui): add Playfair Display + DM Sans fonts, new color tokens"
```

---

### Task 2: AppShell + BottomTabs

**Files:**
- Modify: `apps/golfer-app/src/components/layout/AppShell.tsx`
- Modify: `apps/golfer-app/src/components/layout/BottomTabs.tsx`

**Step 1: Update AppShell**

Add `font-sans` to root div so DM Sans applies globally:

```tsx
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-pine font-sans text-cream">
      <main className="flex flex-1 flex-col pb-14">{children}</main>
      <BottomTabs />
    </div>
  );
}
```

**Step 2: Update BottomTabs with icons and refined styling**

Add simple SVG icons inline. Top border. Safe area padding. Gold active, cream/40 inactive.

```tsx
import { NavLink } from "react-router-dom";

const tabs = [
  {
    to: "/gps",
    label: "GPS",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    to: "/scorecard",
    label: "Carte",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: "/profile",
    label: "Profil",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
] as const;

export function BottomTabs() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex h-14 items-center justify-around border-t border-cream/10 bg-pine pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${isActive ? "text-gold" : "text-cream/40"}`
          }
        >
          {tab.icon}
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

**Step 3: Run tests**

Run: `cd apps/golfer-app && pnpm test`
Expected: All pass.

**Step 4: Commit**

```bash
git add apps/golfer-app/src/components/layout/
git commit -m "feat(ui): refine AppShell + BottomTabs with icons and DM Sans"
```

---

### Task 3: Auth Screens (Login, Register, Anonymous)

**Files:**
- Modify: `apps/golfer-app/src/features/auth/LoginScreen.tsx`
- Modify: `apps/golfer-app/src/features/auth/RegisterScreen.tsx`
- Modify: `apps/golfer-app/src/features/auth/AnonymousScreen.tsx`

**Step 1: Update LoginScreen**

Key changes: Playfair Display heading, refined inputs with border, rounded-xl buttons, app logo larger.

Replace the return JSX with:
- `font-display` on the h1
- `rounded-xl bg-cream/8 border border-cream/10` on inputs
- `rounded-xl` on buttons (was rounded-lg)
- Logo: use `/icons/app-logo.png` at h-16

**Step 2: Apply same pattern to RegisterScreen and AnonymousScreen**

Same input/button/heading styling changes.

**Step 3: Run tests**

Run: `cd apps/golfer-app && pnpm test`
Expected: All pass (tests match by text content, not class names).

**Step 4: Commit**

```bash
git add apps/golfer-app/src/features/auth/
git commit -m "feat(ui): polish auth screens with Playfair headings and refined inputs"
```

---

### Task 4: Landing Page

**Files:**
- Modify: `apps/golfer-app/src/features/session/LandingPage.tsx`

**Step 1: Update LandingPage layout**

Key changes:
- Logo: `h-12 w-12` (was h-16 w-16)
- "Bienvenue" heading: `font-display text-2xl` (Playfair Display)
- CTA button: `rounded-xl` (consistent)
- Recent rounds: cards with `rounded-2xl bg-cream/5` + course name + vs-par badge
- Off-course message: subtle card with icon

**Step 2: Run tests**

Run: `cd apps/golfer-app && pnpm test`
Expected: All pass.

**Step 3: Commit**

```bash
git add apps/golfer-app/src/features/session/LandingPage.tsx
git commit -m "feat(ui): polish landing page with Playfair heading and round cards"
```

---

### Task 5: HoleIllustration Component (NEW)

**Files:**
- Create: `apps/golfer-app/src/features/gps/HoleIllustration.tsx`
- Create: `apps/golfer-app/src/features/gps/__tests__/HoleIllustration.test.tsx`

This is the biggest new piece — a stylized SVG rendering of the current hole.

**Step 1: Write the test**

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HoleIllustration } from "../HoleIllustration";

describe("HoleIllustration", () => {
  afterEach(cleanup);

  it("renders SVG with fairway and green", () => {
    render(
      <HoleIllustration
        holeNumber={7}
        par={4}
        distanceMeters={385}
        teePosition={{ lat: 48.85, lng: 2.29 }}
        greenCenter={{ lat: 48.854, lng: 2.293 }}
        greenFront={null}
        greenBack={null}
        hazards={[]}
        playerPosition={{ lat: 48.852, lng: 2.291 }}
        distanceToCenter={142}
      />,
    );
    // SVG should render
    const svg = document.querySelector("svg");
    expect(svg).not.toBeNull();
    // Distance label should show
    expect(screen.getByText("142m")).toBeInTheDocument();
  });

  it("renders without player position", () => {
    render(
      <HoleIllustration
        holeNumber={1}
        par={4}
        distanceMeters={350}
        teePosition={{ lat: 48.85, lng: 2.29 }}
        greenCenter={{ lat: 48.854, lng: 2.293 }}
        greenFront={null}
        greenBack={null}
        hazards={[]}
        playerPosition={null}
        distanceToCenter={null}
      />,
    );
    const svg = document.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders fallback when no tee/green positions", () => {
    render(
      <HoleIllustration
        holeNumber={1}
        par={4}
        distanceMeters={350}
        teePosition={null}
        greenCenter={null}
        greenFront={null}
        greenBack={null}
        hazards={[]}
        playerPosition={null}
        distanceToCenter={null}
      />,
    );
    // Should show fallback text
    expect(screen.getByText("Trou 1")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/golfer-app && pnpm vitest run src/features/gps/__tests__/HoleIllustration.test.tsx`
Expected: FAIL (module not found)

**Step 3: Implement HoleIllustration**

The component takes hole data and renders an SVG. Key approach:
- SVG viewBox `0 0 200 400` (portrait, tee at bottom, green at top)
- Background: gradient from pine to fairway
- Fairway: rounded rect path with fairway-light fill
- Green: ellipse at top with bright green + radial glow
- Bunkers: sand ellipses at relative positions
- Water: water-colored shapes
- Player: gold circle with pulse animation ring
- Dashed line: SVG line from player to green
- Distance badge: foreignObject with the distance label

Position calculation: normalize tee→green to SVG coordinates. Player position interpolated between tee and green based on distance ratio.

**Step 4: Run test to verify it passes**

Run: `cd apps/golfer-app && pnpm vitest run src/features/gps/__tests__/HoleIllustration.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/golfer-app/src/features/gps/HoleIllustration.tsx apps/golfer-app/src/features/gps/__tests__/HoleIllustration.test.tsx
git commit -m "feat(ui): add stylized SVG hole illustration component"
```

---

### Task 6: GPS Screen Rework

**Files:**
- Modify: `apps/golfer-app/src/features/gps/GpsScreen.tsx`
- Modify: `apps/golfer-app/src/features/gps/DistanceCard.tsx` (replace with distance triptych)
- Modify: `apps/golfer-app/src/features/gps/HoleSelector.tsx`

**Step 1: Rework GpsScreen layout**

Replace the current flat layout with the 18Birdies-inspired structure:
1. **Hole header** (sticky): `◀ Trou N · Par X · Ym ▶` — Playfair for hole number
2. **HoleIllustration** (~55vh): The SVG from Task 5
3. **Distance triptych**: Three inline columns (AVANT / CENTRE / FOND)
4. **GPS status**: Compact at bottom

The session confirmation screen stays largely the same but gets Playfair heading + refined button.

**Step 2: Replace DistanceCard with inline triptych**

Instead of 3 separate DistanceCard components, render a single row:
```
AVANT      CENTRE      FOND
 128       142m         156
```
Center is DM Mono text-4xl (hero), sides are text-2xl, labels are uppercase tracking-widest text-xs.

**Step 3: Update HoleSelector**

Refine with `rounded-xl` buttons, slightly larger touch targets.

**Step 4: Run tests**

Run: `cd apps/golfer-app && pnpm test`
Expected: All pass. The GpsScreen tests use mocked hooks so the DOM structure changes don't break assertions (tests check for text content like "Aucun parcours sélectionné", distance values, etc.).

**Step 5: Commit**

```bash
git add apps/golfer-app/src/features/gps/
git commit -m "feat(ui): rework GPS screen with 18Birdies-inspired layout and hole illustration"
```

---

### Task 7: Scorecard Screen

**Files:**
- Modify: `apps/golfer-app/src/features/scorecard/ScorecardScreen.tsx`
- Modify: `apps/golfer-app/src/features/scorecard/RunningTotal.tsx`
- Modify: `apps/golfer-app/src/features/scorecard/ScoreEntry.tsx`
- Modify: `apps/golfer-app/src/features/scorecard/StrokeCounter.tsx`
- Modify: `apps/golfer-app/src/features/scorecard/StatToggle.tsx`

**Step 1: Update ScorecardScreen**

Keep existing functionality but refine styling:
- Running total card: `rounded-2xl bg-cream/5`
- Score entry area: cleaner spacing
- "Terminer la partie" button: refined secondary style with `rounded-xl`
- Current hole number: font-display

**Step 2: Refine ScoreEntry, StrokeCounter, StatToggle**

- StrokeCounter buttons: `rounded-xl` (was rounded-lg), slightly larger touch targets (h-11 w-11)
- StatToggle: refined pill shapes, green-mid/30 for true state
- ScoreEntry: par label in font-display

**Step 3: Update RunningTotal**

- Use `rounded-2xl bg-cream/5` container
- Score number in font-mono
- vs Par in font-display style

**Step 4: Run tests**

Run: `cd apps/golfer-app && pnpm test`
Expected: All pass.

**Step 5: Commit**

```bash
git add apps/golfer-app/src/features/scorecard/
git commit -m "feat(ui): polish scorecard with refined spacing and typography"
```

---

### Task 8: Summary Screen

**Files:**
- Modify: `apps/golfer-app/src/features/summary/RoundSummaryScreen.tsx`
- Modify: `apps/golfer-app/src/features/summary/StatsSummary.tsx`
- Modify: `apps/golfer-app/src/features/summary/HoleBreakdown.tsx`

**Step 1: Update RoundSummaryScreen**

- Title: `font-display text-xl`
- CTA button: `rounded-xl bg-green-mid`

**Step 2: Update StatsSummary**

- Large score number: `font-display text-5xl` centered
- vs Par badge: pill with color-coded background
- Stats row: 4 columns with uppercase labels and mono values

**Step 3: Update HoleBreakdown**

- Table headers: uppercase, tracking-widest, text-xs
- Current-vs-par coloring per row (green under, gold over)
- Subtle row borders

**Step 4: Run tests**

Run: `cd apps/golfer-app && pnpm test`
Expected: All pass.

**Step 5: Commit**

```bash
git add apps/golfer-app/src/features/summary/
git commit -m "feat(ui): polish summary screen with large score display and stats"
```

---

### Task 9: Profile Screen

**Files:**
- Modify: `apps/golfer-app/src/features/profile/ProfileScreen.tsx`

**Step 1: Update ProfileScreen**

- Title: `font-display text-xl`
- User card: initials avatar circle (first letter, bg-green-mid, font-display) + name + email
- Prefs toggle: refined switch, larger touch target
- Cards: `rounded-2xl bg-cream/5`
- Logout button: `rounded-xl` secondary style

**Step 2: Run tests**

Run: `cd apps/golfer-app && pnpm test`
Expected: All pass.

**Step 3: Commit**

```bash
git add apps/golfer-app/src/features/profile/
git commit -m "feat(ui): polish profile screen with avatar and refined cards"
```

---

### Task 10: InstallBanner

**Files:**
- Modify: `apps/golfer-app/src/components/InstallBanner.tsx`

**Step 1: Refine InstallBanner**

- Container: `rounded-2xl bg-cream/5 border border-cream/10`
- Install button: `rounded-lg bg-green-mid`
- Better layout with app icon

**Step 2: Run tests**

Run: `cd apps/golfer-app && pnpm test`
Expected: All pass.

**Step 3: Commit**

```bash
git add apps/golfer-app/src/components/InstallBanner.tsx
git commit -m "feat(ui): refine install banner styling"
```

---

### Task 11: Final Validation

**Step 1: Run full validation**

```bash
pnpm validate
```
Expected: lint + format + typecheck + build all pass.

**Step 2: Run all unit tests**

```bash
pnpm test
```
Expected: All 201+ golfer-app tests + all API tests pass.

**Step 3: Run E2E tests**

```bash
cd apps/golfer-app && pnpm test:e2e
```
Expected: All 30 Playwright E2E tests pass.

**Step 4: Visual check in browser**

```bash
cd apps/golfer-app && pnpm dev
```
Open http://localhost:5173 — walk through every screen, verify against Augusta mockup.

**Step 5: Final commit if any format fixes needed**

```bash
pnpm format
git add -A && git commit -m "chore: format after UI polish"
```

---

## Execution Notes

- **No backend changes** — only `apps/golfer-app/` is touched
- **No store/hook changes** — only component JSX and CSS classes
- **One new component**: `HoleIllustration.tsx` (Task 5)
- **Existing tests must pass unchanged** — we're only changing visual presentation
- **Commit after every task** — each is independently deployable
- **Total: ~15 files modified, 1 new file created**
