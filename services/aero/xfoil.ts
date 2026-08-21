// XFoil / UIUC Airfoil Database integration.
//
// Fetches airfoil coordinates from the Selig UIUC Airfoil Database
// (https://m-selig.ae.illinois.edu/ads/coord_database.html).
//
// No API key required. The database is public and maintained by
// the UIUC Applied Aerodynamics Group (Michael Selig).
//
// Usage:
//   const results = await searchAirfoils('clark');
//   const coords = await fetchAirfoilCoords('clarky');
//   const all = await getAirfoilList();

import { type AirfoilPoint } from './airfoil';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AirfoilEntry {
  /** Airfoil name (e.g. "naca0012", "clarky", "e423") */
  name: string;
  /** Display name (e.g. "NACA 0012", "Clark Y", "Eppler 423") */
  displayName: string;
  /** Source URL */
  url: string;
}

export interface AirfoilCoords {
  name: string;
  displayName: string;
  /** Upper surface points (x, y) */
  upper: AirfoilPoint[];
  /** Lower surface points (x, y) */
  lower: AirfoilPoint[];
  /** All points as a closed polygon (TE -> upper -> LE -> lower -> TE) */
  all: AirfoilPoint[];
  /** Number of points */
  pointCount: number;
}

// ---------------------------------------------------------------------------
// UIUC database URL
// ---------------------------------------------------------------------------

const UIUC_BASE = 'https://m-selig.ae.illinois.edu/ads/coord';

