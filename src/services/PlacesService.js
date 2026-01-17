import { apiCall } from '../utils/ApiUtils';

/**
 * Search for nearby places around a specific location
 * @param {Object} location - The location to search around
 * @param {number} location.latitude - Latitude coordinate
 * @param {number} location.longitude - Longitude coordinate
 * @param {number} radius - Search radius in meters (default: 1000)
 * @param {string[]} types - Types of places to search for (default: restaurant, lodging)
 * @returns {Promise<Array>} - List of nearby places
 */
export const searchNearbyPlaces = async (
  location,
  radius = 1000,
  types = ['restaurant', 'lodging']
) => {
  try {
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      throw new Error('Invalid location provided');
    }

    const endpoint = '/places';
    const params = {
      location: `${location.latitude},${location.longitude}`,
      radius,
      type: types.join('|'),
    };

    const response = await apiCall(endpoint, params);

    if (!response.results) {
      throw new Error('Invalid response from Places API');
    }

    return response.results;
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    throw error;
  }
};

/**
 * Get detailed information about a specific place
 * @param {string} placeId - The Google Place ID
 * @returns {Promise<Object>} - Detailed place information
 */
export const getPlaceDetails = async (placeId) => {
  try {
    if (!placeId) {
      throw new Error('Place ID is required');
    }

    const endpoint = '/places/details';
    const params = {
      place_id: placeId,
      fields: 'name,formatted_address,rating,user_ratings_total,price_level,vicinity,geometry,photos,types',
    };

    const response = await apiCall(endpoint, params);

    if (!response.result) {
      throw new Error('Invalid response from Place Details API');
    }

    return response.result;
  } catch (error) {
    console.error('Error fetching place details:', error);
    throw error;
  }
};
