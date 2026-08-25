<h1 align="center">✈️ FlightOps</h1>

<p align="center">
  <strong>Aerospace Engineering Simulator & Aircraft Design Game</strong><br/>
  Design aircraft, run real aerodynamic analysis, and fly missions — all in the browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6" alt="TypeScript">
  <img src="https://img.shields.io/badge/React_Native-0.79-blue" alt="React Native">
  <img src="https://img.shields.io/badge/Tests-206-passing-brightgreen" alt="206 Tests">
  <img src="https://img.shields.io/badge/Aero_Models-25+-ff9900" alt="25+ Models">
  <img src="https://img.shields.io/badge/Engine-XFoil%20Panel%20Method-blueviolet" alt="Panel Method">
</p>

<p align="center">
  <a href="https://ojasvigoel598.github.io/FlightOps/FLIGHT_GAME.html">🎮 Play Game</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#engineering-tools">Engineering Tools</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="MENTAL_MODEL.md">📐 Deep Dive (Mental Model)</a>
</p>

---

## What is FlightOps?

FlightOps is a **browser-based aerospace engineering simulator** where you design aircraft by choosing wings, engines, tail, and airfoil — then see if your design can complete a mission using real physics equations.

**No server. No account. No internet required after first load.**

### Two Modes

| | 🎮 Fun Mode | 📐 Engineering Mode |
|---|---|---|
| **For** | Beginners, players | Aerospace students, engineers |
| **Experience** | Visual design → fly → score | Full equations → analysis → validate |
| **Physics** | Simplified but correct | Industry-standard methods |

---

## How It Works

```
Design aircraft (wing, engine, airfoil)
        ↓
Panel method calculates Cp distribution around your airfoil
        ↓
Lift, drag, thrust computed from real aerodynamic equations
        ↓
Newton/Euler equations integrate motion at 60fps
        ↓
Results: range, fuel burn, L/D, stability, stall margin
```

Every number comes from a real aerospace equation. Nothing is faked.

---

## Engineering Tools

FlightOps implements **25+ aerospace analysis methods** used in industry and university courses:

| Tool | Method | Source |
|------|--------|--------|
| **Panel Method** | Source + vortex panels (Katz & Plotkin) | `services/aero/panel.ts` |
| **Lifting Line** | Prandtl numerical lifting-line | `services/aero/liftingLine.ts` |
| **Theodorsen C(k)** | Unsteady lift deficiency | `services/aero/unsteady.ts` |
| **Wagner Φ(s)** | Indicial step response | `services/aero/unsteady.ts` |
| **BEM Propeller** | Blade Element Momentum + Prandtl tip-loss | `services/aerodynamics.ts` |
| **Wind Tunnel Validation** | NACA Report 824 experimental data | `services/aero/windtunnel.ts` |
| **Stability Derivatives** | CLα, Cmα, Cnβ, Clp, Cmq | `services/aero/stability.ts` |
| **Eigenvalue Analysis** | Phugoid, short-period, Dutch roll, spiral | `services/aero/stability.ts` |
| **Drag Polar** | CD vs CL with max L/D annotation | `services/aerodynamics.ts` |
| **Thrust Required** | T_req(V) vs T_avail(V) | `services/aerodynamics.ts` |
| **Flight Envelope** | V-n diagram | `services/aerodynamics.ts` |
| **Trim Solver** | Elevator for L=W, M=0 | `services/aerodynamics.ts` |
| **Component Buildup** | Raymer parasite drag | `services/aero/engineering.ts` |
| **Weight Buildup** | Raymer statistical weights | `services/aero/engineering.ts` |
| **Breguet Range** | Prop & jet range equation | `services/aero/engineering.ts` |
| **Normal Shock** | Exact shock relations | `services/aero/engineering.ts` |
| **Oblique Shock** | θ-β-M via Newton-Raphson | `services/aero/engineering.ts` |
| **Prandtl-Meyer** | Expansion fan calculator | `services/aero/engineering.ts` |
| **Design Space Explorer** | Parameter sensitivity sweep | `services/aero/engineering.ts` |
| **Historical Aircraft** | Compare against Cessna/F-16/737 | `services/aero/engineering.ts` |

