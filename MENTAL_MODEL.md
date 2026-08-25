# FlightOps — Engineering Mental Model

> For readers with aerospace/physics background but zero coding experience.
> Every code concept is translated: **CODE → MATHEMATICS → PHYSICS → AEROSPACE THEORY → ENGINEERING PURPOSE**.

---

## The Big Picture

```
Pilot input (keyboard/touch)
        ↓
Flight controls (elevator, aileron, rudder, throttle)
        ↓
Aircraft state (position, velocity, orientation, angular rates)
        ↓
Atmosphere model (density, temperature, speed of sound at altitude)
        ↓
Aerodynamics (lift, drag, moments from airfoil + wing geometry)
        ↓
Propulsion (thrust from engine model, fuel burn)
        ↓
Forces & moments → Newton/Euler equations → accelerations
        ↓
Numerical integration (Euler forward step) → new state
        ↓
Telemetry recorded each frame
        ↓
AI/ML analysis (anomaly detection, classification)
        ↓
Warnings, explanations, decisions → operator
        ↓
3D visualisation + audio
```

This loop runs **60 times per second**. Each cycle is one timestep of the flight simulation.

---

## 1. ATMOSPHERE — ISA Model

### What it is
The International Standard Atmosphere (ISA) defines how air properties change with altitude.

### Why it exists
Aircraft performance depends on air density. A wing at 10,000m produces less lift than at sea level because the air is thinner. You MUST model this or the simulation is wrong.

### The equations
```
Temperature:  T = T₀ − L × h          (for h < 11,000m)
Pressure:     P = P₀ × (T/T₀)^(g/(R×L))
Density:      ρ = ρ₀ × (T/T₀)^(g/(R×L) − 1)
Speed of sound: a = √(γ × R × T)
```

**FlightOps uses a simplified exponential:**
```
ρ = 1.225 × e^(−h/8500)
```

### What this means physically
- At sea level: ρ = 1.225 kg/m³
- At 11,000m: ρ ≈ 0.364 kg/m³ (70% less air)
- Less air → less lift → must fly faster or use bigger wing
- Less air → less drag → jet engines more efficient at altitude (up to a point)

### Where in code
`services/aerodynamics.ts` — `isaAtmosphere(altitudeM)`

### What would happen without it
The aircraft would fly identically at sea level and at 40,000ft. That's completely wrong — real aircraft have a "service ceiling" where they simply cannot climb higher because the air is too thin.

---

## 2. AERODYNAMICS — Lift and Drag

### What they are
- **Lift (L):** The aerodynamic force perpendicular to the airflow that holds the aircraft up
- **Drag (D):** The aerodynamic force parallel to the airflow that resists forward motion

### The fundamental equations
```
L = ½ × ρ × V² × S × CL
D = ½ × ρ × V² × S × CD
```

**Variables:**
| Symbol | Meaning | Units |
|--------|---------|-------|
| ρ | Air density | kg/m³ |
| V | True airspeed | m/s |
| S | Wing reference area | m² |
| CL | Lift coefficient (dimensionless) | — |
| CD | Drag coefficient (dimensionless) | — |

### What CL and CD mean physically
CL and CD are **not constants** — they change with:
- **Angle of attack (α):** CL increases linearly with α up to the stall angle (~12-16°), then drops sharply
- **Mach number:** Compressibility effects change the flow pattern
- **Reynolds number:** Viscous effects change boundary layer behavior

### The drag polar
```
CD = CD₀ + k × CL²
```
- **CD₀:** Zero-lift drag (parasite drag from friction, form drag)
- **k × CL²:** Induced drag (drag due to producing lift — wingtip vortices)
- **k = 1/(π × AR × e):** where AR = b²/S (aspect ratio), e = Oswald efficiency

### Stall model
FlightOps uses a **quadratic CL(α) curve**:
```
For |α| < α_stall:  CL = CL_max × sin(2α) / sin(2α_stall)
For |α| > α_stall:  CL = CL_max × (1 − ((α−α_stall)/(90−α_stall))² × 0.8)
```

This means:
- CL peaks at α_stall (~14°)
- CL doesn't drop to zero immediately — it retains ~20% at deep stall
- This is physically realistic: in deep stall the wing still has some lift, just much less

### Where in code
`services/aerodynamics.ts` — `computeLift()`, `computeDrag()`, `computeCL()`

### What would happen without it
No lift = no flight. The aircraft falls like a rock. No drag = the aircraft accelerates forever. No stall = you could fly at 90° angle of attack (impossible in reality).

