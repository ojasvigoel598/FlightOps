<h1 align="center">✈️ Flight Ops</h1>

<p align="center">
  <strong>Aerospace Aircraft Design Simulator & Engineering Game</strong><br/>
  Learn aircraft design by playing. Two modes: Fun Mode for beginners, Engineering Mode for students.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.79-blue" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-53-black" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tests-157-passing-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/Aero_Models-25+-ff9900" alt="Aero Models">
</p>

<p align="center">
  <a href="#what-is-flight-ops">What is it?</a> ·
  <a href="#the-big-picture-how-it-works">How it works</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#the-physics-engine">Physics Engine</a> ·
  <a href="#engineering-analysis-tools">Engineering Tools</a> ·
  <a href="#testing">Tests</a>
</p>

---

## What is Flight Ops?

Flight Ops is an **interactive aerospace engineering simulator and game** that runs entirely in your browser or on your phone. No server, no account, no internet required after the first load.

**The core idea:** You design an aircraft by choosing wings, engines, tail, and airfoil. The app calculates whether your design can complete a mission — using real aerospace equations. Then you fly it and see if your engineering decisions were good.

**Two paths:**

| | 🎮 Fun Mode | 📐 Engineering Mode |
|---|---|---|
| **For** | Beginners, curious players | Aerospace students, enthusiasts |
| **Approach** | Visual choices, simple explanations | Full equations, Sadraey design process |
| **Math** | Hidden — you see results | Every equation shown and explained |
| **Aircraft** | Pick shapes, see outcomes | 7 real configurations with full analysis |

**The game loop:**

```
Choose a mission (fly 800 km with 2000 kg of passengers)
        ↓
Design your aircraft (wing size, engine power, airfoil shape)
        ↓
App calculates: Can it fly? How far? How fast? Is it safe?
        ↓
Fly the mission (you control pitch, throttle, flaps)
        ↓
See results: fuel used, efficiency score, whether you succeeded
        ↓
Earn credits → unlock better analysis tools → redesign → retry
```

---

## The Big Picture: How It Works

Imagine you're an aerospace engineer at a company. Your job is:

1. **A customer gives you a mission:** "Fly 800 km with 2000 passengers"
2. **You design an aircraft** to meet that mission
3. **You run simulations** to check if your design works
4. **You fly it** and see what happens
5. **You learn** from what went wrong and improve

Flight Ops does all of this in your browser. Here's the data flow:

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR INPUTS                           │
│  "I want to fly 800 km with 2000 kg of passengers"     │
│  Wing: 10m span, 16m² area                             │
│  Engine: Turboprop, 500 kW                             │
│  Airfoil: NACA 2412                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              AERODYNAMICS ENGINE                        │
│                                                         │
│  "Given your wing shape and airspeed, here's how much  │
│   lift and drag your wing produces."                    │
│                                                         │
│  Uses: Panel Method, Vortex Lattice, Thin-Airfoil      │
│  Theory, Theodorsen unsteady aerodynamics               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              PROPULSION ENGINE                          │
│                                                         │
│  "Given your engine type and throttle, here's how much │
│   thrust you get, and how fast you burn fuel."          │
│                                                         │
│  Uses: Blade Element Theory, SFC models, altitude       │
│  correction                                            │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              FLIGHT DYNAMICS                            │
│                                                         │
│  "Given your lift, drag, thrust, and weight — here's   │
│   how the aircraft actually moves through the air."     │
│                                                         │
│  Uses: Newton's second law, Euler's rotational eqn,    │
│  ISA atmosphere, fuel burn → mass change                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              RESULTS                                    │
│                                                         │
│  "Your aircraft can fly 750 km with 1800 kg payload.   │
│   It burns 312 kg of fuel. Max L/D is 12.4.            │
│   Stall speed is 28 m/s. Cruise at 120 m/s."          │
│                                                         │
│  Shows: performance charts, drag polar, thrust curves,  │
│  stability analysis, weight breakdown                   │
└─────────────────────────────────────────────────────────┘
```

**The key insight:** Every number you see comes from real physics equations. When you change the wing span, the lift changes. When you change the engine, the thrust changes. Nothing is faked.

---

## Quick Start

```bash
# Install (uses bun — a bun.lockb is committed)
bun install

