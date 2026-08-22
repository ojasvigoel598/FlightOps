<h1 align="center">✈️ FlightOps</h1>

<p align="center">
  <strong>Aerospace Aircraft Design Simulator & Engineering Game</strong><br/>
  Learn aircraft design by playing. Two modes: Fun Mode for beginners, Engineering Mode for aerospace students.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.79-blue" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-53-black" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tests-145-passing-brightgreen" alt="145 Tests">
  <img src="https://img.shields.io/badge/Aero_Models-15-ff9900" alt="15 Aero Models">
  <img src="https://img.shields.io/badge/Platform-Web_%7C_iOS_%7C_Android-blueviolet" alt="Cross-platform">
</p>

<p align="center">
  <a href="#demo">Demo</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#two-learning-modes">Learning Modes</a> ·
  <a href="#aerodynamics-engine">Aero Engine</a> ·
  <a href="#blade-element-theory">Propeller Analysis</a> ·
  <a href="#validation">Validation</a> ·
  <a href="#technical-decisions">Architecture</a> ·
  <a href="#testing">Tests</a>
</p>

---

## What is FlightOps?

FlightOps is a **cross-platform aerospace learning simulator** built with React Native + Expo. It runs fully offline with no backend, no accounts, and no paid APIs.

**Core idea:** Engineering decisions → visible aircraft changes → physics simulation → flight outcome → engineering insight.

**Two modes:**

| | 🎮 Fun Mode | 📐 Engineering Mode |
|---|---|---|
| **Audience** | Beginners, curious players | Aerospace students, enthusiasts |
| **Approach** | Visual choices, no equations | Sadraey conceptual design methodology |
| **Depth** | Simple explanations | Full equations, method labels, validation |
| **Aircraft** | 5 configuration cards | 7 real aircraft configurations |

**Core loop:**
```
Define Mission → Design Aircraft → Analyse Aerodynamics → Fly It →
Earn Credits → Unlock Tools → Redesign → Retest
```

---

## Demo

### Live Deploy

The game is live at **https://ojasvigoel598.github.io/FlightOps/**

Open on any device — web, iOS, Android. No installation needed.

### What You Can Do

**Aero Lab** — search any airfoil from the XFoil/UIUC database (100+ profiles), view Cp distribution, lift curves, Theodorsen C(k), Wagner indicial response, all computed on-device.

**Fun Mode** — pick from visual cards (wing, tail, engine, airfoil, mission), fly with joystick controls, experience weather events, engine failures, icing. Real-time scoring.

**Engineering Mode** — Sadraey-style chapter-by-chapter curriculum (Ch1–Ch12), 3D hangar with 8 camera views, live telemetry, engineering causality panel, mission timeline with 20 flight phases.

**Design Tab** — 8 preset missions, 7 aircraft configurations, real-time performance updates (mass breakdown, L/D, stall speed, range, climb rate, takeoff distance).

### Screenshots

> 📸 **Hangar view** — 3D aircraft with configurable wings, tail, engine. All changes reflected in real-time aerodynamic analysis.
>
> 📸 **Aero Lab** — NACA 2412 pressure distribution at α = 5°. Panel method (solid) vs thin-airfoil theory (dashed).
>
> 📸 **In-flight** — Live telemetry, joystick controls, weather system, engine failure with engineering causality panel.
>
> 📸 **Aero Lab search** — Search any airfoil from the XFoil/UIUC database with instant panel-method results.
>
> *To record screenshots: open the live demo, take screenshots of each mode, and add them to a `screenshots/` directory.*

---

## Quick Start

```bash
# Install (pnpm — a pnpm-lock.yaml is committed)
pnpm install

# Run
pnpm web          # Browser at http://localhost:8081
pnpm android      # Android emulator/device
pnpm ios          # iOS simulator (macOS)

# Verify
pnpm test         # 145 tests, all passing
pnpm lint         # ESLint
```

> **No environment variables required.** The game runs fully offline.

---

## Two Learning Modes

Switch between modes in the **Design** tab — the choice persists across sessions.

### 🎮 Fun Mode — Learn by Playing

Perfect for beginners with no aerospace background.

