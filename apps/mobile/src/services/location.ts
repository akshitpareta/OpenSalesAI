import Geolocation, {
  GeoPosition,
  GeoError,
} from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid } from 'react-native';
import { useLocationStore, Coordinates } from '../store/location-store';

/**
 * Earth radius in meters (WGS-84 mean radius).
 */
const EARTH_RADIUS_M = 6_371_000;

/**
 * Default maximum distance in meters for store proximity validation.
 */
const DEFAULT_PROXIMITY_M = 100;

/**
 * Convert degrees to radians.
 */
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Request location permissions for the platform.
 * Returns true if permission granted.
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    const status = await Geolocation.requestAuthorization('whenInUse');
    return status === 'granted';
  }

  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'OpenSalesAI Location Permission',
        message:
          'OpenSalesAI needs access to your location to validate store check-ins and optimize your route.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return false;
};

/**
 * Parse a GeoPosition into our Coordinates type.
 */
const parsePosition = (position: GeoPosition): Coordinates => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy ?? null,
  altitude: position.coords.altitude ?? null,
  heading: position.coords.heading ?? null,
  speed: position.coords.speed ?? null,
  timestamp: position.timestamp,
});

/**
 * Get the current device location (one-shot).
 * Returns Coordinates or throws on error.
 */
export const getCurrentLocation = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position: GeoPosition) => {
        const coords = parsePosition(position);
        useLocationStore.getState().setCurrentLocation(coords);
        resolve(coords);
      },
      (error: GeoError) => {
        useLocationStore.getState().setError(error.message);
        reject(new Error(`Location error (${error.code}): ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );
  });
};

/**
 * Start continuous location watching.
 * Updates the location store on each new position.
 */
export const watchLocation = (): void => {
  const store = useLocationStore.getState();

  if (store.isTracking) return; // Already watching

  const watchId = Geolocation.watchPosition(
    (position: GeoPosition) => {
      const coords = parsePosition(position);
      useLocationStore.getState().setCurrentLocation(coords);
      useLocationStore.getState().addToHistory(coords);
    },
    (error: GeoError) => {
      useLocationStore.getState().setError(error.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 10, // Minimum 10m movement to trigger update
      interval: 10000, // 10 seconds (Android)
      fastestInterval: 5000,
      forceRequestLocation: true,
      showLocationDialog: true,
    }
  );

  store.setWatchId(watchId);
  store.setTracking(true);
};

/**
 * Stop continuous location watching.
 */
export const stopWatchLocation = (): void => {
  const store = useLocationStore.getState();
  const { watchId } = store;

  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    store.setWatchId(null);
  }
  store.setTracking(false);
};

/**
 * Calculate the distance between two points using the Haversine formula.
 * Returns distance in meters.
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
};

/**
 * Validate that the user is within proximity of a store.
 *
 * @param storeLat  Store latitude
 * @param storeLng  Store longitude
 * @param maxDistance  Maximum allowed distance in meters (default: 100m)
 * @returns Object with isWithin flag, actual distance, and the max allowed
 */
export const validateProximity = async (
  storeLat: number,
  storeLng: number,
  maxDistance: number = DEFAULT_PROXIMITY_M
): Promise<{
  isWithin: boolean;
  distance: number;
  maxDistance: number;
  currentLocation: Coordinates;
}> => {
  const currentLocation = await getCurrentLocation();
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    storeLat,
    storeLng
  );

  return {
    isWithin: distance <= maxDistance,
    distance: Math.round(distance),
    maxDistance,
    currentLocation,
  };
};

/**
 * Format distance for display.
 * Under 1000m shows meters, otherwise shows km.
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};