### Performance
- Panel method runs in **<50ms** for 128 panels
- BEM propeller: 20 radial stations computed in **<10ms**
- Eigenvalue analysis: 6-DOF modes in **<5ms**

---

## Quick Start

```bash
bun install
bun test          # 206 tests, all passing
bun run web       # http://localhost:8081
```

### Project Structure

```
services/                  Pure logic (no UI, no I/O)
  aerodynamics.ts          ISA, panel method, lift/drag, BEM, drag polar
  aero/panel.ts            Source + vortex panel method
  aero/liftingLine.ts      Prandtl lifting-line theory
  aero/unsteady.ts         Theodorsen, Wagner, Duhamel
  aero/stability.ts        Stability derivatives, eigenvalue modes
  aero/windtunnel.ts       NACA experimental validation data
  aero/engineering.ts      Component drag, weight, shocks, Prandtl-Meyer
  aero/xfoil.ts            UIUC airfoil database
  aircraft-config.ts       Geometry → mass → performance
  flight-state-machine.ts  Flight phases state machine

components/                UI layer
  EngineeringMode.tsx      Full engineering analysis
  FunMode.tsx              Visual aircraft design game
  EngineeringSimulation.tsx  3D hangar + flight sim

tests/                     206 Vitest tests across 10 files
docs/                      Research provenance
FLIGHT_GAME.html           Standalone browser game (60fps canvas)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.79 · Expo SDK 53 |
| Language | TypeScript 5.8 (strict) |
| 3D | Three.js via @react-three/fiber |
| Charts | react-native-svg |
| Testing | Vitest (206 tests) |
| Styling | NativeWind (Tailwind for RN) |
| State | React Context + AsyncStorage |

---

## Key Equations

| Equation | Meaning |
|----------|---------|
| `L = ½ρV²S·CL` | Wing lift force |
| `CD = CD₀ + k·CL²` | Drag polar |
| `α = θ − γ` | Angle of attack (correct formulation) |
| `ρ = 1.225·e^(−h/8500)` | ISA atmosphere |
| `CD_i = CL²/(π·AR·e)` | Induced drag |
| `R = (V/SFC)·(L/D)·ln(Wᵢ/Wf)` | Breguet range |
| `Cp = 1 − (V/V∞)²` | Bernoulli pressure |

---

## Testing

```bash
bun test       # 206 tests across 10 files
```

| Suite | Tests | What it covers |
|-------|-------|----------------|
| Aerodynamics | 42 | CL convergence, panel Cp, wind tunnel validation, BEM |
| Engineering | 49 | Shock relations, Prandtl-Meyer, weight, trim, drag polar |
| Stability | 8 | Derivatives, eigenvalue modes, aircraft configs |
| Unsteady | 23 | Bessel, Theodorsen, Wagner, Duhamel |
| Mission Design | 15 | Requirements, scoring, mass breakdown |
| Contracts | 4 | RNG reproducibility, difficulty scaling |
| Others | 65 | Math utils, QR, simulation, aero credits |

---

## References

- Anderson — *Fundamentals of Aerodynamics*, 6th ed.
- Katz & Plotkin — *Low-Speed Aerodynamics*, 2nd ed.
- Sadraey — *Aircraft Design: A Conceptual Approach*, 6th ed.
- Raymer — *Aircraft Design: A Conceptual Approach*, 6th ed.
- Nelson — *Flight Stability and Automatic Control*, 2nd ed.
- Abbott & von Doenhoff — *Theory of Wing Sections*
- Theodorsen — NACA TR 496 (1935)
- UIUC Low-Speed Airfoil Tests

All aerodynamic models are **original TypeScript implementations**.

---

## Author

**Ojasvi Goel** — [GitHub](https://github.com/ojasvigoel598) · [Email](mailto:ojasvigoel598@gmail.com)

---

<p align="center">
  Built with ✈️ and 📐 for aerospace education
</p>
