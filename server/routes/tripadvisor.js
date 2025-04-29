/**
 * TripAdvisor integration routes using official TripAdvisor Content API
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');

// TripAdvisor API settings
const TRIPADVISOR_API_KEY = process.env.TRIPADVISOR_API_KEY;
const TRIPADVISOR_API_BASE_URL = 'https://api.content.tripadvisor.com/api/v1';

/**
 * Search for places on TripAdvisor
 * GET /tripadvisor?place_name=Restaurant Name&location=Amsterdam
 */
router.get('/', async (req, res) => {
  try {
    const { place_name, location } = req.query;
    
    if (!place_name || !location) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Both place name and location must be provided'
      });
    }
    
    // Check if API key exists and has proper format
    if (!TRIPADVISOR_API_KEY || TRIPADVISOR_API_KEY.length < 20) {
      console.log('TripAdvisor API key is missing or has incorrect format');
      console.log(`Current API key value length: ${TRIPADVISOR_API_KEY ? TRIPADVISOR_API_KEY.length : 0}`);
      return res.status(200).json({
        status: 'OK',
        result: {
          name: place_name,
          location: location,
          tripadvisor_data: null,
          message: 'TripAdvisor API key is not properly configured'
        }
      });
    }
    
    console.log(`TripAdvisor API request for: "${place_name}" in "${location}"`);
    console.log(`Using TripAdvisor API key: ${TRIPADVISOR_API_KEY.substring(0, 5)}...${TRIPADVISOR_API_KEY.substring(TRIPADVISOR_API_KEY.length - 5)}`);
    console.log(`API key length: ${TRIPADVISOR_API_KEY.length}`);
    
    // First, search for the location ID using the location search endpoint
    let locationId = await searchLocationId(location);
    
    if (!locationId) {
      console.log(`Could not find TripAdvisor location ID for "${location}", using default fallback`);
      // Use Amsterdam as fallback location ID for testing if no match found
      locationId = '188590'; // Amsterdam location ID
    }
    
    // Now search for the place within that location
    const searchResults = await searchPlace(place_name, locationId);
    
    if (!searchResults || searchResults.length === 0) {
      console.log(`No results found for "${place_name}" in location "${location}"`);
      return res.json({
        status: 'OK',
        result: {
          name: place_name,
          location: location,
          tripadvisor_data: null,
          message: 'No matching places found'
        }
      });
    }
    
    // Get the top result
    const topResult = searchResults[0];
    console.log(`Found TripAdvisor match for "${place_name}": ${topResult.name} (ID: ${topResult.location_id})`);
    
    // Get detailed information about the place
    const detailedData = await getPlaceDetails(topResult.location_id);
    
    if (!detailedData) {
      console.log(`Could not retrieve details for place ID ${topResult.location_id}`);
      // Return basic information without details
      return res.json({
        status: 'OK',
        result: {
          name: place_name,
          location: location,
          tripadvisor_data: {
            name: topResult.name,
            location_id: topResult.location_id,
            rating: topResult.rating,
            num_reviews: topResult.num_reviews
          }
        }
      });
    }
    
    // Format the response with detailed data
    const formattedData = {
      name: place_name,
      location: location,
      tripadvisor_data: {
        name: detailedData.name,
        location_id: detailedData.location_id,
        rating: detailedData.rating,
        num_reviews: detailedData.num_reviews,
        ranking: detailedData.ranking,
        category: detailedData.category?.name,
        address: detailedData.address_obj?.address_string,
        website: detailedData.website,
        phone: detailedData.phone,
        url: `https://www.tripadvisor.com${detailedData.web_url}`,
        photo_url: detailedData.photo?.images?.original?.url || detailedData.photo?.images?.large?.url
      }
    };
    
    console.log(`Successfully retrieved TripAdvisor data for "${place_name}"`);
    return res.json({
      status: 'OK',
      result: formattedData
    });
    
  } catch (error) {
    console.error('Error in TripAdvisor API route:', error.message);
    
    let errorMessage = 'API connection error';
    let statusCode = 200; // Use 200 to keep the frontend working
    
    // Check if it's an authorization issue
    if (error.response && error.response.status === 403) {
      errorMessage = 'TripAdvisor API authorization issue - please verify API key';
      console.error('TripAdvisor API authorization error:', 
                   error.response.data?.Message || 'Unknown authentication error');
    }
    
    res.status(statusCode).json({
      status: 'OK', // Keep consistent with previous implementation that returned OK even with errors
      result: {
        name: req.query.place_name,
        location: req.query.location,
        tripadvisor_data: null,
        error: errorMessage,
        api_error: true
      }
    });
  }
});

/**
 * Search for a location (city, region) on TripAdvisor to get its location ID
 * @param {string} locationName - Name of the location (e.g., "Amsterdam")
 * @returns {Promise<string|null>} - TripAdvisor location ID or null if not found
 */
async function searchLocationId(locationName) {
  try {
    const response = await axios.get(`${TRIPADVISOR_API_BASE_URL}/location/search`, {
      params: {
        key: TRIPADVISOR_API_KEY,
        searchQuery: locationName,
        category: 'All',
        language: 'en'
      }
    });
    
    if (response.data?.data?.length > 0) {
      // Find locations of type "geos" (geographic locations) first
      const geoLocation = response.data.data.find(item => item.result_type === 'geos');
      if (geoLocation) {
        return geoLocation.location_id;
      }
      
      // If no geo location, return the first result
      return response.data.data[0].location_id;
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching for location ID for "${locationName}":`, error.message);
    console.error('Full error details:', error.response?.data || 'No response data');
    return null;
  }
}

/**
 * Search for a place within a specific location on TripAdvisor
 * @param {string} placeName - Name of the place to search for
 * @param {string} locationId - TripAdvisor location ID to search within
 * @returns {Promise<Array|null>} - List of matching places or null if error
 */
async function searchPlace(placeName, locationId) {
  try {
    const response = await axios.get(`${TRIPADVISOR_API_BASE_URL}/location/search`, {
      params: {
        key: TRIPADVISOR_API_KEY,
        searchQuery: placeName,
        category: 'All',
        language: 'en',
        latLong: locationId // Can be location ID or coordinates
      }
    });
    
    if (response.data?.data?.length > 0) {
      return response.data.data;
    }
    
    return [];
  } catch (error) {
    console.error(`Error searching for place "${placeName}" in location ${locationId}:`, error.message);
    if (error.response && error.response.status === 403) {
      console.error('TripAdvisor API authorization error for place search:',
                   error.response.data?.Message || 'Unknown authentication error');
    }
    return null;
  }
}

/**
 * Get detailed information about a specific place on TripAdvisor
 * @param {string} locationId - TripAdvisor location ID
 * @returns {Promise<Object|null>} - Detailed information or null if error
 */
async function getPlaceDetails(locationId) {
  try {
    const response = await axios.get(`${TRIPADVISOR_API_BASE_URL}/location/${locationId}/details`, {
      params: {
        key: TRIPADVISOR_API_KEY,
        language: 'en',
        currency: 'EUR'
      }
    });
    
    if (response.data) {
      return response.data;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting details for location ID ${locationId}:`, error.message);
    if (error.response && error.response.status === 403) {
      console.error('TripAdvisor API authorization error for details:',
                   error.response.data?.Message || 'Unknown authentication error');
    }
    return null;
  }
}

module.exports = router;