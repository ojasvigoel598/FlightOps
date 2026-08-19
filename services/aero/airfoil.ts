// Powered by OnSpace.AI
// NACA 4-digit airfoil geometry. Pure functions, no React.
//
// Construction follows the standard NACA 4-digit definition
// (Abbott & von Doenhoff, "Theory of Wing Sections", 1959):
//
//   mean camber line:
//     y_c(x) = (m/p^2) * (2 p x - x^2)                 for 0 <= x <= p
//     y_c(x) = (m/(1-p)^2) * ((1-2p) + 2 p x - x^2)    for p <= x <= 1
//
//   thickness (closed trailing edge):
//     y_t(x) = (t/0.2) * (0.2969 sqrt(x) - 0.1260 x
//                         - 0.3516 x^2 + 0.2843 x^3 - 0.1036 x^4)
//   The 0.1036 coefficient (rather than the classic 0.1015) forces
//   y_t(1) = 0 so the trailing edge closes exactly, which is the
//   standard choice in computational panel codes.
//
//   surface ordinates:
//     x_u = x - y_t sin(theta),  y_u = y_c + y_t cos(theta)
//     x_l = x + y_t sin(theta),  y_l = y_c - y_t cos(theta)
//     theta = atan(dy_c/dx)
//
// Points are cosine-spaced along the chord to cluster near the leading
// and trailing edges, then assembled into a closed polygon ordered
// TE -> upper surface -> LE -> lower surface -> TE (counter-clockwise).

export interface AirfoilPoint {
  x: number;
  y: number;
}

export interface AirfoilParams {
  /** Max camber as a fraction of chord (e.g. 0.02 for NACA 2412). */
  m: number;
  /** Chordwise position of max camber as a fraction of chord (e.g. 0.4). */
  p: number;
  /** Max thickness as a fraction of chord (e.g. 0.12). */
  t: number;
}

/** Parse a NACA 4-digit code such as "0012" or "2412". */
export function naca4Params(code: string): AirfoilParams {
  const digits = code.trim();
  if (!/^\d{4}$/.test(digits)) {
    throw new Error(`Invalid NACA 4-digit code: "${code}"`);
  }
  return {
    m: Number(digits[0]) / 100,
    p: Number(digits[1]) / 10,
    t: Number(digits[2] + digits[3]) / 100,
  };
}

/** Mean camber line ordinate and slope at station x. */
function camberLine(x: number, m: number, p: number): { yc: number; dyc: number } {
  // Symmetric airfoils (m = 0 or p = 0) have no camber and the camber
  // formulas are singular (division by p^2), so return zero directly.
  if (m <= 0 || p <= 0 || p >= 1) return { yc: 0, dyc: 0 };
  if (x <= p) {
    return {
      yc: (m / (p * p)) * (2 * p * x - x * x),
      dyc: (m / (p * p)) * (2 * p - 2 * x),
    };
  }
  return {
    yc: (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x),
    dyc: (m / ((1 - p) * (1 - p))) * (2 * p - 2 * x),
  };
}

/** Half-thickness at station x (closed trailing edge variant). */
function thickness(x: number, t: number): number {
  return (
    (t / 0.2) *
    (0.2969 * Math.sqrt(x) -
      0.126 * x -
      0.3516 * x * x +
      0.2843 * x * x * x -
      0.1036 * x * x * x * x)
  );
}

/**
 * Generate a closed airfoil polygon with `nPanels` panels.
 * Returns `nPanels + 1` points (first point repeated at the end).
 */
export function generateAirfoil(code: string, nPanels: number): AirfoilPoint[] {
  const { m, p, t } = naca4Params(code);
  const count = Math.max(3, Math.floor(nPanels / 2) + 1);

  const upper: AirfoilPoint[] = [];
  const lower: AirfoilPoint[] = [];

  for (let i = 0; i < count; i += 1) {
    const beta = (i / (count - 1)) * Math.PI;
    const x = 0.5 * (1 - Math.cos(beta)); // cosine-spaced, clustered at LE/TE
    const { yc, dyc } = camberLine(x, m, p);
    const yt = thickness(x, t);
    const theta = Math.atan2(dyc, 1);
    upper.push({ x: x - yt * Math.sin(theta), y: yc + yt * Math.cos(theta) });
    lower.push({ x: x + yt * Math.sin(theta), y: yc - yt * Math.cos(theta) });
  }

  // TE -> upper surface -> LE -> lower surface -> TE.
  const pts: AirfoilPoint[] = [];
  for (let i = upper.length - 1; i >= 0; i -= 1) pts.push(upper[i]);
  for (let i = 1; i < lower.length; i += 1) pts.push(lower[i]);
  pts.push({ ...pts[0] });
  return pts;
}
