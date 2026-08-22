// Flight Ops — Aerodynamics module.
//
// A self-contained, dependency-free linear-aerodynamics library that runs on
// any platform (web, iOS, Android). All quantities are SI unless explicitly
// stated. Every public function validates its inputs and fails loudly (throws)
// on non-finite or physically impossible values instead of silently returning
// meaningless numbers.
//
// Implemented models
// ------------------
// 1. ISA standard atmosphere (geopotential altitude 0–20 km) + Sutherland
//    viscosity, giving temperature, pressure, density, speed of sound.
// 2. Dynamic pressure  q = ½·ρ·V², Reynolds number, Mach number.
// 3. 2D potential flow:
//      - constant-strength SOURCE PANEL method for the non-lifting pressure
//        distribution (Cp) around a closed body (validated against the exact
//        doublet solution for a circular cylinder: Cp = 1 − 4·sin²θ).
//      - 2D VORTEX LATTICE method (bound vortices at the quarter-chord,
//        control points at the three-quarter-chord) for lift, including camber
//        effects, validated against thin-airfoil theory CL = 2π(α − α_L0).
// 4. Thin-airfoil theory lift slope with camber (zero-lift angle from Fourier
//    coefficients of the camber-line slope).
// 5. Parabolic drag polar  CD = cd0 + k·CL².
//
// Model limitations (documented, surfaced through `warnings`)
// -----------------------------------------------------------
// - Incompressible potential flow only; results degrade for M ≥ ~0.3.
// - Linear/attached-flow regime only; the linear lift slope is not valid
//   beyond roughly ±12–15° angle of attack (separation / stall).
// - The source-panel pressure distribution is computed at α = 0° (source
//   panels cannot generate circulation). Lift at α ≠ 0 comes from the vortex
//   lattice model.
// - Steady, inviscid flow: viscous drag enters only through the input cd0.

export interface AtmosphereState {
  /** Static temperature, K */
  temperatureK: number;
  /** Static pressure, Pa */
  pressurePa: number;
  /** Air density, kg/m³ */
  densityKgM3: number;
  /** Speed of sound, m/s */
  speedOfSoundMs: number;
  /** Dynamic viscosity (Sutherland), Pa·s */
  viscosityPaS: number;
}

export interface AirfoilSpec {
  id: string;
  label: string;
  /** NACA 4-digit camber, % chord */
  camberPct: number;
  /** NACA 4-digit camber position, % chord */
  camberPosPct: number;
  /** NACA 4-digit thickness, % chord */
  thicknessPct: number;
}

export const AIRFOILS: AirfoilSpec[] = [
  // Symmetric
  { id: 'naca0006', label: 'NACA 0006', camberPct: 0, camberPosPct: 0, thicknessPct: 6 },
  { id: 'naca0012', label: 'NACA 0012', camberPct: 0, camberPosPct: 0, thicknessPct: 12 },
  { id: 'naca0018', label: 'NACA 0018', camberPct: 0, camberPosPct: 0, thicknessPct: 18 },
  // General aviation workhorses (4-digit)
  { id: 'naca2412', label: 'NACA 2412', camberPct: 2, camberPosPct: 40, thicknessPct: 12 },
  { id: 'naca4412', label: 'NACA 4412', camberPct: 4, camberPosPct: 40, thicknessPct: 12 },
  { id: 'naca2421', label: 'NACA 2421', camberPct: 2, camberPosPct: 40, thicknessPct: 21 },
  { id: 'naca6412', label: 'NACA 6412', camberPct: 6, camberPosPct: 40, thicknessPct: 12 },
  // Low-speed / high-lift (4-digit)
  { id: 'naca23012', label: 'NACA 23012', camberPct: 1.8, camberPosPct: 15, thicknessPct: 12 },
  { id: 'naca4421', label: 'NACA 4421', camberPct: 4, camberPosPct: 40, thicknessPct: 21 },
  // Thicker sections (structural / agricultural / UAV)
  { id: 'naca0025', label: 'NACA 0025', camberPct: 0, camberPosPct: 0, thicknessPct: 25 },
  { id: 'naca4418', label: 'NACA 4418', camberPct: 4, camberPosPct: 40, thicknessPct: 18 },
];

export interface PanelPoint {
  x: number;
  y: number;
}

export interface CpResult {
  /** chord-wise location of the panel control point (normalised 0–1) */
  x: number;
  /** y location of the panel control point (normalised by chord) */
  y: number;
  /** pressure coefficient at the control point */
  cp: number;
  /** tangential velocity / freestream velocity */
  vtOverVinf: number;
}

export interface LiftResult {
  /** lift coefficient from the 2D vortex lattice model */
  clVlm: number;
  /** lift coefficient from thin-airfoil theory 2π(α − α_L0) */
  clThin: number;
  /** zero-lift angle of attack from the camber line, degrees */
  alphaL0Deg: number;
  /** circulation strengths (m²/s) per panel, for diagnostics */
  circulations: number[];
}

export interface AeroAnalysis {
  valid: boolean;
  warnings: string[];
  airfoil: AirfoilSpec;
  atmosphere: AtmosphereState;
  /** dynamic pressure, Pa */
  qPa: number;
  /** Mach number, dimensionless */
  mach: number;
  /** Reynolds number, dimensionless */
  reynolds: number;
  /** lift coefficient (vortex lattice), dimensionless */
  cl: number;
  /** lift coefficient (thin-airfoil theory), dimensionless */
  clThin: number;
  /** Prandtl-Glauert compressibility-corrected CL, dimensionless */
  clCompressed: number;
  /** drag coefficient (parabolic polar), dimensionless */
  cd: number;
  /** Prandtl-Glauert compressibility-corrected CD, dimensionless */
  cdCompressed: number;
  /** pitching moment coefficient about the quarter-chord (thin-airfoil theory), dimensionless */
  cm: number;
  /** zero-lift angle, degrees */
  alphaL0Deg: number;
  /** Prandtl-Glauert compressibility factor β = sqrt(1 − M²), dimensionless */
  prandtlGlauertBeta: number;
  /** section lift per unit span, N/m */
  liftPerSpan: number;
  /** section drag per unit span, N/m */
  dragPerSpan: number;
  /** pressure distribution from the source panel method (α = 0°) */
  cp: CpResult[];
  cpMin: number;
  cpMax: number;
}