// Curated list of well-known airfoils (name -> displayName)
// This is a subset of the most commonly used airfoils from the UIUC database.
// The full database has 1600+ airfoils.
const KNOWN_AIRFOILS: AirfoilEntry[] = [
  // NACA 4-digit series
  { name: 'naca0006', displayName: 'NACA 0006', url: `${UIUC_BASE}/naca0006.dat` },
  { name: 'naca0009', displayName: 'NACA 0009', url: `${UIUC_BASE}/naca0009.dat` },
  { name: 'naca0012', displayName: 'NACA 0012', url: `${UIUC_BASE}/naca0012.dat` },
  { name: 'naca0015', displayName: 'NACA 0015', url: `${UIUC_BASE}/naca0015.dat` },
  { name: 'naca0018', displayName: 'NACA 0018', url: `${UIUC_BASE}/naca0018.dat` },
  { name: 'naca0021', displayName: 'NACA 0021', url: `${UIUC_BASE}/naca0021.dat` },
  { name: 'naca0025', displayName: 'NACA 0025', url: `${UIUC_BASE}/naca0025.dat` },
  { name: 'naca23012', displayName: 'NACA 23012', url: `${UIUC_BASE}/naca23012.dat` },
  { name: 'naca23015', displayName: 'NACA 23015', url: `${UIUC_BASE}/naca23015.dat` },
  { name: 'naca23018', displayName: 'NACA 23018', url: `${UIUC_BASE}/naca23018.dat` },
  { name: 'naca23021', displayName: 'NACA 23021', url: `${UIUC_BASE}/naca23021.dat` },
  { name: 'naca23024', displayName: 'NACA 23024', url: `${UIUC_BASE}/naca23024.dat` },
  { name: 'naca2412', displayName: 'NACA 2412', url: `${UIUC_BASE}/naca2412.dat` },
  { name: 'naca2415', displayName: 'NACA 2415', url: `${UIUC_BASE}/naca2415.dat` },
  { name: 'naca2418', displayName: 'NACA 2418', url: `${UIUC_BASE}/naca2418.dat` },
  { name: 'naca4412', displayName: 'NACA 4412', url: `${UIUC_BASE}/naca4412.dat` },
  { name: 'naca4415', displayName: 'NACA 4415', url: `${UIUC_BASE}/naca4415.dat` },
  { name: 'naca4418', displayName: 'NACA 4418', url: `${UIUC_BASE}/naca4418.dat` },
  { name: 'naca63-212', displayName: 'NACA 63-212', url: `${UIUC_BASE}/naca63-212.dat` },
  { name: 'naca63a-210', displayName: 'NACA 63A-210', url: `${UIUC_BASE}/naca63a210.dat` },
  { name: 'naca64-208', displayName: 'NACA 64-208', url: `${UIUC_BASE}/naca64-208.dat` },
  { name: 'naca64-212', displayName: 'NACA 64-212', url: `${UIUC_BASE}/naca64-212.dat` },
  { name: 'naca65-206', displayName: 'NACA 65-206', url: `${UIUC_BASE}/naca65-206.dat` },
  { name: 'naca65-209', displayName: 'NACA 65-209', url: `${UIUC_BASE}/naca65-209.dat` },
  { name: 'naca65-212', displayName: 'NACA 65-212', url: `${UIUC_BASE}/naca65-212.dat` },
  // NACA 5-digit series
  { name: 'naca1412', displayName: 'NACA 1412', url: `${UIUC_BASE}/naca1412.dat` },
  { name: 'naca22112', displayName: 'NACA 22112', url: `${UIUC_BASE}/naca22112.dat` },
  // Clark series
  { name: 'clarky', displayName: 'Clark Y', url: `${UIUC_BASE}/clarky.dat` },
  { name: 'clark-x', displayName: 'Clark X', url: `${UIUC_BASE}/clark-x.dat` },
  { name: 'clarkyhp', displayName: 'Clark YH', url: `${UIUC_BASE}/clarkyhp.dat` },
  // Eppler series
  { name: 'e387', displayName: 'Eppler 387', url: `${UIUC_BASE}/e387.dat` },
  { name: 'e423', displayName: 'Eppler 423', url: `${UIUC_BASE}/e423.dat` },
  { name: 'e473', displayName: 'Eppler 473', url: `${UIUC_BASE}/e473.dat` },
  // Gottingen series
  { name: 'gottingen398', displayName: 'Göttingen 398', url: `${UIUC_BASE}/goe398.dat` },
  { name: 'gottingen535', displayName: 'Göttingen 535', url: `${UIUC_BASE}/goe535.dat` },
  // Joukowski
  { name: 'joukowski', displayName: 'Joukowski', url: `${UIUC_BASE}/joukowski.dat` },
  // Korn
  { name: 'korn', displayName: 'Korn', url: `${UIUC_BASE}/korn.dat` },
  // Munk
  { name: 'munk1', displayName: 'Munk 1', url: `${UIUC_BASE}/munk1.dat` },
  // NLR series
  { name: 'nlr7301', displayName: 'NLR 7301', url: `${UIUC_BASE}/nlr7301.dat` },
  // Plonski
  { name: 'plonski223', displayName: 'Plonksi 223', url: `${UIUC_BASE}/plonski223.dat` },
  // RAE series
  { name: 'rae2822', displayName: 'RAE 2822', url: `${UIUC_BASE}/rae2822.dat` },
  // Selig series (glider/low-speed)
  { name: 's1010', displayName: 'Selig 1010', url: `${UIUC_BASE}/s1010.dat` },
  { name: 's1012', displayName: 'Selig 1012', url: `${UIUC_BASE}/s1012.dat` },
  { name: 's1014', displayName: 'Selig 1014', url: `${UIUC_BASE}/s1014.dat` },
  { name: 's1016', displayName: 'Selig 1016', url: `${UIUC_BASE}/s1016.dat` },
  { name: 's1018', displayName: 'Selig 1018', url: `${UIUC_BASE}/s1018.dat` },
  { name: 's1020', displayName: 'Selig 1020', url: `${UIUC_BASE}/s1020.dat` },
  { name: 's1022', displayName: 'Selig 1022', url: `${UIUC_BASE}/s1022.dat` },
  { name: 's1024', displayName: 'Selig 1024', url: `${UIUC_BASE}/s1024.dat` },
  { name: 's1026', displayName: 'Selig 1026', url: `${UIUC_BASE}/s1026.dat` },
  { name: 's1028', displayName: 'Selig 1028', url: `${UIUC_BASE}/s1028.dat` },
  { name: 's1030', displayName: 'Selig 1030', url: `${UIUC_BASE}/s1030.dat` },
  { name: 's1046', displayName: 'Selig 1046', url: `${UIUC_BASE}/s1046.dat` },
  { name: 's1048', displayName: 'Selig 1048', url: `${UIUC_BASE}/s1048.dat` },
  { name: 's1050', displayName: 'Selig 1050', url: `${UIUC_BASE}/s1050.dat` },
  { name: 's1060', displayName: 'Selig 1060', url: `${UIUC_BASE}/s1060.dat` },
  { name: 's1070', displayName: 'Selig 1070', url: `${UIUC_BASE}/s1070.dat` },
  { name: 's1080', displayName: 'Selig 1080', url: `${UIUC_BASE}/s1080.dat` },
  { name: 's1090', displayName: 'Selig 1090', url: `${UIUC_BASE}/s1090.dat` },
  { name: 's1100', displayName: 'Selig 1100', url: `${UIUC_BASE}/s1100.dat` },
  { name: 's1120', displayName: 'Selig 1120', url: `${UIUC_BASE}/s1120.dat` },
  { name: 's1210', displayName: 'Selig 1210', url: `${UIUC_BASE}/s1210.dat` },
  { name: 's1223', displayName: 'Selig 1223', url: `${UIUC_BASE}/s1223.dat` },
  { name: 's2010', displayName: 'Selig 2010', url: `${UIUC_BASE}/s2010.dat` },
  { name: 's2020', displayName: 'Selig 2020', url: `${UIUC_BASE}/s2020.dat` },
  { name: 's2030', displayName: 'Selig 2030', url: `${UIUC_BASE}/s2030.dat` },
  { name: 's2040', displayName: 'Selig 2040', url: `${UIUC_BASE}/s2040.dat` },
  { name: 's2050', displayName: 'Selig 2050', url: `${UIUC_BASE}/s2050.dat` },
  { name: 's2060', displayName: 'Selig 2060', url: `${UIUC_BASE}/s2060.dat` },
  { name: 's2070', displayName: 'Selig 2070', url: `${UIUC_BASE}/s2070.dat` },
  { name: 's2080', displayName: 'Selig 2080', url: `${UIUC_BASE}/s2080.dat` },
  { name: 's2090', displayName: 'Selig 2090', url: `${UIUC_BASE}/s2090.dat` },
  { name: 's2100', displayName: 'Selig 2100', url: `${UIUC_BASE}/s2100.dat` },
  { name: 's2300', displayName: 'Selig 2300', url: `${UIUC_BASE}/s2300.dat` },
  { name: 's2310', displayName: 'Selig 2310', url: `${UIUC_BASE}/s2310.dat` },
  { name: 's3010', displayName: 'Selig 3010', url: `${UIUC_BASE}/s3010.dat` },
  { name: 's3021', displayName: 'Selig 3021', url: `${UIUC_BASE}/s3021.dat` },
  { name: 's3031', displayName: 'Selig 3031', url: `${UIUC_BASE}/s3031.dat` },
  { name: 's4020', displayName: 'Selig 4020', url: `${UIUC_BASE}/s4020.dat` },
  { name: 's4060', displayName: 'Selig 4060', url: `${UIUC_BASE}/s4060.dat` },
  { name: 's5010', displayName: 'Selig 5010', url: `${UIUC_BASE}/s5010.dat` },
  { name: 's5020', displayName: 'Selig 5020', url: `${UIUC_BASE}/s5020.dat` },
  { name: 's5030', displayName: 'Selig 5030', url: `${UIUC_BASE}/s5030.dat` },
  { name: 's5040', displayName: 'Selig 5040', url: `${UIUC_BASE}/s5040.dat` },
  { name: 's5050', displayName: 'Selig 5050', url: `${UIUC_BASE}/s5050.dat` },
  { name: 's5060', displayName: 'Selig 5060', url: `${UIUC_BASE}/s5060.dat` },
  { name: 's5070', displayName: 'Selig 5070', url: `${UIUC_BASE}/s5070.dat` },
  // Boeing series
  { name: 'boeing-volmer-vj', displayName: 'Boeing-Volmer VJ', url: `${UIUC_BASE}/boeing-volmer-vj.dat` },
  // Wortmann series
  { name: 'wortmann-fx-60-100', displayName: 'Wortmann FX 60-100', url: `${UIUC_BASE}/fx60100.dat` },
  { name: 'wortmann-fx-61-163', displayName: 'Wortmann FX 61-163', url: `${UIUC_BASE}/fx61163.dat` },
  { name: 'wortmann-fx-63-137', displayName: 'Wortmann FX 63-137', url: `${UIUC_BASE}/fx63137.dat` },
  { name: 'wortmann-fx-67-170', displayName: 'Wortmann FX 67-170', url: `${UIUC_BASE}/fx67170.dat` },
  { name: 'wortmann-fx-69-170', displayName: 'Wortmann FX 69-170', url: `${UIUC_BASE}/fx69170.dat` },
  { name: 'wortmann-fx-71-150', displayName: 'Wortmann FX 71-150', url: `${UIUC_BASE}/fx71150.dat` },
  { name: 'wortmann-fx-72-150', displayName: 'Wortmann FX 72-150', url: `${UIUC_BASE}/fx72150.dat` },
  { name: 'wortmann-fx-73-170', displayName: 'Wortmann FX 73-170', url: `${UIUC_BASE}/fx73170.dat` },
  // AG series
  { name: 'ag25', displayName: 'AG 25', url: `${UIUC_BASE}/ag25.dat` },
  { name: 'ag35', displayName: 'AG 35', url: `${UIUC_BASE}/ag35.dat` },
  { name: 'ag37', displayName: 'AG 37', url: `${UIUC_BASE}/ag37.dat` },
  { name: 'ag43', displayName: 'AG 43', url: `${UIUC_BASE}/ag43.dat` },
  { name: 'ag45', displayName: 'AG 45', url: `${UIUC_BASE}/ag45.dat` },
  { name: 'ag48', displayName: 'AG 48', url: `${UIUC_BASE}/ag48.dat` },
];

