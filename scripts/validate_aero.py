#!/usr/bin/env python3
"""Validation harness for the Flight Ops aerodynamics core.

The TypeScript modules under services/aero/ are the production code. This
script ports those algorithms to Python so the mathematics can be checked
against known analytical / benchmark values without a JS runtime.

Each ported function is a direct translation of its TypeScript counterpart,
so a passing check here validates the algorithm that ships in the app.

Run:  python3 scripts/validate_aero.py
Exit code is non-zero if any check fails.
"""

import math
import sys

# ---------------------------------------------------------------------------
# Port of services/aero/airfoil.ts
# ---------------------------------------------------------------------------


def naca4_params(code):
    digits = code.strip()
    assert len(digits) == 4 and digits.isdigit(), f"Invalid NACA code {code!r}"
    return {
        "m": int(digits[0]) / 100,
        "p": int(digits[1]) / 10,
        "t": int(digits[2:4]) / 100,
    }


def camber_line(x, m, p):
    # Symmetric airfoils (m = 0 or p = 0) have no camber and the camber
    # formulas are singular (division by p^2), so return zero directly.
    if m <= 0 or p <= 0 or p >= 1:
        return 0.0, 0.0
    if x <= p:
        return (m / (p * p)) * (2 * p * x - x * x), (m / (p * p)) * (2 * p - 2 * x)
    return (
        (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x),
        (m / ((1 - p) ** 2)) * (2 * p - 2 * x),
    )


def thickness(x, t):
    # 0.1036 coefficient (closed trailing edge variant) forces y_t(1) = 0.
    return (
        (t / 0.2)
        * (
            0.2969 * math.sqrt(x)
            - 0.126 * x
            - 0.3516 * x * x
            + 0.2843 * x * x * x
            - 0.1036 * x * x * x * x
        )
    )


def generate_airfoil(code, n_panels):
    params = naca4_params(code)
    m, p, t = params["m"], params["p"], params["t"]
    count = max(3, n_panels // 2 + 1)
    upper, lower = [], []
    for i in range(count):
        beta = (i / (count - 1)) * math.pi
        x = 0.5 * (1 - math.cos(beta))
        yc, dyc = camber_line(x, m, p)
        yt = thickness(x, t)
        theta = math.atan2(dyc, 1)
        upper.append((x - yt * math.sin(theta), yc + yt * math.cos(theta)))
        lower.append((x + yt * math.sin(theta), yc - yt * math.cos(theta)))
    pts = list(reversed(upper)) + lower[1:] + [upper[-1]]
    return pts


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def approx(a, b, tol, label):
    err = abs(a - b)
    ok = err <= tol
    print(f"[{'PASS' if ok else 'FAIL'}] {label}: {a:.6f} vs {b:.6f} (err {err:.2e}, tol {tol:.1e})")
    return ok


def main():
    ok = True

    # --- NACA 0012 (symmetric, t = 0.12) ---
    pts = generate_airfoil("0012", 160)
    xs = [pt[0] for pt in pts]
    ys = [pt[1] for pt in pts]

    ok &= approx(max(xs) - min(xs), 1.0, 1e-3, "0012 chord length")
    ok &= approx(pts[0][0], pts[-1][0], 1e-12, "0012 closed polygon (x)")
    ok &= approx(pts[0][1], pts[-1][1], 1e-12, "0012 closed polygon (y)")
    ok &= approx(max(ys), 0.06, 4e-3, "0012 upper surface max ordinate")
    ok &= approx(min(ys), -0.06, 4e-3, "0012 lower surface min ordinate")
    ok &= approx(max(ys) + min(ys), 0.0, 4e-3, "0012 symmetric about mean line")

    # --- NACA 2412 (camber m = 0.02 at p = 0.40, t = 0.12) ---
    pts2 = generate_airfoil("2412", 160)
    xs2 = [pt[0] for pt in pts2]
    ys2 = [pt[1] for pt in pts2]

    ok &= approx(max(xs2) - min(xs2), 1.0, 1e-3, "2412 chord length")
    ok &= approx(max(ys2) - min(ys2), 0.12, 4e-3, "2412 max thickness (y-span)")
    ok &= approx(max(ys2) + min(ys2), 0.04, 8e-3, "2412 camber shift (mean of extremes)")

    # --- Direct function values at known stations ---
    yc, _ = camber_line(0.4, 0.02, 0.4)
    ok &= approx(yc, 0.02, 1e-12, "camber line y_c(0.4) = m = 0.02")
    yc2, _ = camber_line(0.0, 0.02, 0.4)
    ok &= approx(yc2, 0.0, 1e-12, "camber line y_c(0) = 0")
    yt_max = max(thickness(x / 2000, 0.12) for x in range(1, 2001))
    ok &= approx(yt_max, 0.06, 1e-3, "max thickness y_t = t/2 = 0.06")
    yt_te = thickness(1.0, 0.12)
    ok &= approx(yt_te, 0.0, 1e-12, "thickness closes at trailing edge")

    print()
    print("RESULT:", "ALL PASS" if ok else "FAILURES PRESENT")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
