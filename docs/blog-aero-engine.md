# Building a Real-Time Aerodynamics Engine in TypeScript

**How I built 15 validated aerodynamic models that run in <15ms on any device**

*By Ojasvi Goel — August 2026*

---

## Why Build This?

Most aerospace education tools are either:
1. **Desktop-only** (XFOIL, MATLAB toolboxes) — not accessible on phones
2. **Purely theoretical** (textbooks) — no interactive feedback
3. **Just games** (flight simulators) — no engineering depth

I wanted something that combines all three: **real aerodynamics, interactive visualization, and game-like engagement**. The result is FlightOps — a cross-platform aerospace simulator with 15 validated aerodynamic models running entirely in TypeScript.

---

## The Core Problem

The panel method is the workhorse of subsonic aerodynamic analysis. It discretizes an airfoil surface into flat panels with source/vortex distributions, enforces the Kutta condition at the trailing edge, and solves a linear system to obtain pressure distribution.

The challenge: solving an N×N system in real-time on a mobile browser.

---

## Architecture: Zero Dependencies

```
services/
  aerodynamics.ts      ISA, panel method, VLM, drag polar, BET
  aero/
    airfoil.ts         NACA 4-digit geometry generation
    panel.ts           Source + vortex panel method
    liftingLine.ts     Prandtl numerical lifting line
    unsteady.ts        Theodorsen, Wagner, Duhamel
    xfoil.ts           UIUC airfoil database (100+ profiles)
```

Every function is a pure TypeScript function. No React, no Three.js, no DOM dependencies. This means:
- Same validated logic on web, iOS, and Android
- Fully testable with Vitest (145 tests)
- Runs offline with zero network requests

---

## Model #5: The Panel Method

The source panel method discretizes the airfoil into N flat panels. Each panel has a uniform source strength σ and a single vortex γ (shared across all panels). The Kutta condition sets γ so that the trailing-edge tangential velocities are equal.

**Key equations:**

```
V_i = V∞ + Σ(j=1 to N) [σ_j * influence(i,j)] + γ * vortex_influence(i)
Kutta: VT(TE_upper) = VT(TE_lower)
Solve: [A]{σ,γ} = {b}
```

**Results for NACA 2412:**

| Quantity | Reference (NACA TR 824) | Panel Method |
|----------|------------------------|--------------|
| α_L0 | −2.0° | −2.08° |
| CL(0°) | 0.25 | 0.24 |
| dCL/dα | 2π ≈ 6.28 | 6.28 |
| Cm_{c/4} | −0.05 | −0.051 |

**Performance:** 128 panels solve in **<15ms** on a mid-range laptop.

---

## Model #15: Blade Element Theory

BET divides a propeller blade into radial stations. At each station, the local inflow angle φ is computed from the axial velocity V and rotational speed ωr. The local lift and drag forces are computed from the section CL and CD, then integrated along the span.

**Key outputs:** Thrust, torque, power, efficiency, advance ratio J, and per-station data (CL, CD, dT, dQ at each radial station).

**Special features:**
- Prandtl tip-loss factor
- Hub-loss model
- Works at V=0 (static/hover thrust)
- 20-station resolution

---

## The Unsteady Suite

### Theodorsen C(k) — Frequency Domain

Theodorsen's function describes how a harmonic oscillation in angle of attack produces a lagged, reduced-amplitude lift force. Implemented using Hankel functions (Bessel Y₀, Y₁, J₀, J₁).

```
C(k) = H₁⁽²⁾(k) / [H₁⁽²⁾(k) + i·H₀⁽²⁾(k)]
```

### Wagner Φ(s) — Time Domain

The Wagner function gives the indicial (step response) lift. Implemented via both the Jones approximation and the exact inversion via the Biliniear transform.

```
Φ(s) ≈ 1 − 0.165·e^(−0.0455s) − 0.835·e^(−0.3s)
```

### Duhamel Superposition

Combines Wagner with arbitrary α(t) histories via convolution. This bridges the time-domain and frequency-domain approaches.

---

## Why Panel Method over CFD?

| Factor | Panel Method | Navier-Stokes CFD |
|--------|-------------|-------------------|
| Speed | <15ms | 10s–minutes |
| Interactive | ✅ Yes | ❌ No |
| Browser-compatible | ✅ Yes | ❌ No |
| Educational value | High (shows Cp) | Lower (black box) |
| Accuracy (subsonic) | Good for attached flow | Excellent |
| Separation/stall | ❌ Not modelled | ✅ Modelled |

For **educational purposes** where students need to see Cp distributions and understand pressure-based lift, the panel method is ideal. It runs fast enough for real-time interaction while teaching the fundamental physics.

---

## Validation Methodology

Every model is validated against published analytical or experimental data:

1. **Analytical validation** — flat-plate CL = 2πα (exact), cylinder Cp (exact), Prandtl-Glauert β (exact)
2. **Wind tunnel validation** — NACA 2412 vs NACA Report 824 (Abbott & Doenhoff 1959)
3. **Cross-validation** — panel method vs thin-airfoil theory vs vortex lattice
4. **Limiting cases** — Theodorsen C(0)=1, C(∞)=0.5; Wagner Φ(0)=0.5, Φ(∞)=1

The validation suite contains 55 aerodynamic tests, all passing.

---

## XFOIL Integration

The app connects to the UIUC Airfoil Database to provide 100+ real airfoil profiles. Users can search by name (Clark Y, Eppler 387, Wortmann, Selig, etc.), select an airfoil, and immediately see:
- Airfoil shape preview
- Cp distribution at any angle of attack
- Lift curve (panel method vs thin-airfoil theory)
- Theodorsen and Wagner unsteady analysis

All computed on-device — no server needed.

---

## What's Next

1. **Laminar-turbulent transition** — Adding boundary-layer transition prediction
2. **ESDU drag methods** — Industry-standard parasite drag estimation
3. **WebGPU compute** — Offloading panel method to GPU for 1000+ panels
4. **3D Cp visualization** — Rendering pressure fields on the 3D aircraft model

---

## Try It

**Live demo:** https://ojasvigoel598.github.io/FlightOps/

**Source:** https://github.com/ojasvigoel598/FlightOps

**Tests:** 145 passing, TypeScript strict mode, zero runtime errors.

---

*All aerodynamic models are original TypeScript implementations. No third-party source code was copied. See the project README for full provenance and references.*
