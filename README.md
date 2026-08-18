# Flight Ops

A flight-ops tycoon game with a built-in **linear-aerodynamics lab**, built with React Native and Expo for iOS, Android and web.

- **Play the game** — run a cargo airline: take contracts, design aircraft in the hangar, fly missions with live telemetry and in-flight events, and grow your company.
- **Run the Aero Lab** — an engineering tool that computes ISA atmosphere conditions, dynamic pressure, Reynolds and Mach numbers, a 2D source-panel method for flow over airfoils, a vortex-lattice lift model, and a drag polar. It is validated against thin-airfoil theory and the analytic cylinder pressure distribution, and it runs entirely on the phone.

Author: **Ojasvi Goel**.

## Getting Started

The project is managed with **pnpm** (a `pnpm-lock.yaml` is committed).

```bash
pnpm install          # install dependencies
pnpm test             # run the physics/unit test suite
pnpm lint             # run ESLint
pnpm exec tsc -b --noEmit   # typecheck
```

### Run the app

```bash
pnpm web              # Expo dev server (web)
pnpm android          # Expo dev client on an Android emulator/device
pnpm ios              # Expo dev client on the iOS simulator
```

`pnpm web` starts Metro on port 8081. The web build is also statically exported for hosting:

```bash
npx expo export --platform web   # static output in dist/
```

## Project structure

```
app/                    Expo Router screens
  (tabs)/               Contract board, Hangar, Missions, Company, Aero Lab, Phone
  mission.tsx           In-flight mission screen
  result.tsx            Mission result
components/             Shared UI (panels, badges, telemetry deck, …)
constants/              Theme tokens and config
contexts/               Game state provider
hooks/                  useGame / useMission
services/               Pure game + physics logic
  aerodynamics.ts       ISA atmosphere, panel method, vortex lattice, drag polar
  simulation.ts         Mission simulation
  contracts.ts          Procedural contract generation
  reachable-url.ts      Loopback-safe URL resolution for the QR workflow
  pwa.ts                PWA head tags + service-worker registration
template/               OnSpace template remnants (auth scaffolding, unused)
tests/                  Vitest unit + physics sanity tests
public/                 Web-only static assets (manifest.json, sw.js, icon)
```

## Architecture

The codebase follows a clean separation between **pure logic** and **presentation**:

```
Screens / UI (React Native, Expo Router)
        │
        ▼
contexts/hooks (game state, mission lifecycle)
        │
        ▼
services/ (pure, testable logic — no React, no I/O)
   ├── simulation.ts     mission physics/telemetry
   ├── contracts.ts      seeded contract generation
   ├── aerodynamics.ts   ISA, panel method, vortex lattice, drag polar
   └── rng.ts            deterministic RNG
        │
        ▼
AsyncStorage (save state) — no backend required
```

Key properties:

- **The same validated logic runs on every platform.** The Aero Lab and the game share one `services/` layer — there is no separate web/native code path, so phone, desktop and tablet results are identical by construction.
- **Determinism.** Contract and mission generation use a seeded RNG (`services/rng.ts`), making runs reproducible for testing and teaching.
- **No network dependency at runtime.** Persistence is local (AsyncStorage); the optional Supabase auth template code is not mounted in the running app.
- **Web head/PWA wiring is isolated** in `services/pwa.ts` and guarded so it never runs in native builds.

## Game overview

- **Contract board** — procedurally generated cargo contracts (payload, distance, reward, difficulty) from a seeded RNG, so each run is reproducible.
- **Hangar** — design your aircraft by picking wings, engine and fuel tank; a physics model computes weight, range, fuel burn, safety and mission feasibility.
- **Missions** — fly with live telemetry (progress, fuel, integrity, engine health) and react to in-flight events (crosswind, engine vibration, fuel leak, bird strike, icing, turbulence, hydraulics) with risk/reward decisions.
- **Company** — money (£M), XP/levels, engineers and an upgrade shop (composite airframe, laminar wings, precision machining, AI co-pilot).
- **Persistence** — save state lives in AsyncStorage; the game runs fully offline with no backend required.

## Aerodynamics module (Aero Lab)

`services/aerodynamics.ts` is a self-contained, dependency-free **linear-aerodynamics** library — the kind of tool described by the classic "linear aerodynamics tool that runs on a smartphone" project brief. It runs identically on web, iOS and Android; the **Aero Lab** tab in the app is its UI.

### Models implemented

| Quantity | Formula | Notes |
| --- | --- | --- |
| ISA atmosphere | hydrostatic + lapse rate (0–20 km geopotential), Sutherland viscosity | returns T, p, ρ, a, μ |
| Dynamic pressure | q = ½·ρ·V² | Pa |
| Mach number | M = V/a | valid-when < 0.3 (incompressible model) |
| Reynolds number | Re = ρ·V·c/μ | based on reference chord |
| Pressure distribution | constant-strength **source panel method** | non-lifting, exact for thick bodies at α = 0° |
| Lift | 2D **vortex lattice** (vortices at quarter-chord, control points at three-quarter-chord) + thin-airfoil theory | camber handled via camber-line slope |
| Zero-lift angle | α_L0 from thin-airfoil Fourier coefficients | trapezoidal quadrature |
| Drag | parabolic polar CD = cd0 + k·CL², k = 1/(π·e·AR) for finite wings | |

### Units and conventions

Everything is **SI**: metres, seconds, kg, Pa, N/m, K. Angles are degrees at the API boundary, converted to radians internally. Chord and panel coordinates are normalised by chord. The reference area for CL/CD is the chord (2D section convention).

### Validation

The module is validated against closed-form solutions (regression-tested in `tests/aerodynamics.test.ts`):

- **Cylinder Cp**: the source panel method reproduces the exact doublet solution Cp = 1 − 4·sin²θ to ~1e-9.
- **Flat-plate lift**: CL from the vortex lattice converges to thin-airfoil theory CL = 2πα (within 0.13% at 128 panels); for a flat plate α_L0 = 0°.
- **Cambered sections**: computed zero-lift angles match theory — NACA 2412 ≈ −2.08°, NACA 4412 ≈ −4.15° — and CL(α) tracks thin-airfoil theory.

### Assumptions and limitations (surfaced in the UI)

- **Incompressible** potential flow; results are flagged with a warning for M ≥ 0.3 (no compressibility correction).
- **Linear, attached flow**; the lift model is not valid beyond roughly ±15° angle of attack (separation/stall) and the solver rejects |α| > 30°.
- Source panels cannot generate circulation, so the Cp plot is the **non-lifting** pressure distribution at α = 0°; lift at α ≠ 0 comes from the vortex lattice model.
- **Steady, inviscid**: skin friction enters only through the input cd0.
- 2D section model; the finite-wing effect enters only through the induced-drag factor k = 1/(π·e·AR).

### Inputs you control in the Aero Lab

Altitude (0–20 km), true airspeed, reference chord, angle of attack, airfoil (NACA 0012 / 2412 / 4412 / 23012), panel count, cd0, section k, aspect ratio and span efficiency. The output shows the atmosphere state, q, M, Re, CL (VLM and thin-airfoil), CD, section lift/drag per span, and the Cp curve.

## Environment variables

**None are required.** The core game and the Aero Lab run entirely on-device.

Optional, for future Supabase auth (dormant template code): `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in a local `.env.local` (gitignored). The running app does not call Supabase today.
