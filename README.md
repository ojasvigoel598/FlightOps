<h1 align="center">✈️ Flight Ops</h1>

<p align="center">
  <strong>Aerospace Aircraft Design Simulator & Engineering Game</strong><br/>
  Learn aircraft design by playing. Two modes: Fun Mode for beginners, Engineering Mode for students.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.79-blue" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-53-black" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tests-127-passing-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/Aero_Models-14-ff9900" alt="Aero Models">
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#two-learning-modes">Learning Modes</a> ·
  <a href="#design-tab-mission-designer">Design Tab</a> ·
  <a href="#aero-lab-linear-aerodynamics">Aero Lab</a> ·
  <a href="#qr-code--mobile">QR Code</a> ·
  <a href="#testing">Tests</a>
</p>

---

## What is Flight Ops?

Flight Ops is an **interactive aerospace learning game** built with React Native + Expo. It has no backend and no accounts — everything runs on your device.

**Choose your path:**

| | 🎮 Fun Mode | 📐 Engineering Mode |
|---|---|---|
| **For** | Beginners, curious players | Aerospace students, enthusiasts |
| **Approach** | Visual choices, no equations | Sadraey-style design process |
| **Tailored** | Simple explanations | Equations, method labels |
| **Aircraft** | Pick shapes, see results | 7 real configurations |

**Core loop:** Define a mission → Design an aircraft → Analyse aerodynamics → Fly it → Earn credits → Unlock better tools → Redesign → Retest.

---

## Quick Start