# Run
bun run web          # Browser at http://localhost:8081
bun run android      # Android emulator/device
bun run ios          # iOS simulator (macOS)

# Verify
bun test             # 157 tests, all passing
bun run lint         # ESLint
```

> **No environment variables required.** The game runs fully offline.

---

## The Physics Engine

This is the heart of Flight Ops. Every calculation uses real aerospace equations. Here's what's happening under the hood:

### 1. Atmosphere Model (ISA)

The app knows that air gets thinner as you go higher. At sea level, air density is 1.225 kg/m³. At 11 km (cruise altitude for airliners), it's only 0.364 kg/m³.

**Why this matters:** Thinner air means less lift AND less drag. Your aircraft performs differently at different altitudes.

**The equation:**
```
ρ = 1.225 × e^(-h/8500)     [simplified exponential model]
```

### 2. Lift and Drag

Your wing produces lift (the force that keeps you up) and drag (the force that slows you down). Both depend on air density, speed, and wing shape.

**Lift equation:**
```
L = ½ × ρ × V² × S × CL
```

Where:
- ρ = air density (kg/m³)
- V = airspeed (m/s)
- S = wing area (m²)
- CL = lift coefficient (depends on airfoil shape and angle of attack)

**Drag equation:**
```
D = ½ × ρ × V² × S × CD
```

Where CD = CD₀ + k × CL² (the "drag polar" — drag increases with the square of lift)

### 3. Propulsion

Your engine produces thrust. The app calculates how much thrust you get based on engine type, throttle setting, and altitude.

**For jet engines:**
```
T = T_max × (ρ / ρ₀) × throttle
```

**For propeller engines:**
```
T = T_max × (ρ / ρ₀) × η_prop × throttle
```

Where η_prop is propeller efficiency (typically 0.75–0.85).

### 4. Flight Mechanics

The app uses Newton's second law (F = ma) to calculate how the aircraft moves:

```
Net force = Thrust − Drag − Weight × sin(γ)
Acceleration = Net force / mass
New speed = old speed + acceleration × time step
```

It also tracks fuel burn: as you burn fuel, the aircraft gets lighter, which changes how it flies.

### 5. Unsteady Aerodynamics

For dynamic maneuvers (pitching, gusts, turbulence), the app uses Theodorsen's theory:

**Theodorsen C(k):** A complex-valued function that accounts for the fact that lift doesn't respond instantly to changes in angle of attack. The wake behind the wing takes time to develop.

**Wagner Φ(s):** Shows how lift grows after a sudden change in angle of attack — it starts at 50% and grows to 100% as the wake develops.

### 6. Panel Method

To calculate pressure distribution around an airfoil, the app uses the panel method:

1. Divide the airfoil surface into small flat panels
2. Place a vortex on each panel
3. Solve a system of equations so that air flows tangent to the surface
4. Calculate pressure from velocity (Bernoulli's equation)

This gives you the Cp curve — how pressure varies along the wing surface.

---

## Engineering Analysis Tools

Beyond the basic flight model, FlightOps includes professional-grade analysis tools. These are the same methods used in aerospace industry and university courses:

### Wind Tunnel Validation

The app includes experimental data from NACA wind tunnel tests (NACA Report 824, 1959). You can compare the app's predictions against real-world measurements for NACA 0012, 2412, and 4412 airfoils.

### Drag Polar Chart

Shows CD vs CL — the fundamental relationship between drag and lift. Annotations show:
- Maximum L/D point (most efficient cruise)
- Minimum drag point
- Stall region

### Thrust Required vs Available

Shows how much thrust you need to fly at each speed, versus how much your engine can provide. The intersection gives your maximum speed.

### Stability Derivatives

Computes CL_α, Cm_α, Cm_q, Cl_β, Cn_β, and other derivatives that determine whether your aircraft is stable. Predefined configurations for Cessna 172, F-16, Boeing 737, and ASK 21 glider.

### Eigenvalue Mode Analysis

Identifies the dynamic modes of your aircraft:
- **Short-period:** Rapid pitch oscillation (1-3 seconds)
- **Phugoid:** Slow altitude-speed exchange (30-100 seconds)
- **Dutch roll:** Coupled yaw-roll oscillation
- **Spiral:** Slow bank-heading divergence

### Component Buildup Drag

Uses Raymer's method to estimate drag from each component: wing skin friction, fuselage pressure drag, tail interference, nacelle drag.

### Normal/Oblique Shock Calculator

For supersonic flight: calculates the properties across a shock wave (pressure ratio, temperature ratio, Mach number change).

### Prandtl-Meyer Expansion

For supersonic flow around corners: calculates how the flow accelerates and pressure drops through an expansion fan.

### Flight Envelope (V-n Diagram)

Shows the structural and aerodynamic limits of your aircraft — maximum speed, stall speed, maximum load factor.

### Trim Solver

Finds the elevator deflection needed to maintain steady level flight (L=W, M=0).

### Design Space Explorer

Sweeps one parameter (wing area, span, mass, etc.) across a range and shows how it affects L/D, stall speed, and cruise speed.

---

## Project Structure

```
app/                    Expo Router screens
  (tabs)/               Tabs: Hangar · Contracts · Aero Lab · Design · Company
  mission.tsx           In-flight mission control
  result.tsx            Mission outcome
  qr.tsx                QR code for sharing

