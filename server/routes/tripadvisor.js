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
    
    // Try to validate the API key by checking if it contains only valid characters
    const validKeyPattern = /^[a-zA-Z0-9\-_]+$/;
    if (!validKeyPattern.test(TRIPADVISOR_API_KEY)) {
      console.log('WARNING: TripAdvisor API key contains invalid characters (should only contain letters, numbers, hyphens, and underscores)');
    }
    
    // Check if the key might have extra quotes or spaces
    if (TRIPADVISOR_API_KEY.includes('"') || TRIPADVISOR_API_KEY.includes("'") || 
        TRIPADVISOR_API_KEY.startsWith(' ') || TRIPADVISOR_API_KEY.endsWith(' ')) {
      console.log('WARNING: TripAdvisor API key contains quotes or extra spaces which might cause authentication issues');
    }
    
    // Add fallback for testing if official TripAdvisor API fails
    let useScraperFallback = false;
    
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
    // Configure the request
    const url = `${TRIPADVISOR_API_BASE_URL}/location/search`;
    const params = {
      key: TRIPADVISOR_API_KEY,
      searchQuery: locationName,
      category: 'All',
      language: 'en'
    };

    console.log(`Sending TripAdvisor API search location request to: ${url}`);
    console.log(`Request parameters: searchQuery=${locationName}, category=All, language=en`);
    
    // Configure axios with headers
    const config = {
      params,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TravelBuddy/1.0'
      }
    };
    
    const response = await axios.get(url, config);
    
    console.log(`TripAdvisor location search response status: ${response.status}`);
    console.log(`Response data available: ${!!response.data}`);
    
    if (response.data?.data?.length > 0) {
      console.log(`Found ${response.data.data.length} location results for "${locationName}"`);
      
      // Find locations of type "geos" (geographic locations) first
      const geoLocation = response.data.data.find(item => item.result_type === 'geos');
      if (geoLocation) {
        console.log(`Using geo location: ${geoLocation.name} (ID: ${geoLocation.location_id})`);
        return geoLocation.location_id;
      }
      
      // If no geo location, return the first result
      console.log(`No geo location found, using first result: ${response.data.data[0].name} (ID: ${response.data.data[0].location_id})`);
      return response.data.data[0].location_id;
    }
    
    console.log(`No location results found for "${locationName}"`);
    return null;
  } catch (error) {
    console.error(`Error searching for location ID for "${locationName}":`, error.message);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('Request was made but no response received');
    } else {
      console.error('Error setting up the request:', error.message);
    }
    
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
    // Configure the request
    const url = `${TRIPADVISOR_API_BASE_URL}/location/search`;
    const params = {
      key: TRIPADVISOR_API_KEY,
      searchQuery: placeName,
      category: 'All',
      language: 'en',
      latLong: locationId // Can be location ID or coordinates
    };

    console.log(`Sending TripAdvisor API place search request to: ${url}`);
    console.log(`Request parameters: searchQuery=${placeName}, latLong=${locationId}`);
    
    // Configure axios with headers
    const config = {
      params,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TravelBuddy/1.0'
      }
    };
    
    const response = await axios.get(url, config);
    
    console.log(`TripAdvisor place search response status: ${response.status}`);
    console.log(`Response data available: ${!!response.data}`);
    
    if (response.data?.data?.length > 0) {
      console.log(`Found ${response.data.data.length} places matching "${placeName}"`);
      return response.data.data;
    }
    
    console.log(`No places found matching "${placeName}" in location ID ${locationId}`);
    return [];
  } catch (error) {
    console.error(`Error searching for place "${placeName}" in location ${locationId}:`, error.message);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
      
      if (error.response.status === 403) {
        console.error('TripAdvisor API authorization error for place search:',
                     error.response.data?.Message || 'Unknown authentication error');
      }
    } else if (error.request) {
      console.error('Request was made but no response received');
    } else {
      console.error('Error setting up the request:', error.message);
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
    // Configure the request
    const url = `${TRIPADVISOR_API_BASE_URL}/location/${locationId}/details`;
    const params = {
      key: TRIPADVISOR_API_KEY,
      language: 'en',
      currency: 'EUR'
    };

    console.log(`Sending TripAdvisor API details request to: ${url}`);
    
    // Configure axios with headers
    const config = {
      params,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TravelBuddy/1.0'
      }
    };
    
    const response = await axios.get(url, config);
    
    console.log(`TripAdvisor details response status: ${response.status}`);
    console.log(`Response data available: ${!!response.data}`);
    
    if (response.data) {
      console.log(`Successfully retrieved details for location ID ${locationId}`);
      return response.data;
    }
    
    console.log(`No details found for location ID ${locationId}`);
    return null;
  } catch (error) {
    console.error(`Error getting details for location ID ${locationId}:`, error.message);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
      
      if (error.response.status === 403) {
        console.error('TripAdvisor API authorization error for details:',
                     error.response.data?.Message || 'Unknown authentication error');
      }
    } else if (error.request) {
      console.error('Request was made but no response received');
    } else {
      console.error('Error setting up the request:', error.message);
    }
    
    return null;
  }
}

module.exports = router;