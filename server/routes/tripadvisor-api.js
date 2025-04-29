/**
 * TripAdvisor integration routes using official TripAdvisor Content API
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');

// TripAdvisor API settings
const TRIPADVISOR_API_KEY = process.env.TRIPADVISOR_API_KEY;

/**
 * Search for places on TripAdvisor
 * GET /tripadvisor?place_name=Restaurant Name&location=Amsterdam
 */
router.get('/', async (req, res) => {
  try {
    const { place_name, location } = req.query;
    
    if (!place_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Place name is required'
      });
    }
    
    // Check if API key exists and has proper format
    if (!TRIPADVISOR_API_KEY || TRIPADVISOR_API_KEY.length < 10) {
      console.log('TripAdvisor API key is missing or has incorrect format');
      return res.status(200).json({
        status: 'OK',
        result: {
          name: place_name,
          location: location || '',
          tripadvisor_data: null,
          message: 'TripAdvisor API key is not properly configured'
        }
      });
    }
    
    console.log(`TripAdvisor API request for: "${place_name}" in "${location}"`);
    
    try {
      // First, search for the location ID using the location search endpoint
      let locationId = null;
      if (location) {
        locationId = await searchLocationId(location);
      }
      
      // If we couldn't find a location ID, use a more general search approach
      if (!locationId) {
        console.log(`Could not find location ID for "${location}", using general search`);
        
        // Use the search endpoint to find matching places
        const searchResults = await searchTripadvisorPlaces(place_name, location);
        
        if (!searchResults || searchResults.length === 0) {
          console.log(`No results found for "${place_name}" in TripAdvisor search`);
          return res.json({
            status: 'OK',
            result: {
              name: place_name,
              location: location || '',
              tripadvisor_data: null,
              message: 'No matching places found'
            }
          });
        }
        
        // Get the best matching place from the search results
        const bestMatch = searchResults[0];
        
        // Get the detailed information for the place
        const details = await getPlaceDetails(bestMatch.location_id);
        
        if (details) {
          return res.json({
            status: 'OK',
            result: {
              name: place_name,
              location: location || '',
              tripadvisor_data: formatTripAdvisorData(details, bestMatch)
            }
          });
        } else {
          return res.json({
            status: 'OK',
            result: {
              name: place_name,
              location: location || '',
              tripadvisor_data: {
                name: bestMatch.name,
                url: `https://www.tripadvisor.com/${bestMatch.web_url}`,
                location_id: bestMatch.location_id
              }
            }
          });
        }
      } else {
        // If we have a location ID, search for the place within that location
        const searchResults = await searchPlace(place_name, locationId);
        
        if (!searchResults || searchResults.length === 0) {
          console.log(`No results found for "${place_name}" in location ID ${locationId}`);
          return res.json({
            status: 'OK',
            result: {
              name: place_name,
              location: location || '',
              tripadvisor_data: null,
              message: 'No matching places found in this location'
            }
          });
        }
        
        // Get the best matching place
        const bestMatch = searchResults[0];
        
        // Get the detailed information for the place
        const details = await getPlaceDetails(bestMatch.location_id);
        
        if (details) {
          return res.json({
            status: 'OK',
            result: {
              name: place_name,
              location: location || '',
              tripadvisor_data: formatTripAdvisorData(details, bestMatch)
            }
          });
        } else {
          return res.json({
            status: 'OK',
            result: {
              name: place_name,
              location: location || '',
              tripadvisor_data: {
                name: bestMatch.name,
                url: `https://www.tripadvisor.com/${bestMatch.web_url}`,
                location_id: bestMatch.location_id
              }
            }
          });
        }
      }
    } catch (apiError) {
      console.error(`TripAdvisor API error: ${apiError.message}`);
      
      // Return a graceful error response
      return res.status(200).json({
        status: 'OK',
        result: {
          name: place_name,
          location: location || '',
          tripadvisor_data: null,
          api_error: apiError.message
        }
      });
    }
  } catch (error) {
    console.error(`Unexpected error in TripAdvisor route: ${error}`);
    return res.status(500).json({
      status: 'ERROR',
      error: "An unexpected error occurred"
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
    const url = 'https://api.content.tripadvisor.com/api/v1/location/search';
    const params = {
      searchQuery: locationName,
      category: 'geos',
      language: 'en',
      key: TRIPADVISOR_API_KEY
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      const locationId = response.data.data[0].location_id;
      console.log(`Found location ID for "${locationName}": ${locationId}`);
      return locationId;
    }
    
    console.log(`No location ID found for "${locationName}"`);
    return null;
  } catch (error) {
    console.error(`Error searching for location ID: ${error.message}`);
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
    const url = 'https://api.content.tripadvisor.com/api/v1/location/search';
    const params = {
      searchQuery: placeName,
      category: 'restaurants,attractions,hotels',
      language: 'en',
      latLong: null,  // We're using locationId instead
      radius: null,   // We're using locationId instead
      radiusUnit: null, // We're using locationId instead
      key: TRIPADVISOR_API_KEY
    };
    
    // If we have a location ID, add it to the params
    if (locationId) {
      params.locationId = locationId;
    }
    
    const response = await axios.get(url, { params });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      console.log(`Found ${response.data.data.length} places for "${placeName}" in location ID ${locationId}`);
      return response.data.data;
    }
    
    console.log(`No places found for "${placeName}" in location ID ${locationId}`);
    return null;
  } catch (error) {
    console.error(`Error searching for place: ${error.message}`);
    return null;
  }
}