```bash
# Install (uses pnpm — a pnpm-lock.yaml is committed)
pnpm install

# Run
pnpm web          # Browser at http://localhost:8081
pnpm android      # Android emulator/device
pnpm ios          # iOS simulator (macOS)

# Verify
pnpm test         # 127 tests, all passing
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

**Each choice shows a simple explanation:**
> "Long, slender wings are like a glider — they cut through the air with less effort. That's why gliders have very long wings."

### 📐 Engineering Mode — Sadraey-Style Design

For aerospace students following the Sadraey conceptual design methodology.

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

---

## Design Tab — Mission Designer

The engineering heart of Flight Ops. Define missions and design aircraft to meet them.

### Mission Definition

8 preset missions with instant parameter loading:

| Mission | Range | Speed | Payload | Best For |
|---------|-------|-------|---------|----------|
| Learn to Fly | 200 km | 55 m/s | 100 kg | Training |
| Regional Passenger | 800 km | 120 m/s | 2,000 kg | Airliner design |
| Long Range | 3,000 km | 200 m/s | 500 kg | Endurance |
| Cargo Haul | 500 km | 90 m/s | 5,000 kg | Heavy lift |
| Surveillance | 1,500 km | 60 m/s | 30 kg | UAV design |
| Speed Run | 600 km | 250 m/s | 200 kg | Fighter design |
| Crop Spraying | 50 km | 40 m/s | 800 kg | AG aircraft |
| Custom | Any | Any | Any | Free design |

### Aircraft Configuration

Change any parameter and see performance update in real time:

**Wing** — span, area, taper ratio, sweep, airfoil (NACA 0006 to 6412)

**Tail** — Conventional, T-tail, V-tail, Canard, or No tail

**Propulsion** — Piston, Turboprop, Turbofan, or Electric; engine count and power

### What updates instantly
- Mass breakdown (wing, fuselage, tail, propulsion, fuel, payload)
- Aspect ratio, wing loading, power loading
- Stall speed, cruise speed, max L/D
- Range, endurance, climb rate, takeoff distance
- Feasibility assessment with specific warnings

---

## Aero Lab — Linear Aerodynamics

A self-contained, dependency-free **linear-aerodynamics library** that runs on any platform. Same validated logic on web, iOS, and Android.

### Models Implemented

| Model | Method | What it does |
|-------|--------|-------------|
| ISA Atmosphere | Hydrostatic + Sutherland | T, p, ρ, a, μ at 0–20 km |
| Dynamic Pressure | q = ½ρV² | Pressure from velocity |
| Mach Number | M = V/a | Subsonic regime |
| Reynolds Number | Re = ρVc/μ | Viscous effects |
| Source Panel | Hess & Smith (1967) | Cp distribution around airfoil |
| Vortex Lattice | 2D bound vortices | CL vs angle of attack |
| Thin-Airfoil Theory | Fourier coefficients | Zero-lift angle α_L0 |
| Drag Polar | CD = cd0 + k·CL² | Parasite + induced drag |
| Prandtl-Glauert | CL_M = CL₀/√(1−M²) | Compressibility correction |
| Pitching Moment | Cm_{c/4} from A1, A2 | Nose-down moment |
| Theodorsen C(k) | Hankel functions (NACA TR 496) | Frequency-domain lift deficiency |
| Wagner Φ(s) | Jones/Garrick/exact inversion | Indicial lift response |
| Duhamel Superposition | Convolution with Wagner | Arbitrary α histories |
| Discrete Vortex | Kelvin-shed wake (UVLM-lite) | Time-domain circulation |

### Validation

All validated against closed-form analytical solutions:

| Test | Reference | Error |
|------|-----------|-------|
| Cylinder Cp | Exact doublet Cp = 1 − 4sin²θ | ~10⁻⁹ |
| Flat-plate CL | Thin-airfoil CL = 2πα | 0.13% at 128 panels |
| NACA 2412 α_L0 | −2.08° | Matches theory |
| NACA 4412 α_L0 | −4.15° | Matches theory |
| Prandtl-Glauert β | β = √(1−M²) | Exact |
| Pitching moment | Symmetric Cm = 0 | Exact |
| Bessel Wronskian | J₁Y₀ − J₀Y₁ = 2/(πx) | ~10⁻⁹ |
| Theodorsen C(k) | C(0)=1, C(∞)=0.5 | Exact limits |
| Wagner Φ(s) | Φ(0)=0.5, Φ(∞)=1 | Exact limits |
| Duhamel↔Theodorsen | Garrick reciprocal relation | ~1% amplitude |

### Units

Everything is **SI**: metres, seconds, kg, Pa, N/m, K. Angles in degrees at the API boundary, radians internally.

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

**How to earn:**
- Complete missions → base reward
- High L/D efficiency → bonus
- Safe flights → bonus
- Heavy payloads → bonus
- Meet range requirement → bonus

---

## QR Code — Open on Phone

Three strategies ensure the QR always works:

1. **Auto-detect** — uses the web origin (works on deployed URLs)
2. **WebRTC LAN detection** — finds your computer's IP (free, no API key, same WiFi)
3. **Manual URL input** — paste the preview URL

**How to use:**
1. Open the app in the browser preview
2. Go to the **Phone** tab or visit `/qr`
3. Scan with your phone camera (iOS) or Google Lens (Android)
4. Phone opens the same app — all gameplay works on-device

The QR auto-refreshes every 5 seconds to catch new preview sessions.

---

## Game — Cargo Airline

Run a cargo airline: take contracts, design aircraft, fly missions, earn money.

### How to Play

```
Contracts → Hangar → Mission → Result → Company → Repeat
```

1. **Contracts** — pick a cargo job (payload, distance, reward, difficulty)
2. **Hangar** — assemble aircraft from wings, engine, fuel tank
3. **Mission** — fly with live telemetry, react to events (crosswind, engine vibration, fuel leak, bird strike, icing)
4. **Result** — deliver payload for reward, or lose it. Net = reward − build cost
5. **Company** — spend earnings on upgrades (composite airframe, laminar wings, AI co-pilot)

### Features
- **Design-to-mission loop** — parts change real physics (range, burn rate, safety)
- **Deterministic missions** — seeded PRNG, reproducible events
- **Choice-driven events** with engineering trade-offs
- **Chain reactions** — damaged engines burn more fuel
- **Fully offline** — no backend, no accounts, AsyncStorage persistence

---

## Project Structure

```
app/                    Expo Router screens
  (tabs)/               Hangar · Contracts · Aero Lab · Design · Company · Phone
  qr.tsx                Standalone QR code (/qr)
  mission.tsx           In-flight mission control
  result.tsx            Mission outcome