// ---------------------------------------------------------------------------
// Parse XFoil .dat format
// ---------------------------------------------------------------------------

/**
 * Parse XFoil/UIUC .dat file format.
 * Format: header lines (starting with letter or NACA code), then
 * two columns of x,y coordinates, upper surface then lower surface.
 * Some files have header "Max thickness" line between upper and lower.
 */
function parseDatFile(raw: string, name: string, displayName: string): AirfoilCoords {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const points: AirfoilPoint[] = [];

  let isLower = false;
  let upperPoints: AirfoilPoint[] = [];
  let lowerPoints: AirfoilPoint[] = [];

  for (const line of lines) {
    // Skip header lines (contain letters but not coordinates)
    if (/^[A-Za-z]/.test(line) && !/^\d/.test(line)) {
      // Check if this is the separator between upper and lower surfaces
      if (/thickness/i.test(line) || /max\s+t/i.test(line)) {
        isLower = true;
        continue;
      }
      // Skip other header lines
      continue;
    }

    // Try to parse as "x y" coordinate pair
    const parts = line.split(/[\s,]+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      if (!isNaN(x) && !isNaN(y)) {
        if (isLower) {
          lowerPoints.push({ x, y });
        } else {
          upperPoints.push({ x, y });
        }
      }
    }
  }

  // If we couldn't separate upper/lower, treat all as a single surface
  if (upperPoints.length === 0 && lowerPoints.length === 0) {
    return {
      name,
      displayName,
      upper: [],
      lower: [],
      all: [],
      pointCount: 0,
    };
  }

  // Combine into ordered polygon: TE -> upper -> LE -> lower -> TE
  // Upper surface goes from TE (x=1) to LE (x=0)
  // Lower surface goes from LE (x=0) to TE (x=1)
  all = [...upperPoints, ...lowerPoints];

  return {
    name,
    displayName,
    upper: upperPoints,
    lower: lowerPoints,
    all,
    pointCount: all.length,
  };
}