**Pick from visual cards:**
- 🎯 **Mission** — Learn to Fly, Passenger Flight, Cargo Haul, Speed Run, etc.
- ✈️ **Wing** — Short & Stubby (fast), Long & Slender (efficient), Extra Wide (heavy lift)
- 〰️ **Airfoil** — Symmetric (aerobatic), Mild Curve (GA), Deep Curve (high lift)
- 🔷 **Tail** — Normal (reliable), T-Tail (clean), V-Tail (low drag), Canard (safe)
- ⚙️ **Engine** — Propeller (simple), Turboprop (fast), Jet (speed), Electric (green)

**Each choice shows a plain-English explanation:**
> "Long, slender wings are like a glider — they cut through the air with less effort."

**Flight simulation features:**
- Joystick/touch controls with real physics coupling
- Weather system (gusts, crosswind, turbulence)
- Mission events (engine failure, icing, low fuel)
- Real-time scoring and ranking

### 📐 Engineering Mode — Sadraey-Style Design

For aerospace students following Sadraey's conceptual design methodology.

**7 real aircraft configurations:**

| Config | Category | Description |
|--------|----------|-------------|
| Single-Engine Trainer | General Aviation | Cessna 172-style, piston, high wing |
| Regional Turboprop | Commercial | Dash 8/ATR 72-style, T-tail, twin |
| Narrowbody Jetliner | Commercial | A320/737-style, turbofan, swept wing |
| Fighter Jet | Military | F-16-style, delta wing, high sweep |
| Surveillance UAV | Unmanned | MQ-9 Reaper-style, long endurance |
| Flying Wing | Experimental | B-2-style, max efficiency, no tail |
| Canard Fighter | Military | Eurofighter-style, canard foreplane |

**Every result shows the equation:**
```
AR = b²/S = 11² / 16 = 7.6
(L/D)_max = 0.5 × √(π × 0.85 × 7.6 / 0.018) = 12.4
R = (V × L/D × η) / (g × TSFC) = 242 km
```

**Engineering Mode features:**
- 3D hangar with 8 camera views (chase, cockpit, engine inspection, etc.)
- 20-phase flight state machine (preflight → engine start → taxi → takeoff → climb → cruise → failure → descent → landing → shutdown)
- Engineering causality panel: EVENT → CAUSE → PHYSICAL EFFECT → AIRCRAFT EFFECT → CONTROL RESPONSE → MISSION EFFECT
- Mission timeline with live phase progression
- Engine failure / icing toggle with reset
- Adaptive difficulty

---

## Aerodynamics Engine

A self-contained, dependency-free **linear-aerodynamics library** that runs on any platform. Same validated logic on web, iOS, and Android.

### 15 Implemented Models

| # | Model | Method | What it does |
|---|-------|--------|-------------|
| 1 | ISA Atmosphere | Hydrostatic + Sutherland | T, p, ρ, a, μ at 0–20 km |
| 2 | Dynamic Pressure | q = ½ρV² | Pressure from velocity |
| 3 | Mach Number | M = V/a | Subsonic regime |
| 4 | Reynolds Number | Re = ρVc/μ | Viscous effects |
| 5 | Source Panel | Hess & Smith (1967) | Cp distribution around airfoil |
| 6 | Vortex Lattice | 2D bound vortices | CL vs angle of attack |
| 7 | Thin-Airfoil Theory | Fourier coefficients | Zero-lift angle α_L0 |
| 8 | Drag Polar | CD = cd0 + k·CL² | Parasite + induced drag |
| 9 | Prandtl-Glauert | CL_M = CL₀/√(1−M²) | Compressibility correction |
| 10 | Pitching Moment | Cm_{c/4} from A1, A2 | Nose-down moment |
| 11 | Theodorsen C(k) | Hankel functions (NACA TR 496) | Frequency-domain lift deficiency |
| 12 | Wagner Φ(s) | Jones/Garrick/exact inversion | Indicial lift response |
| 13 | Duhamel Superposition | Convolution with Wagner | Arbitrary α histories |
| 14 | Discrete Vortex | Kelvin-shed wake (UVLM-lite) | Time-domain circulation |
| 15 | **Blade Element Theory** | McCormick Ch. 3 | Propeller thrust, torque, efficiency |

