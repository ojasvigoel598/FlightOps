---
name: aerodynamics
description: Validated linear-aerodynamics domain skill for Flight Ops — steady panel/vortex methods and unsteady Theodorsen/Wagner models. Use when auditing, extending, validating or explaining the aerodynamic code in services/aerodynamics.ts, services/unsteady.ts or the Aero Lab UI.
---

# Aerodynamics skill (Flight Ops)

Domain knowledge for the aerodynamic modules in this repository. Everything here
is backed by the primary sources listed in `docs/RESEARCH.md`; do not "improve"
the code without re-validating against the benchmarks below.

## Conventions (do not change silently)

- **SI units everywhere.** Angles are degrees at API boundaries, radians internally.
- Chord/panel coordinates normalised by chord. 2D section convention: reference
  length is the chord `c`; reference area for CL/CD is `c` per unit span.
- Reduced frequency (Theodorsen): `k = ω·b/V` with **half-chord** `b = c/2`.
- Reduced time (Wagner): `s = 2·V·t/c = V·t/b`.
- `C(k) = F + iG` with **phase-lag sign**: G ≤ 0 for k > 0, |C| decreases from
  `|C(0)| = 1` to `|C(∞)| = 1/2`.

## Validated steady models (`services/aerodynamics.ts`)

| Quantity | Formula | Validation |
| --- | --- | --- |
| ISA atmosphere | hydrostatic + lapse (0–20 km), Sutherland μ | T,p,ρ,a at SL & tropopause vs ISA tables |
| Dynamic pressure | q = ½ρV² | closed form |
| Cp (non-lifting) | constant-strength source panels | cylinder Cp = 1 − 4sin²θ to ~1e-9 |
| CL (lifting) | 2D vortex lattice (Γ at x/c = ¼, control at ¾) | CL = 2πα (flat plate), α_L0 for NACA 2412/4412/23012 |
| CD | CD = cd0 + k·CL², k = 1/(πeAR) | closed form |

Model limits (surfaced as warnings): incompressible (M < 0.3), attached flow
(|α| ≲ 15°, solver rejects |α| > 30°), source-panel Cp is non-lifting at α = 0°.

## Validated unsteady models (`services/unsteady.ts`)

- **Bessel J0/J1/Y0/Y1** — series for small x, asymptotic for large x; verified
  against the known zeros (J0: 2.4048255577, J1: 3.8317059702, Y0: 0.8935769663,
  Y1: 2.1971413260).
- **Theodorsen C(k)** = H₁⁽²⁾(k)/[H₁⁽²⁾(k) + i·H₀⁽²⁾(k)] — limits F(0)=1,
  F(∞)=1/2, G(0)=G(∞)=0, phase lag monotone in k.
- **Wagner Φ(s)** — exact limits Φ(0⁺) = 1/2, Φ(∞) = 1; Jones two-exponential
  approximation Φ(s) = 1 − 0.165·e^(−0.0455s) − 0.335·e^(−0.3s) is within ~2% of
  the exact Garrick-integral evaluation (NACA TR 629).
- **Duhamel superposition** — for harmonic α, the steady-state circulatory
  response must converge to the Theodorsen amplitude 2π|C(k)|·α₀ (Garrick's
  reciprocal relation); regression test enforces this.
- **Discrete unsteady vortex method** (camber-line bound vortices + shed wake,
  Kelvin's theorem) — step response must track Φ(s) (Katz & Plotkin ch. 13.6
  formulation).

## Audit checklist (use before modifying aero code)

1. Units & sign conventions unchanged? (see above)
2. Kutta condition / Kelvin theorem enforced?
3. Inputs validated (finite, positive where physical, range-clamped)?
4. Regression benchmarks still pass (`pnpm test`)?
5. Analytical limits checked (C(0), C(∞), Φ(0), Φ(∞))?
6. Provenance: any new equation documented in docs/RESEARCH.md with a primary source?

## References

- Theodorsen, NACA TR 496 (1935). Wagner, ZAMM 5(1):17–35 (1925).
- Jones, NACA TR 681 (1940). Garrick, NACA TR 629 (1938).
- Hess & Smith, Prog. Aerosp. Sci. 8:1–138 (1967).
- Katz & Plotkin, *Low-Speed Aerodynamics*, 2nd ed. (2001) — ch. 11 (panels),
  ch. 13 (unsteady).
- AeroPython (Barba & Mesnard, JOSE 10.21105/jose.00045; BSD-3 / CC-BY).
- Dawson, arXiv:2104.15122 (2021) — improved Wagner approximations (SINDy).
