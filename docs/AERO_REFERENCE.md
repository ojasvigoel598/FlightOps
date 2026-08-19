# Aerodynamics Module — Research Reference & Provenance

This document records where the mathematics in `services/aero/` comes from,
how each piece was validated, and what its limitations are. It is written for
an aerospace-engineering student: enough theory to follow the code, and honest
about every claim made.

**Validation entry point:** `python3 scripts/validate_aero.py` — 66 checks,
all passing. The TypeScript modules are the production code; the Python script
ports the same algorithms so the mathematics can be checked against references
without a JS runtime.

---

## 1. Airfoil geometry — `services/aero/airfoil.ts`

- **Source:** Abbott & von Doenhoff, *Theory of Wing Sections* (1959) — the
  standard NACA 4-digit definition.
- **Construction:** mean camber line `y_c(x)` (two-parabola form), thickness
  `y_t(x)` from the classic polynomial, surface ordinates from the local
  slope angle `θ = atan(dy_c/dx)`.
- **Notable choice:** the thickness coefficient `0.1036` (closed-trailing-edge
  variant) instead of the classic `0.1015`. The classic value leaves
  `y_t(1) = +0.00126` — a trailing-edge gap that corrupts the panel method's
  Kutta condition. The closed variant forces `y_t(1) = 0` exactly and is the
  standard choice in computational panel codes.
- **Paneling:** cosine spacing clusters points at the leading and trailing
  edges (where the solution varies fastest). The polygon is closed and
  counter-clockwise (TE → upper → LE → lower → TE).
- **Validation:** chord, max thickness `t/2`, camber `y_c(0.4) = m`, symmetry,
  and `y_t(1) = 0` — all within tolerance.
- **Limitation:** NACA 4-digit geometry only (a design convenience, not a
  physics limitation).

## 2. Panel method — `services/aero/panel.ts`

- **Source:** Katz & Plotkin, *Low-Speed Aerodynamics*, 2nd ed. (2001),
  Chapter 11 — constant-strength **source** panels with a single unknown
  **vortex** strength shared by all panels, and a trailing-edge Kutta
  condition. This is the classical "source + vortex" formulation that makes
  the Kutta condition a *linear* constraint and keeps the system
  (N+1)×(N+1).
- **Boundary condition:** zero normal velocity at each panel midpoint
  (collocation point).
- **Kutta condition:** tangential velocity at the first and last (trailing
  edge) panels are equal and opposite.
- **Influence coefficients** (per panel, panel-local frame):

  ```
  S1 = 0.5 ln((s² + n²) / ((s−l)² + n²))        source, tangential
  N1 = atan2(n, s−l) − atan2(n, s)              source, normal
  ```

  The `atan2` **argument order** (n first) is the branch-safe form: the
  alternate orders produce spurious ±2π jumps for collocation points on the
  far side of a panel. The self-influence (collocation point) is set
  analytically: source normal `+σ/2`, vortex tangential `−γ/2` — the
  classical limits that a floating-point `n ≈ 0` would otherwise corrupt.
- **Rotation into the global frame:** each panel's local-frame influence is
  rotated by the receiver/source tangent dot/cross products (`D = t_i·t_j`,
  `C = t_i×t_j`). Dropping this rotation (a common simplification) produces
  spurious circulation; it is deliberately not used.
- **Solver:** Gauss–Jordan elimination with partial pivoting — deterministic,
  dependency-free, well within smartphone budget at N = 120 panels.
- **Validation (quantitative):**
  - **Circular cylinder** (exact potential-flow solution): min Cp = −2.997
    vs exact −3; stagnation Cp = 0.997 vs 1; CL = 0 to 1e-15; source
    distribution σ = −2cosθ (interior Neumann convention, documented in code).
  - **NACA 0012:** CL(0°) = 0 to 6e-17; CL(±5°) anti-symmetric to 1e-16;
    Kutta residual ~1e-16; stagnation Cp = 1 within 0.5%.
  - **NACA 2412:** zero-lift angle −2.14° vs −2.08° thin-airfoil theory.
  - **Cross-check:** the closed-form influence coefficients were verified
    against direct numerical quadrature of the source-sheet integrals to
    ~1e-15, and the whole solver reproduces the AeroPython lesson-11 result
    (CL = 0.506 at α = 4° on their naca0012 geometry) to 4 significant
    figures.
