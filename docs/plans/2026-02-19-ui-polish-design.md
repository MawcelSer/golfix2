# Golfix UI Polish — Design Document

> Sprint 3E, Task 3.16: Full Augusta Caddie aesthetic across all golfer-app screens.

## Aesthetic Direction

**Augusta Caddie** — Classic golf club refined. Dark pine backgrounds, cream text, green gradient hole illustrations, gold accents. Serif display font for headings, clean sans for body, monospace for distances.

## Design System

### Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Display | Playfair Display | 700 | Hole numbers, screen titles, big scores |
| Body | DM Sans | 400/500/700 | Labels, buttons, form text, paragraphs |
| Data | DM Mono | 500 | Distances, scores, stats |

Load via Google Fonts CDN in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Tailwind config additions in `index.css`:
```css
@theme {
  --font-display: "Playfair Display", Georgia, serif;
  --font-sans: "DM Sans", system-ui, sans-serif;
  --font-mono: "DM Mono", ui-monospace, monospace;
}
```

### Color Palette

Existing (keep):
- `pine: #0f2818` — primary background
- `cream: #fafdf7` — primary text
- `green-mid: #2d8b47` — primary actions, fairway
- `gold: #d4a843` — accents, active states
- `sage: #8fb89a` — secondary info
- `water: #4a9fd4` — water hazards
- `sand: #d4b968` — bunkers
- `forest: #1b6b2e` — darker green
- `green-light: #5cb85c` — success states

New additions:
- `fairway: #1a4a25` — dark fairway gradient
- `fairway-light: #3a7a4a` — light fairway gradient

### Shared Component Patterns

- Cards: `rounded-2xl bg-cream/5 backdrop-blur-sm`
- Primary buttons: `rounded-xl bg-green-mid py-3 text-cream font-medium`
- Secondary buttons: `rounded-xl border border-cream/20 py-3 text-cream/70`
- Inputs: `rounded-xl bg-cream/8 border border-cream/10 px-4 py-3`
- Active tab: `text-gold`, Inactive tab: `text-cream/40`

## Screen Designs

### 1. GPS Screen (18Birdies-inspired)

The hero screen. Layout from top to bottom:

**Hole header bar** (sticky top):
- Left arrow, "Trou 7 · Par 4 · 385m", Right arrow
- Hole number in Playfair Display, info in DM Sans
- Arrows disabled at holes 1/18

**SVG hole illustration** (~55% viewport height):
- Dark gradient background (pine → fairway)
- Fairway: elongated shape rendered from hole geometry
- Green: bright circle/oval at target end
- Bunkers: sand-colored ellipses positioned from hazard data
- Water: water-colored shapes from hazard data
- Player dot: pulsing gold circle with subtle ring animation (CSS keyframes)
- Dashed line: player → green center, with distance label badge midpoint
- Fallback: if no hole geometry, show centered distance numbers only

**Distance triptych**:
- Three columns: AVANT | CENTRE | FOND
- Center distance in DM Mono text-4xl (hero number)
- Side distances in DM Mono text-2xl
- Labels in DM Sans uppercase text-xs tracking-widest text-cream/50
- "m" suffix in smaller text next to center number

**Quick score strip** (compact, at bottom above tabs):
- Hole number badge | Strokes +/- | Putts +/- | FIR pill | GIR pill
- Compact single row, no vertical expansion
- Tapping expands to full ScoreEntry if needed

### 2. Scorecard Screen

Full grid table (matches Augusta mockup):

**Header row**: # | PAR | SCORE | PUTT | FIR | GIR | +/-
**Data rows**: One per hole played
- Current hole: gold left border highlight
- FIR/GIR: green dot (hit), red dot (miss), dash (unset)
- +/- column: green text (under par), gold text (over par), cream (even)

**Summary footer card**:
- Total score, total putts, FIR%, GIR%
- Displayed in a `rounded-2xl bg-cream/5` card

