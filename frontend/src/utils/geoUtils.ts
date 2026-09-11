/**
 * Geo-spatial utilities for TerraScope
 * Focused on Bharveli & Balaghat Manganese Belt (Madhya Pradesh, India)
 */

export interface LatLng {
  lat: number;
  lng: number;
}

// Initial map viewport center only (not a boundary claim) - the real study-
// area boundary comes from GET /api/study-area (see api.getStudyArea() /
// ProspectivityView), never hardcoded here.
export const BHARVELI_CENTER: [number, number] = [21.805992, 80.261628];

/**
 * Standard ray-casting algorithm to test if a point (lat, lng) is inside a
 * single polygon ring, given as [lat, lng] pairs.
 */
function isInsideRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Tests if a point (lat, lng) falls inside any of the given polygon rings
 * (the real study area is a MultiPolygon - a union of disjoint grid-cell
 * footprints - so "inside" means inside at least one of its parts).
 * `rings` must come from the real GET /api/study-area boundary
 * (see geoJsonToLeafletPositions) - there is no built-in fallback shape.
 */
export function isInsideStudyArea(lat: number, lng: number, rings: [number, number][][]): boolean {
  if (isNaN(lat) || isNaN(lng) || rings.length === 0) return false;
  return rings.some((ring) => isInsideRing(lat, lng, ring));
}

/**
 * Converts a GeoJSON Polygon/MultiPolygon geometry (coordinates in
 * [lng, lat] order, per the GeoJSON spec - this is what GET /api/study-area
 * returns via PostGIS's ST_AsGeoJSON) into Leaflet-ready positions
 * ([lat, lng] order, nested as polygon -> ring -> point). A plain Polygon is
 * wrapped as a single-polygon array so callers only ever handle one shape.
 */
export function geoJsonToLeafletPositions(
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
): [number, number][][][] {
  const toRing = (ring: number[][]): [number, number][] => ring.map(([lng, lat]) => [lat, lng]);

  if (geometry.type === 'Polygon') {
    const polygon = geometry.coordinates as number[][][];
    return [polygon.map(toRing)];
  }
  const multiPolygon = geometry.coordinates as number[][][][];
  return multiPolygon.map((polygon) => polygon.map(toRing));
}

export function formatCoordinate(val: number, decimals: number = 6): string {
  return Number(val).toFixed(decimals);
}
