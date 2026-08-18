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

## Environment variables

**None are required.** The core game and the Aero Lab run entirely on-device.

Optional, for future Supabase auth (dormant template code): `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in a local `.env.local` (gitignored). The running app does not call Supabase today.
