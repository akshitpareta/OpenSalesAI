import { GPS_RADIUS_METERS, EARTH_RADIUS_METERS } from '@opensalesai/shared';

/**
 * Calculate the Haversine distance between two GPS coordinates.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRadians = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Validate that a GPS position is within the allowed radius of a store.
 * Default max distance is 100 meters.
 *
 * @returns Object with valid flag, actual distance, and max allowed distance.
 */
export function validateProximity(
  repLat: number,
  repLng: number,
  storeLat: number,
  storeLng: number,
  maxDistanceMeters: number = GPS_RADIUS_METERS,
): {
  valid: boolean;
  distance_meters: number;
  max_distance_meters: number;
} {
  const distance = haversineDistance(repLat, repLng, storeLat, storeLng);

  return {
    valid: distance <= maxDistanceMeters,
    distance_meters: Math.round(distance * 100) / 100,
    max_distance_meters: maxDistanceMeters,
  };
}

/**
 * Validate that GPS coordinates are within valid ranges.
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