**"Terminer la partie" button** at very bottom.

### 3. Landing Page

**Top section**:
- App logo (48x48) top-left
- "Bienvenue, [name]" in Playfair Display text-2xl

**Off-course card** (when not on a course):
- Subtle card with icon and message

**CTA button**: Full-width, green-mid, "Démarrer un parcours"

**Recent rounds**: List cards with:
- Course name (DM Sans font-medium)
- Date (text-sm text-cream/50)
- Total score (DM Mono text-xl, right-aligned)
- vs Par badge

**Install banner**: Bottom positioned if applicable.

### 4. Summary Screen

**Hero score**: Playfair Display text-5xl centered
**vs Par badge**: Rounded pill — green-light bg if under, gold bg if over, cream/10 if even

**Stats row**: 4 columns — Score | Putts | FIR% | GIR%
- Each with label (text-xs uppercase) and value (DM Mono text-lg)

**Hole breakdown table**: Same style as scorecard grid

**"Retour à l'accueil" button**: Full-width green-mid.

### 5. Profile Screen

**User card**: Initials circle avatar (bg-green-mid, Playfair Display letter) + name + email
**Prefs card**: Toggle switch (refined, green-mid when on, cream/20 when off)
**Logout button**: Secondary style, bottom of screen.

### 6. Auth Screens (Login / Register / Anonymous)

**Centered layout**: Logo top, form middle
**Title**: Playfair Display "Se connecter" / "Créer un compte" / "Mode anonyme"
**Inputs**: Refined with cream/8 bg, cream/10 border
**Submit button**: Green-mid primary
**Links**: Gold for primary action, cream/50 for secondary.

### 7. Bottom Tabs

**Background**: Pine with `border-t border-cream/10`
**Icons**: Simple SVG icons (crosshair for GPS, grid for Carte, circle-user for Profil)
**Active state**: Gold icon + gold text
**Inactive state**: cream/40 icon + cream/40 text
**Height**: 56px, safe-area padding for notched phones.

### 8. Install Banner

**Card style**: `rounded-2xl bg-cream/5 border border-cream/10`
**Content**: App icon + "Installer Golfix" text + "Installer" button (green-mid) + X dismiss
**Position**: Above bottom tabs on landing page.

## SVG Hole Illustration

The hole SVG is the most complex new component. It renders a stylized overhead view from cached course data.

**Data inputs** (from `CourseData.holes[n]`):
- `teePosition: { lat, lng }` — starting point
- `greenCenter: { lat, lng }` — target point
- `greenFront/greenBack: { lat, lng }` — green boundaries
- `hazards: Array<{ type, position }>` — bunkers and water
- `distanceMeters` — total hole length

**Rendering approach**:
- SVG viewBox normalized to hole dimensions (tee at bottom, green at top)
- Fairway: Rounded rectangle/path with gradient fill (fairway → fairway-light)
- Green: Ellipse with bright green fill and subtle glow
- Bunkers: Sand-colored ellipses at relative positions
- Water: Water-colored blobs at relative positions
- Player: Gold circle at projected position between tee and green
- Dashed line: SVG `stroke-dasharray` line from player to green

**Fallback**: If tee/green positions are null (no GPS data in course), show distance numbers only without the SVG.

## Animations

Minimal, purposeful:
- **GPS pulse**: `@keyframes pulse` on player dot — scale 1→1.5 with opacity fade
- **Distance numbers**: CSS transition on value change (opacity fade)
- **Page transitions**: None (keep instant for PWA feel)
- **Tab switch**: No animation (instant)

## Implementation Notes

- All changes are CSS/component-level — no new dependencies except Google Fonts link
- Keep all existing functionality intact (hooks, stores, services untouched)
- SVG hole illustration is a new component: `features/gps/HoleIllustration.tsx`
- Font loading: preconnect to Google Fonts for performance
- Test: All existing tests must pass without modification (UI-only changes)
