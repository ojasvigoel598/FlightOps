# EXPLANATION.md — Flight Ops Project Guide

> **For Python developers**: This document explains every file in the project,
> what it does, and where to edit things. It's written so you can jump in
> without knowing TypeScript or React Native.

---

## TL;DR

**Flight Ops** is a cross-platform game (iOS / Android / Web) built with
**React Native + Expo**. It has no backend — everything runs on the device.
You design aircraft, take cargo contracts, fly missions, earn money, buy
upgrades, and optionally open an Aero Lab to solve real aerodynamics problems.

The code is written in **TypeScript** (`.ts` / `.tsx` files) — think Python
with type hints enforced at compile time. The UI uses **React Native** (like
Flutter, but JavaScript-based). Physics and math are in plain TypeScript
files with no framework dependency.

---

## Tech Stack (Python equivalents)

| Flight Ops | Python equivalent |
|---|---|
| TypeScript (`.ts`/`.tsx`) | Python with strict `mypy` |
| React Native | Kivy or Flutter (cross-platform UI) |
| Expo | Flask/django-runserver (dev server + build tooling) |
| expo-router | Flask's `@app.route` — file-based URL routing |
| React Context (`useContext`) | A global singleton / dependency injection |
| AsyncStorage | SQLite or shelve (local key-value persistence) |
| Vitest | pytest |
| Three.js / R3F | VPython or PyOpenGL (3D graphics) |
| `npm` / `pnpm` | `pip` + `requirements.txt` |

---

## Project Structure — File-by-File

### Root configuration files

| File | What it does | Python analogy |
|---|---|---|
| `package.json` | Lists all dependencies and scripts. Like `pyproject.toml` or `requirements.txt`. The `scripts` section has commands: `npm run web` starts the dev server, `npm test` runs tests. | `pyproject.toml` |
| `tsconfig.json` | TypeScript compiler settings. Tells TS to be strict and resolve `@/` imports to the project root. | `mypy.ini` |
| `vitest.config.ts` | Test runner config. Maps `@/` to the project root for test imports. | `pytest.ini` / `conftest.py` |
| `babel.config.js` | JavaScript transpiler config (converts modern JS to older JS for browsers). You almost never edit this. | N/A |
| `app.json` | Expo app metadata (name, icon, splash screen). | N/A |
| `eslint.config.js` | Linter rules. Like `ruff` or `flake8` config. | `.flake8` |

---

### `app/` — Screens & Routing (the "views")

Expo Router uses **file-based routing**: each `.tsx` file in `app/` becomes
a URL/screen. This is like Flask's `@app.route('/')` but automatic.

| File | Screen | What the user sees |
|---|---|---|
| `app/_layout.tsx` | **Root layout** | Wraps everything in providers (GameContext, ModeProvider, ModelBProvider). This is the "app shell". |
| `app/(tabs)/_layout.tsx` | **Tab bar** | Defines the 5 bottom tabs: Hangar, Contracts, Aero Lab, Game, Company. |
| `app/(tabs)/index.tsx` | **Hangar tab** | Pick wings, engine, fuel. See stats update live. Launch missions from here. |
| `app/(tabs)/contracts.tsx` | **Contracts tab** | Browse available cargo jobs. Pick one, then go to Hangar to build for it. |
| `app/(tabs)/aero.tsx` | **Aero Lab tab** | Live aerodynamics workbench — pick an airfoil, adjust angle of attack, see Cp plots, lift curves, Theodorsen/Wagner unsteady functions. All computed on-device. |
| `app/(tabs)/design.tsx` | **Game / Design tab** | Switches between **Fun Mode** (intuitive, no equations) and **Engineering Mode** (Sadraey-style). This is the Model B learning experience. |
| `app/(tabs)/company.tsx` | **Company tab** | Your aerospace firm dashboard — treasury, XP, level, engineers, upgrades. |
| `app/(tabs)/phone.tsx` | **Phone tab** | (Placeholder/auxiliary screen) |
| `app/mission.tsx` | **Mission screen** | The flight simulation — advance through stages, make choices during events, watch fuel/integrity/altitude. |
| `app/result.tsx` | **Result screen** | After a mission: success/failure, reward, XP earned, log of events. |
| `app/qr.tsx` | **QR code screen** | Shows a QR code for sharing/linking. |
| `app/+not-found.tsx` | **404 screen** | Shown for unknown routes. |