components/
  FunMode.tsx           Fun Mode — intuitive visual design
  EngineeringMode.tsx   Engineering Mode — Sadraey-style analysis
  feature/              Domain components (ContractCard, FlowField, etc.)
  ui/                   Shared UI (Panel, Badge, Button, etc.)
services/
  aerodynamics.ts       ISA, panel method, VLM, drag polar, Prandtl-Glauert, Cm
  unsteady.ts           Theodorsen C(k), Wagner Φ(s), Duhamel superposition
  unsteady-vortex.ts    Discrete vortex-panel method (UVLM-lite)
  mission-design.ts     Mission definition and requirements engine
  aircraft-config.ts    Detailed aircraft geometry and mass breakdown
  aero-credits.ts       Credits, progression, tech unlocks, explanations
  simulation.ts         Mission physics/telemetry
  contracts.ts          Procedural contract generation
  reachable-url.ts      QR URL resolution (WebRTC LAN detection)
contexts/
  GameContext.tsx        Game state provider
  ModeContext.tsx        Learning mode (Fun/Engineering) persistence
hooks/
  useGame.tsx           Game state consumer
  useMission.tsx        Mission state machine
tests/                  127 Vitest tests across 9 files
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
   ├── aerodynamics.ts      ISA, panel method, vortex lattice, drag polar
   ├── unsteady.ts          Theodorsen, Wagner, Duhamel
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
| Charts | react-native-svg |
| Icons | @expo/vector-icons |
| Testing | Vitest (127 tests) |
| Validation | Python harness (scripts/validate_aero.py) |

---

## Testing

```bash
pnpm test       # Run all 127 tests
```

| Suite | Tests | What it covers |
|-------|-------|----------------|
| Aerodynamics | 37 | Cylinder Cp, CL convergence, zero-lift angles, Prandtl-Glauert, Cm |
| Unsteady | 23 | Bessel Wronskian, Theodorsen limits, Wagner bounds, Duhamel |
| Discrete Vortex | 8 | Kelvin conservation, Wagner step-response |
| Mission Design | 15 | Preset missions, requirements, scoring, mass breakdown |
| Aero Credits | 19 | Tech tiers, rewards, design comparison, explanations |
| Reachable URL | 8 | QR validation, LAN URL construction |
| Simulation | 6 | Mission telemetry sanity |
| Contracts | 4 | RNG reproducibility, difficulty scaling |
| Math Utils | 7 | Clamp, round, lerp edge cases |

---

## References

### Aerodynamics
- Anderson, J.D. — *Fundamentals of Aerodynamics*, 6th ed. (2017)
- Katz, J. & Plotkin, A. — *Low-Speed Aerodynamics*, 2nd ed. (2001)
- Hess, J.L. & Smith, A.M.O. — "Calculation of potential flow about arbitrary bodies" (1967)
- Abbott, I.H. & von Doenhoff, A.E. — *Theory of Wing Sections* (1959)
- Theodorsen, T. — NACA TR 496 (1935)
- Wagner, H. — ZAMM 5:17-35 (1925)
- Jones, R.T. — NACA TR 681 (1940)
- Garrick, I.E. — NACA TR 629 (1938)
- Dawson & Brunton — arXiv:2104.15122 (2021)

### Aircraft Design
- Sadraey, M.H. — *Aircraft Design: A Conceptual Approach*, 6th ed. (2023)
- Raymer, D.P. — *Aircraft Design: A Conceptual Approach*, 6th ed. (2018)

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
