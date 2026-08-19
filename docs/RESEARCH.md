# Research & Provenance — Flight Ops Aerodynamics

This document records the scientific basis of the aerodynamic models in this
repository, the research that informed them, the provenance of every
algorithm, and the validation performed. It is written to be understandable
by an aerospace-engineering student while remaining technically rigorous.

Everything here is either **original engineering work** (clearly marked) or
**adapted from published research** with a primary source cited. Nothing is
claimed to be validated that was not actually validated (see
`tests/aerodynamics.test.ts`, `tests/unsteady.test.ts`,
`tests/unsteady-vortex.test.ts`).

---

## 1. Scope

Two coupled modules implement the linear-aerodynamics tool:

- `services/aerodynamics.ts` — steady models: ISA atmosphere, dynamic
  pressure/Mach/Reynolds, NACA 4-digit geometry, constant-strength **source
  panel method** (non-lifting Cp), 2D **vortex lattice** (lifting CL), thin
  airfoil theory (α_L0), parabolic drag polar, and velocity-field evaluation.
- `services/unsteady.ts` — unsteady models: Bessel functions, **Theodorsen
  C(k)**, the **Wagner function** Φ(s) (Jones, Garrick and exact), Theodorsen
  harmonic lift (plunge/quarter-chord pitch), and **Duhamel superposition**.
- `services/unsteady-vortex.ts` — a **discrete unsteady vortex-panel method**
  (camber-line bound vortices + Kelvin-shed wake), the numerical counterpart
  of Wagner's theory.

All quantities are SI; angles are degrees at API boundaries, radians
internally; coordinates are normalised by chord; CL/CD use the 2D section
convention (reference length = chord).

---

## 2. Mathematical foundations and model hierarchy

```
Laplace equation (incompressible, irrotational potential flow)
   └── superposition of elementary solutions (sources, vortices, doublets)
         ├── Source panel method (Hess & Smith 1967)     → non-lifting Cp
         ├── Vortex lattice (Kutta condition)            → CL, α_L0
         └── Unsteady thin-airfoil theory
               ├── Theodorsen C(k) (1935)   → frequency domain
               ├── Wagner Φ(s) (1925)       → time domain (indicial)
               │     └── Garrick pair (1938): C(k) ↔ Φ(s) (Fourier/Laplace)
               └── Discrete vortex wake (Katz & Plotkin ch. 13.6)
```

**Assumptions** (the same everywhere, surfaced as warnings in the UI):

1. Incompressible potential flow — valid for M ≲ 0.3 (compressibility
   warning above).
2. Small angles, attached flow — linear lift valid for |α| ≲ 15°; the
   solver rejects |α| > 30°.
3. Thin airfoil / flat wake — the unsteady wake convects at the freestream
   speed without transverse motion (the classical Wagner-theory assumption).
4. 2D section model — finite-wing effects enter only through the
   induced-drag factor k = 1/(πeAR).

---

## 3. Steady panel method (provenance and formulation)

**Source:** J. L. Hess and A. M. O. Smith, "Calculation of potential flow
about arbitrary bodies", *Progress in Aerospace Sciences* 8:1–138, 1967.
DOI: 10.1016/0376-0421(67)90003-6.

Formulation implemented (constant-strength sources; non-lifting):

- Panels along the body polygon; cosine spacing concentrates panels at the
  leading edge.
- Flow tangency enforced at each panel midpoint (control point):
  `Σ_j A_ij σ_j = −V∞·n_i`, with `A_ij` the normal velocity at control
  point `i` induced by a unit source panel `j` (Katz & Plotkin, *Low-Speed
  Aerodynamics*, 2nd ed., §11.3; self-influence evaluated just off the panel,
  exterior side, matching the Hess–Smith jump condition).
- Cp = 1 − (V_t/V∞)² from the tangential velocity at each control point.

**Validation:** circular-cylinder Cp against the exact doublet solution
Cp = 1 − 4sin²θ to ~1e-9; stagnation-point recovery; airfoil Cp finite and
bounded. (Tests: `tests/aerodynamics.test.ts`.)

