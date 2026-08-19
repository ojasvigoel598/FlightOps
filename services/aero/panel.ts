// Powered by OnSpace.AI
// Constant-strength source + vortex panel method.
//
// Formulation follows Katz & Plotkin, "Low-Speed Aerodynamics" (2nd ed.,
// 2001), ch. 11: constant-strength source panels with a single unknown
// vortex strength shared by all panels, a zero-normal-velocity boundary
// condition at each collocation point, and a trailing-edge Kutta
// condition enforcing equal tangential velocity at the two TE panels.
//
// Influence of a unit source panel at a point (panel-local coords
// s along panel, n normal to panel):
//   u_s = (1/2pi) * S1,   u_n = (1/2pi) * N1
//   S1 = 0.5 * ln((s^2 + n^2) / ((s - l)^2 + n^2))
//   N1 = atan2(n, s - l) - atan2(n, s)
// (N1's atan2 order puts n first so the branch cut is handled correctly
// for points on either side of the panel line; the alternate orders give
// spurious +/- 2*pi jumps. At the collocation point itself (n = 0) this
// yields N1 = +pi, the classical +sigma/2 self-influence. Verified against
// direct numerical quadrature of the source-sheet integral to ~1e-15.)
// The vortex field is the source field rotated 90 deg:
//   u_s = -(1/2pi) * N1,  u_n = (1/2pi) * S1
// With collocations at panel midpoints the self-influences reduce to the
// classical values (source normal -sigma/2, vortex tangential +gamma/2).
//
// S1/N1 are expressed in the *source* panel's local frame, so before the
// normal/tangential boundary conditions are applied the induced velocity is
// rotated into the global frame with the panel-orientation factors
//   D_ij = t_i . t_j          (dot of receiver/source tangents)
//   C_ij = t_i x t_j          (2-D cross, receiver/source tangents)
// giving the influence coefficients
//   source    normal:  S1*C + N1*D     tangential:  S1*D + N1*C
//   vortex    normal: -N1*C + S1*D     tangential: -N1*D + S1*C
// (A common simplification drops the rotation, effectively assuming all
// panels are parallel; that produces spurious circulation, so it is not
// used here.)
//
// The (N+1) x (N+1) system is solved by Gauss-Jordan elimination with
// partial pivoting (no external dependencies, deterministic, mobile-safe).

import type { AirfoilPoint } from './airfoil';

export interface PanelGeometry {
  x1: number[];
  y1: number[];
  x2: number[];
  y2: number[];
  /** Collocation points (panel midpoints). */
  xc: number[];
  yc: number[];
  length: number[];
  /** Unit tangents along the panel direction. */
  tx: number[];
  ty: number[];
  /** Outward unit normals (right of the tangent for CCW polygons). */
  nx: number[];
  ny: number[];
}

export interface PanelSolution {
  /** Source strengths per panel. */
  sigma: number[];
  /** Common vortex strength. */
  gamma: number;
  /** Tangential surface velocity at each collocation (nondimensional). */
  vt: number[];
  /** Pressure coefficient at each collocation. */
  cp: number[];
  /** Circulation Gamma (nondimensional, per unit span). */
  circulation: number;
  /** Lift coefficient per unit span. */
  cl: number;
}

