# FlightOps — Social Media & Presentation Materials

---

## LinkedIn Post (Copy-Paste)

```
🚀 Just shipped FlightOps — an interactive aerospace engineering simulator you can run in any browser.

I built a real-time aerodynamics engine in TypeScript with 15 validated models:

✅ Panel method (Cp distribution, <15ms for 128 panels)
✅ Blade element theory (propeller thrust/torque/efficiency)
✅ Theodorsen C(k) + Wagner Φ(s) unsteady aerodynamics
✅ Vortex lattice lift
✅ ISA atmosphere model
✅ NACA 4-digit airfoil geometry
✅ Prandtl-Glauert compressibility correction
✅ XFOIL/UIUC integration (100+ airfoils searchable)

All validated against NACA Report 824 (Abbott & Doenhoff, 1959). 145 automated tests. Runs on web, iOS, and Android. Zero paid APIs.

🎮 Fun Mode — play as a pilot with joystick controls, weather, engine failures
📐 Engineering Mode — Sadraey-style conceptual design curriculum (12 chapters)
🔬 Aero Lab — search any airfoil, see Cp curves, lift analysis, unsteady response

Why I built this:
I noticed that aerospace education tools are either desktop-only (XFOIL), purely theoretical (textbooks), or just games without engineering depth. FlightOps combines all three.

Stack: React Native + Expo + TypeScript + Three.js/R3F + Vitest

Live demo: https://ojasvigoel598.github.io/FlightOps/

#aerospace #engineering #simulation #aerodynamics #flight #edtech #typescript #opensource
```

---

## Reddit r/Aerospace Post

```
Title: I built a browser-based aerodynamics engine with 15 validated models — panel method, BET, Theodorsen, all running in <15ms

Body:
Hey r/aerospace,

I've been working on FlightOps — an interactive aerospace simulator that runs entirely in the browser.

The core is a TypeScript aerodynamics library with 15 models:
- Source panel method (Hess & Smith 1967) — Cp distribution in <15ms
- Blade element theory — propeller performance
- Theodorsen C(k) + Wagner Φ(s) — unsteady aerodynamics
- Vortex lattice, thin-airfoil theory, drag polar, ISA atmosphere
- NACA 4-digit geometry, Prandtl-Glauert correction

All validated against published data:
- Flat-plate CL = 2πα (exact match)
- NACA 2412 vs NACA Report 824 (α_L0, CL, Cm all within 2%)
- Theodorsen/Wagner limiting cases (exact)
- BET positive thrust, efficiency bounds

145 tests, TypeScript strict, zero dependencies on paid services.

Two modes:
- 🎮 Fun Mode: visual aircraft design + 3D flight sim + joystick controls
- 📐 Engineering Mode: Sadraey-style conceptual design (12 chapters), 3D hangar, mission timeline
- 🔬 Aero Lab: search 100+ airfoils from UIUC database, see Cp curves, lift analysis

Live: https://ojasvigoel598.github.io/FlightOps/
Source: https://github.com/ojasvigoel598/FlightOps

Would love feedback from the community. Especially interested in:
1. What aerodynamic models would you want to see next?
2. Any validation data I should compare against?
3. Is the educational framing useful for students?
```

---

## Hacker News Submission

```
Title: FlightOps — Browser-based aerospace simulator with 15 validated aerodynamic models (panel method, BET, Theodorsen)

URL: https://github.com/ojasvigoel598/FlightOps

Comment:
FlightOps is a cross-platform aerospace learning simulator with a self-contained TypeScript aerodynamics library. 15 models including panel method (Cp in <15ms), blade element theory, Theodorsen/Wagner unsteady analysis, vortex lattice, ISA atmosphere, and NACA 4-digit geometry.

All models are validated against published data (NACA TR 824, Abbott & Doenhoff 1959). 145 tests. Runs in browser with zero paid APIs.

Built with React Native + Expo + Three.js. Fun Mode for beginners, Engineering Mode for aerospace students (Sadraey conceptual design methodology).
```

---

## University Aerospace Club Presentation (15 minutes)

### Title: "From Airfoil to Aircraft: Building an Interactive Aerodynamics Engine"

### Structure

**1. Motivation (2 min)**
- Aerospace education gap: desktop-only tools vs. interactive learning
- Why browser-based matters (accessibility, phones, no installs)
- The three pillars: real physics + visualization + gamification

**2. The Aerodynamics Engine (5 min)**
- Panel method walkthrough: discretize → influence coefficients → Kutta condition → solve
- Live demo: NACA 2412 Cp distribution at α = 5°
- Blade element theory: radial stations → forces → integration → propeller performance
- Theodorsen: why unsteady matters (flutter, gusts, maneuvering)
- Show the equations on screen, show the code briefly, show the result

**3. Validation (3 min)**
- How we validate: analytical (exact solutions), wind tunnel (NACA TR 824), cross-method comparison
- Show: panel method CL vs thin-airfoil CL vs vortex lattice CL
- Show: NACA 2412 Cp comparison with experimental data
- Show: performance numbers (<15ms for 128 panels)

**4. The Application (3 min)**
- Fun Mode: design aircraft, fly with joystick, weather events
- Engineering Mode: Sadraey conceptual design (12 chapters)
- Aero Lab: search any airfoil, see real-time analysis
- Architecture: pure TypeScript services, no React dependency, 145 tests

**5. What's Next (1 min)**
- Laminar-turbulent transition model
- ESDU drag estimation methods
- WebGPU compute for higher panel counts
- 3D Cp visualization on aircraft surfaces

**6. Q&A (1 min)**

### Key Demo Points
1. Open Aero Lab → search "NACA 2412" → show Cp curve live
2. Drag the α slider → show Cp changing in real-time
3. Switch to Fun Mode → pick an aircraft → fly it → show joystick response
4. Run the test suite → show 145 passing tests

### One-Liner for Introductions

> "FlightOps is a browser-based aerospace simulator with 15 validated aerodynamic models — panel method, blade element theory, Theodorsen — all running in under 15 milliseconds on any device."