The **2D vortex lattice** (bound vortices at the quarter-chord of each
chordwise panel, control points at the three-quarter-chord — the rear neutral
point) recovers the thin-airfoil lift slope: CL = 2π·α·N/(N+1) → 2πα, and
gives the correct zero-lift angles for cambered sections (NACA 2412 ≈ −2.08°,
4412 ≈ −4.15°, 23012 ≈ −1.5°).

**Related educational implementation consulted (not copied):**
L. A. Barba and O. Mesnard, "AeroPython: classical aerodynamics of potential
flow using Python", *Journal of Open Source Education* 2(15):45, 2019.
DOI: 10.21105/jose.00045 (code BSD-3-Clause, content CC-BY 4.0). The
vortex-source panel method for lifting bodies in Lesson 11 confirmed the
quarter/three-quarter-chord placement and the sign conventions; our
implementation is original TypeScript.

---

## 4. Unsteady theory

### 4.1 Theodorsen function C(k)

**Source:** T. Theodorsen, "General Theory of Aerodynamic Instability and the
Mechanism of Flutter", NACA Report No. 496, 1935.

```
C(k) = H₁⁽²⁾(k) / [H₁⁽²⁾(k) + i·H₀⁽²⁾(k)],   k = ω·b/V (b = c/2)
F(k) = [J₁(J₁+Y₀) + Y₁(Y₁−J₀)] / [(J₁+Y₀)² + (J₀−Y₁)²]
G(k) = −[Y₁Y₀ + J₁J₀] / [(J₁+Y₀)² + (J₀−Y₁)²]
```

- `Bessel functions`: power series for x ≤ 8 (A&S 9.1.10–9.1.14), asymptotic
  expansions for x > 8 (A&S 9.2.5–9.2.11, six-term P/Q polynomials).
- **Validation:** Wronskian J₁Y₀ − J₀Y₁ = 2/(πx) to ~1e-9; published zeros
  (J₀: 2.4048255577, J₁: 3.8317059702, Y₀: 0.8935769663, Y₁: 2.1971413260);
  reference values at x = 10; exact limits C(0) = 1, C(∞) = 1/2; monotone
  |C|; the classical table value C(0.5) ≈ 0.5979 − 0.1507i; the small-k
  behaviour 1 − F ≈ (π/2)k with G ≈ −k·ln(k/2) (checked against the
  numerically-converged trend).
- The phase of C(k) is bounded by ≈ −14.5° (circulatory lag).

### 4.2 Wagner function Φ(s)

**Sources:** H. Wagner, "Über die Entstehung des dynamischen Auftriebes von
Tragflügeln", *Z. Angew. Math. Mech.* 5(1):17–35, 1925.
DOI: 10.1002/zamm.19250050103. R. T. Jones, "The Unsteady Lift of a Wing of
Finite Aspect Ratio", NACA TR 681, 1940 (two-exponential approximation).
I. E. Garrick, "On Some Reciprocal Relations in the Theory of Nonstationary
Flows", NACA TR 629, 1938 (Fourier pair + algebraic approximation).

Implemented forms (s = 2Vt/c):

- **Jones:** Φ(s) = 1 − 0.165·e^(−0.0455s) − 0.335·e^(−0.3s) — the standard
  engineering approximation (max abs error < 1%, Dawson & Brunton 2021).
- **Garrick:** Φ(s) = 1 − 2/(4+s) — correct algebraic large-s decay, max
  abs error < 2%.