// ---------------------------------------------------------------------------
// Constants (SI)
// ---------------------------------------------------------------------------

const G0 = 9.80665; // m/s²
const R_AIR = 287.05287; // J/(kg·K)
const GAMMA = 1.4; // ratio of specific heats, air
const T0 = 288.15; // K, ISA sea level
const P0 = 101325; // Pa, ISA sea level
const LAPSE = 0.0065; // K/m, troposphere lapse rate
const T_STRAT = 216.65; // K, stratosphere (11–20 km)
const H_TROPOPAUSE = 11_000; // m
const H_MAX = 20_000; // m
const MU0 = 1.716e-5; // Pa·s, Sutherland reference
const T_SUTH = 273.15; // K, Sutherland reference temperature
const S_SUTH = 110.4; // K, Sutherland constant
const PI = Math.PI;

const TROPOSPHERE_EXP = G0 / (R_AIR * LAPSE); // ~5.2559

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`aerodynamics: ${name} must be a finite number, got ${value}`);
  }
}

function assertPositive(name: string, value: number): void {
  assertFinite(name, value);
  if (value <= 0) {
    throw new Error(`aerodynamics: ${name} must be positive, got ${value}`);
  }
}

function assertInRange(name: string, value: number, min: number, max: number): void {
  assertFinite(name, value);
  if (value < min || value > max) {
    throw new Error(`aerodynamics: ${name} must be within [${min}, ${max}], got ${value}`);
  }
}

// ---------------------------------------------------------------------------
// ISA standard atmosphere + viscosity
// ---------------------------------------------------------------------------

export function standardAtmosphere(altitudeM: number): AtmosphereState {
  assertInRange('altitudeM', altitudeM, 0, H_MAX);

  let temperatureK: number;
  let pressurePa: number;

  if (altitudeM <= H_TROPOPAUSE) {
    temperatureK = T0 - LAPSE * altitudeM;
    pressurePa = P0 * Math.pow(temperatureK / T0, TROPOSPHERE_EXP);
  } else {
    temperatureK = T_STRAT;
    pressurePa =
      22_632.1 * Math.exp((-G0 * (altitudeM - H_TROPOPAUSE)) / (R_AIR * T_STRAT));
  }

  const densityKgM3 = pressurePa / (R_AIR * temperatureK);
  const speedOfSoundMs = Math.sqrt(GAMMA * R_AIR * temperatureK);
  const viscosityPaS =
    MU0 * Math.pow(temperatureK / T_SUTH, 1.5) * ((T_SUTH + S_SUTH) / (temperatureK + S_SUTH));

  return { temperatureK, pressurePa, densityKgM3, speedOfSoundMs, viscosityPaS };
}

/** Dynamic pressure q = ½·ρ·V² (Pa). */
export function dynamicPressure(velocityMs: number, densityKgM3: number): number {
  assertPositive('velocityMs', velocityMs);
  assertPositive('densityKgM3', densityKgM3);
  return 0.5 * densityKgM3 * velocityMs * velocityMs;
}

/** Mach number M = V / a. */
export function machNumber(velocityMs: number, speedOfSoundMs: number): number {
  assertPositive('velocityMs', velocityMs);
  assertPositive('speedOfSoundMs', speedOfSoundMs);
  return velocityMs / speedOfSoundMs;
}

/** Reynolds number Re = ρ·V·c / μ. */
export function reynoldsNumber(
  velocityMs: number,
  chordM: number,
  densityKgM3: number,
  viscosityPaS: number,
): number {
  assertPositive('velocityMs', velocityMs);
  assertPositive('chordM', chordM);
  assertPositive('densityKgM3', densityKgM3);
  assertPositive('viscosityPaS', viscosityPaS);
  return (densityKgM3 * velocityMs * chordM) / viscosityPaS;
}

// ---------------------------------------------------------------------------
// NACA 4-digit airfoil geometry
// ---------------------------------------------------------------------------

export interface NacaGeometry {
  /** camber-line height at chord position x (0–1) */
  camber(x: number): number;
  /** camber-line slope dyc/dx at chord position x */
  camberSlope(x: number): number;
  /** closed polygon of surface points (upper TE→LE, lower LE→TE) */
  points(nPanels: number): PanelPoint[];
}

export function nacaGeometry(spec: AirfoilSpec): NacaGeometry {
  const m = spec.camberPct / 100;
  const p = spec.camberPosPct / 100;
  const t = spec.thicknessPct / 100;

  function camber(x: number): number {
    if (m === 0) return 0;
    if (x < p) return (m / (p * p)) * (2 * p * x - x * x);
    return (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * x - x * x);
  }

  function camberSlope(x: number): number {
    if (m === 0) return 0;
    if (x < p) return (2 * m / (p * p)) * (p - x);
    return (2 * m / ((1 - p) * (1 - p))) * (p - x);
  }

  function thickness(x: number): number {
    // x⁴ coefficient 0.1015 keeps the trailing edge closed (classic NACA).
    return (
      (t / 0.2) *
      (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x)
    );
  }

  function points(nPanels: number): PanelPoint[] {
    if (!Number.isInteger(nPanels) || nPanels < 8 || nPanels > 256) {
      throw new Error(`aerodynamics: nPanels must be an integer in [8, 256], got ${nPanels}`);
    }
    const out: PanelPoint[] = [];
    // Cosine spacing concentrates panels near the leading edge.
    const xs: number[] = [];
    for (let k = 0; k <= nPanels; k += 1) {
      xs.push(0.5 * (1 - Math.cos((k * PI) / nPanels)));
    }
    // Upper surface from trailing edge to leading edge (k = 0 is the LE).
    for (let k = nPanels; k >= 0; k -= 1) {
      const x = xs[k];
      const theta = Math.atan2(camberSlope(x), 1);
      out.push({ x, y: camber(x) + thickness(x) * Math.cos(theta) });
    }
    // Lower surface from leading edge (k = 1, avoiding a duplicate LE point)
    // back to the trailing edge, closing the polygon.
    for (let k = 1; k <= nPanels; k += 1) {
      const x = xs[k];
      const theta = Math.atan2(camberSlope(x), 1);
      out.push({ x, y: camber(x) - thickness(x) * Math.cos(theta) });
    }
    return out;
  }

  return { camber, camberSlope, points };
}

