import * as Location from 'expo-location';

/**
 * Gets the initial location for the map.
 * First attempts to get the current user location, falls back to a default location if permission is denied
 * @returns {Promise<{latitude: number, longitude: number}>} - Location coordinates
 */
export const getInitialLocation = async () => {
  try {
    // Request location permission
    let { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Location permission not granted. Using default location.');
    }
    
    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    
    // Return default location (New York City) if can't get user location
    return {
      latitude: 40.7128,
      longitude: -74.0060,
    };
  }
};

/**
 * Checks if the app has location permissions
 * @returns {Promise<boolean>} - True if app has location permissions
 */
export const checkLocationPermissions = async () => {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
};

/**
 * Gets the precise current location of the user
 * @returns {Promise<{latitude: number, longitude: number}>} - Current location coordinates
 */
export const getCurrentPreciseLocation = async () => {
  try {
    const hasPermission = await checkLocationPermissions();
    
    if (!hasPermission) {
      throw new Error('Location permission not granted.');
    }
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting precise location:', error);
    throw error;
  }
};