components/
  FunMode.tsx           Fun Mode — visual aircraft design
  EngineeringMode.tsx   Engineering Mode — Sadraey-style analysis
  EngineeringSimulation.tsx  Full 3D hangar + flight simulation
  feature/              AeroChart, UnsteadyLab, TelemetryDeck, etc.
  three/                3D models (AircraftModel, Hangar3D, World, Particles)
  ui/                   Shared UI (Panel, Badge, Button, StatBar)

services/               Pure logic — no UI, no I/O
  aerodynamics.ts       ISA, panel method, VLM, drag polar, BEM, shocks, trim
  aero/stability.ts     Stability derivatives, eigenvalue analysis
  aero/windtunnel.ts    NACA experimental data
  aero/engineering.ts   Component drag, weight, Breguet, shocks, Prandtl-Meyer
  aero/panel.ts         Source + vortex panel method (Katz & Plotkin)
  aero/liftingLine.ts   Prandtl numerical lifting-line theory
  aero/unsteady.ts      Theodorsen C(k), Wagner Φ(s)
  aero/xfoil.ts         UIUC airfoil database integration
  aircraft-config.ts    Aircraft geometry → mass → performance
  flight-state-machine.ts  Flight phases (preflight → cruise → landing)
  fun-flight.ts         Fun Mode physics engine
  mission-design.ts     Mission requirements and scoring
  simulation.ts         Mission telemetry
  contracts.ts          Procedural contract generation

tests/                  157 Vitest tests across 9 files
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
   ├── aero/stability.ts    Stability derivatives, eigenvalue modes
   ├── aero/engineering.ts  Component drag, weight, Breguet, shocks
   ├── aero/windtunnel.ts   NACA experimental data for validation
   ├── unsteady.ts          Theodorsen, Wagner, Duhamel
   ├── aircraft-config.ts   Geometry → mass → performance
   ├── mission-design.ts    Mission → engineering requirements
   └── simulation.ts        Mission physics
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
| 3D Graphics | Three.js via @react-three/fiber |
| State | React context + AsyncStorage |
| Charts | react-native-svg |
| Testing | Vitest (157 tests) |
| Styling | NativeWind (Tailwind for React Native) |

---

## Testing

```bash
bun test       # Run all 157 tests
```