- **Known limitation (documented, not hidden):** constant-strength panels
  overpredict CL by ~10% at 5° (0.605 vs 0.548 thin-airfoil theory; XFOIL
  inviscid ≈ 0.55). The converged value is a genuine property of the
  constant-strength formulation — production codes use **linear-strength**
  (Hess–Smith) panels, which is the natural next upgrade. The cylinder and
  symmetry benchmarks pin down that the overprediction is not a sign,
  geometry, or assembly error.

## 3. Theodorsen's function — `services/aero/unsteady.ts`

- **Source:** Theodorsen, *General Theory of Aerodynamic Instability and the
  Mechanism of Flutter*, NACA Report 496 (1935).

  ```
  C(k) = H₁⁽²⁾(k) / (H₁⁽²⁾(k) + i·H₀⁽²⁾(k)),   k = ωb/U
  ```

  C(k) multiplies the quasi-steady circulatory lift for harmonic motion:
  |C| < 1 (the wake "deficits" the lift) with a phase lag.
- **Implementation:** Hankel functions of the second kind from Bessel J₀, J₁,
  Y₀, Y₁ power series (Abramowitz & Stegun 9.1.10–9.1.11). The series
  converge rapidly for the reduced-frequency range of interest (k ≤ 10) and
  the log-term cancellation in Yₙ is benign there. No external math library.
- **Limits (exact):** C(0) = 1 (quasi-steady), C(∞) → 1/2 (half the lift is
  lost at infinite frequency because the wake cannot develop). Both are
  enforced by the formulation itself, not by fudging.
- **Validation:** |C(k) − C_scipy| < 1e-16 across k using
  `scipy.special.hankel2` (the Bessel series also match `scipy.special`
  j0/j1/y0/y1 to ~1e-14 at every test point).

## 4. Wagner's function — `services/aero/unsteady.ts`

- **Source:** Wagner (1925) for the physics; R.T. Jones (1938) for the
  two-exponential approximation:

  ```
  w(s) = 1 − 0.165·e^(−0.0455 s) − 0.335·e^(−0.3 s),   s = Ut/b
  ```

  w(s) is the lift ratio after a step change in angle of attack:
  w(0) = 1/2 (half the lift appears instantly, the rest grows as the wake
  develops), w(∞) → 1.
- **Exact cross-validation:** the harness numerically inverts the *exact*
  Theodorsen C(k) to the exact Wagner function via

  ```
  w(s) = 1/2 + (1/π) ∫₀^∞ [ (Re C − 1/2)·sin(ks) + Im C·(cos ks − 1) ]/k dk
  ```

  Jones' approximation agrees with this exact inversion within ~0.6% at
  s = 0.1 … 5. Two exact identities fall out of the derivation and are
  checked in the harness: `∫₀^∞ Im C(k)/k dk = −π/4`, and the high-frequency
  constraint `C(∞) = 1/2` that forces the initial value w(0⁺) = 1/2.
- **Limitation:** Jones' approximation deviates from the exact function in a
  small neighborhood of s = 0 (the exact function has an infinite initial
  slope); it is accurate to ~1–2% elsewhere, which is why it is used in
  essentially every aeroelasticity textbook.

## 5. Prandtl numerical lifting-line — `services/aero/liftingLine.ts`

- **Source:** Prandtl (1918–19); Anderson, *Fundamentals of Aerodynamics*
  (5th ed.), ch. 5; Katz & Plotkin, *Low-Speed Aerodynamics* (2001), ch. 12.
  This is the Level-2 rung of the fidelity ladder: it takes a 2-D section
  polar (default thin-airfoil slope a₀ = 2π) and predicts the *finite wing*'s
  lift, induced drag, and spanwise loading — the bridge from airfoil to
  aircraft.
- **Formulation:** the bound circulation is expanded in a Fourier sine
  series over the span (wing tips excluded — the downwash integral is
  singular there):

  ```
  Γ(θ) = 2 b V Σ Aₙ sin(nθ),   y = (b/2) cos θ
  ```

  Substituting into the fundamental equation (section lift
  Γ = ½ a₀ c V α_eff, with the induced angle αᵢ = Σ nAₙ sin(nθ)/sin θ
  from the trailing vortex sheet) gives a linear system for Aₙ, solved by
  Gauss–Jordan elimination (the same solver as the panel method). Then

  ```
  C_L  = π AR A₁
  C_Di = π AR Σ n Aₙ²
  e    = A₁² / Σ n Aₙ²        (span efficiency; e = 1 is ideal)
  ```

  Planforms: rectangular, elliptical (exact), linearly tapered, plus linear
  washout twist.