---

## 3. ANGLE OF ATTACK — The Most Important Variable

### What it is
The angle between the wing's chord line and the oncoming airflow.

### The equation (correctly implemented)
```
α = θ − γ
```
where:
- θ = pitch angle (where the nose points relative to horizontal)
- γ = flight path angle (where the aircraft is actually going)

### Why this matters
α is the **single most important variable in aerodynamics**. It determines:
- How much lift the wing produces
- Whether the wing is stalled
- How much drag there is
- Whether the aircraft is stable or unstable

### Common mistake
Many simulators use α = θ (ignoring γ). This is WRONG. An aircraft can have θ = 10° (nose up) but γ = −5° (descending) → α = 15°. If you use α = θ, you get α = 10°, which is a 5° error — enough to miss the stall boundary.

### FlightOps implementation
FlightOps correctly computes α = θ − γ and uses it for all aerodynamic calculations.

---

## 4. PROPULSION — Thrust and Fuel Burn

### What it is
The engine converts fuel energy into thrust (a forward force).

### Jet engine model
```
T = T_max × (ρ / ρ₀) × throttle
```
- Thrust scales linearly with density (less air = less thrust)
- At altitude, jet engines lose thrust proportionally

### Propeller engine model
```
T = T_static × (ρ / ρ₀) × η_prop × throttle
```
- η_prop = propeller efficiency (typically 0.75-0.85)
- Propeller efficiency depends on advance ratio J = V/(n×D)

### Blade Element Momentum Theory (BEMT)
FlightOps implements BEMT for propeller analysis:
```
For each radial station r/R:
  φ = atan(V_axial / (Ω × r))          # inflow angle
  α_blade = φ − θ_twist                 # local angle of attack
  dL = ½ρ W² c Cl(α_blade) × 2πr dr    # lift on blade element
  dD = ½ρ W² c Cd(α_blade) × 2πr dr    # drag on blade element
  dT = dL cos(φ) − dD sin(φ)            # thrust contribution
  dQ = r × (dL sin(φ) + dD cos(φ))      # torque contribution
```

**With Prandtl tip-loss correction:**
```
F = (2/π) × arccos(exp(−f))
where f = (N/2) × ((R−r)/(r × sin(φ_tip)))
```

This accounts for the fact that at the blade tip, air "leaks" around the edge, reducing the effective lift. Without this correction, predicted thrust at the tip would be ~30% too high.

### Fuel burn
```
Fuel flow = T × SFC     (for jets)
Fuel flow = P × SFC     (for props)
```
where SFC = Specific Fuel Consumption (kg/(N·s) for jets, kg/(W·s) for props)

As fuel burns, **aircraft mass decreases:**
```
mass(t) = dry_mass + fuel_remaining(t)
```
This is physically critical: a Boeing 747 burns ~100,000 kg of fuel on a long-haul flight. Its takeoff weight is ~400,000 kg. By landing, it weighs 25% less. This changes stall speed, turn radius, and fuel efficiency.

### Where in code
`services/aerodynamics.ts` — BEM propeller model
`services/aero/engineering.ts` — `breguetRange()`, `raymerWeightBuildup()`

---

## 5. EQUATIONS OF MOTION — How the Aircraft Moves

### Newton's Second Law (translation)
```
ΣF = m × a
```

**Along the flight path:**
```
m × (dV/dt) = T − D − W × sin(γ)
```
- T = thrust (forward)
- D = drag (backward)
- W × sin(γ) = weight component along flight path (gravity effect)

**Perpendicular to flight path:**
```
m × V × (dγ/dt) = L − W × cos(γ)
```
- L = lift (upward relative to airflow)
- W × cos(γ) = weight component perpendicular to flight path
- If L = W × cos(γ) → γ doesn't change → level flight
- If L > W × cos(γ) → γ increases → aircraft climbs (in terms of flight path)

### Euler's Rotational Equations
```
I_x × (dp/dt) = L_roll − (I_z − I_y) × q × r     # roll
I_y × (dq/dt) = M_pitch − (I_x − I_z) × p × r     # pitch
I_z × (dr/dt) = N_yaw − (I_y − I_x) × p × q       # yaw
```

Where:
- p, q, r = roll, pitch, yaw rates (rad/s)
- I_x, I_y, I_z = moments of inertia about each axis
- L_roll, M_pitch, N_yaw = aerodynamic moments