**Where to edit for UX changes**: All screen-level edits happen in `app/(tabs)/*.tsx` files. Each file exports a default React component (like a Flask view function).

---

### `components/` — Reusable UI pieces

These are like Jinja macros or Django template tags — small, focused UI
building blocks that screens compose together.

#### `components/ui/` — Low-level UI primitives

| File | What it is | Python analogy |
|---|---|---|
| `Button.tsx` | Styled button (primary, secondary, ghost variants) | A Jinja macro for `<button>` |
| `Panel.tsx` | Card-like container with title + subtitle | A template partial for a card |
| `Badge.tsx` | Small colored label (e.g., "Beginner", "Critical") | A tag/badge partial |
| `StatBar.tsx` | Horizontal progress bar with label and value | A template for a progress bar |

#### `components/layout/` — Page scaffolding

| File | What it is |
|---|---|
| `Screen.tsx` | Wrapper that provides safe-area padding and scroll behavior for every screen. |
| `ScreenHeader.tsx` | The eyebrow + title + subtitle block at the top of every screen. |

#### `components/feature/` — Game-specific widgets

| File | What it does |
|---|---|
| `ContractCard.tsx` | Displays one cargo contract (title, payload, distance, reward, difficulty badge). |
| `PartSelector.tsx` | Wing/engine/fuel picker card with pros/cons. |
| `StatReadout.tsx` | Row showing a stat name + value + color (for vehicle stats). |
| `TelemetryDeck.tsx` | Live telemetry display during missions (fuel %, integrity, altitude, speed). |
| `EventCard.tsx` | Random event during flight (weather, fault, etc.) with choice buttons. |
| `UpgradeCard.tsx` | R&D upgrade card in the Company tab. |
| `AeroChart.tsx` | SVG chart for plotting Cp, CL, Theodorsen, Wagner curves in the Aero Lab. |
| `FlowField.tsx` | (Potential-flow velocity field visualization) |

#### `components/charts/`

| File | What it does |
|---|---|
| `LineChart.tsx` | Generic SVG line chart component (used for telemetry plots). |

#### `components/three/` — 3D graphics

| File | What it does |
|---|---|
| `AircraftModel.tsx` | Three.js 3D aircraft geometry (fuselage, wings, tail, engines). |
| `World.tsx` | Three.js environment (runway, sky, terrain, clouds). |

#### `components/model-b/` — Model B educational screens

| File | What it does |
|---|---|
| `Chapter1Screen.tsx` | First Sadraey chapter — interactive learning screen for "Aircraft Design Fundamentals". |

#### `components/FunMode.tsx` — Fun Mode designer

The intuitive aircraft designer for beginners. Shows visual option cards
(wing shapes, tail types, engines, airfoils, missions) with simple English
explanations. No equations. Learns by experimenting.

#### `components/EngineeringMode.tsx` — Engineering Mode designer

The Sadraey-style designer for advanced students. Shows equations,
detailed parameters, mass breakdown, and performance trade-offs.

#### `components/index.ts` — Barrel exports

Like Python's `__init__.py` — re-exports all components so screens can
import them as `import { Button, Panel } from '@/components'`.

---

### `contexts/` — Global state (like singletons / dependency injection)

React Context is how React shares state across many components without
passing props through every level. Think of each context as a global
singleton that components can "subscribe to."

| File | What it manages | Python analogy |
|---|---|---|
| `GameContext.tsx` | Company money, XP, level, contracts, vehicle design, active contract, last result. Persisted in AsyncStorage. | A global `game_state` dict in Flask's `g` object |
| `ModeContext.tsx` | Learning mode switch: "fun" vs "engineering". Persisted in AsyncStorage. | A global config toggle |
| `ModelBContext.tsx` | Model B (educational) state: chapter progress, mission state, flight simulation, dynamics parameters. | A session object for the learning system |