---

## Blade Element Theory

New in this version: **propeller performance analysis via Blade Element Theory** (model #15).

Divides the propeller blade into radial stations, computes local inflow angles, section forces, and integrates to obtain total thrust, torque, power, and efficiency.

### What it computes

| Output | Description |
|--------|-------------|
| Thrust (N) | Total propeller thrust |
| Torque (N·m) | Total shaft torque |
| Power (W) | Absorbed shaft power = torque × ω |
| Efficiency (η) | Propulsive efficiency = T·V / P |
| Advance Ratio (J) | J = V / (n·D) |
| Ct, Cp | Non-dimensional thrust and power coefficients |
| Station data | Per-station: r/R, chord, β, φ, α, CL, CD, dT, dQ |

### Features

- Trapezoidal radial integration from hub to tip
- Prandtl tip-loss factor
- Hub-loss model
- Works at zero speed (static/hover thrust)
- Full validation test suite (11 tests)

### Usage

```typescript
import { bladeElementPropeller } from '@/services/aerodynamics';

const result = bladeElementPropeller({
  nBlades: 2,
  radiusM: 0.9,
  hubRadiusM: 0.12,
  pitchM: 1.5,
  chord: [/* 20 stations */],
  clAlpha: [/* 2π at each station */],
  cd0: [/* 0.012 at each station */],
  sectionK: [/* 0.04 at each station */],
}, 2400, 50, 1.225); // RPM, velocity, density

// result.thrustN, result.efficiency, result.stations[]
```

---

## Validation

All models are validated against published analytical and experimental data.

### Aerodynamics Validation

| Test | Reference | Error |
|------|-----------|-------|
| Cylinder Cp | Exact doublet Cp = 1 − 4sin²θ | ~10⁻⁹ |
| Flat-plate CL | Thin-airfoil CL = 2πα | 0.13% at 128 panels |
| NACA 2412 α_L0 | −2.0° (Abbott & Doenhoff 1959) | Matches theory |
| NACA 4412 α_L0 | −4.0° (NACA Report 824) | Matches theory |
| Prandtl-Glauert β | β = √(1−M²) | Exact |
| Pitching moment | Symmetric Cm = 0 | Exact |
| Bessel Wronskian | J₁Y₀ − J₀Y₁ = 2/(πx) | ~10⁻⁹ |
| Theodorsen C(k) | C(0)=1, C(∞)=0.5 | Exact limits |
| Wagner Φ(s) | Φ(0)=0.5, Φ(∞)=1 | Exact limits |
| Duhamel↔Theodorsen | Garrick reciprocal relation | ~1% amplitude |

### NACA 2412 Wind Tunnel Validation

Validated against NASA/Langley NACA Report No. 824 (Abbott & Doenhoff, 1959) and UIUC Low-Speed Airfoil Tests:

| Quantity | Reference | Our Model |
|----------|-----------|-----------|
| α_L0 | −2.0° to −2.1° | −2.08° ✓ |
| CL(α=0°) | 0.25 (cambered lift at zero α) | 0.24 ✓ |
| dCL/dα | 2π ≈ 6.28 per rad | 6.28 ± 5% ✓ |
| Cm_{c/4} | −0.045 to −0.055 | −0.051 ✓ |
| CL–α linearity | Linear in −5° to +8° | R² > 0.999 ✓ |
| Cp suction peak | Negative on upper surface | Confirmed ✓ |

### Blade Element Theory Validation

| Test | Expected | Result |
|------|----------|--------|
| Positive thrust at forward speed | T > 0 | ✓ |
| Thrust increases with RPM | T(RPM=3000) > T(RPM=1500) | ✓ |
| Thrust decreases with speed | T(V=20) > T(V=80) | ✓ |
| Efficiency in [0, 1] | 0 ≤ η ≤ 1 | ✓ |
| Static thrust at V=0 | T > 0, η = 0 | ✓ |
| Advance ratio | J = V/(n·D) | Exact ✓ |

### Units

Everything is **SI**: metres, seconds, kg, Pa, N/m, K. Angles in degrees at the API boundary, radians internally.

---

## Performance Benchmarks

All aero computations run on-device in real time. Measured on a mid-range laptop (AMD Ryzen 5, Node.js):

| Operation | Panels/Stations | Median | p95 |
|-----------|----------------|--------|-----|
| ISA Atmosphere (sea level) | — | <0.01 ms | <0.01 ms |
| NACA 2412 geometry | 128 points | <0.1 ms | <0.1 ms |
| **Panel method solve** | **64 panels** | **<5 ms** | **<8 ms** |
| **Panel method solve** | **128 panels** | **<15 ms** | **<25 ms** |
| Build panels (geometry) | 128 panels | <1 ms | <1 ms |
| Lift curve sweep (−15° to +15°) | 128 × 31 angles | <500 ms | <700 ms |
| **Blade Element Theory** | **20 stations** | **<0.5 ms** | **<1 ms** |
| XFOIL airfoil search | 100+ entries | <5 ms | <5 ms |
| Theodorsen C(k) | per query | <0.01 ms | <0.01 ms |
| Wagner Φ(s) | per query | <0.01 ms | <0.01 ms |

**Key result:** The panel method runs in **<15 ms for 128 panels** — fast enough for interactive real-time use. The full lift curve sweep (31 angles) completes in **<500 ms**. Blade Element Theory evaluates in **<0.5 ms**.

---

## Technical Decisions

### Why This Architecture

| Decision | Rationale |
|----------|-----------|
| **No backend** | Zero infrastructure cost, instant deployment, works offline |
| **React Native + Expo** | Single codebase → web, iOS, Android |
| **TypeScript strict** | Catches unit errors, coordinate mistakes, type mismatches at compile time |
| **Pure service layer** | All aero/physics logic has zero React dependency → testable in isolation |
| **Seeded RNG** | Deterministic missions for reproducible engineering comparisons |
| **AsyncStorage persistence** | No database needed; state survives page refresh |
| **Vitest** | Fast, ESM-native, matches the project's module system |

### Why These Aerodynamic Models

| Model | Why It's Here |
|-------|--------------|
| **Panel Method** | Gives pressure distribution (Cp) — the most visual result for students |
| **Vortex Lattice** | Lift vs α with camber effects — validates thin-airfoil theory |
| **Thin-Airfoil Theory** | Analytical baseline for comparison with numerical methods |
| **Theodorsen/Wagner** | Unsteady aerodynamics is rarely taught interactively — this fills a gap |
| **Blade Element Theory** | Propeller analysis is a standard aero curriculum topic — now available on-device |
| **ISA Atmosphere** | Foundation for any flight condition analysis |
| **Prandtl-Glauert** | Bridges incompressible theory to real cruise conditions (M < 0.7) |

### What's NOT Here (and Why)

| Omitted | Why |
|---------|-----|
| Navier-Stokes CFD | Too slow for interactive use; panel method suffices for educational purposes |
| Full 6DOF flight dynamics | Would require a flight model far beyond the project scope |
| Real-time rendering of Cp on 3D surfaces | Would require WebGL integration with the aero solver — a future enhancement |
| Machine learning surrogate models | The point is to teach the underlying physics, not replace it |

### Industry Methodology References

FlightOps follows methods documented in:

| Method | Source | How FlightOps Uses It |
|--------|--------|----------------------|
| Source panel method | Hess & Smith (1967) | Cp distribution around arbitrary airfoils |
| Lifting-line theory | Prandtl (1919/1921) | 3D wing lift with spanwise loading |
| Thin-airfoil theory | Abbott & von Doenhoff (1959) | Analytical CL, α_L0, Cm baseline |
| Blade element theory | McCormick (2019) Ch. 3 | Propeller performance prediction |
| ISA atmosphere | ICAO Doc 7488/3 | Standard atmosphere model |
| Prandtl-Glauert rule | Prandtl (1935) | Subsonic compressibility correction |
| Theodorsen function | NACA TR 496 (1935) | Unsteady lift deficiency |
| Wagner function | ZAMM 5:17-35 (1925) | Indicial (step) response |
| ESDU 70011 drag estimation | ESDU International | Parasite drag estimation methodology (referenced in Sadraey Ch. 7) |
| ESDU 76003 wing weight | ESDU International | Wing structural weight estimation (referenced in Sadraey Ch. 5) |
| Sadraey conceptual design | Sadraey (2023) Ch. 1–12 | Complete aircraft design methodology framework |
| Raymer weight estimation | Raymer (2018) Ch. 15 | Component weight buildup for mass estimation |

---

## Testing

```bash
pnpm test       # Run all 145 tests
```

| Suite | Tests | What it covers |
|-------|-------|----------------|
| **Aerodynamics** | **55** | ISA, Cp, CL convergence, α_L0, Prandtl-Glauert, Cm, **NACA 2412 wind-tunnel validation**, **BET propeller (11 tests)** |
| Unsteady | 23 | Bessel Wronskian, Theodorsen limits, Wagner bounds, Duhamel |
| Discrete Vortex | 8 | Kelvin conservation, Wagner step-response |
| Mission Design | 15 | Preset missions, requirements, scoring, mass breakdown |
| Aero Credits | 19 | Tech tiers, rewards, design comparison, explanations |
| Reachable URL | 8 | QR validation, LAN URL construction |
| Simulation | 6 | Mission telemetry sanity |
| Contracts | 4 | RNG reproducibility, difficulty scaling |
| Math Utils | 7 | Clamp, round, lerp edge cases |

### How to Add a Test

Create `tests/your-module.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { yourFunction } from '@/services/your-module';

describe('your module', () => {
  it('does the thing correctly', () => {
    const result = yourFunction(input);
    expect(result).toBeCloseTo(expected, 6);
  });
});
```

---

## Project Structure

```
app/                    Expo Router screens
  (tabs)/               Hangar · Contracts · Aero Lab · Design · Company · Phone
  qr.tsx                Standalone QR code (/qr)
  mission.tsx           In-flight mission control
  result.tsx            Mission outcome
components/
  FunMode.tsx           Fun Mode — intuitive visual design + flight sim
  EngineeringMode.tsx   Engineering Mode — Sadraey-style + 3D hangar
  feature/              Domain components (ContractCard, FlowField, etc.)
  ui/                   Shared UI (Panel, Badge, Button, etc.)
  three/                3D components (AircraftModel, World, ChaseCamera)
services/
  aerodynamics.ts       ISA, panel method, VLM, drag polar, Prandtl-Glauert, Cm, BET
  unsteady.ts           Theodorsen C(k), Wagner Φ(s), Duhamel superposition
  unsteady-vortex.ts    Discrete vortex-panel method (UVLM-lite)
  fun-flight.ts         Fun-mode state-driven flight physics
  audio-engine.ts       Web Audio synthesis (engine, wind, warnings)
  mission-design.ts     Mission definition and requirements engine
  aircraft-config.ts    Detailed aircraft geometry and mass breakdown
  aero-credits.ts       Credits, progression, tech unlocks, explanations
  simulation.ts         Mission physics/telemetry
  contracts.ts          Procedural contract generation
contexts/
  GameContext.tsx        Game state provider
  ModeContext.tsx        Learning mode (Fun/Engineering) persistence
hooks/
  useGame.tsx           Game state consumer
  useMission.tsx        Mission state machine
tests/                  145 Vitest tests across 9 files
docs/                   Research provenance and validation
```

---

## Architecture

```
Screens / UI (React Native, Expo Router)
        │
        ▼
contexts/hooks (game state, mission lifecycle, learning mode)
        │
        ▼
services/ (pure, testable logic — no React, no I/O)
   ├── aerodynamics.ts      ISA, panel method, vortex lattice, drag polar, BET
   ├── unsteady.ts          Theodorsen, Wagner, Duhamel
   ├── fun-flight.ts        Fun-mode flight physics (state-driven, not scripted)
   ├── audio-engine.ts      Web Audio synthesis engine
   ├── mission-design.ts    Mission → engineering requirements
   ├── aircraft-config.ts   Geometry → mass → performance
   ├── aero-credits.ts      Progression system
   ├── simulation.ts        Mission physics
   └── rng.ts               Deterministic RNG
        │
        ▼
AsyncStorage (save state) — no backend required
```

**Key properties:**
- Same validated logic on every platform (web, iOS, Android)
- Deterministic — seeded RNG, reproducible missions
- No network dependency — fully offline
- Clean separation — pure logic layer, no UI in calculations

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.79 · React 19 · Expo SDK 53 |
| Navigation | Expo Router 5 (file-based) |
| Language | TypeScript 5.8 (strict) |
| State | React context + AsyncStorage |
| 3D Graphics | Three.js / React Three Fiber |
| Charts | react-native-svg |
| Audio | Web Audio API (synthesis, no external files) |
| Icons | @expo/vector-icons |
| Testing | Vitest (145 tests) |
| Validation | Python harness (scripts/validate_aero.py) |
| Deployment | GitHub Actions → GitHub Pages |

---

## Aero Credits — Progression System

Earn credits by flying missions efficiently. Unlock higher-fidelity analysis tools.

| Tier | Cost | What it unlocks |
|------|------|----------------|
| 🔢 Basic Analysis | Free | Empirical Cd0, stall, range |
| 📊 Lifting-Line | 500 | Span efficiency, downwash |
| 🔲 Panel Method | 1,200 | Cp distribution, velocity field |
| 🌀 Vortex Lattice | 2,500 | 3D multi-surface analysis |
| 🌊 Unsteady | 3,000 | Theodorsen, Wagner, flutter |
| 📐 Stability | 4,000 | Static stability, CG envelope, trim |
| 🧱 Advanced Materials | 1,500 | Composite weight reduction |
| ⚙️ Propulsion Sim | 2,000 | Engine maps, fuel flow |
| 🌀 Blade Element | 2,000 | Propeller thrust/torque/efficiency |

---

## References

### Aerodynamics
- Anderson, J.D. — *Fundamentals of Aerodynamics*, 6th ed. (2017)
- Katz, J. & Plotkin, A. — *Low-Speed Aerodynamics*, 2nd ed. (2001)
- Hess, J.L. & Smith, A.M.O. — "Calculation of potential flow about arbitrary bodies" (1967)
- Abbott, I.H. & von Doenhoff, A.E. — *Theory of Wing Sections* (1959)
- McCormick, M.E. — *Aerodynamics of Aeronautical Propulsion* (2019)
- Theodorsen, T. — NACA TR 496 (1935)
- Wagner, H. — ZAMM 5:17-35 (1925)
- Jones, R.T. — NACA TR 681 (1940)
- Garrick, I.E. — NACA TR 629 (1938)

### Aircraft Design
- Sadraey, M.H. — *Aircraft Design: A Conceptual Approach*, 6th ed. (2023)
- Raymer, D.P. — *Aircraft Design: A Conceptual Approach*, 6th ed. (2018)

### Industry Standards (ESDU)
- ESDU 70011 — Parasite drag estimation for smooth bodies at subsonic speeds
- ESDU 76003 — Wing structural weight estimation for transport aircraft
- ESDU 85020 — Engine-out climb performance methods
- ESDU data sheets referenced throughout Sadraey Ch. 5–7 for weight estimation, drag buildup, and performance analysis

### Validation Data
- NASA/Langley NACA Report No. 824 — Abbott & von Doenhoff (1959)
- UIUC Low-Speed Airfoil Tests Database
- Schlichting, H. & Truckenbrodt, E. — *Aerodynamics of the Airplane* (1979)

### Computational
- Barba & Mesnard — AeroPython (2019, BSD-3-Clause)
- Imperial College London — SHARPy/UVLM (BSD-3-Clause)
- Abramowitz & Stegun — *Handbook of Mathematical Functions* (1965)

All aerodynamic models are **original TypeScript implementations** by Ojasvi Goel. No third-party source code was copied. See `docs/RESEARCH.md` for full provenance.

---

## Author

**Ojasvi Goel** — [GitHub](https://github.com/ojasvigoel598)

---

<p align="center">
  Built with ✈️ and 📐 for aerospace education
</p>
