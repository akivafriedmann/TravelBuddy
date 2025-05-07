const express = require('express');
const axios = require('axios');
const router = express.Router();

// Get API key from environment variable
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// Base URL for Google Places API
const PLACES_API_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

/**
 * Search for nearby places
 * GET /places?location=lat,lng&radius=1000&type=restaurant|lodging&opennow=true
 */
router.get('/', async (req, res) => {
  try {
    const { location, radius = 1000, type, keyword, opennow } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Location parameter is required' });
    }
    
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('No Google Maps API key provided. Using mock data.');
      return mockNearbyPlacesResponse(req, res);
    }
    
    console.log(`Searching for places near ${location} with radius ${radius}m, type: ${type || 'any'}, keyword: ${keyword || 'none'}, open now: ${opennow ? 'yes' : 'no'}`);
    
    // Build parameters object
    const params = {
      location,
      radius,
      key: GOOGLE_MAPS_API_KEY
    };
    
    // Add optional parameters
    if (type) {
      params.type = type;
    }
    
    if (keyword) {
      params.keyword = keyword;
    }
    
    // Add opennow parameter only if it's provided and equals 'true'
    if (opennow === 'true') {
      params.opennow = true;
    }
    
    const response = await axios.get(`${PLACES_API_BASE_URL}/nearbysearch/json`, { params });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    res.status(500).json({ 
      error: 'Failed to fetch nearby places',
      message: error.message
    });
  }
});

/**
 * Get details for a specific place
 * GET /places/details?place_id=123&fields=name,rating
 */
router.get('/details', async (req, res) => {
  try {
    const { place_id, fields } = req.query;
    
    if (!place_id) {
      return res.status(400).json({ error: 'Place ID is required' });
    }
    
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('No Google Maps API key provided. Using mock data.');
      return mockPlaceDetailsResponse(req, res);
    }
    
    const response = await axios.get(`${PLACES_API_BASE_URL}/details/json`, {
      params: {
        place_id,
        fields,
        key: GOOGLE_MAPS_API_KEY
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch place details',
      message: error.message
    });
  }
});

/**
 * Mock response for nearby places when API key is not available
 */
function mockNearbyPlacesResponse(req, res) {
  const { location } = req.query;
  const [lat, lng] = location.split(',').map(parseFloat);
  
  const mockData = {
    results: [
      {
        id: 'mock-restaurant-1',
        place_id: 'mock-restaurant-1',
        name: 'Awesome Restaurant',
        vicinity: '123 Main St, Test City',
        geometry: {
          location: {
            lat: lat + 0.001,
            lng: lng + 0.001
          }
        },
        rating: 4.5,
        user_ratings_total: 120,
        price_level: 2,
        types: ['restaurant', 'food', 'point_of_interest']
      },
      {
        id: 'mock-hotel-1',
        place_id: 'mock-hotel-1',
        name: 'Luxury Hotel',
        vicinity: '456 Broadway, Test City',
        geometry: {
          location: {
            lat: lat - 0.001,
            lng: lng - 0.001
          }
        },
        rating: 4.8,
        user_ratings_total: 350,
        price_level: 3,
        types: ['lodging', 'point_of_interest']
      },
      {
        id: 'mock-restaurant-2',
        place_id: 'mock-restaurant-2',
        name: 'Budget Eats',
        vicinity: '789 Side St, Test City',
        geometry: {
          location: {
            lat: lat + 0.002,
            lng: lng - 0.002
          }
        },
        rating: 3.9,
        user_ratings_total: 80,
        price_level: 1,
        types: ['restaurant', 'food', 'point_of_interest']
      }
    ],
    status: 'OK'
  };
  
  return res.json(mockData);
}

/**
 * Mock response for place details when API key is not available
 */
function mockPlaceDetailsResponse(req, res) {
  const { place_id } = req.query;
  
  const mockData = {
    result: {
      place_id,
      name: 'Mock Place',
      formatted_address: '123 Test St, Test City, Test Country',
      geometry: {
        location: {
          lat: 40.7128,
          lng: -74.0060
        }
      },
      rating: 4.6,
      user_ratings_total: 200,
      price_level: 2,
      vicinity: '123 Test St',
      types: ['restaurant', 'food', 'point_of_interest']
    },
    status: 'OK'
  };
  
  return res.json(mockData);
}

module.exports = router;