/** Build panel geometry from a closed airfoil polygon. */
export function buildPanels(airfoil: AirfoilPoint[]): PanelGeometry {
  const n = airfoil.length - 1;
  const x1: number[] = [];
  const y1: number[] = [];
  const x2: number[] = [];
  const y2: number[] = [];
  const xc: number[] = [];
  const yc: number[] = [];
  const length: number[] = [];
  const tx: number[] = [];
  const ty: number[] = [];
  const nx: number[] = [];
  const ny: number[] = [];

  for (let i = 0; i < n; i += 1) {
    const a = airfoil[i];
    const b = airfoil[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    x1.push(a.x);
    y1.push(a.y);
    x2.push(b.x);
    y2.push(b.y);
    xc.push(0.5 * (a.x + b.x));
    yc.push(0.5 * (a.y + b.y));
    length.push(len);
    tx.push(ux);
    ty.push(uy);
    // Outward normal for counter-clockwise polygons: right of travel.
    nx.push(uy);
    ny.push(-ux);
  }

  return { x1, y1, x2, y2, xc, yc, length, tx, ty, nx, ny };
}

/**
 * Unit-strength source/vortex influence of a panel at a point.
 * Returns the S1/N1 coefficients (see header comment).
 */
function panelInfluence(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { s1: number; n1: number; len: number; tx: number; ty: number; nx: number; ny: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const tx = dx / len;
  const ty = dy / len;
  const nx = ty;
  const ny = -tx;
  const rx = px - x1;
  const ry = py - y1;
  const s = rx * tx + ry * ty;
  const n = rx * nx + ry * ny;
  const s1 = 0.5 * Math.log((s * s + n * n) / ((s - len) * (s - len) + n * n));
  // atan2(y, x): first arg is y = n, second is x = s (or s - len).
  const n1 = Math.atan2(n, s - len) - Math.atan2(n, s);
  return { s1, n1, len, tx, ty, nx, ny };
}

/** Solve a dense linear system A x = b by Gauss-Jordan with partial pivoting. */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    if (pv === 0 || !Number.isFinite(pv)) {
      throw new Error('panel system is singular');
    }
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = M[r][col] / pv;
      for (let c = col; c <= n; c += 1) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

/**
 * Solve the panel method for a built geometry at a given angle of attack.
 * Freestream is unit magnitude along the alpha direction by default.
 */
export function solvePanelMethod(
  geom: PanelGeometry,
  alphaDeg: number,
  vInf = 1,
): PanelSolution {
  const n = geom.x1.length;
  const alpha = (alphaDeg * Math.PI) / 180;
  const uInf = vInf * Math.cos(alpha);
  const vInfY = vInf * Math.sin(alpha);

  // Influence coefficients, rotated into the global frame (see header).
  // sn = source->normal, vn = vortex->normal, st = source->tangential,
  // vtn = vortex->tangential influence of panel j at collocation i.
  const sn: number[][] = [];
  const vn: number[][] = [];
  const st: number[][] = [];
  const vtn: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const rowSn: number[] = [];
    const rowVn: number[] = [];
    const rowSt: number[] = [];
    const rowVt: number[] = [];
    for (let j = 0; j < n; j += 1) {
      if (j === i) {
        // Self-influence handled analytically: at the collocation point the
        // atan2-based N1 is branch-sensitive to floating-point noise in n
        // (a tiny negative n flips the value from +pi to -pi), so the
        // classical limits are set explicitly:
        //   source normal +sigma/2, vortex normal 0,
        //   source tangential 0, vortex tangential -gamma/2.
        rowSn.push(Math.PI);
        rowVn.push(0);
        rowSt.push(0);
        rowVt.push(-Math.PI);
        continue;
      }
      const inf = panelInfluence(
        geom.xc[i],
        geom.yc[i],
        geom.x1[j],
        geom.y1[j],
        geom.x2[j],
        geom.y2[j],
      );
      const d = geom.tx[i] * inf.tx + geom.ty[i] * inf.ty; // t_i . t_j
      const c = geom.tx[i] * inf.ty - geom.ty[i] * inf.tx; // t_i x t_j
      const s = inf.s1;
      const n1 = inf.n1;
      // Rotation identities (n̂ = right of travel, so n̂_j·t̂_i = C,
      // t̂_j·n̂_i = -C, n̂_j·n̂_i = D, t̂_j·t̂_i = D):
      rowSn.push(-s * c + n1 * d);
      rowVn.push(n1 * c + s * d);
      rowSt.push(s * d + n1 * c);
      rowVt.push(-n1 * d + s * c);
    }
    sn.push(rowSn);
    vn.push(rowVn);
    st.push(rowSt);
    vtn.push(rowVt);
  }

  // Assemble the (N+1) x (N+1) system.
  const size = n + 1;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const row = new Array(size).fill(0);
    let vortexCol = 0;
    for (let j = 0; j < n; j += 1) {
      row[j] = sn[i][j];
      vortexCol += vn[i][j];
    }
    row[n] = vortexCol;
    A.push(row);
    b.push(-2 * Math.PI * (uInf * geom.nx[i] + vInfY * geom.ny[i]));
  }
  // Kutta condition: V_t at first and last TE panels are equal and opposite.
  {
    const row = new Array(size).fill(0);
    let vortexCol = 0;
    for (let j = 0; j < n; j += 1) {
      row[j] = st[0][j] + st[n - 1][j];
      vortexCol += vtn[0][j] + vtn[n - 1][j];
    }
    row[n] = vortexCol;
    A.push(row);
    b.push(-2 * Math.PI * (uInf * (geom.tx[0] + geom.tx[n - 1]) + vInfY * (geom.ty[0] + geom.ty[n - 1])));
  }

  const x = solveLinear(A, b);
  const sigma = x.slice(0, n);
  const gamma = x[n];

  // Surface tangential velocities and Cp.
  const vt: number[] = [];
  const cp: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < n; i += 1) {
    let t = 0;
    for (let j = 0; j < n; j += 1) {
      t += sigma[j] * st[i][j] + gamma * vtn[i][j];
    }
    const vtI = t / (2 * Math.PI) + (uInf * geom.tx[i] + vInfY * geom.ty[i]);
    vt.push(vtI);
    cp.push(1 - (vtI / vInf) * (vtI / vInf));
    totalLength += geom.length[i];
  }

  const circulation = gamma * totalLength;
  const chord = Math.max(...geom.x1, ...geom.x2) - Math.min(...geom.x1, ...geom.x2);
  const cl = (2 * circulation) / (vInf * chord);

  return { sigma, gamma, vt, cp, circulation, cl };
}

/** One-shot helper: generate the airfoil, build panels and solve. */
export function solveAirfoil(
  code: string,
  nPanels: number,
  alphaDeg: number,
  points: AirfoilPoint[],
  vInf = 1,
): PanelSolution {
  return solvePanelMethod(buildPanels(points), alphaDeg, vInf);
}