**Where to edit for game logic changes**: `GameContext.tsx` controls all
money/XP/contract logic. `ModelBContext.tsx` controls the educational
chapter progression.

---

### `hooks/` — Convenience wrappers

These are thin wrappers that make it easy for screens to access context.
Think of them as helper functions that return the data a screen needs.

| File | What it does |
|---|---|
| `useGame.tsx` | `useGame()` returns the GameContext — money, contracts, design, etc. |
| `useMission.tsx` | `useMission()` returns mission simulation helpers. |
| `useColorScheme.ts` / `.web.ts` | Returns "dark" or "light" (platform-specific). |
| `useThemeColor.ts` | Returns a themed color based on the current color scheme. |

---

### `services/` — Pure logic (no UI) — the "engine"

This is where all the math, physics, and game rules live. These are pure
TypeScript functions with **no React dependency** — you can test them
with vitest just like Python unittest.

#### Game engine

| File | What it does | Python analogy |
|---|---|---|
| `simulation.ts` | `computeVehicleStats()` — converts a design + payload into stats (cost, weight, range, safety, reliability). Pure math. | A function in `engine.py` |
| `contracts.ts` | `generateContracts()` — deterministic contract generation from a seed. | A factory function with seeded random |
| `rng.ts` | Seeded pseudo-random number generator. Makes contract generation reproducible. | `random.seed()` |
| `events.ts` | Random mission events (weather, engine faults, etc.) and their resolutions. | An event system module |
| `mission-design.ts` | `PRESET_MISSIONS` (8 mission types), `computeMissionRequirements()`, `scoreMission()`. | Mission definition + scoring logic |

#### Aerodynamics engine

| File | What it does | Physics basis |
|---|---|---|
| `aerodynamics.ts` | **The core aerodynamics library.** ISA standard atmosphere, NACA 4-digit airfoil geometry, source panel method (Cp), vortex lattice lift, thin-airfoil theory, drag polar, Prandtl-Glauert correction. ~700 lines. | Katz & Plotkin, Anderson, thin-airfoil theory |
| `aircraft-config.ts` | `WingConfig`, `TailConfig`, `FuselageConfig`, `PropulsionConfig`, `MassBreakdown`, `computeMassBreakdown()`, `computePerformance()`. Full aircraft configuration for the Aero Lab designer. | Raymer + Sadraey weight estimation |
| `aero-credits.ts` | Tech tier system — unlock advanced aero methods by earning credits. | Game progression logic |
| `pwa.ts` | PWA (Progressive Web App) helpers for web deployment. | N/A |
| `reachable-url.ts` | URL validation utility. | URL validation |

#### Aero Lab specialized modules (`services/aero/`)

| File | What it does |
|---|---|
| `airfoil.ts` | `generateAirfoil(code, n)` — generates NACA 4-digit airfoil surface points from a 4-digit code string. |
| `panel.ts` | `buildPanels()`, `solvePanelMethod()` — source + vortex panel method for Cp and CL. Uses Kutta condition at trailing edge. |
| `liftingLine.ts` | Prandtl numerical lifting-line method for finite wings (3D lift with spanwise distribution). |
| `unsteady.ts` | Theodorsen C(k) function, Wagner indicial response, Bessel functions. Unsteady aerodynamics. |

#### Unsteady vortex module

| File | What it does |
|---|---|
| `unsteady-vortex.ts` | Vortex blob dynamics for unsteady flow visualization. |

#### Model B modules (`services/model-b/`)

| File | What it does |
|---|---|
| `chapters.ts` | 12 Sadraey chapters: definitions, missions per chapter, unlock logic, progress tracking. The educational curriculum. |
| `flight-dynamics.ts` | 3-DOF flight simulation (position, altitude, airspeed, fuel). Step function with trim finder. The "physics engine" for Model B missions. |