- **Exact:** numerical Fourier inversion of the Garrick pair (Peters'
  integral, recommended by S. T. M. Dawson and S. L. Brunton, "Improved
  approximations to the Wagner function using sparse identification of
  nonlinear dynamics", arXiv:2104.15122, 2021):

  ```
  Φ(s) = 1 + (2/π)∫₀^∞ [(F(k) − 1)/k]·sin(ks) dk
  ```

  evaluated with adaptive Simpson over half-periods, truncated at K·s = 3200
  (tail bound |∫_K^∞ (F−1)/k·sin(ks)dk| ≤ 1/(πKs)).

- **Validation anchors for the exact function:** Φ(0⁺) = 1/2 and Φ(∞) = 1
  (exact limits); the von Kármán–Sears small-time series
  Φ ≈ 1/2 + s/8 − s²/32 + 7s³/768 (Sears 1938) at s = 0.05; the Sears
  large-time asymptotic Φ ≈ 1 − 1/s − 2ln(2s)/s² + 2/s² at s = 20 (0.9366
  vs computed 0.9368); Jones within the published 1% band
  (max |Φ−Φ_Jones| = 0.0066 at the sampled points); Garrick within 2%.

### 4.3 Garrick's reciprocal relation (used as a validation)

**Source:** Garrick, NACA TR 629, 1938.

The Jones-approximated Wagner kernel has Laplace transform
`C̃(s) = 1 − c₁s/(s+λ₁) − c₂s/(s+λ₂)`, so the **Duhamel** convolution of Φ
with a harmonic α(s) must reach the steady state `2π·α₀·|C̃(k)|` with phase
`arg C̃(k)`. The regression test verifies amplitude within ~3% and phase
within ~4° of the exact C(k) (the residual is the Jones-vs-exact difference,
not error). This cross-links the time- and frequency-domain implementations.

### 4.4 Theodorsen harmonic lift

Classical formulas (Fung / Hodges & Pierce form, sign conventions documented
in the module):

- **Plunge** h = h₀e^{iωt} (h positive down, L positive up):
  `CL/(h₀/b) = πk² − 2πik·C(k)` — apparent mass πk² plus circulatory
  −2πik·C(k). Vanishes at k → 0 (zero plunge rate at peak displacement);
  apparent-mass dominated at high k.
- **Pitch about quarter-chord** α = α₀e^{iωt}:
  `CL/α₀ = 2π·C(k)(1 + ik) + iπk` — quasi-steady limit 2π at k → 0
  (thin-airfoil slope), apparent-mass dominated at high k.

Validated by the limiting behaviour in both limits.

### 4.5 Discrete unsteady vortex method

**Source/adaptation:** the unsteady vortex-panel formulation of Katz &
Plotkin, *Low-Speed Aerodynamics*, 2nd ed., ch. 13.6 (unsteady thin airfoil),
with the new wake vortex solved **implicitly** together with the bound
circulation through Kelvin's theorem — the formulation used by modern
UVLM implementations (e.g., SHARPy, Imperial College London;
ImperialCollegeLondon/UVLM, BSD-3-Clause — consulted, not copied).

- N bound vortices on the camber line (¼-chord positions), control points at
  the ¾-chord; one wake vortex shed per step at the trailing edge; the wake
  convects at V∞.
- Kelvin's theorem is imposed exactly: Γ_bound + Γ_wake = 0 (residual
  ~1e-14 in tests).
- Lift from Kutta–Joukowski: CL = −2ΣΓ (chord-normalised, V∞ = 1).

**Validation:** Kelvin conservation; step-response CL(s)/2πα tracks the
*exact* Wagner function within ~1% at s = 10–20 and ~4% at s = 5; exact
anti-symmetry in α.

**Known limitation (documented in the module):** for s ≲ 2 the discrete
response lags the exact Wagner function. The exact Φ(0⁺) = ½ initial jump is
produced by an *infinitesimal vortex sheet* at the trailing edge; a finite
point vortex at a finite distance over-weights the near wake, so the bound
circulation builds more slowly at first. This is a first-order artifact of
the point-vortex wake representation, consistent with Dawson & Brunton's
observation that early-time wake dynamics require a finer vortex
representation than the flat-wake Wagner theory assumes.

---

## 5. Research adaptation matrix

