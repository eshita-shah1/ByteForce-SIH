/**
 * Geo-spatial utilities for TerraScope
 * Focused on Bharveli & Balaghat Manganese Belt (Madhya Pradesh, India)
 */

export interface LatLng {
  lat: number;
  lng: number;
}

// Center reference for Bharveli & Balaghat concession
export const BHARVELI_CENTER: [number, number] = [21.805992, 80.261628];

// Bounding polygon coordinates for Bharveli & Balaghat Study Concession
export const BHARVELI_CONCESSION_POLYGON: [number, number][] = [
  [21.8360, 80.2380],
  [21.8410, 80.2820],
  [21.8240, 80.3010],
  [21.7920, 80.2890],
  [21.7740, 80.2550],
  [21.7890, 80.2310]
];

/**
 * Standard ray-casting algorithm to test if a point (lat, lng) is inside a polygon
 */
export function isInsideStudyArea(lat: number, lng: number, polygon: [number, number][] = BHARVELI_CONCESSION_POLYGON): boolean {
  if (isNaN(lat) || isNaN(lng)) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function formatCoordinate(val: number, decimals: number = 6): string {
  return Number(val).toFixed(decimals);
}
