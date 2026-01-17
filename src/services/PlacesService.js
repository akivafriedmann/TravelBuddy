import { apiCall } from '../utils/ApiUtils';

export const searchNearbyPlaces = async (
  location,
  radius = 1500,
  type = 'restaurant'
) => {
  try {
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      throw new Error('Invalid location provided');
    }

    const endpoint = '/nearby';
    const params = {
      lat: location.latitude,
      lng: location.longitude,
      radius,
      type,
    };

    const response = await apiCall(endpoint, params);

    if (!response.results) {
      throw new Error('Invalid response from Places API');
    }

    return response.results.map(place => ({
      ...place,
      id: place.place_id,
      geometry: place.geometry || {
        location: {
          lat: place.geometry?.location?.lat,
          lng: place.geometry?.location?.lng
        }
      }
    }));
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    throw error;
  }
};

export const getPlaceDetails = async (placeId) => {
  try {
    if (!placeId) {
      throw new Error('Place ID is required');
    }

    const endpoint = '/details';
    const params = {
      place_id: placeId,
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