| Suite | Tests | What it covers |
|-------|-------|----------------|
| Aerodynamics | 42 | Cylinder Cp, CL convergence, zero-lift angles, Prandtl-Glauert, Cm, wind tunnel validation, BEM propeller, boundary layer transition |
| Stability | 8 | Derivative computation, eigenvalue modes, aircraft configs |
| Unsteady | 23 | Bessel Wronskian, Theodorsen limits, Wagner bounds, Duhamel |
| Discrete Vortex | 8 | Kelvin conservation, Wagner step-response |
| Mission Design | 15 | Preset missions, requirements, scoring, mass breakdown |
| Aero Credits | 19 | Tech tiers, rewards, design comparison, explanations |
| Reachable URL | 8 | QR validation, LAN URL construction |
| Simulation | 6 | Mission telemetry sanity |
| Contracts | 4 | RNG reproducibility, difficulty scaling |
| Math Utils | 7 | Clamp, round, lerp edge cases |

---

## Mathematical Models Summary

| Model | Equation | What it calculates |
|-------|----------|-------------------|
| ISA Atmosphere | ρ = ρ₀ × e^(-h/H) | Air density at altitude |
| Lift | L = ½ρV²S×CL | Wing lift force |
| Drag Polar | CD = CD₀ + k×CL² | Total drag coefficient |
| Panel Method | σ = solve(A·x = b) | Pressure distribution |
| Vortex Lattice | Γ = solve(A·γ = α) | Section lift coefficient |
| Theodorsen | C(k) = H₁⁽²⁾/(H₁⁽²⁾ + iH₀⁽²⁾) | Unsteady lift deficiency |
| Wagner | Φ(s) = 1 − 0.165e⁻⁰·⁰⁴⁵⁵ˢ − 0.335e⁻⁰·³ˢ | Indicial lift response |
| BEM Propeller | dT = (L·cosφ − D·sinφ) × 2πr·dr | Propeller thrust |
| Prandtl Tip Loss | F = (2/π)×arccos(e⁻ᶠ) | Blade tip correction |
| Normal Shock | p₂/p₁ = 1 + (2γ/(γ+1))(M₁² − 1) | Post-shock pressure |
| Prandtl-Meyer | ν(M) = √((γ+1)/(γ−1))×arctan(...) − arctan(...) | Expansion fan angle |
| Breguet Range | R = (V/SFC)×(L/D)×ln(Wᵢ/W𝒻) | Aircraft range |
| Raymer Weight | W = Σ(component statistics) | Structural weight estimate |
| Trim | δe = −(Cm₀ + Cmα×α)/Cmδe | Elevator for level flight |

---

## References

### Aerodynamics
- Anderson, J.D. — *Fundamentals of Aerodynamics*, 6th ed. (2017)
- Katz, J. & Plotkin, A. — *Low-Speed Aerodynamics*, 2nd ed. (2001)
- Hess, J.L. & Smith, A.M.O. — "Calculation of potential flow about arbitrary bodies" (1967)
- Abbott, I.H. & von Doenhoff, A.E. — *Theory of Wing Sections* (1959)
- Theodorsen, T. — NACA TR 496 (1935)
- Wagner, H. — ZAMM 5:17-35 (1925)
- McCormick, B.W. — *Aerodynamics of Aeronautical Propulsion* (1995)

### Flight Dynamics & Stability
- Nelson, R.C. — *Flight Stability and Automatic Control*, 2nd ed. (1998)
- Etkin, B. & Reid, L.D. — *Dynamics of Flight: Stability and Control* (1996)

### Aircraft Design
- Sadraey, M.H. — *Aircraft Design: A Conceptual Approach*, 6th ed. (2023)
- Raymer, D.P. — *Aircraft Design: A Conceptual Approach*, 6th ed. (2018)

### Compressible Flow
- Anderson, J.D. — *Modern Compressible Flow*, 3rd ed. (2003)

### Wind Tunnel Data
- Abbott, I.H. & von Doenhoff, A.E. — NACA Report No. 824 (1959)
- UIUC Low-Speed Airfoil Tests — Selig et al.

All aerodynamic models are **original TypeScript implementations** by Ojasvi Goel. No third-party source code was copied. See `docs/RESEARCH.md` for full provenance.

---

## Author

**Ojasvi Goel** — [GitHub](https://github.com/ojasvigoel598)

---

<p align="center">
  Built with ✈️ and 📐 for aerospace education
</p>
