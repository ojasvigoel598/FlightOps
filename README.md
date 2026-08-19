# Flight Ops

An **aerospace aircraft design simulator and engineering game**, built with React Native and Expo for iOS, Android and web.

- **Design tab** — define a mission (range, speed, payload) and design an aircraft to meet it. Change wing geometry, tail configuration, and propulsion — see mass breakdown and performance update in real time.
- **Aero Lab** — a linear-aerodynamics engineering tool: ISA atmosphere, source-panel Cp, vortex-lattice CL, Prandtl-Glauert compressibility correction, pitching moment, Theodorsen/Wagner unsteady functions. All validated against closed-form solutions.
- **Play the game** — run a cargo airline: take contracts, design aircraft in the hangar, fly missions with live telemetry and in-flight events, and grow your company.
- **Aero Credits** — earn credits by completing missions with efficient, safe designs. Unlock higher-fidelity analysis tools (lifting-line, panel method, VLM, unsteady aero, stability).
- **QR code** — scan to open on your phone (WebRTC LAN detection or manual URL input).

Author: **Ojasvi Goel** ([ojasvigoel598](https://github.com/ojasvigoel598)).

## Getting Started

The project is managed with **pnpm** (a `pnpm-lock.yaml` is committed).

```bash
pnpm install          # install dependencies
pnpm test             # run the physics/unit test suite
pnpm lint             # run ESLint
pnpm exec tsc -b --noEmit   # typecheck
```

### Run the app

```bash
pnpm web              # Expo dev server (web)
pnpm android          # Expo dev client on an Android emulator/device
pnpm ios              # Expo dev client on the iOS simulator
```

`pnpm web` starts Metro on port 8081. The web build is also statically exported for hosting:

```bash
npx expo export --platform web   # static output in dist/
```

## Project structure

```
app/                    Expo Router screens
  (tabs)/               Hangar, Contracts, Aero Lab, Design, Company, Phone
  qr.tsx                Standalone QR code page (/qr)
  mission.tsx           In-flight mission screen
  result.tsx            Mission result
components/             Shared UI (panels, badges, telemetry deck, …)
constants/              Theme tokens and config
contexts/               Game state provider
hooks/                  useGame / useMission
services/               Pure game + physics logic
  aerodynamics.ts       ISA, panel method, VLM, drag polar, Prandtl-Glauert, Cm
  unsteady.ts           Theodorsen C(k), Wagner Phi(s), Duhamel superposition
  unsteady-vortex.ts    Discrete vortex-panel method (UVLM-lite)
  mission-design.ts     Mission definition and engineering requirements
  aircraft-config.ts    Detailed aircraft geometry and mass breakdown
  aero-credits.ts       Credits, progression, tech unlocks, educational explanations
  simulation.ts         Mission simulation
  contracts.ts          Procedural contract generation
  reachable-url.ts      QR URL resolution (WebRTC LAN detection)
  pwa.ts                PWA head tags + service-worker registration
template/               Auth scaffolding (unused, not mounted in the app)
tests/                  Vitest unit + physics sanity tests (127 tests)
public/                 Web-only static assets (manifest.json, sw.js, icon)
docs/                   Research provenance and validation methodology
```

## Architecture

The codebase follows a clean separation between **pure logic** and **presentation**:

```
Screens / UI (React Native, Expo Router)
        │
        ▼
contexts/hooks (game state, mission lifecycle)
        │
        ▼
services/ (pure, testable logic — no React, no I/O)
   ├── simulation.ts     mission physics/telemetry
   ├── contracts.ts      seeded contract generation
   ├── aerodynamics.ts   ISA, panel method, vortex lattice, drag polar
   └── rng.ts            deterministic RNG
        │
        ▼
AsyncStorage (save state) — no backend required
```

Key properties:

- **The same validated logic runs on every platform.** The Aero Lab and the game share one `services/` layer — there is no separate web/native code path, so phone, desktop and tablet results are identical by construction.
- **Determinism.** Contract and mission generation use a seeded RNG (`services/rng.ts`), making runs reproducible for testing and teaching.
- **No network dependency at runtime.** Persistence is local (AsyncStorage); the optional Supabase auth template code is not mounted in the running app.
- **Web head/PWA wiring is isolated** in `services/pwa.ts` and guarded so it never runs in native builds.

## Game overview

- **Contract board** — procedurally generated cargo contracts (payload, distance, reward, difficulty) from a seeded RNG, so each run is reproducible.
- **Hangar** — design your aircraft by picking wings, engine and fuel tank; a physics model computes weight, range, fuel burn, safety and mission feasibility.
- **Missions** — fly with live telemetry (progress, fuel, integrity, engine health) and react to in-flight events (crosswind, engine vibration, fuel leak, bird strike, icing, turbulence, hydraulics) with risk/reward decisions.
- **Company** — money (£M), XP/levels, engineers and an upgrade shop (composite airframe, laminar wings, precision machining, AI co-pilot).
- **Persistence** — save state lives in AsyncStorage; the game runs fully offline with no backend required.

## Design tab (Mission Designer)

The **Design** tab is the aerospace engineering laboratory where students define missions and design aircraft:

### Mission definition
8 preset mission types: Trainer, Regional Passenger, Long Range, Cargo, Surveillance UAV, High Speed, Agricultural, Custom. The student sets range, endurance, cruise speed, altitude, and payload. The system converts these into engineering requirements using Breguet range equations and Sadraey weight estimation.

### Aircraft configuration
Detailed geometry controls:
- **Wing**: span, area, taper ratio, sweep, airfoil (5 NACA sections)
- **Tail**: conventional, T-tail, V-tail, canard, or none
- **Propulsion**: piston, turboprop, turbofan, or electric; engine count and power

Changing any parameter immediately updates: mass breakdown, aspect ratio, wing loading, stall speed, cruise speed, max L/D, range, climb rate, takeoff distance, and feasibility assessment.

### Aero Credits
Earn credits by completing missions with efficient, safe designs. Credits unlock technology tiers:
| Tier | Unlocks |
| --- | --- |
| Basic Analysis | Empirical Cd0, stall, range |
| Lifting-Line | Span efficiency, downwash visualisation |
| Panel Method | Cp distribution, velocity field |
| Vortex Lattice | 3D multi-surface analysis |
| Unsteady | Theodorsen, Wagner, flutter screening |
| Stability | Static stability, CG envelope, trim |
| Advanced Materials | Composite weight reduction |
| Propulsion Sim | Engine maps, fuel flow |

### Educational explanations
Every key concept (aspect ratio, wing loading, static margin, L/D, stall speed) has both a **simple** explanation and an **engineering** explanation with equations and design guidance.

## Aerodynamics module (Aero Lab)

`services/aerodynamics.ts` is a self-contained, dependency-free **linear-aerodynamics** library — the kind of tool described by the classic "linear aerodynamics tool that runs on a smartphone" project brief. It runs identically on web, iOS and Android; the **Aero Lab** tab in the app is its UI.

### Models implemented

| Quantity | Formula | Notes |
| --- | --- | --- |
| ISA atmosphere | hydrostatic + lapse rate (0–20 km geopotential), Sutherland viscosity | returns T, p, ρ, a, μ |
| Dynamic pressure | q = ½·ρ·V² | Pa |
| Mach number | M = V/a | linear model valid below M ~0.7 |
| Reynolds number | Re = ρ·V·c/μ | based on reference chord |
| Pressure distribution | constant-strength **source panel method** (Hess & Smith 1967) | non-lifting, exact for thick bodies at α = 0° |
| Lift | 2D **vortex lattice** (vortices at quarter-chord, control points at three-quarter-chord) + thin-airfoil theory | camber handled via camber-line slope |
| Zero-lift angle | α_L0 from thin-airfoil Fourier coefficients | trapezoidal quadrature |
| Drag | parabolic polar CD = cd0 + k·CL², k = 1/(π·e·AR) for finite wings | |
| Compressibility | **Prandtl–Glauert** correction: CL_M = CL_0/β, β = √(1−M²) | extends linear validity to M < ~0.7 |
| Pitching moment | Cm_{c/4} from thin-airfoil Fourier coefficients A1, A2 | nose-down for cambered sections |

### Units and conventions

Everything is **SI**: metres, seconds, kg, Pa, N/m, K. Angles are degrees at the API boundary, converted to radians internally. Chord and panel coordinates are normalised by chord. The reference area for CL/CD is the chord (2D section convention).

### Validation

The module is validated against closed-form solutions (91 regression tests in `tests/`):

- **Cylinder Cp**: the source panel method reproduces the exact doublet solution Cp = 1 − 4·sin²θ to ~1e-9.
- **Flat-plate lift**: CL from the vortex lattice converges to thin-airfoil theory CL = 2πα (within 0.13% at 128 panels); for a flat plate α_L0 = 0°.
- **Cambered sections**: computed zero-lift angles match theory — NACA 2412 ≈ −2.08°, NACA 4412 ≈ −4.15° — and CL(α) tracks thin-airfoil theory.
- **Prandtl–Glauert**: β = √(1−M²) factor verified at M = 0 (β = 1) and M = 0.5 (β = √0.75); CL_M × β = CL_0 to machine precision.
- **Pitching moment**: symmetric airfoil Cm = 0; cambered Cm negative and monotone in camber (NACA 2412 ≈ −0.053, 4412 ≈ −0.094).
- **Theodorsen/Wagner**: Bessel Wronskian, exact limits, Jones/Garrick error bounds, Duhamel–Theodorsen cross-validation (see `tests/unsteady.test.ts`).
- **Discrete vortex**: Kelvin conservation (~1e-14), Wagner step-response within ~1% at s ≥ 10 (see `tests/unsteady-vortex.test.ts`).

### Assumptions and limitations (surfaced in the UI)

- **Subsonic linearised** potential flow with **Prandtl–Glauert compressibility correction** (β = √(1−M²)); valid for M < ~0.7. A warning flags M ≥ 0.3; the solver rejects M ≥ 1.
- **Linear, attached flow**; the lift model is not valid beyond roughly ±15° angle of attack (separation/stall) and the solver rejects |α| > 30°.
- Source panels cannot generate circulation, so the Cp plot is the **non-lifting** pressure distribution at α = 0°; lift at α ≠ 0 comes from the vortex lattice model.
- **Steady, inviscid**: skin friction enters only through the input cd0.
- 2D section model; the finite-wing effect enters only through the induced-drag factor k = 1/(π·e·AR).
- **Pitching moment** Cm_{c/4} is from thin-airfoil theory and does not include thickness or viscous contributions.

### Inputs you control in the Aero Lab

Altitude (0–20 km), true airspeed, reference chord, angle of attack, airfoil (10 NACA 4-digit sections: 0006, 0012, 0018, 2412, 4412, 2421, 6412, 23012, 4421, 0025, 4418), panel count, cd0, section k, aspect ratio and span efficiency. The output shows the atmosphere state, q, M, Re, CL (VLM, thin-airfoil, and Prandtl–Glauert corrected), CD (incompressible and corrected), Cm, α_L0, section lift/drag per span, and the Cp curve.

## Mobile access via QR code

The **Phone** tab renders a live QR code that opens the app in a phone browser:

> Open on phone → [QR] → Scan this QR code with your phone

The QR payload is **resolved at runtime** using three strategies: (1) the web origin if not localhost, (2) WebRTC-based LAN IP detection (free, no API key, works when phone and computer are on the same WiFi), or (3) manual URL input where the user pastes the preview URL. `services/reachable-url.ts` rejects loopback-only addresses (`localhost`, `127.0.0.1`, `0.0.0.0`, `::1`) because a phone can never reach those.

A standalone QR page is also available at `/qr` — bookmarkable for quick access.

Workflow:

1. Open the app in the web preview (the preview URL is phone-reachable).
2. Open the **Phone** tab (or navigate to `/qr`) and scan the QR with the phone camera / Google Lens.
3. The phone opens the same app in its browser — all gameplay and the Aero Lab run on-device, so the phone needs no backend.
4. If auto-detection fails (browser blocks WebRTC), paste the preview URL into the manual input field.
5. On Android/Chrome the deployed web build can be installed to the home screen (it is an installable PWA — see below).

## PWA and Android packaging

### Progressive Web App

The static web build is an installable PWA:

- `public/manifest.json` — name, short name, theme/background colour (#060A12), standalone display, start URL and icons (`public/icon.png`, copied from the app logo).
- `public/sw.js` — lightweight service worker: **network-first for navigations** (deep links and refreshes survive a dropped network) and **cache-first for same-origin static assets**. The game and Aero Lab are fully client-side, so offline use after first load is genuine.
- `services/pwa.ts` — registers the worker only on the production web build (never in native builds or the dev server) and injects the manifest link, theme-colour and apple-touch-icon tags at runtime.

### Android packaging (Android Studio path)

The project is a managed Expo app, so the native Android project is generated rather than committed:

```bash
pnpm install
npx expo prebuild --platform android   # generates android/ with the app identifier below
# open android/ in Android Studio → Build → Build App Bundle(s)/APK(s)
```

- App identifier: `com.ojasvigoel.flightops`, `versionCode: 1` (in `app.json` — change `versionCode` on every release).
- The icon/adaptive icon come from `assets/images/logo.png`; change them in `app.json` for a branded launcher icon.
- For release builds, configure signing in Android Studio (Build → Generate Signed Bundle/APK) — a release build must not remain debug-signed.
- If you later wrap the **deployed web URL** instead (Trusted Web Activity), the production URL must be HTTPS and you must serve `/.well-known/assetlinks.json` with your app's signing-certificate SHA-256 fingerprint; use `npx @bubblewrap/cli` or Android Studio's TWA tooling. The current prebuild route packages the app itself.

This repository keeps the managed workflow (no committed `android/`/`ios/` folders), so the web preview and Expo Go workflow are unaffected by native packaging.

## Testing

```bash
pnpm test
```

Runs the Vitest suite (127 tests across 9 files):

- **Aerodynamics** (37 tests) — cylinder Cp vs the analytic doublet solution; flat-plate CL convergence to 2πα; zero-lift angles for cambered NACA sections; Prandtl-Glauert correction factor and compressibility-corrected CL/CD; pitching moment coefficient for symmetric and cambered airfoils; drag polar sanity; validation errors on impossible inputs and supersonic Mach.
- **Unsteady aerodynamics** (23 tests) — Bessel function Wronskian and zeros; Theodorsen C(k) limits, table values, monotonicity; Wagner function exact limits, small-time Sears series, large-time asymptotic, Jones/Garrick error bounds; Duhamel harmonic steady state vs Theodorsen (Garrick relation).
- **Discrete vortex** (8 tests) — Kelvin circulation conservation; Wagner step-response CL tracking; symmetry in alpha.
- **Simulation physics** (6 tests) — mission telemetry sanity (fuel burn, progress, event handling).
- **Contracts** (4 tests) — seeded RNG reproducibility, difficulty/reward bounds.
- **Math utils** (7 tests) — clamping, rounding, interpolation edge cases.
- **Reachable URL** (8 tests) — QR payload validation: rejects localhost/loopback and non-http(s), accepts real hosts, buildLanUrl construction.
- **Mission design** (15 tests) — preset missions, requirements computation, scoring, aircraft config defaults, mass breakdown consistency, performance derivation.
- **Aero Credits** (19 tests) — tech tier prerequisites, credit deduction, reward computation, design comparison, educational explanations.

Typecheck the whole project with `pnpm exec tsc -b --noEmit`. For release checks, export the static web build with `npx expo export --platform web` and smoke-test the app (launch → contract board → mission → Aero Lab → Phone tab → refresh) in the preview.

## Environment variables

**None are required.** The core game and the Aero Lab run entirely on-device.

Optional, for future Supabase auth (dormant template code): `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in a local `.env.local` (gitignored). The running app does not call Supabase today.

## References

### Aerodynamics and flight physics

1. **Anderson, J. D.** *Fundamentals of Aerodynamics*, 6th ed. McGraw-Hill, 2017. — Prandtl-Glauert correction (sec. 10.2), thin-airfoil theory (ch. 4), panel methods (ch. 3).
2. **Katz, J. and Plotkin, A.** *Low-Speed Aerodynamics*, 2nd ed. Cambridge University Press, 2001. — Panel method formulation (ch. 11), vortex lattice method, unsteady thin-airfoil and discrete vortex methods (ch. 13).
3. **Hess, J. L. and Smith, A. M. O.** "Calculation of potential flow about arbitrary bodies." *Progress in Aerospace Sciences* 8:1-138, 1967. — Constant-strength source panel method.
4. **Abbott, I. H. and von Doenhoff, A. E.** *Theory of Wing Sections*. Dover, 1959. — NACA 4-digit airfoil geometry and thin-airfoil theory.
5. **Theodorsen, T.** "General Theory of Aerodynamic Instability and the Mechanism of Flutter." NACA Report No. 496, 1935. — Theodorsen's function C(k).
6. **Wagner, H.** "Uber die Entstehung des dynamischen Auftriebes von Tragflugeln." *Z. Angew. Math. Mech.* 5(1):17-35, 1925. — Wagner indicial lift function.
7. **Jones, R. T.** "The Unsteady Lift of a Wing of Finite Aspect Ratio." NACA TR 681, 1940. — Two-exponential Wagner approximation.
8. **Garrick, I. E.** "On Some Reciprocal Relations in the Theory of Nonstationary Flows." NACA TR 629, 1938. — Fourier pair linking C(k) and Phi(s).
9. **Dawson, S. T. M. and Brunton, S. L.** "Improved approximations to the Wagner function using sparse identification of nonlinear dynamics." arXiv:2104.15122, 2021. — Exact Wagner function computation and error bounds.

### Aircraft design

10. **Sadraey, M. H.** *Aircraft Design: A Conceptual Approach*, 6th ed. AIAA Education Series, 2023. — Conceptual design methodology, configuration decisions, sizing, trade-offs.
11. **Raymer, D. P.** *Aircraft Design: A Conceptual Approach*, 6th ed. AIAA, 2018. — General aircraft design reference.

### Computational and educational resources

12. **Barba, L. A. and Mesnard, O.** "AeroPython: classical aerodynamics of potential flow using Python." *Journal of Open Source Education* 2(15):45, 2019. DOI: 10.21105/jose.00045. — Educational panel-method implementations (BSD-3-Clause code, CC-BY 4.0 content); consulted for sign conventions, not copied.
13. **Imperial College London.** SHARPy / UVLM. BSD-3-Clause. https://github.com/ImperialCollegeLondon/UVLM. — Unsteady vortex lattice method formulation; consulted for implicit Kelvin wake approach, not copied.
14. **Abramowitz, M. and Stegun, I. A.** *Handbook of Mathematical Functions*. Dover, 1965. — Bessel function series and asymptotic expansions (A&S 9.1, 9.2).

All aerodynamic models in this project are original TypeScript implementations by Ojasvi Goel, based on the published theory cited above. No third-party source code was copied into the repository. A complete research provenance document is in `docs/RESEARCH.md`.