FlightOps **does implement** these equations (after the fixes we made). The previous version had artificial damping that killed real dynamics — we removed it.

### Numerical integration
```
New state = Old state + derivative × Δt
```
This is **forward Euler integration** — simple but effective for 60fps game loop where Δt ≈ 0.0167s.

### Where in code
`components/FunMode.tsx` — flight loop step

---

## 6. PANEL METHOD — Pressure Distribution

### What it is
A numerical method to calculate how air flows around an airfoil and what the pressure distribution looks like.

### How it works (physically)
1. Divide the airfoil surface into N small flat panels
2. Place a **source** and **vortex** on each panel
3. Enforce the **flow-tangency condition:** air must flow along the surface, not through it
4. This creates a system of N linear equations: **A × σ = b**
5. Solve for source strengths σ
6. Calculate velocity from source strengths
7. Calculate pressure from velocity using **Bernoulli's equation:**
   ```
   Cp = 1 − (V/V∞)²
   ```

### What Cp means
- Cp = 1: stagnation point (air stops completely, pressure is maximum)
- Cp < 0: suction (pressure below freestream — this is where lift comes from)
- Cp on upper surface is typically more negative than lower surface → net upward force = lift

### Why panel method
It's **fast** (< 50ms for 128 panels) and **accurate for inviscid flow**. It captures pressure distribution correctly but misses viscous effects (skin friction, boundary layer separation). For preliminary design, this is the standard tool — XFOIL, AVL, and OpenVSP all use panel methods as their core.

### Where in code
`services/aero/panel.ts` — full source + vortex panel method (Katz & Plotkin formulation)

---

## 7. LIFTING LINE THEORY — 3D Wing Effects

### What it is
Extends 2D airfoil theory to a 3D finite wing. Accounts for the fact that a real wing has tips where air "leaks" from bottom to top, creating wingtip vortices.

### The physics
A 2D (infinite) wing has no induced drag. A 3D wing does, because the pressure difference at the tips creates vortices that deflect the airflow downward (downwash), effectively reducing the angle of attack.

### Prandtl's lifting line equation
```
α_eff = α_geometric − α_induced
α_induced = w / V∞    (downwash angle)
```

**Induced drag:**
```
CD_i = CL² / (π × AR × e)
```

This is one of the most important equations in aerodynamics. It tells you:
- Higher aspect ratio (longer, narrower wing) → less induced drag
- Higher CL (more lift) → more induced drag (quadratically!)
- Gliders have very high AR (20-40) to minimize induced drag
- Fighter jets have low AR (3-4) for maneuverability, accepting more induced drag

### Where in code
`services/aero/liftingLine.ts` — Prandtl numerical lifting-line theory

---

## 8. UNSTEADY AERODYNAMICS — Dynamic Response

### What it is
When the aircraft changes angle of attack suddenly (gust, rapid maneuver), the lift doesn't respond instantly. The wake behind the wing takes time to develop.

### Theodorsen's theory
The lift deficiency function C(k):
```
C(k) = H₁⁽²⁾(k) / (H₁⁽²⁾(k) + iH₀⁽²⁾(k))
```
where k = ωb/(2V) is the reduced frequency.

**Physical meaning:**
- At k → 0 (slow maneuver): C → 1 (quasi-steady, full lift)
- At k → ∞ (fast maneuver): C → 0.5 (only 50% of steady-state lift)
- The wing produces only half the expected lift during very rapid maneuvers

### Wagner's function (step response)
```
Φ(s) = 1 − 0.165 × e^(−0.0455s) − 0.335 × e^(−0.3s)
```
where s = 2Vt/c (dimensionless time)

**Physical meaning:** After a sudden change in α:
- At t = 0: lift is only 50% of final value
- Lift grows exponentially to 100% over ~5 chord lengths of travel
- This is why rapid pull-ups are less effective than gradual ones

### Where in code
`services/aero/unsteady.ts` — Theodorsen C(k), Wagner Φ(s), Duhamel superposition

---

## 9. FLIGHT OPERATIONS — State Machine

### What it is
A state machine that manages the phases of a flight, from preflight checks to landing.

### The phases
```
PREFLIGHT → ENGINE_START → TAXI → TAKEOFF_ROLL → LIFTOFF → CLIMB
    → CRUISE → DESCENT → APPROACH → FLARE → TOUCHDOWN → ROLLOUT → COMPLETE
```