- **Validation:** the elliptical wing is the exact analytic benchmark:
  e = 1, uniform downwash, C_L_alpha = a₀·AR/(AR+2) — matched to 1e-14.
  The rectangular AR = 6 result (e ≈ 0.954, C_Lα ≈ 4.53/rad) is reported
  as the **converged solution of the Prandtl integral equation**: the
  Fourier series is N-converged (N = 640 changes nothing below 1e-5) and
  an independent discrete horseshoe-vortex lifting line agrees within
  0.25%. It is deliberately *not* cited against a remembered textbook
  table. Symmetry (C_L(−α) = −C_L(α), even Fourier terms vanish), the
  AR → ∞ limit back to the 2-D slope 2π, and symmetric tip unloading
  under washout are all regression-checked.
- **Twist implementation note:** washout is a function of |y|, so the code
  uses |cos θ|. A plain cos θ is antisymmetric in θ — it would wash out one
  tip while washing in the other; the symmetric-loading regression check
  catches exactly that class of bug.
- **Limitation:** classical lifting-line assumes thin, straight,
  high-aspect-ratio wings in attached flow — no sweep, dihedral, thickness,
  viscosity, or compressibility. That is the documented scope of Level 2.

## 6. What is NOT implemented (honest scope)

- **Profile drag:** inviscid potential flow produces zero drag (d'Alembert's
  paradox), and no viscous/integral boundary layer exists yet. Induced drag
  *is* computed at the finite-wing level (inviscid C_Di from the lifting
  line), but profile drag C_D0 remains out of scope. This is a model
  limitation, not an omission error.
- **Moment coefficient C_M:** computable by pressure integration over the
  surface but not yet exposed in the UI.
- **Unsteady vortex / UVLM:** not implemented. For the current educational
  scope (harmonic and step responses of a rigid airfoil), the Theodorsen +
  Wagner pair is the correct, lightweight choice; a full UVLM would add
  wake-convection machinery with no benefit at this fidelity. A time-domain
  discrete-vortex wake is the natural future extension for large-amplitude
  or maneuvering cases.

## 7. Provenance & licensing

| Component | Source | Status |
|---|---|---|
| NACA 4-digit geometry | Abbott & von Doenhoff (1959) | Reimplemented from the published definition; original TS code |
| Source+vortex panel method | Katz & Plotkin (2001), ch. 11 | Reimplemented from the published equations; original TS code |
| Closed-form influence coefficients | Original derivation, verified against direct quadrature | Original engineering work |
| AeroPython (Barba Group) | MIT-licensed educational notebooks | Used **only as a validation cross-check**; no code copied; their published result reproduced independently |
| Theodorsen C(k) | NACA Report 496 (1935) | Reimplemented; Bessel series from A&S (public-domain formulas) |
| Wagner w(s) | Wagner (1925); R.T. Jones (1938) | Approximation implemented directly (published constants) |
| Numerical lifting-line | Prandtl (1918–19); Anderson ch. 5; Katz & Plotkin ch. 12 | Reimplemented from the published equations; original TS code; validated against the exact elliptical solution |
| scipy | BSD-3 | Dev-only validation harness (optional dependency) |

No external solver code was pasted into the project. Every algorithm is
implemented in original TypeScript, and the validation harness reproduces the
published reference results independently.

## 8. Reproducibility

1. `python3 scripts/validate_aero.py` — full 66-check validation (scipy
   optional; skip messages appear if absent).
2. `npm run web` — run the app; the Aero Lab tab exercises every module.
3. The Bessel series, influence coefficients, Fourier lifting-line system,
   and transform identities are written out explicitly in the code headers
   so each can be verified by hand.

## 9. Future improvements (ranked)

1. **Linear-strength (Hess–Smith) panels** — removes the ~10% CL
   overprediction (P0 physics-accuracy).
2. **Vortex Lattice Method (VLM, Level 3)** — multiple lifting surfaces,
   sweep, dihedral, tail interference; the natural extension of the
   lifting-line module.
3. **C_M and pressure integration over the surface** — small, well-defined.
4. **Küssner gust response** — same transform machinery as Wagner.
5. **Time-domain discrete-vortex wake** — large-amplitude / maneuver case.
