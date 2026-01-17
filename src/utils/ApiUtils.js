// Base URL for the server API
const API_BASE_URL = 'https://5000-replit-replit-zc84jcxuobn.ws-us115.replit.dev/api';

/**
 * Make an API call to the backend server
 * @param {string} endpoint - API endpoint to call
 * @param {Object} params - Query parameters for the API call
 * @returns {Promise<Object>} - API response
 */
export const apiCall = async (endpoint, params = {}) => {
  try {
    // Construct URL with query parameters
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    // Make the API request
    const response = await fetch(url.toString());
    
    // Check if the response is ok
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'An unknown error occurred'
      }));
      throw new Error(errorData.message || `API Error: ${response.status}`);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API call error (${endpoint}):`, error);
    throw error;
  }
};

/**
 * For use in development/testing when API keys are not available
 * This returns mock data that matches the structure of real API responses
 * @param {string} endpoint - The API endpoint that would be called
 * @param {Object} params - The parameters that would be sent
 * @returns {Promise<Object>} - Mock response data
 */
export const mockApiCall = async (endpoint, params = {}) => {
  console.warn('Using mock API data for', endpoint, params);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return different mock data based on the endpoint
  switch (endpoint) {
    case '/places':
      return {
        results: [
          {
            id: 'place1',
            name: 'Amazing Restaurant',
            vicinity: '123 Main St, City',
            geometry: {
              location: {
                lat: parseFloat(params.location.split(',')[0]) + 0.001,
                lng: parseFloat(params.location.split(',')[1]) + 0.001
              }
            },
            rating: 4.5,
            user_ratings_total: 123,
            price_level: 2,
            types: ['restaurant', 'food', 'point_of_interest']
          },
          {
            id: 'place2',
            name: 'Luxury Hotel',
            vicinity: '456 Broadway, City',
            geometry: {
              location: {
                lat: parseFloat(params.location.split(',')[0]) - 0.001,
                lng: parseFloat(params.location.split(',')[1]) - 0.001
              }
            },
            rating: 4.8,
            user_ratings_total: 327,
            price_level: 3,
            types: ['lodging', 'point_of_interest']
          }
        ]
      };
    
    case '/places/details':
      return {
        result: {
          place_id: params.place_id,
          name: 'Detailed Place',
          formatted_address: '123 Example St, City, Country',
          vicinity: '123 Example St',
          geometry: {
            location: {
              lat: 40.7128,
              lng: -74.0060
            }
          },
          rating: 4.7,
          user_ratings_total: 256,
          price_level: 2,
          types: ['restaurant', 'food', 'point_of_interest']
        }
      };
    
    case '/geocoding':
      if (params.address) {
        return {
          results: [
            {
              formatted_address: params.address,
              geometry: {
                location: {
                  lat: 40.7128,
                  lng: -74.0060
                }
              }
            }
          ]
        };
      } else if (params.latlng) {
        const [lat, lng] = params.latlng.split(',');
        return {
          results: [
            {
              formatted_address: `Address at ${lat}, ${lng}`,
              geometry: {
                location: {
                  lat: parseFloat(lat),
                  lng: parseFloat(lng)
                }
              }
            }
          ]
        };
      }
      
    default:
      throw new Error(`No mock data available for endpoint: ${endpoint}`);
  }
};