---

### `constants/` — Static configuration

| File | What it does | Python analogy |
|---|---|---|
| `theme.ts` | Colors, spacing, font sizes, shadows — the design system. | A CSS variables file or Figma tokens |
| `config.ts` | Game constants: wing specs (short/standard/long), engine specs, fuel tanks, upgrades, starting company values. | A `config.py` with dataclasses |
| `Colors.ts` | Platform-specific color definitions (dark/light mode). | N/A |
| `styles.ts` | Shared style utilities. | N/A |

---

### `types/` — Type definitions (interfaces)

| File | What it does |
|---|---|
| `game.ts` | All game domain types: `Design`, `VehicleStats`, `Contract`, `Telemetry`, `MissionEvent`, `Company`, etc. These are like Python `@dataclass` or `TypedDict` definitions. |
| `three-jsx.d.ts` | Type declarations for Three.js JSX elements in React. |

---

### `utils/` — Tiny pure helpers

| File | What it does |
|---|---|
| `math.ts` | `clamp()`, `round()`, `lerp()` — basic math utilities. |

---

### `template/` — Framework scaffolding (you rarely edit this)

| Directory | What it is |
|---|---|
| `template/auth/` | Authentication structure (mock + Supabase options). Not currently used by Flight Ops. |
| `template/ui/` | Alert system (`AlertProvider`, `useAlert`). Used for confirmation dialogs. |
| `template/core/` | API client structure (GraphQL/Apollo). Not currently active. |
| `template/index.ts` | Re-exports template modules. |

---

### `tests/` — Test suite

| File | What it tests | How many tests |
|---|---|---|
| `aerodynamics.test.ts` | ISA atmosphere, NACA geometry, source panel Cp, vortex lattice lift, drag polar, Prandtl-Glauert, NACA 2412 wind-tunnel validation, BET propeller. | 55 |
| `unsteady.test.ts` | Bessel functions, Theodorsen C(k), Wagner Φ(s), harmonic lift. | 23 |
| `unsteady-vortex.test.ts` | Vortex blob dynamics. | 8 |
| `mission-design.test.ts` | Preset missions, requirements computation, scoring, aircraft config defaults. | 15 |
| `aero-credits.test.ts` | Tech tiers, credit state, mission rewards, design comparison, explanations. | 19 |
| `contracts.test.ts` | Contract generation determinism and structure. | 4 |
| `simulation.test.ts` | Vehicle stats computation. | 6 |
| `reachable-url.test.ts` | URL validation. | 8 |
| `math.test.ts` | Math utilities. | 7 |

**Total: 145 tests, all passing.**

**To run tests**: `npm test` (or `npx vitest run`)

---

### `scripts/` — Validation scripts

| File | What it does |
|---|---|
| `validate_aero.py` | Python script that cross-validates the TypeScript aerodynamics against reference values. Run with `python scripts/validate_aero.py`. |

---

### `components/index.ts` — The barrel file

Think of this as Python's `__init__.py` that re-exports everything:
```typescript
// Like: from .ui import Button, Panel, Badge
export { Button } from './ui/Button';
export { Panel } from './ui/Panel';
// ...
```

---

## How the App Works (User Flow)

### Model A: Fun Game Mode

```
1. CONTRACTS tab  → Pick a cargo job (payload, distance, reward)
2. HANGAR tab     → Build aircraft (wing, engine, fuel) for that job
3. LAUNCH         → Fly the mission
4. MISSION screen → Advance through flight stages, make event choices
5. RESULT screen  → See reward, XP, mission log
6. COMPANY tab    → Spend earnings on upgrades
7. Repeat!
```

### Model B: Educational Learning Mode

```
1. GAME / DESIGN tab → Switch to "Engineering Mode"
2. Chapter 1 → Learn aircraft design fundamentals interactively
3. Complete missions tied to each Sadraey chapter
4. Unlock chapters as you progress
5. Notebook tracks your learning
6. 12 chapters total, following Sadraey's textbook structure
```

