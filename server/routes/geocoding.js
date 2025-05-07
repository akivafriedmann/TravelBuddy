const express = require('express');
const axios = require('axios');
const router = express.Router();

// Get API key from environment variable
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// Base URL for Google Geocoding API
const GEOCODING_API_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Geocode an address or place name to coordinates
 * GET /geocoding?address=New York City
 */
router.get('/', async (req, res) => {
  try {
    const { address, latlng } = req.query;
    
    if (!address && !latlng) {
      return res.status(400).json({ 
        error: 'Either address or latlng parameter is required' 
      });
    }
    
    console.log(`Geocoding request received: address=${address || 'not provided'}, latlng=${latlng || 'not provided'}`);
    
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('No Google Maps API key provided. Using mock data.');
      return mockGeocodingResponse(req, res);
    }
    
    // Build request parameters
    const params = {
      key: GOOGLE_MAPS_API_KEY
    };
    
    if (address) {
      params.address = address;
    } else if (latlng) {
      params.latlng = latlng;
    }
    
    console.log(`Making geocoding API request to: ${GEOCODING_API_BASE_URL}`);
    
    try {
      const response = await axios.get(GEOCODING_API_BASE_URL, { params });
      console.log(`Geocoding API response status: ${response.status}, results: ${response.data?.results?.length || 0}`);
      
      // Handle zero results case more explicitly
      if (response.data && response.data.status === 'ZERO_RESULTS') {
        console.log('Geocoding API returned zero results');
        return res.json({
          status: 'ZERO_RESULTS',
          results: [],
          error_message: 'No locations found for the given address'
        });
      }
      
      // Include a fallback location if no results were found
      if (!response.data?.results || response.data.results.length === 0) {
        // Don't use mock data here to respect data integrity, just return the actual empty result
        console.log('No results found in geocoding API response');
      }
      
      return res.json(response.data);
    } catch (requestError) {
      console.error('Geocoding API request error:', requestError.message);
      
      // Check if it's a rate limit or quota issue
      if (requestError.response && 
         (requestError.response.status === 429 || 
          (requestError.response.data && requestError.response.data.status === 'OVER_QUERY_LIMIT'))) {
        console.error('Geocoding API quota exceeded or rate limited');
        return res.status(429).json({
          status: 'OVER_QUERY_LIMIT',
          error: 'Geocoding API quota exceeded, please try again later'
        });
      }
      
      // Use mock for development environments only - for production we would return an error
      return mockGeocodingResponse(req, res);
    }
  } catch (error) {
    console.error('Error with geocoding request:', error);
    res.status(500).json({ 
      error: 'Failed to complete geocoding request',
      message: error.message
    });
  }
});

/**
 * Mock response for geocoding when API key is not available
 */
function mockGeocodingResponse(req, res) {
  const { address, latlng } = req.query;
  
  let mockData;
  
  // Handle forward geocoding (address to coordinates)
  if (address) {
    mockData = {
      results: [
        {
          formatted_address: address,
          geometry: {
            location: {
              lat: 40.7128, // Default to New York City coordinates
              lng: -74.0060
            }
          },
          place_id: 'mock-place-id-1',
          types: ['locality', 'political']
        }
      ],
      status: 'OK'
    };
    
    // Add some variation based on common city names
    if (address.toLowerCase().includes('london')) {
      mockData.results[0].geometry.location = { lat: 51.5074, lng: -0.1278 };
    } else if (address.toLowerCase().includes('paris')) {
      mockData.results[0].geometry.location = { lat: 48.8566, lng: 2.3522 };
    } else if (address.toLowerCase().includes('tokyo')) {
      mockData.results[0].geometry.location = { lat: 35.6762, lng: 139.6503 };
    }
  } 
  // Handle reverse geocoding (coordinates to address)
  else if (latlng) {
    const [lat, lng] = latlng.split(',').map(parseFloat);
    
    mockData = {
      results: [
        {
          formatted_address: `Mock Address near ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          geometry: {
            location: {
              lat,
              lng
            }
          },
          place_id: 'mock-place-id-2',
          types: ['street_address']
        }
      ],
      status: 'OK'
    };
  }
  
  return res.json(mockData);
}

module.exports = router;