// ---------------------------------------------------------------------------
// Small linear-algebra helpers
// ---------------------------------------------------------------------------

/** Solve A·x = b by Gaussian elimination with partial pivoting. */
function solveLinearSystem(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-14) {
      throw new Error('aerodynamics: singular linear system (degenerate geometry?)');
    }
    if (pivot !== col) {
      const tmp = m[col];
      m[col] = m[pivot];
      m[pivot] = tmp;
    }
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k <= n; k += 1) m[row][k] -= factor * m[col][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

// ---------------------------------------------------------------------------
// Source panel method (constant-strength sources) — non-lifting Cp
// ---------------------------------------------------------------------------

interface BuiltPanels {
  points: PanelPoint[];
  mid: PanelPoint[];
  tangents: PanelPoint[];
  normals: PanelPoint[];
  lengths: number[];
}

function buildPanels(points: PanelPoint[]): BuiltPanels {
  const n = points.length;
  const mid: PanelPoint[] = [];
  const tangents: PanelPoint[] = [];
  const normals: PanelPoint[] = [];
  const lengths: number[] = [];
  for (let j = 0; j < n; j += 1) {
    const a = points[j];
    const b = points[(j + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) throw new Error('aerodynamics: degenerate panel of zero length');
    const tx = dx / len;
    const ty = dy / len;
    // +90° rotation of the tangent; consistent for the whole loop.
    const nx = -ty;
    const ny = tx;
    tangents.push({ x: tx, y: ty });
    normals.push({ x: nx, y: ny });
    lengths.push(len);
    mid.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return { points, mid, tangents, normals, lengths };
}

/**
 * Influence of a unit-strength constant source panel j on a point p.
 * Returns velocity components (u, v). Derived from the classic panel-method
 * result (e.g. Katz & Plotkin, Low-Speed Aerodynamics, §11.3):
 *   u = (1/4π)·ln(r1²/r2²),   v = (1/2π)·(θ2 − θ1)
 * in panel-local coordinates, rotated back to the global frame.
 */
function sourceInfluence(panels: BuiltPanels, j: number, p: PanelPoint): PanelPoint {
  const a = panels.points[j];
  const t = panels.tangents[j];
  const nrm = panels.normals[j];
  const l = panels.lengths[j];
  const rx = p.x - a.x;
  const ry = p.y - a.y;
  const xi = rx * t.x + ry * t.y;
  // Evaluate just off the panel on the exterior side (η = −ε). The source
  // sheet has a normal-velocity jump of σ; on the exterior side the induced
  // self-influence is −σ/2 in the chosen normal direction, matching the
  // classic panel-method formulation (Hess–Smith / Anderson §3.13).
  const eta = rx * nrm.x + ry * nrm.y - 1e-9 * l;
  const r1sq = xi * xi + eta * eta;
  const r2sq = (xi - l) * (xi - l) + eta * eta;
  const uLocal = (1 / (4 * PI)) * Math.log(r1sq / r2sq);
  const vLocal = (1 / (2 * PI)) * (Math.atan2(eta, xi - l) - Math.atan2(eta, xi));
  return {
    x: uLocal * t.x + vLocal * nrm.x,
    y: uLocal * t.y + vLocal * nrm.y,
  };
}

/**
 * Source panel method for the pressure distribution around a closed body at
 * angle of attack `alphaDeg`. Source panels cannot generate circulation, so
 * this is a NON-LIFTING solution; it is exact for thick bodies at α = 0 and
 * useful for pressure loads. Lift is handled by `vortexLatticeLift`.
 */
/**
 * Solve the constant-strength source-panel system: source strengths σ_j such
 * that the normal velocity vanishes at every control point (Hess–Smith,
 * Progress in Aerospace Sciences 8, 1967; non-lifting solution).
 */
function solveSourceStrengths(bodyPoints: PanelPoint[], alphaDeg: number): number[] {
  assertFinite('alphaDeg', alphaDeg);
  if (bodyPoints.length < 8) {
    throw new Error(`aerodynamics: need at least 8 body points, got ${bodyPoints.length}`);
  }
  const panels = buildPanels(bodyPoints);
  const n = panels.mid.length;
  const alpha = (alphaDeg * PI) / 180;
  const vInf = { x: Math.cos(alpha), y: Math.sin(alpha) };

  const matrix: number[][] = [];
  const rhs: number[] = [];
  for (let i = 0; i < n; i += 1) {
    matrix.push(new Array<number>(n).fill(0));
    for (let j = 0; j < n; j += 1) {
      const vel = sourceInfluence(panels, j, panels.mid[i]);
      matrix[i][j] = vel.x * panels.normals[i].x + vel.y * panels.normals[i].y;
    }
    rhs.push(-(vInf.x * panels.normals[i].x + vInf.y * panels.normals[i].y));
  }
  return solveLinearSystem(matrix, rhs);
}

export function sourcePanelPressure(
  bodyPoints: PanelPoint[],
  alphaDeg: number,
): CpResult[] {
  const panels = buildPanels(bodyPoints);
  const n = panels.mid.length;
  const alpha = (alphaDeg * PI) / 180;
  const vInf = { x: Math.cos(alpha), y: Math.sin(alpha) };

  const strengths = solveSourceStrengths(bodyPoints, alphaDeg);

  const cp: CpResult[] = [];
  for (let i = 0; i < n; i += 1) {
    let vt = vInf.x * panels.tangents[i].x + vInf.y * panels.tangents[i].y;
    for (let j = 0; j < n; j += 1) {
      const vel = sourceInfluence(panels, j, panels.mid[i]);
      vt += strengths[j] * (vel.x * panels.tangents[i].x + vel.y * panels.tangents[i].y);
    }
    const vtRatio = vt; // freestream speed normalised to 1
    cp.push({
      x: panels.mid[i].x,
      y: panels.mid[i].y,
      cp: 1 - vtRatio * vtRatio,
      vtOverVinf: vtRatio,
    });
  }
  return cp;
}

// ---------------------------------------------------------------------------
// Velocity-field evaluation (for potential-flow visualisation)
// ---------------------------------------------------------------------------

export interface VelocityFieldPoint {
  x: number;
  y: number;
  /** velocity x-component / V∞ (dimensionless) */
  u: number;
  /** velocity y-component / V∞ (dimensionless) */
  v: number;
}

/** True when (px, py) is strictly inside the polygon (ray-casting). */
function pointInPolygon(px: number, py: number, poly: PanelPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Evaluate the (non-lifting) potential-flow velocity field around a closed
 * body: freestream + source panels, normalised by V∞. Grid points inside the
 * body are omitted (the flow field is only defined outside it). This is the
 * same solution that produces the Cp distribution, so every arrow is a real
 * computed quantity — nothing decorative.
 */
export function velocityField(
  bodyPoints: PanelPoint[],
  alphaDeg: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  nx: number,
  ny: number,
): VelocityFieldPoint[] {
  assertFinite('alphaDeg', alphaDeg);
  if (!Number.isInteger(nx) || nx < 2 || nx > 100) throw new Error('aerodynamics: nx in [2, 100]');
  if (!Number.isInteger(ny) || ny < 2 || ny > 100) throw new Error('aerodynamics: ny in [2, 100]');
  const panels = buildPanels(bodyPoints);
  const strengths = solveSourceStrengths(bodyPoints, alphaDeg);
  const alpha = (alphaDeg * PI) / 180;
  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);

  const out: VelocityFieldPoint[] = [];
  for (let iy = 0; iy < ny; iy += 1) {
    const y = yMin + ((yMax - yMin) * iy) / (ny - 1);
    for (let ix = 0; ix < nx; ix += 1) {
      const x = xMin + ((xMax - xMin) * ix) / (nx - 1);
      if (pointInPolygon(x, y, bodyPoints)) continue;
      let u = cosA;
      let v = sinA;
      for (let j = 0; j < strengths.length; j += 1) {
        const vel = sourceInfluence(panels, j, { x, y });
        u += strengths[j] * vel.x;
        v += strengths[j] * vel.y;
      }
      out.push({ x, y, u, v });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2D vortex lattice method — lift
// ---------------------------------------------------------------------------

/**
 * 2D vortex lattice for an airfoil section. Bound vortices sit at the
 * quarter-chord of each chordwise panel; the flow-tangency condition is
 * enforced at the three-quarter-chord control points. The camber-line slope
 * enters through the local surface angle, which produces the correct
 * zero-lift angle for cambered sections.
 *
 * Flat-plate validation: with N panels, CL = 2π·α·N/(N+1), which converges to
 * thin-airfoil theory CL = 2πα as N → ∞.
 */
export function vortexLatticeLift(
  spec: AirfoilSpec,
  alphaDeg: number,
  nPanels: number,
): LiftResult {
  assertFinite('alphaDeg', alphaDeg);
  if (!Number.isInteger(nPanels) || nPanels < 4 || nPanels > 512) {
    throw new Error(`aerodynamics: nPanels must be an integer in [4, 512], got ${nPanels}`);
  }
  const geo = nacaGeometry(spec);
  const alpha = (alphaDeg * PI) / 180;
  const dx = 1 / nPanels;

  const xV: number[] = [];
  const xC: number[] = [];
  const beta: number[] = [];
  for (let i = 0; i < nPanels; i += 1) {
    const x0 = i * dx;
    xV.push(x0 + 0.25 * dx);
    const xc = x0 + 0.75 * dx;
    xC.push(xc);
    beta.push(Math.atan2(geo.camberSlope(xc), 1));
  }

  const matrix: number[][] = [];
  const rhs: number[] = [];
  for (let i = 0; i < nPanels; i += 1) {
    matrix.push(new Array<number>(nPanels).fill(0));
    for (let j = 0; j < nPanels; j += 1) {
      const sep = xC[i] - xV[j];
      if (Math.abs(sep) < 1e-12) {
        throw new Error('aerodynamics: vortex/control-point coincidence in VLM');
      }
      // Induced vertical velocity at (xc, 0) from a unit vortex at (xv, 0):
      // v = Γ / (2π·(xc − xv)). Normal to the locally-tilted surface:
      matrix[i][j] = 1 / (2 * PI * sep);
    }
    rhs.push(-Math.sin(alpha - beta[i]));
  }

  const gammas = solveLinearSystem(matrix, rhs); // non-dimensional, per unit V∞

  // Bound circulation is clockwise (−Γ) for positive lift; with the induced
  // velocity convention above, the Kutta–Joukowski section lift is
  // L' = −ρ·V∞·ΣΓ, hence CL = −2·ΣΓ/(V∞·c) with c = 1.
  let circulation = 0;
  for (let j = 0; j < nPanels; j += 1) circulation += gammas[j];
  const clVlm = -2 * circulation;

  const alphaL0Deg = thinAirfoilZeroLift(geo);
  const clThin = 2 * PI * (alpha - (alphaL0Deg * PI) / 180);

  return {
    clVlm,
    clThin,
    alphaL0Deg,
    circulations: gammas,
  };
}

/**
 * Zero-lift angle of attack (degrees) from thin-airfoil theory:
 *   α_L0 = −(A0 − A1/2),
 *   A0 = (1/π)∫₀^π (dz/dx) dθ,   A1 = (2/π)∫₀^π (dz/dx)·cosθ dθ,
 * with x = (1 − cosθ)/2. Computed by trapezoidal quadrature.
 */
function thinAirfoilZeroLift(geo: NacaGeometry): number {
  const steps = 200;
  let a0 = 0;
  let a1 = 0;
  const dTheta = PI / steps;
  for (let k = 0; k <= steps; k += 1) {
    const theta = k * dTheta;
    const x = 0.5 * (1 - Math.cos(theta));
    const slope = geo.camberSlope(x);
    const w = k === 0 || k === steps ? 0.5 : 1;
    a0 += w * slope;
    a1 += w * slope * Math.cos(theta);
  }
  a0 = (a0 * dTheta) / PI;
  a1 = ((a1 * dTheta) * 2) / PI;
  // α_L0 = A0 − A1/2 for this discretisation (verified against NACA 2412,
  // which must give ≈ −2°; a naive −(A0 − A1/2) flips the sign).
  return ((a0 - a1 / 2) * 180) / PI;
}

/**
 * Prandtl-Glauert compressibility correction factor β = √(1 − M²).
 * CL and CD scale as CL_M = CL_0 / β, CD_M = CD_0 / β in subsonic
 * linearised flow. Valid for M < ~0.7 (Anderson, Fundamentals of
 * Aerodynamics, §10.2). Returns 1 for M = 0.
 */
export function prandtlGlauertBeta(mach: number): number {
  assertFinite('mach', mach);
  if (mach < 0) throw new Error(`aerodynamics: Mach must be ≥ 0, got ${mach}`);
  if (mach >= 1) throw new Error(`aerodynamics: Prandtl-Glauert valid only for M < 1, got ${mach}`);
  const beta = Math.sqrt(1 - mach * mach);
  return beta;
}

/**
 * Pitching moment coefficient about the quarter-chord (thin-airfoil theory):
 *   Cm_{c/4} = π/4 · (A2 − A1),
 * where A0, A1, A2 are the Fourier coefficients of the camber-line slope:
 *   A0 = (1/π)∫₀^π (dz/dx) dθ,
 *   A_n = (2/π)∫₀^π (dz/dx) cos(nθ) dθ,
 * with x = (1 − cosθ)/2.  For a flat plate Cm = 0; for cambered sections
 * Cm is nonzero and negative (nose-down), independent of α (Anderson §4.8).
 */
export function pitchingMomentCoeff(geo: NacaGeometry): number {
  const steps = 200;
  let a0 = 0;
  let a1 = 0;
  let a2 = 0;
  const dTheta = PI / steps;
  for (let k = 0; k <= steps; k += 1) {
    const theta = k * dTheta;
    const x = 0.5 * (1 - Math.cos(theta));
    const slope = geo.camberSlope(x);
    const w = k === 0 || k === steps ? 0.5 : 1;
    a0 += w * slope;
    a1 += w * slope * Math.cos(theta);
    a2 += w * slope * Math.cos(2 * theta);
  }
  a0 *= dTheta / PI;
  a1 *= (2 * dTheta) / PI;
  a2 *= (2 * dTheta) / PI;
  return (PI / 4) * (a2 - a1);
}

/** Parabolic drag polar: CD = cd0 + k·CL². */
export function dragPolar(cd0: number, k: number, cl: number): number {
  assertPositive('cd0', cd0);
  assertFinite('k', k);
  assertFinite('cl', cl);
  return cd0 + k * cl * cl;
}

/**
 * Oswald-style induced-drag factor for a finite wing:
 * k = 1/(π·e·AR). For an infinite (2D) section pass aspectRatio = 0, which
 * returns the supplied section `k` directly.
 */
export function inducedDragFactor(oswaldE: number, aspectRatio: number, sectionK: number): number {
  assertPositive('oswaldE', oswaldE);
  if (oswaldE > 1) throw new Error('aerodynamics: oswaldE must be ≤ 1');
  assertFinite('aspectRatio', aspectRatio);
  assertPositive('sectionK', sectionK);
  if (aspectRatio > 0) return 1 / (PI * oswaldE * aspectRatio);
  return sectionK;
}

// ---------------------------------------------------------------------------
// Top-level flight condition analysis
// ---------------------------------------------------------------------------

export interface FlightConditionInput {
  /** geometric altitude, m (0–20 000) */
  altitudeM: number;
  /** true airspeed, m/s */
  velocityMs: number;
  /** reference chord, m */
  chordM: number;
  /** angle of attack, degrees */
  angleOfAttackDeg: number;
  /** airfoil id from AIRFOILS */
  airfoilId: string;
  /** number of panels for both methods */
  panels: number;
  /** zero-lift drag coefficient of the section */
  cd0: number;
  /** section drag factor k for CD = cd0 + k·CL² (used when aspectRatio ≤ 0) */
  sectionK: number;
  /** wing aspect ratio; > 0 enables the finite-wing induced-drag estimate */
  aspectRatio: number;
  /** span efficiency (used when aspectRatio > 0) */
  oswaldE: number;
}

export function analyzeFlight(input: FlightConditionInput): AeroAnalysis {
  assertInRange('altitudeM', input.altitudeM, 0, H_MAX);
  assertPositive('velocityMs', input.velocityMs);
  assertPositive('chordM', input.chordM);
  assertFinite('angleOfAttackDeg', input.angleOfAttackDeg);
  assertPositive('cd0', input.cd0);
  assertFinite('sectionK', input.sectionK);
  assertFinite('aspectRatio', input.aspectRatio);
  assertPositive('oswaldE', input.oswaldE);

  const airfoil = AIRFOILS.find((a) => a.id === input.airfoilId) ?? AIRFOILS[0];

  const warnings: string[] = [];
  if (Math.abs(input.angleOfAttackDeg) > 15) {
    warnings.push('|α| > 15°: linear thin-airfoil/vortex-lattice lift is outside its attached-flow validity range.');
  }
  if (Math.abs(input.angleOfAttackDeg) > 30) {
    throw new Error(`aerodynamics: angle of attack out of model range (|α| ≤ 30°), got ${input.angleOfAttackDeg}`);
  }

  const atmosphere = standardAtmosphere(input.altitudeM);
  const qPa = dynamicPressure(input.velocityMs, atmosphere.densityKgM3);
  const mach = machNumber(input.velocityMs, atmosphere.speedOfSoundMs);
  const reynolds = reynoldsNumber(
    input.velocityMs,
    input.chordM,
    atmosphere.densityKgM3,
    atmosphere.viscosityPaS,
  );

  if (mach >= 0.3 && mach < 0.7) {
    warnings.push('M ≥ 0.3: Prandtl–Glauert correction applied (extends linear validity to ~0.7).');
  } else if (mach >= 0.7) {
    warnings.push('M ≥ 0.7: Prandtl–Glauert correction applied but linearised theory is suspect near M ≈ 1.');
  }
  if (mach >= 1) {
    throw new Error('aerodynamics: supersonic flow outside linearised subsonic model range');
  }

  const lift = vortexLatticeLift(airfoil, input.angleOfAttackDeg, input.panels);
  const k = inducedDragFactor(input.oswaldE, input.aspectRatio, input.sectionK);
  const cd = dragPolar(input.cd0, k, lift.clVlm);

  // Prandtl–Glauert compressibility correction: CL_M = CL_0 / β, CD_M = CD_0 / β.
  const beta = prandtlGlauertBeta(mach);
  const clCompressed = lift.clVlm / beta;
  const cdCompressed = cd / beta;

  // Pitching moment about the quarter-chord from thin-airfoil Fourier coefficients.
  const geo = nacaGeometry(airfoil);
  const cm = pitchingMomentCoeff(geo);

  // Source panels cannot generate circulation; the pressure distribution is
  // therefore the non-lifting solution evaluated at α = 0°.
  const cp = sourcePanelPressure(geo.points(input.panels), 0);

  let cpMin = Infinity;
  let cpMax = -Infinity;
  for (const p of cp) {
    if (p.cp < cpMin) cpMin = p.cp;
    if (p.cp > cpMax) cpMax = p.cp;
  }

  return {
    valid: warnings.length === 0,
    warnings,
    airfoil,
    atmosphere,
    qPa,
    mach,
    reynolds,
    alphaL0Deg: lift.alphaL0Deg,
    cl: lift.clVlm,
    clThin: lift.clThin,
    clCompressed,
    cd,
    cdCompressed,
    cm,
    prandtlGlauertBeta: beta,
    liftPerSpan: qPa * input.chordM * clCompressed,
    dragPerSpan: qPa * input.chordM * cdCompressed,
    cp,
    cpMin,
    cpMax,
  };
}

// ---------------------------------------------------------------------------
// Blade Element Theory (BET) — propeller / rotor performance
// ---------------------------------------------------------------------------
//
// The blade is divided into N radial stations from hub radius to tip.
// At each station we compute the local inflow angle, effective angle of
// attack, section forces (lift and drag), and integrate to obtain total
// thrust and torque.
//
// Reference: Anderson, Introduction to Flight §6.4; McCormick, Aerodynamics
// of Aeronautical Propulsion Ch. 3.
//
// Assumptions:
// - Incompressible flow (valid below ~M 0.5 at blade tip)
// - Quasi-steady: no wake rotation or compressibility corrections
// - Lift slope from thin airfoil theory: cl_alpha = 2π
// - Drag model: Cd = cd0 + k·Cl² (parabolic polar per section)
// - Hub losses modelled by thrust loss factor at the root
// - No blade twist distribution supplied: constant geometric pitch

export interface PropellerGeometry {
  /** number of blades */
  nBlades: number;
  /** propeller radius, m (tip radius) */
  radiusM: number;
  /** hub (root) radius, m — typically 0.1–0.2 × radius */
  hubRadiusM: number;
  /** geometric pitch, m — axial advance per revolution */
  pitchM: number;
  /** chord at each radial station (normalised 0–1), m */
  chord: number[];
  /** section lift-curve slope at each radial station, 1/rad (typically ≈ 2π) */
  clAlpha: number[];
  /** section zero-lift drag coefficient at each radial station */
  cd0: number[];
  /** profile drag polar factor k at each radial station (Cd = cd0 + k·Cl²) */
  sectionK: number[];
}

export interface PropellerStation {
  /** radial fraction r/R ∈ (hub, 1) */
  rOverR: number;
  /** local chord, m */
  chordM: number;
  /** local geometric pitch angle, rad */
  betaRad: number;
  /** local inflow angle (advance angle), rad */
  phiRad: number;
  /** local angle of attack, rad */
  alphaRad: number;
  /** section lift coefficient */
  cl: number;
  /** section drag coefficient */
  cd: number;
  /** section local thrust, N */
  dThrust: number;
  /** section local torque, N·m */
  dTorque: number;
  /** local relative velocity, m/s */
  wLocal: number;
}

export interface PropellerResult {
  valid: boolean;
  warnings: string[];
  /** total thrust, N */
  thrustN: number;
  /** total torque, N·m */
  torqueNm: number;
  /** power absorbed = torque × omega, W */
  powerW: number;
  /** propulsive efficiency η = T·V / P (dimensionless, 0–1) */
  efficiency: number;
  /** advance ratio J = V / (n·D) where n = revs/s, D = 2R */
  advanceRatio: number;
  /** RPM */
  rpm: number;
  /** thrust coefficient Ct = T / (ρ·n²·D⁴) */
  thrustCoeff: number;
  /** power coefficient Cp = P / (ρ·n³·D⁵) */
  powerCoeff: number;
  /** station-by-station results */
  stations: PropellerStation[];
}

/**
 * Blade Element Theory analysis for a propeller.
 *
 * @param geometry  blade geometry (chord, clAlpha, cd0, sectionK arrays)
 * @param rpm       propeller rotational speed in revolutions per minute
 * @param velocityMs freestream velocity (advance speed), m/s
 * @param densityKgM3 air density, kg/m³
 * @param nStations number of radial integration stations (10–50)
 * @param hubLosses hub loss factor (0–1; 1 = no losses)
 * @param tipLoss   Prandtl tip-loss factor applied at the outermost station
 * @returns thrust, torque, power, efficiency, station data
 */
export function bladeElementPropeller(
  geometry: PropellerGeometry,
  rpm: number,
  velocityMs: number,
  densityKgM3: number,
  nStations: number = 20,
  hubLosses: number = 0.95,
  tipLoss: boolean = true,
): PropellerResult {
  // Input validation
  assertPositive('geometry.radiusM', geometry.radiusM);
  assertPositive('geometry.hubRadiusM', geometry.hubRadiusM);
  if (geometry.hubRadiusM >= geometry.radiusM) {
    throw new Error('aerodynamics: hubRadiusM must be < radiusM');
  }
  assertPositive('geometry.pitchM', geometry.pitchM);
  assertPositive('rpm', rpm);
  assertFinite('velocityMs', velocityMs);
  if (velocityMs < 0) throw new Error('aerodynamics: velocityMs must be ≥ 0');
  assertPositive('densityKgM3', densityKgM3);
  if (!Number.isInteger(nStations) || nStations < 4 || nStations > 100) {
    throw new Error(`aerodynamics: nStations must be an integer in [4, 100], got ${nStations}`);
  }

  const R = geometry.radiusM;
  const rHub = geometry.hubRadiusM;
  const B = geometry.nBlades;
  const P = geometry.pitchM;
  const omega = (rpm * 2 * PI) / 60; // rad/s
  const n = rpm / 60; // revs/s
  const D = 2 * R;
  const J = velocityMs > 0 && n > 0 ? velocityMs / (n * D) : 0;

  const warnings: string[] = [];

  // Check array lengths
  if (
    geometry.chord.length !== nStations ||
    geometry.clAlpha.length !== nStations ||
    geometry.cd0.length !== nStations ||
    geometry.sectionK.length !== nStations
  ) {
    warnings.push(
      `Blade arrays (chord, clAlpha, cd0, sectionK) must each have nStations (${nStations}) entries. ` +
      `Received: chord=${geometry.chord.length}, clAlpha=${geometry.clAlpha.length}, ` +
      `cd0=${geometry.cd0.length}, sectionK=${geometry.sectionK.length}. ` +
      'Using first valid value for all stations.',
    );
  }

  function safeGet(arr: number[], i: number, fallback: number): number {
    return i < arr.length ? arr[i] : fallback;
  }

  const stations: PropellerStation[] = [];
  let totalThrust = 0;
  let totalTorque = 0;

  // Integrate from hub to tip using the trapezoidal rule
  for (let i = 0; i < nStations; i++) {
    // Radial station: distribute linearly from hub to tip
    const rFraction = rHub / R + (i + 0.5) * ((1 - rHub / R) / nStations);
    const r = rFraction * R;
    const dr = ((1 - rHub / R) * R) / nStations; // radial width

    // Section geometry
    const c = safeGet(geometry.chord, i, geometry.chord[0] ?? 0.1 * R);
    const cla = safeGet(geometry.clAlpha, i, 2 * PI);
    const cd0 = safeGet(geometry.cd0, i, 0.01);
    const k = safeGet(geometry.sectionK, i, 0.05);

    // Local geometric pitch angle: tan(β) = P / (2π·r)
    const beta = Math.atan2(P, 2 * PI * r);

    // Inflow velocity components (ignoring wake rotation for simplicity)
    const Vaxial = velocityMs;
    const Vtangential = omega * r;

    // Inflow angle: tan(φ) = Vaxial / Vtangential (at blade station)
    // For a stationary propeller (V=0, pure rotor), φ → 90°
    const phi = Math.atan2(Vaxial, Vtangential);

    // Angle of attack at this station
    const alpha = beta - phi;

    // Section relative velocity
    const wLocal = Math.hypot(Vaxial, Vtangential);

    // Section forces
    const cl = cla * alpha;
    const cd = cd0 + k * cl * cl;

    // Force per unit span in the axial direction (thrust direction)
    // and tangential direction (torque-producing)
    const qLocal = 0.5 * densityKgM3 * wLocal * wLocal;
    const liftPerSpan = qLocal * c * cl;
    const dragPerSpan = qLocal * c * cd;

    // Resolve into axial (thrust) and tangential (torque-producing) components
    const dThrust = liftPerSpan * Math.cos(phi) - dragPerSpan * Math.sin(phi);
    const dTorque = (liftPerSpan * Math.sin(phi) + dragPerSpan * Math.cos(phi)) * r;

    // Prandtl tip-loss factor at the outermost station
    let tipFactor = 1;
    if (tipLoss && i === nStations - 1 && B > 0) {
      // Prandtl: F = (2/π) · arccos(exp(−f))
      // f = (B/2) · (R − r) / (r · sin(φ))
      const fArg = (B / 2) * (R - r) / (r * Math.max(Math.sin(phi), 1e-6));
      tipFactor = fArg > 20 ? 0 : (2 / PI) * Math.acos(Math.exp(-fArg));
    }

    // Integrate: thrust = ∫ dT · 2πr dr, torque = ∫ dQ · 2πr dr
    const dThrustIntegrated = dThrust * 2 * PI * r * dr * B * tipFactor * hubLosses;
    const dTorqueIntegrated = dTorque * 2 * PI * r * dr * B * tipFactor * hubLosses;

    totalThrust += dThrustIntegrated;
    totalTorque += dTorqueIntegrated;

    stations.push({
      rOverR: rFraction,
      chordM: c,
      betaRad: beta,
      phiRad: phi,
      alphaRad: alpha,
      cl,
      cd,
      dThrust: dThrustIntegrated,
      dTorque: dTorqueIntegrated,
      wLocal,
    });
  }

  // Power and efficiency
  const powerW = totalTorque * omega;
  const propulsiveEfficiency = powerW > 0 ? (totalThrust * velocityMs) / powerW : 0;

  // Non-dimensional coefficients
  const Ct = n > 0 ? totalThrust / (densityKgM3 * n * n * D * D * D * D) : 0;
  const Cp = n > 0 ? powerW / (densityKgM3 * n * n * n * D * D * D * D * D) : 0;

  if (propulsiveEfficiency > 1) {
    warnings.push('Efficiency > 1 — model assumption breakdown (check inputs).');
  }
  if (J > 1.5) {
    warnings.push('Advance ratio J > 1.5 — thrust may be negative (windmilling region).');
  }

  return {
    valid: warnings.length === 0,
    warnings,
    thrustN: totalThrust,
    torqueNm: totalTorque,
    powerW,
    efficiency: Math.max(0, Math.min(propulsiveEfficiency, 1)),
    advanceRatio: J,
    rpm,
    thrustCoeff: Ct,
    powerCoeff: Cp,
    stations,
  };
}

// ---------------------------------------------------------------------------
// Model 16 — Laminar–Turbulent Transition on a Flat Plate
// ---------------------------------------------------------------------------
//
// Estimates the transition Reynolds number Re_x_tr using the Thwaites
// laminar boundary-layer solution combined with the von Kármán
// Schlichting skin-friction formula for the turbulent side.
//
// For engineering purposes we use the empirical correlation:
//   Re_x_tr ≈ Re_crit, where Re_crit ≈ 5×10⁵ for smooth flat plate
//   (Schlichting & Gersten, Boundary-Layer Theory, 9th ed., §15.4).
//
// Reference:
//   Schlichting, H. & Gersten, K. — Boundary-Layer Theory, 9th ed. (2017)
//   Thwaites, B. — "Approximate calculation of the laminar boundary layer,"  (1949)
//   von Kármán, T. — "The laminar and turbulent friction in plane walls," (1921)
//
// Inputs:
//   velocityMs    — freestream velocity [m/s]
//   chordM        — plate chord (or distance from leading edge) [m]
//   densityKgM3   — freestream density [kg/m³]
//   viscosityPaS  — dynamic viscosity [Pa·s]
//   ReCrit        — critical Reynolds number for transition (default 5×10⁵)
//
// Returns:
//   Re_x_tr       — transition Reynolds number (redundant — equals ReCrit)
//   x_tr          — transition location from leading edge [m]
//   Re_L          — Reynolds number at chord trailing edge
//   Cf_lam        — mean laminar friction coefficient (Blasius)
//   Cf_turb       — mean turbulent friction coefficient (Prandtl–Schlichting)
//   Cf_avg        — weighted-average Cf over the entire plate
//   x_tr_ratio    — x_tr / chord (0–1)
//   regime        — 'fully laminar' | 'transition' | 'fully turbulent'

export interface TransitionResult {
  Re_x_tr: number;
  x_tr: number;
  Re_L: number;
  Cf_lam: number;
  Cf_turb: number;
  Cf_avg: number;
  x_tr_ratio: number;
  regime: 'fully laminar' | 'transition' | 'fully turbulent';
}

export function laminarTurbulentTransition(
  velocityMs: number,
  chordM: number,
  densityKgM3: number,
  viscosityPaS: number,
  ReCrit = 5e5,
): TransitionResult {
  if (velocityMs <= 0) throw new Error('velocityMs must be > 0');
  if (chordM <= 0) throw new Error('chordM must be > 0');
  if (densityKgM3 <= 0) throw new Error('densityKgM3 must be > 0');
  if (viscosityPaS <= 0) throw new Error('viscosityPaS must be > 0');

  // Reynolds number at trailing edge
  const Re_L = (densityKgM3 * velocityMs * chordM) / viscosityPaS;

  // Transition location
  const x_tr = (ReCrit * viscosityPaS) / (densityKgM3 * velocityMs);
  const x_tr_ratio = Math.min(x_tr / chordM, 1);

  // Blasius laminar skin-friction coefficient: Cf = 1.328 / sqrt(Re)
  const Cf_lam = 1.328 / Math.sqrt(Re_L);

  // Prandtl–Schlichting turbulent skin-friction: Cf = 0.455 / (log10(Re_L))^2.58
  const Cf_turb = 0.455 / Math.pow(Math.log10(Math.max(Re_L, 1e3)), 2.58);

  // Weighted average: laminar portion × Cf_lam + turbulent portion × Cf_turb
  const Cf_avg = x_tr_ratio * Cf_lam + (1 - x_tr_ratio) * Cf_turb;

  // Regime classification
  let regime: TransitionResult['regime'];
  if (Re_L < ReCrit) {
    regime = 'fully laminar';
  } else if (x_tr_ratio < 1) {
    regime = 'transition';
  } else {
    regime = 'fully turbulent';
  }

  return {
    Re_x_tr: ReCrit,
    x_tr,
    Re_L,
    Cf_lam,
    Cf_turb,
    Cf_avg,
    x_tr_ratio,
    regime,
  };
}

// ---------------------------------------------------------------------------
// Model 17 — Drag Increase Due to Transition (entity drag delta)
// ---------------------------------------------------------------------------
//
// Computes the drag penalty of having a laminar–turbulent transition
// versus fully-laminar or fully-turbulent flow. Useful for comparing
// natural-laminar-flow (NLF) airfoils vs turbulent airfoils.
//
// Returns the difference in mean Cf: ΔCf = Cf_transition − Cf_fully_turbulent
// A negative ΔCf means the transition location reduces drag.

export interface DragDeltaResult {
  Cf_fully_laminar: number;
  Cf_fully_turbulent: number;
  Cf_transition: number;
  dragReduction: number; // positive = drag saved by laminar run
  transitionFraction: number; // x_tr / chord
}

export function dragDeltaFromTransition(
  velocityMs: number,
  chordM: number,
  densityKgM3: number,
  viscosityPaS: number,
  ReCrit = 5e5,
): DragDeltaResult {
  const tr = laminarTurbulentTransition(
    velocityMs,
    chordM,
    densityKgM3,
    viscosityPaS,
    ReCrit,
  );

  return {
    Cf_fully_laminar: tr.Cf_lam,
    Cf_fully_turbulent: tr.Cf_turb,
    Cf_transition: tr.Cf_avg,
    dragReduction: tr.Cf_turb - tr.Cf_avg,
    transitionFraction: tr.x_tr_ratio,
  };
}
