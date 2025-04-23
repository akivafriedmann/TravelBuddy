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
      
      // Add components parameter for Netherlands/Amsterdam to improve locality precision
      // This helps with neighborhood searches like "De Pijp" stay within Amsterdam
      if (address.toLowerCase().includes('amsterdam') || 
          address.toLowerCase().includes('de pijp') ||
          address.toLowerCase().includes('jordaan') ||
          address.toLowerCase().includes('oud-west') ||
          address.toLowerCase().includes('oud zuid')) {
        params.components = 'country:nl';
        
        // For specific Amsterdam neighborhoods, add bounds to restrict results
        // This keeps the search focused on the actual neighborhood
        if (address.toLowerCase().includes('de pijp')) {
          // De Pijp area boundaries (approximate)
          params.bounds = '52.348,4.884|52.358,4.902';
        } else if (address.toLowerCase().includes('jordaan')) {
          // Jordaan area boundaries (approximate)
          params.bounds = '52.365,4.875|52.380,4.890';
        }
      }
    } else if (latlng) {
      params.latlng = latlng;
    }
    
    const response = await axios.get(GEOCODING_API_BASE_URL, { params });
    
    res.json(response.data);
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