### Aero Lab (available in both modes)

```
1. AERO LAB tab → Pick a NACA airfoil code (e.g., 2412)
2. Adjust angle of attack with slider
3. See live: pressure distribution (Cp), lift curve, Theodorsen, Wagner
4. All math computed on-device, validated against benchmarks
```

---

## Where to Edit — Quick Reference

| I want to... | Edit this file |
|---|---|
| Change a screen's layout/content | `app/(tabs)/<tab>.tsx` |
| Add a new screen | Create `app/<name>.tsx`, add route in `app/_layout.tsx` |
| Change game balance (costs, stats) | `constants/config.ts` |
| Change the look/colors | `constants/theme.ts` |
| Add a new UI component | `components/ui/NewThing.tsx`, export from `components/index.ts` |
| Change aerodynamics math | `services/aerodynamics.ts` |
| Change flight simulation | `services/model-b/flight-dynamics.ts` |
| Add a new chapter | `services/model-b/chapters.ts` |
| Change contract generation | `services/contracts.ts` |
| Add a mission event | `services/events.ts` |
| Add a new test | Create `tests/new.test.ts` |
| Change company/XP logic | `contexts/GameContext.tsx` |
| Change learning mode switching | `contexts/ModeContext.tsx` |
| Add 3D model parts | `components/three/AircraftModel.tsx` |
| Change the mission flow | `app/mission.tsx` + `services/events.ts` |
| Add a new upgrade | `constants/config.ts` (UPGRADES array) |

---

## TypeScript ↔ Python Translation Guide

### Variables
```python
# Python
x: int = 5
name: str = "hello"
```
```typescript
// TypeScript
let x: number = 5;
let name: string = "hello";
const PI = 3.14;  // const = final/immutable
```

### Functions
```python
# Python
def compute_stats(design: dict, payload: float) -> dict:
    ...
```
```typescript
// TypeScript
function computeStats(design: Design, payloadKg: number): VehicleStats {
  ...
}
```

### Interfaces (like dataclasses)
```python
# Python
@dataclass
class Design:
    wing: str
    engine: str
    fuel: str
```
```typescript
// TypeScript
interface Design {
  wing: WingId;    // 'short' | 'standard' | 'long' (union type)
  engine: EngineId;
  fuel: FuelId;
}
```

### Imports
```python
# Python
from services.aerodynamics import standard_atmosphere, analyze_flight
```
```typescript
// TypeScript
import { standardAtmosphere, analyzeFlight } from '@/services/aerodynamics';
// @/ = project root (configured in tsconfig.json)
```

### Error handling
```python
# Python
raise ValueError("altitude must be positive")
```
```typescript
// TypeScript
throw new Error('altitude must be positive');
```

### Null/None
```python
# Python
result = maybe_get()  # could be None
if result is not None:
    ...
```
```typescript
// TypeScript
const result = maybeGet();  // could be null | undefined
if (result != null) { ... }
```

### Lists and Maps
```python
# Python
items = [1, 2, 3]
mapping = {"a": 1, "b": 2}
```
```typescript
// TypeScript
const items: number[] = [1, 2, 3];
const mapping: Record<string, number> = { a: 1, b: 2 };
```

### Testing
```python
# Python (pytest)
def test_atmosphere():
    atm = standard_atmosphere(0)
    assert atm.density == 1.225
```
```typescript
// TypeScript (vitest)
it('sea level density', () => {
  const atm = standardAtmosphere(0);
  expect(atm.densityKgM3).toBeCloseTo(1.225, 3);
});
```

---

## Running the Project

```bash
# Install dependencies (like pip install -r requirements.txt)
pnpm install

# Start dev server (like python app.py)
pnpm run web

# Run tests (like pytest)
pnpm test

# Type checking (like mypy)
npx tsc --noEmit
```

---

*Last updated: August 2026*
*Repository: https://github.com/ojasvigoel598/FlightOps*