### Each phase defines:
- **Objective:** What the aircraft should be doing (e.g., CLIMB: gain altitude at best rate)
- **Controls:** What inputs are available (e.g., TAKEOFF_ROLL: full throttle, no pitch)
- **Transition conditions:** When to move to next phase (e.g., liftoff when V > V_r)
- **Physics modifiers:** Phase-specific effects (e.g., ground effect near runway, gear drag when extended)

### Where in code
`services/flight-state-machine.ts`

---

## 10. STABILITY AND CONTROL

### Static stability
An aircraft is statically stable if, when disturbed, it tends to return to its original state.

**Longitudinal (pitch) stability:**
```
dCm/dα < 0     (negative slope → nose drops when α increases)
```

**Directional (yaw) stability:**
```
dCn/dβ > 0     (positive → nose returns when sideslip occurs)
```

### Stability derivatives
FlightOps computes the key stability derivatives:
| Derivative | Meaning | What it tells you |
|------------|---------|-------------------|
| CL_α | Lift curve slope | How much lift changes per degree of α |
| Cm_α | Pitch stiffness | Whether the aircraft is pitch-stable |
| Cm_q | Pitch damping | How quickly pitch oscillations die out |
| Cn_β | Weathercock stability | Whether the aircraft yaws into the wind |
| Cl_β | Dihedral effect | Whether the aircraft rolls into a sideslip |
| Cl_p | Roll damping | How quickly roll oscillations die out |

### Dynamic modes (eigenvalue analysis)
FlightOps linearizes the equations of motion and computes eigenvalues to identify dynamic modes:

| Mode | Period | Damping | What it looks like |
|------|--------|---------|-------------------|
| Short-period | 1-3s | High | Quick pitch bounce |
| Phugoid | 30-100s | Low | Slow altitude-speed exchange |
| Dutch roll | 2-4s | Medium | Coupled yaw-roll oscillation |
| Spiral | 10-30s | Very low | Slow bank-heading divergence |
| Roll subsidence | <1s | Very high | Quick roll rate decay |

### Where in code
`services/aero/stability.ts` — `computeStabilityDerivatives()`, `computeEigenvalues()`

---

## 11. FAILURES AND EVENTS

### Engine failure
**Real physics:** When an engine fails, thrust drops to zero (or partial for multi-engine). The asymmetric thrust (in multi-engine) creates a yawing moment.

**FlightOps:** Engine failure reduces thrust by a percentage. The pilot must yaw into the operating engine and maintain altitude with remaining thrust.

### Icing
**Real physics:** Ice accretion on wing changes the airfoil shape → reduces CL_max, increases CD. Critical icing occurs in visible moisture at temperatures between −20°C and 0°C.

**FlightOps:** Icing applies a progressive penalty to CL_max and CD₀.

### Stall
**Real physics:** When α exceeds the critical angle, the boundary layer separates from the upper surface → CL drops dramatically → aircraft sinks.

**FlightOps:** CL follows the quadratic stall curve described above.

---

## 12. AI/ML COMPONENTS

### Anomaly Detection
FlightOps uses **statistical thresholds** for anomaly detection, not neural networks.

For each telemetry parameter (RPM, temperature, fuel flow, vibration):
```
Anomaly if: |x − μ| > k × σ
```
where μ = running mean, σ = running standard deviation, k = sensitivity factor.

**This is simple but effective** — it's the same principle behind control charts in manufacturing quality control.

### Where AI ends and physics begins
| Component | Classification |
|-----------|---------------|
| Lift, drag, thrust, acceleration | **PHYSICS-derived** (equations) |
| Anomaly score | **STATISTICAL** (threshold-based) |
| "Low fuel" warning | **RULE-derived** (if fuel < threshold) |
| LLM explanation | **GENERATIVE AI** (text generation) |
| 3D aircraft animation | **VISUAL** (rendering) |

**Critical safety point:** AI in FlightOps is **advisory only**. It never controls the aircraft. The physics engine runs independently. If the AI makes a wrong prediction, the aircraft still responds to physics correctly.

---

## 13. WHAT IS ACTUALLY REALISTIC vs SIMPLIFIED

