import { apiCall } from '../utils/ApiUtils';

/**
 * Search for a place by text query
 * @param {string} query - The search query
 * @returns {Promise<Array>} - List of search results
 */
export const searchPlace = async (query) => {
  try {
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid search query provided');
    }

    const endpoint = '/geocoding';
    const params = {
      address: query,
    };

    const response = await apiCall(endpoint, params);

    if (!response.results || !Array.isArray(response.results)) {
      throw new Error('Invalid response from Geocoding API');
    }

    return response.results;
  } catch (error) {
    console.error('Error searching place:', error);
    throw error;
  }
};

/**
 * Get address from coordinates (reverse geocoding)
 * @param {Object} location - The location coordinates
 * @param {number} location.latitude - Latitude coordinate
 * @param {number} location.longitude - Longitude coordinate
 * @returns {Promise<Array>} - List of address information
 */
export const getAddressFromCoordinates = async (location) => {
  try {
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      throw new Error('Invalid location provided');
    }

    const endpoint = '/geocoding';
    const params = {
      latlng: `${location.latitude},${location.longitude}`,
    };

    const response = await apiCall(endpoint, params);

    if (!response.results || !Array.isArray(response.results)) {
      throw new Error('Invalid response from Reverse Geocoding API');
    }

    return response.results;
  } catch (error) {
    console.error('Error getting address from coordinates:', error);
    throw error;
  }
};