/**
 * Search for places on TripAdvisor without requiring a location ID
 * @param {string} placeName - Name of the place to search for
 * @param {string} location - Location name or address
 * @returns {Promise<Array|null>} - List of matching places or null if error
 */
async function searchTripadvisorPlaces(placeName, location) {
  try {
    // Combine place name and location for a more targeted search
    const searchQuery = location ? `${placeName} ${location}` : placeName;
    
    const url = 'https://api.content.tripadvisor.com/api/v1/location/search';
    const params = {
      searchQuery: searchQuery,
      category: 'restaurants,attractions,hotels',
      language: 'en',
      key: TRIPADVISOR_API_KEY
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      console.log(`Found ${response.data.data.length} places for search query "${searchQuery}"`);
      return response.data.data;
    }
    
    // If no results with combined search, try just the place name
    if (location) {
      const backupParams = {
        searchQuery: placeName,
        category: 'restaurants,attractions,hotels',
        language: 'en',
        key: TRIPADVISOR_API_KEY
      };
      
      const backupResponse = await axios.get(url, { params: backupParams });
      
      if (backupResponse.data && backupResponse.data.data && backupResponse.data.data.length > 0) {
        console.log(`Found ${backupResponse.data.data.length} places for backup search query "${placeName}"`);
        return backupResponse.data.data;
      }
    }
    
    console.log(`No places found for search query "${searchQuery}"`);
    return null;
  } catch (error) {
    console.error(`Error in TripAdvisor general search: ${error.message}`);
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
    const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details`;
    const params = {
      language: 'en',
      currency: 'USD',
      key: TRIPADVISOR_API_KEY
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data) {
      console.log(`Retrieved details for location ID ${locationId}`);
      return response.data;
    }
    
    console.log(`No details found for location ID ${locationId}`);
    return null;
  } catch (error) {
    console.error(`Error getting place details: ${error.message}`);
    return null;
  }
}

/**
 * Format the TripAdvisor API response into a consistent structure
 * @param {Object} details - Detailed information from TripAdvisor API
 * @param {Object} searchResult - Basic information from search results
 * @returns {Object} - Formatted TripAdvisor data
 */
function formatTripAdvisorData(details, searchResult) {
  // Start with basic information from the search result
  const formattedData = {
    name: details.name || searchResult.name,
    url: details.web_url ? `https://www.tripadvisor.com/${details.web_url}` : `https://www.tripadvisor.com/${searchResult.web_url}`,
    location_id: details.location_id || searchResult.location_id
  };
  
  // Add rating if available
  if (details.rating) {
    formattedData.rating = details.rating;
  }
  
  // Add number of reviews if available
  if (details.num_reviews) {
    formattedData.review_count = details.num_reviews;
  }
  
  // Add ranking if available
  if (details.ranking_data && details.ranking_data.ranking_string) {
    const rankMatch = details.ranking_data.ranking_string.match(/#(\d+) of ([\d,]+)/);
    if (rankMatch) {
      formattedData.rank_position = parseInt(rankMatch[1], 10);
      formattedData.rank_total = parseInt(rankMatch[2].replace(/,/g, ''), 10);
    }
  }
  
  // Add address if available
  if (details.address_obj) {
    formattedData.address = details.address_obj.address_string;
  }
  
  // Add category if available
  if (details.category) {
    formattedData.category = details.category.name;
  } else if (details.ancestors && details.ancestors.length > 0) {
    // Try to infer category from ancestors
    const categoryAncestor = details.ancestors.find(a => a.subcategory && a.subcategory.length > 0);
    if (categoryAncestor) {
      formattedData.category = categoryAncestor.subcategory[0].name;
    }
  }
  
  // Add photo if available
  if (details.photo && details.photo.images) {
    formattedData.photo = details.photo.images.large.url;
  }
  
  return formattedData;
}

module.exports = router;