let all: AirfoilPoint[] = [];

// ---------------------------------------------------------------------------
// Fetch airfoil coordinates from UIUC
// ---------------------------------------------------------------------------

/**
 * Fetch airfoil coordinates from the UIUC database.
 * Returns parsed coordinate data or null if not found.
 */
export async function fetchAirfoilCoords(airfoilName: string): Promise<AirfoilCoords | null> {
  const entry = KNOWN_AIRFOILS.find(
    a => a.name === airfoilName.toLowerCase() ||
         a.name === airfoilName.toLowerCase().replace(/\s+/g, '')
  );

  if (!entry) {
    // Try constructing URL from the name
    const url = `${UIUC_BASE}/${airfoilName.toLowerCase().replace(/\s+/g, '')}.dat`;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const text = await resp.text();
        return parseDatFile(text, airfoilName, airfoilName);
      }
    } catch {
      // Fall through
    }
    return null;
  }

  try {
    const resp = await fetch(entry.url);
    if (!resp.ok) return null;
    const text = await resp.text();
    return parseDatFile(text, entry.name, entry.displayName);
  } catch {
    return null;
  }
}

/**
 * Search airfoils by name or keyword.
 * Returns matching entries from the curated list.
 * Search is case-insensitive and matches partial strings.
 */
export function searchAirfoils(query: string): AirfoilEntry[] {
  if (!query || query.trim().length === 0) return KNOWN_AIRFOILS.slice(0, 20);

  const q = query.toLowerCase().trim();
  return KNOWN_AIRFOILS.filter(a =>
    a.name.includes(q) ||
    a.displayName.toLowerCase().includes(q)
  );
}

/**
 * Get the full list of known airfoils.
 */
export function getAirfoilList(): AirfoilEntry[] {
  return KNOWN_AIRFOILS;
}

/**
 * Get airfoil info by name.
 */
export function getAirfoilInfo(name: string): AirfoilEntry | undefined {
  return KNOWN_AIRFOILS.find(
    a => a.name === name.toLowerCase() ||
         a.displayName.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Detect airfoil family from name.
 */
export function detectFamily(name: string): string {
  const n = name.toLowerCase();
  if (n.startsWith('naca')) return 'NACA';
  if (n.startsWith('clark')) return 'Clark';
  if (n.startsWith('e')) return 'Eppler';
  if (n.startsWith('goe') || n.startsWith('gottingen')) return 'Göttingen';
  if (n.startsWith('s')) return 'Selig';
  if (n.startsWith('fx') || n.startsWith('wortmann')) return 'Wortmann';
  if (n.startsWith('rae')) return 'RAE';
  if (n.startsWith('ag')) return 'AG';
  if (n.startsWith('nlr')) return 'NLR';
  if (n.startsWith('joukowski')) return 'Joukowski';
  return 'Other';
}