| Subsystem | Realism Level | Notes |
|-----------|--------------|-------|
| ISA atmosphere | **REAL PHYSICS** | Standard exponential model |
| Lift/drag forces | **ENGINEERING APPROXIMATION** | Linear CL, quadratic drag polar — accurate for attached flow |
| Stall | **SIMPLIFIED MODEL** | Quadratic drop, no hysteresis |
| Panel method | **REAL PHYSICS** | inviscid — captures pressure distribution accurately |
| Lifting line | **REAL PHYSICS** | Prandtl's theory — industry standard for preliminary design |
| BEM propeller | **REAL PHYSICS** | Industry standard method with tip-loss correction |
| Theodorsen/Wagner | **REAL PHYSICS** | Classical unsteady aero theory |
| Stability derivatives | **ENGINEERING APPROXIMATION** | Linearized — accurate near trim, less so at large disturbances |
| Eigenvalue modes | **ENGINEERING APPROXIMATION** | Requires linearization — valid for small perturbations |
| Weight buildup | **SIMPLIFIED MODEL** | Raymer statistical — good for concept phase, not detailed design |
| Shock calculators | **REAL PHYSICS** | Exact normal/oblique shock relations |
| Prandtl-Meyer | **REAL PHYSICS** | Exact isentropic expansion |
| Flight state machine | **GAME MECHANIC** | Discrete phases — real flights are continuous |
| Anomaly detection | **SIMPLIFIED MODEL** | Statistical thresholds — effective but not ML |
| 3D visualisation | **VISUAL EFFECT** | Not physics — aesthetic only |

---

## 14. THE 10 MOST IMPORTANT EQUATIONS

| # | Equation | What it does | Why it matters |
|---|----------|-------------|----------------|
| 1 | L = ½ρV²S×CL | Wing lift | Without this, nothing flies |
| 2 | D = ½ρV²S×CD | Wing drag | Determines fuel burn and speed |
| 3 | CD = CD₀ + k×CL² | Drag polar | Shows the lift-drag tradeoff |
| 4 | α = θ − γ | Angle of attack | The most important aerodynamic variable |
| 5 | F = ma | Newton's 2nd law | How forces become motion |
| 6 | ρ = 1.225×e^(−h/8500) | Atmosphere | Why aircraft perform differently at altitude |
| 7 | CD_i = CL²/(π×AR×e) | Induced drag | Why gliders have long thin wings |
| 8 | R = (V/SFC)×(L/D)×ln(W_i/W_f) | Breguet range | How far an aircraft can fly |
| 9 | Cp = 1 − (V/V∞)² | Bernoulli pressure | How lift relates to pressure difference |
| 10 | δe = −(Cm₀ + Cmα×α)/Cmδe | Trim | What elevator angle keeps you level |

---

## 15. DATA FLOW — One Complete Flight Cycle

### TAKEOFF
1. **Inputs:** Full throttle, stick neutral
2. **Physics:** T > D + W×sin(γ), aircraft accelerates along runway
3. **Lift:** As V increases, L = ½ρV²S×CL grows. When L > W, aircraft lifts off
4. **Telemetry:** V, α, L, D, T, fuel flow recorded each frame
5. **AI:** Monitoring RPM, temperature for anomalies

### CLIMB
1. **Inputs:** Reduced throttle, nose up ~10°
2. **Physics:** L > W×cos(γ), γ increases → aircraft gains altitude
3. **Atmosphere:** ρ decreases → must increase V to maintain L
4. **Fuel:** Engine burning fuel → mass decreasing → less lift needed

### CRUISE
1. **Inputs:** Balanced throttle, trim for level flight
2. **Physics:** L = W, T = D, γ = 0, α = trim angle
3. **Optimization:** Best range at max L/D → minimum fuel per km
4. **Breguet:** R = (V/SFC)×(L/D)×ln(W_start/W_end)

### FAILURE (e.g., engine failure)
1. **Event:** Engine output drops to 0
2. **Physics:** T = 0, D > 0 → aircraft decelerates and descends
3. **Pilot response:** Lower nose to maintain airspeed (trade altitude for speed)
4. **AI detection:** Statistical threshold detects RPM drop
5. **Warning:** "ENGINE FAILURE — maintain V_min"

### APPROACH & LANDING
1. **Inputs:** Reduced throttle, flaps extended, gear down
2. **Physics:** Flaps increase CL_max → lower stall speed for approach
3. **Ground effect:** Within 1 wingspan of ground, induced drag decreases → "float"
4. **Touchdown:** When h → 0, weight transfers from wings to wheels
5. **Rollout:** Brakes + reverse thrust decelerate aircraft

---

*All aerodynamic models are original TypeScript implementations. No third-party source code was copied. See `docs/RESEARCH.md` for full provenance.*