| Source | Year | Authors | Method | Code? | What it contributed | Discrepancy vs ours | Adaptation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NACA TR 496 | 1935 | Theodorsen | C(k), oscillating airfoil theory | n/a | C(k) definition, F/G separation | — | Implemented from first principles | Implemented, tested |
| ZAMM 5:17–35 | 1925 | Wagner | Indicial lift | n/a | Φ(s) definition, limits | — | Implemented exact + approximations | Implemented, tested |
| NACA TR 681 | 1940 | R. T. Jones | 2-exp Wagner approx | n/a | Φ = 1 − 0.165e^(−0.0455s) − 0.335e^(−0.3s) | — | Used as production approximation | Implemented, tested |
| NACA TR 629 | 1938 | Garrick | Fourier pair, algebraic approx | n/a | C↔Φ relation; Φ = 1 − 2/(4+s) | — | Used for exact inversion + validation | Implemented, tested |
| Prog. Aerosp. Sci. 8:1–138 | 1967 | Hess & Smith | Source panel method | n/a | Panel formulation, self-influence | — | Implemented from first principles | Implemented, tested |
| *Low-Speed Aerodynamics* ch. 11, 13 | 2001 | Katz & Plotkin | Panels; unsteady vortex methods | n/a | Influence coefficients; implicit Kelvin wake | — | Reimplemented in TypeScript | Implemented, tested |
| JOSE 2(15):45 | 2019 | Barba & Mesnard | Educational potential flow | BSD-3 / CC-BY | Sign conventions, ¼–¾ layout | Different language/architecture | Consulted, not copied | — |
| arXiv:2104.15122 | 2021 | Dawson & Brunton | Exact Φ computation; SINDy approximations | supplementary | Exact Fourier inversion; error bounds (Jones <1%, Garrick <2%); state-space forms; algebraic long-time decay | — | Exact inversion method adopted; error bounds used in tests | Implemented, tested |
| SHARPy / UVLM | 2015– | Imperial College London | UVLM | BSD-3 | Implicit wake + Kelvin formulation | 3D, C++/Python | Formulation adapted to 2D TypeScript | Implemented, tested |

AeroPython and SHARPy were consulted for formulation and validation practice;
no code was copied from either (both are BSD-3-Clause/CC-BY licensed, so
adaptation with attribution would have been permissible).

---

## 6. Licence and attribution

- All new code in this repository is original (authored by Ojasvi Goel) or
  reimplemented from classical public-domain theory (NACA reports, A&S
  handbook, published textbook mathematics). No third-party source code was
  copied into the project.
- AeroPython (Barba & Mesnard) is BSD-3-Clause (code) / CC-BY 4.0 (content).
  SHARPy/UVLM (Imperial College London) is BSD-3-Clause. Both are cited here
  for provenance; neither contributes code to this repository.

---

## 7. Validation methodology

Each model is checked against **analytical solutions or published
benchmarks**, never just "looks plausible":

| Quantity | Reference | Result |
| --- | --- | --- |
| Cylinder Cp (source panels) | doublet Cp = 1 − 4sin²θ | max err ~1e-9 |
| Flat-plate CL (VLM) | CL = 2πα | within 0.13% at 128 panels |
| α_L0 (cambered sections) | thin-airfoil theory / published | NACA 2412 −2.08°, 4412 −4.15° |
| Bessel functions | Wronskian + zeros | ~1e-9 |
| C(k) | limits + table value | C(0.5) ≈ 0.5979 − 0.1507i |
| Φ(s) exact | vKS series, Sears asymptotics, Jones band | all anchors met |
| Duhamel ↔ Theodorsen | Garrick relation | amp ~1%, phase ~1° |
| Discrete vortex wake | Kelvin + exact Φ(s) | Kelvin 1e-14; Φ within ~1% at s≥10 |

Run the full suite with `pnpm test` (currently 80 tests). Typecheck with
`pnpm exec tsc -b --noEmit`.

---

## 8. Known limitations (honest list)

1. Incompressible linear theory only — M ≥ 0.3 flagged, not modeled.
2. Stall/separated flow outside the model; |α| > 30° rejected.
3. The source-panel Cp is the non-lifting solution at α = 0° (source panels
   carry no circulation); lift comes from the vortex lattice.
4. Viscous drag enters only through the input cd0.
5. 2D section model; finite wings only via k = 1/(πeAR).
6. The discrete vortex method lags the exact Wagner function for s ≲ 2
   (point-vortex wake artifact; see §4.5).
7. The exact Wagner function is computed by numerical quadrature (≈10–40 ms
   per reduced-time value); the app uses Jones's approximation for
   production curves.

## 9. Future improvements (ranked)

1. Compressibility correction (Prandtl–Glauert) with the M ≥ 0.3 warning
   retained.
2. Pitching-moment coefficient from the VLM/thin-airfoil Fourier
   coefficients.
3. Küssner function (sharp-edged gust response) — same inversion machinery.
4. State-space (rational) Wagner approximation for coupled aeroelastic
   simulations (Dawson–Brunton SINDy ODE or the classical Roger/approximation
   fits).
5. Wake roll-up in the discrete vortex method (free-wake convection), which
   also reduces the early-time lag.
