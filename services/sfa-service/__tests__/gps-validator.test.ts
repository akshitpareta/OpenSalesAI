import { describe, it, expect } from 'vitest';
import { haversineDistance, validateProximity, isValidCoordinates } from '../src/services/gps-validator';

describe('haversineDistance', () => {
  it('should return 0 for identical coordinates', () => {
    const distance = haversineDistance(19.076, 72.8777, 19.076, 72.8777);
    expect(distance).toBe(0);
  });

  it('should calculate the correct distance between two known points (Mumbai to Pune ~148km)', () => {
    // Mumbai: 19.076, 72.8777
    // Pune:   18.5204, 73.8567
    const distance = haversineDistance(19.076, 72.8777, 18.5204, 73.8567);
    // Known distance is approximately 118-120 km
    expect(distance).toBeGreaterThan(115_000);
    expect(distance).toBeLessThan(125_000);
  });

  it('should calculate distance between New Delhi and Agra (~206km)', () => {
    // New Delhi: 28.6139, 77.2090
    // Agra:      27.1767, 78.0081
    const distance = haversineDistance(28.6139, 77.209, 27.1767, 78.0081);
    expect(distance).toBeGreaterThan(180_000);
    expect(distance).toBeLessThan(220_000);
  });

  it('should return a small distance for nearby points (< 100m)', () => {
    // Two points roughly 50 meters apart in central Mumbai
    const storeLat = 19.076;
    const storeLng = 72.8777;
    // ~50m offset (approximately 0.00045 degrees at this latitude)
    const repLat = storeLat + 0.00035;
    const repLng = storeLng + 0.00025;

    const distance = haversineDistance(repLat, repLng, storeLat, storeLng);
    expect(distance).toBeGreaterThan(30);
    expect(distance).toBeLessThan(100);
  });

  it('should be symmetric (distance A->B equals B->A)', () => {
    const d1 = haversineDistance(19.076, 72.8777, 18.5204, 73.8567);
    const d2 = haversineDistance(18.5204, 73.8567, 19.076, 72.8777);
    expect(d1).toBeCloseTo(d2, 6);
  });

  it('should handle equator coordinates', () => {
    const distance = haversineDistance(0, 0, 0, 1);
    // 1 degree at equator is approximately 111.32 km
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(112_000);
  });

  it('should handle negative coordinates (southern hemisphere)', () => {
    const distance = haversineDistance(-33.8688, 151.2093, -34.0522, 151.2093);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(25_000);
  });
});

describe('validateProximity', () => {
  const storeLat = 19.076;
  const storeLng = 72.8777;

  it('should return valid=true when rep is within 100m (at the store)', () => {
    const result = validateProximity(storeLat, storeLng, storeLat, storeLng);
    expect(result.valid).toBe(true);
    expect(result.distance_meters).toBe(0);
    expect(result.max_distance_meters).toBe(100);
  });

  it('should return valid=true at edge case 99m away', () => {
    // 99 meters is approximately 0.00089 degrees latitude
    const offset = 0.00089; // ~99m
    const result = validateProximity(storeLat + offset, storeLng, storeLat, storeLng);
    expect(result.valid).toBe(true);
    expect(result.distance_meters).toBeLessThanOrEqual(100);
  });

  it('should return valid=false at edge case 101m away', () => {
    // 101 meters is approximately 0.000908 degrees latitude
    const offset = 0.00095; // ~105m to ensure we are past 100m
    const result = validateProximity(storeLat + offset, storeLng, storeLat, storeLng);
    expect(result.valid).toBe(false);
    expect(result.distance_meters).toBeGreaterThan(100);
  });

  it('should return valid=false when rep is far from store', () => {
    const result = validateProximity(19.0, 72.0, storeLat, storeLng);
    expect(result.valid).toBe(false);
    expect(result.distance_meters).toBeGreaterThan(100);
  });

  it('should respect custom max distance parameter', () => {
    // Use a point ~200m away
    const offset = 0.0018;
    const result = validateProximity(storeLat + offset, storeLng, storeLat, storeLng, 250);
    expect(result.valid).toBe(true);
    expect(result.max_distance_meters).toBe(250);
  });

  it('should round distance to 2 decimal places', () => {
    const result = validateProximity(storeLat + 0.0005, storeLng, storeLat, storeLng);
    const decimalPlaces = result.distance_meters.toString().split('.')[1]?.length || 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});

describe('isValidCoordinates', () => {
  it('should accept valid coordinates', () => {
    expect(isValidCoordinates(19.076, 72.8777)).toBe(true);
    expect(isValidCoordinates(0, 0)).toBe(true);
    expect(isValidCoordinates(-90, -180)).toBe(true);
    expect(isValidCoordinates(90, 180)).toBe(true);
  });

  it('should reject latitude out of range', () => {
    expect(isValidCoordinates(91, 72.8777)).toBe(false);
    expect(isValidCoordinates(-91, 72.8777)).toBe(false);
  });

  it('should reject longitude out of range', () => {
    expect(isValidCoordinates(19.076, 181)).toBe(false);
    expect(isValidCoordinates(19.076, -181)).toBe(false);
  });

  it('should accept boundary values', () => {
    expect(isValidCoordinates(90, 180)).toBe(true);
    expect(isValidCoordinates(-90, -180)).toBe(true);
  });
});
