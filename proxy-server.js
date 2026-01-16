const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

// Simple in-memory cache for photo redirects to avoid repeated API calls and redirects
const photoRedirectCache = new Map();

// Cache expiration time (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000; 

// Regularly clear old cache entries (every hour)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of photoRedirectCache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRATION) {
      photoRedirectCache.delete(key);
    }
  }
}, 60 * 60 * 1000);

// Weather data cache
const weatherCache = new Map();
const WEATHER_CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutes

// TripAdvisor data cache
const tripAdvisorCache = new Map();
const TRIPADVISOR_CACHE_EXPIRATION = 60 * 60 * 1000; // 1 hour

// Clean up weather cache too
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of weatherCache.entries()) {
    if (now - entry.timestamp > WEATHER_CACHE_EXPIRATION) {
      weatherCache.delete(key);
    }
  }
  // Clean TripAdvisor cache
  for (const [key, entry] of tripAdvisorCache.entries()) {
    if (now - entry.timestamp > TRIPADVISOR_CACHE_EXPIRATION) {
      tripAdvisorCache.delete(key);
    }
  }
}, 60 * 60 * 1000);

// Middleware
app.use(express.json());

// Serve static files from the public directory
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
console.log('Serving static files from:', publicPath);

// Helper function to make HTTP GET requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Status Code: ${res.statusCode}`));
      }
      
      const data = [];
      res.on('data', chunk => {
        data.push(chunk);
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(Buffer.concat(data).toString());
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Helper function to make HTTP GET requests with headers (for TripAdvisor)
// Returns { statusCode, body } to allow graceful handling of non-200 responses
function makeRequestWithHeaders(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };
    
    const req = https.request(options, (res) => {
      const data = [];
      res.on('data', chunk => {
        data.push(chunk);
      });
      
      res.on('end', () => {
        try {
          const result = Buffer.concat(data).toString();
          // For 403/401 errors, reject with a specific error type for graceful handling
          if (res.statusCode === 403 || res.statusCode === 401) {
            const authError = new Error(`API authorization failed`);
            authError.statusCode = res.statusCode;
            authError.isAuthError = true;
            return reject(authError);
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Status Code: ${res.statusCode}`));
          }
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Helper function to make HTTP POST requests (for New Places API)
function makePostRequest(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    const req = https.request(options, (res) => {
      const data = [];
      res.on('data', chunk => {
        data.push(chunk);
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(Buffer.concat(data).toString());
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// API endpoint to load Google Maps API with key
app.get('/api/maps-loader', (req, res) => {
  // Use the API key from environment variable
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  console.log('Google Maps API key available:', !!apiKey);
  
  if (!apiKey) {
    console.error('Google Maps API key is missing');
    res.status(500).send('console.error("Google Maps API key is missing");');
    return;
  }
  
  console.log('Google Maps API loader called with key (masked):', apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 3));
  
  // Return a script that loads the Google Maps API with the server's API key
  // But does not expose the key in the client-side code
  res.set('Content-Type', 'application/javascript');
  res.send(`
    // Load the Google Maps API with the key from the server
    console.log("Google Maps API loading with server-provided key");
    (function() {
      const script = document.createElement('script');
      script.src = "https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&callback=initMap";
      script.defer = true;
      script.async = true;
      
      // Add error handler to the script
      script.onerror = function() {
        console.error("Error loading Google Maps API");
        alert("Failed to load Google Maps. Please try refreshing the page.");
      };
      
      document.head.appendChild(script);
    })();
  `);
});

// Server-side proxy for place search
app.get('/api/places/search', async (req, res) => {
  try {
    const { lat, lng, radius = 1500, type = 'tourist_attraction' } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!apiKey) {
      return res.status(500).json({ status: 'ERROR', error: 'API key is not configured' });
    }
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
    
    console.log(`Fetching places/search with: ${url.replace(apiKey, 'API_KEY')}`);
    
    const data = await makeRequest(url);
    
    // Process the response to include direct photo URLs
    if (data.results) {
      data.results.forEach(place => {
        if (place.photos && place.photos.length > 0) {
          place.photos = place.photos.map(photo => {
            return {
              ...photo,
              url: `/api/photo?reference=${photo.photo_reference}&maxwidth=800&maxheight=600`
            };
          });
        }
      });
    }
    
    console.log(`Places/search response: status=${data.status}, results=${data.results ? data.results.length : 0}`);
    
    // Check if the API request was denied
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.log(`API request was denied with status: ${data.status}`);
      return res.status(403).json({ 
        status: 'ERROR', 
        error: `API request was denied: ${data.status}. This is likely due to API key domain restrictions. Please make sure the API key is configured for this domain.`
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error searching places:', error);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

// Server-side proxy for place details
app.get('/api/places/details', async (req, res) => {
  try {
    const { place_id } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!apiKey) {
      return res.status(500).json({ status: 'ERROR', error: 'API key is not configured' });
    }
    
    if (!place_id) {
      return res.status(400).json({ error: 'Place ID is required' });
    }
    
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,formatted_address,opening_hours,website,price_level,reviews,photos';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${apiKey}`;
    
    console.log(`Fetching place details with: ${url.replace(apiKey, 'API_KEY')}`);
    
    const data = await makeRequest(url);
    
    // Process photos to include direct URLs
    if (data.result && data.result.photos) {
      data.result.photos = data.result.photos.map(photo => {
        return {
          ...photo,
          url: `/api/photo?reference=${photo.photo_reference}&maxwidth=1200&maxheight=800`
        };
      });
    }
    
    console.log(`Place details response: status=${data.status}`);
    
    // Check if the API request was denied
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.log(`API request was denied with status: ${data.status}`);
      return res.status(403).json({ 
        status: 'ERROR', 
        error: `API request was denied: ${data.status}. This is likely due to API key domain restrictions. Please make sure the API key is configured for this domain.`
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

// Text Search endpoint - searches for places by name/query
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!apiKey) {
      return res.status(500).json({ status: 'ERROR', error: 'API key is not configured' });
    }
    
    if (!query) {
      return res.status(400).json({ status: 'ERROR', error: 'Query parameter is required' });
    }
    
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    
    console.log(`Text search for: "${query}"`);
    
    const data = await makeRequest(url);
    
    // Process the response to include direct photo URLs
    if (data.results) {
      data.results.forEach(place => {
        if (place.photos && place.photos.length > 0) {
          place.photos = place.photos.map(photo => {
            return {
              ...photo,
              url: `/api/photo?reference=${photo.photo_reference}&maxwidth=800&maxheight=600`
            };
          });
        }
      });
    }
    
    console.log(`Text search response: status=${data.status}, results=${data.results ? data.results.length : 0}`);
    
    // Check if the API request was denied
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.log(`API request was denied with status: ${data.status}`);
      return res.status(403).json({ 
        status: 'ERROR', 
        error: `API request was denied: ${data.status}. This is likely due to API key domain restrictions.`
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error in text search:', error);
    res.status(500).json({ status: 'ERROR', error: 'Failed to search places' });
  }
});

// TripAdvisor integration using Content API
app.get('/api/tripadvisor', async (req, res) => {
  try {
    const { place_name, lat, lng, category } = req.query;
    const apiKey = process.env.TRIPADVISOR_API_KEY;
    
    if (!apiKey) {
      console.log('TripAdvisor API key not configured');
      return res.status(200).json({
        status: 'OK',
        result: { tripadvisor_data: null, message: 'API key not configured' }
      });
    }
    
    if (!place_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'place_name parameter is required'
      });
    }
    
    // Create cache key
    const cacheKey = `${place_name}_${lat}_${lng}`.toLowerCase();
    
    // Check cache first
    if (tripAdvisorCache.has(cacheKey)) {
      const cached = tripAdvisorCache.get(cacheKey);
      if (Date.now() - cached.timestamp < TRIPADVISOR_CACHE_EXPIRATION) {
        console.log(`TripAdvisor cache hit for: ${place_name}`);
        return res.json(cached.data);
      }
    }
    
    console.log(`TripAdvisor API request for: "${place_name}"`);
    
    // Headers required by TripAdvisor API for domain-restricted keys
    // Use the production Replit app domain that's registered with TripAdvisor
    const tripAdvisorDomain = 'ucrave.replit.app';
    console.log(`TripAdvisor using domain: ${tripAdvisorDomain}`);
    const tripAdvisorHeaders = {
      'Referer': `https://${tripAdvisorDomain}/`,
      'Origin': `https://${tripAdvisorDomain}`
    };
    
    // Build search URL
    let searchUrl = `https://api.content.tripadvisor.com/api/v1/location/search?key=${apiKey}&searchQuery=${encodeURIComponent(place_name)}&language=en`;
    
    // Add coordinates if provided
    if (lat && lng) {
      searchUrl += `&latLong=${lat},${lng}`;
    }
    
    // Add category filter
    if (category === 'restaurant') {
      searchUrl += '&category=restaurants';
    } else if (category === 'lodging') {
      searchUrl += '&category=hotels';
    } else if (category === 'tourist_attraction') {
      searchUrl += '&category=attractions';
    }
    
    // Make API request with headers
    const searchResponse = await makeRequestWithHeaders(searchUrl, tripAdvisorHeaders);
    const searchData = JSON.parse(searchResponse);
    
    if (!searchData.data || searchData.data.length === 0) {
      const noResultResponse = {
        status: 'OK',
        result: { tripadvisor_data: null, message: 'No matching location found' }
      };
      tripAdvisorCache.set(cacheKey, { data: noResultResponse, timestamp: Date.now() });
      return res.json(noResultResponse);
    }
    
    // Get the first (best match) result
    const location = searchData.data[0];
    
    // Get location details for rating
    const detailsUrl = `https://api.content.tripadvisor.com/api/v1/location/${location.location_id}/details?key=${apiKey}&language=en`;
    const detailsResponse = await makeRequestWithHeaders(detailsUrl, tripAdvisorHeaders);
    const detailsData = JSON.parse(detailsResponse);
    
    const result = {
      status: 'OK',
      result: {
        tripadvisor_data: {
          location_id: location.location_id,
          name: detailsData.name || location.name,
          rating: detailsData.rating ? parseFloat(detailsData.rating) : null,
          rating_image_url: detailsData.rating_image_url || null,
          num_reviews: detailsData.num_reviews ? parseInt(detailsData.num_reviews) : null,
          ranking_string: detailsData.ranking_data?.ranking_string || null,
          price_level: detailsData.price_level || null,
          web_url: detailsData.web_url || null,
          address: detailsData.address_obj?.address_string || null
        }
      }
    };
    
    // Cache the result
    tripAdvisorCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    console.log(`TripAdvisor data found: ${result.result.tripadvisor_data.rating} rating, ${result.result.tripadvisor_data.num_reviews} reviews`);
    
    return res.json(result);
    
  } catch (error) {
    // Log all errors for debugging
    console.error('TripAdvisor API error:', error.message);
    // Cache failed results to avoid repeated API calls (use req.query values)
    const { place_name: placeName, lat: latitude, lng: longitude } = req.query;
    if (placeName) {
      const failedCacheKey = `${placeName}_${latitude}_${longitude}`.toLowerCase();
      const failedResponse = {
        status: 'OK',
        result: {
          tripadvisor_data: null,
          api_error: true
        }
      };
      tripAdvisorCache.set(failedCacheKey, { data: failedResponse, timestamp: Date.now() });
    }
    res.status(200).json({
      status: 'OK',
      result: {
        tripadvisor_data: null,
        api_error: true
      }
    });
  }
});

// Proxy for getting photos
app.get('/api/photo', (req, res) => {
  try {
    const { reference, photoreference, maxwidth = 400, maxheight = 300 } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    // Allow either 'reference' or 'photoreference' parameter
    const photoRef = photoreference || reference;
    
    if (!photoRef) {
      return res.status(400).json({ error: 'Photo reference is required (use parameter "reference" or "photoreference")' });
    }
    
    if (!apiKey) {
      return res.status(403).json({ 
        status: 'ERROR', 
        error: 'Google Maps API key is not configured' 
      });
    }
    
    // Log the API request (abbreviated)
    const shortRef = photoRef.length > 20 ? photoRef.substring(0, 20) + '...' : photoRef;
    
    // Generate a cache key based on the photo reference and dimensions
    const cacheKey = `${photoRef}_${maxwidth}_${maxheight}`;
    
    // Check if we have this photo URL cached
    if (photoRedirectCache.has(cacheKey)) {
      const cachedData = photoRedirectCache.get(cacheKey);
      console.log(`Using cached photo URL for: ${shortRef}`);
      
      // Create a request to the cached redirect URL
      const cachedReq = https.get(cachedData.url, (cachedRes) => {
        if (cachedRes.statusCode >= 200 && cachedRes.statusCode < 300) {
          res.setHeader('Content-Type', cachedRes.headers['content-type'] || 'image/jpeg');
          cachedRes.pipe(res);
        } else {
          // If the cached URL is no longer valid, remove it from cache and try again without cache
          console.log(`Cached URL is no longer valid, refetching for: ${shortRef}`);
          photoRedirectCache.delete(cacheKey);
          // Try again without using cache
          res.redirect(307, `/api/photo?reference=${photoRef}&maxwidth=${maxwidth}&maxheight=${maxheight}`);
        }
      });
      
      cachedReq.on('error', () => {
        // If there's an error with the cached URL, remove it from cache and try again
        console.log(`Error with cached URL, refetching for: ${shortRef}`);
        photoRedirectCache.delete(cacheKey);
        res.redirect(307, `/api/photo?reference=${photoRef}&maxwidth=${maxwidth}&maxheight=${maxheight}`);
      });
      
      cachedReq.end();
      return;
    }
    
    console.log(`Fetching photo with reference: ${shortRef}`);
    
    // Create URL to the actual Google Places Photo API
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${photoRef}&maxwidth=${maxwidth}&maxheight=${maxheight}&key=${apiKey}`;
    
    // Stream the photo directly without using axios
    const photoReq = https.get(photoUrl, (photoRes) => {
      // Log detailed information about the photo response
      console.log(`Photo response for: ${shortRef}, status=${photoRes.statusCode}, content-type=${photoRes.headers['content-type']}`);
      
      // Check if we got the image or an error from Google
      if (photoRes.statusCode === 403 || photoRes.statusCode === 400) {
        console.error(`Photo API request denied: status=${photoRes.statusCode}`);
        return res.status(403).json({ 
          status: 'ERROR', 
          error: `API request was denied with status: ${photoRes.statusCode}. This is likely due to API key domain restrictions.` 
        });
      }
      
      // If we got a redirect (302), follow it to get the actual image
      if (photoRes.statusCode === 302 && photoRes.headers.location) {
        console.log(`Following photo redirect to: ${photoRes.headers.location}`);
        
        // Store the redirect URL in cache
        photoRedirectCache.set(cacheKey, {
          url: photoRes.headers.location,
          timestamp: Date.now()
        });
        
        // Create a new request to the redirect location
        const redirectReq = https.get(photoRes.headers.location, (redirectRes) => {
          // If we got a successful response from the redirect, stream it
          console.log(`Redirect response: status=${redirectRes.statusCode}, content-type=${redirectRes.headers['content-type']}`);
          
          if (redirectRes.statusCode >= 200 && redirectRes.statusCode < 300) {
            res.setHeader('Content-Type', redirectRes.headers['content-type'] || 'image/jpeg');
            redirectRes.pipe(res);
          } else {
            console.error(`Failed to retrieve image after redirect: ${redirectRes.statusCode}`);
            res.status(redirectRes.statusCode).send('Failed to retrieve image after redirect');
          }
        });
        
        redirectReq.on('error', (error) => {
          console.error('Error following redirect:', error);
          res.status(500).json({ error: 'Failed to follow redirect' });
        });
        
        redirectReq.end();
        return;
      }
      
      // If we got a successful response, stream it
      res.setHeader('Content-Type', photoRes.headers['content-type'] || 'image/jpeg');
      photoRes.pipe(res);
    });
    
    photoReq.on('error', (error) => {
      console.error('Error fetching photo:', error);
      res.status(500).json({ error: 'Failed to fetch photo' });
    });
    
    photoReq.end();
  } catch (error) {
    console.error('Error in photo proxy:', error);
    res.status(500).json({ error: 'Failed to process photo request' });
  }
});

// Photo proxy for Places API v1 (new format with full photo name)
app.get('/api/photo-v2', async (req, res) => {
  try {
    const { name, maxwidth = 400, maxheight = 300 } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!name) {
      return res.status(400).json({ error: 'Photo name is required' });
    }
    
    if (!apiKey) {
      return res.status(403).json({ 
        status: 'ERROR', 
        error: 'Google Maps API key is not configured' 
      });
    }
    
    // Log abbreviated photo name
    const shortName = name.length > 50 ? name.substring(0, 50) + '...' : name;
    console.log(`Fetching photo-v2: ${shortName}`);
    
    // Use Places API v1 media endpoint
    // Format: GET https://places.googleapis.com/v1/{name}/media?maxHeightPx=400&maxWidthPx=400&key=API_KEY
    const photoUrl = `https://places.googleapis.com/v1/${name}/media?maxHeightPx=${maxheight}&maxWidthPx=${maxwidth}&key=${apiKey}`;
    
    const photoReq = https.get(photoUrl, (photoRes) => {
      console.log(`Photo-v2 response: status=${photoRes.statusCode}, content-type=${photoRes.headers['content-type']}`);
      
      if (photoRes.statusCode === 403 || photoRes.statusCode === 400) {
        console.error(`Photo-v2 API request denied: status=${photoRes.statusCode}`);
        return res.status(403).json({ 
          status: 'ERROR', 
          error: `API request was denied with status: ${photoRes.statusCode}` 
        });
      }
      
      // If we got a redirect, follow it
      if (photoRes.statusCode === 302 && photoRes.headers.location) {
        console.log(`Following photo-v2 redirect`);
        const redirectReq = https.get(photoRes.headers.location, (redirectRes) => {
          if (redirectRes.statusCode >= 200 && redirectRes.statusCode < 300) {
            res.setHeader('Content-Type', redirectRes.headers['content-type'] || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            redirectRes.pipe(res);
          } else {
            res.status(redirectRes.statusCode).send('Failed to retrieve image');
          }
        });
        redirectReq.on('error', (error) => {
          console.error('Error following redirect:', error);
          res.status(500).json({ error: 'Failed to follow redirect' });
        });
        redirectReq.end();
        return;
      }
      
      // Stream the photo directly
      res.setHeader('Content-Type', photoRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      photoRes.pipe(res);
    });
    
    photoReq.on('error', (error) => {
      console.error('Error fetching photo-v2:', error);
      res.status(500).json({ error: 'Failed to fetch photo' });
    });
    
    photoReq.end();
  } catch (error) {
    console.error('Error in photo-v2 proxy:', error);
    res.status(500).json({ error: 'Failed to process photo request' });
  }
});

// Nearby places search endpoint - Uses New Places API (v1) with locationRestriction
app.get('/api/nearby', async (req, res) => {
  try {
    const { lat, lng, type = 'restaurant', radius = 1500, keyword } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!lat || !lng) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing required location parameters' });
    }
    
    if (!apiKey) {
      console.log('API key is missing');
      return res.status(500).json({ 
        status: 'ERROR', 
        error: 'Google Maps API key is not configured'
      });
    }
    
    console.log(`Search requested for ${type} near location [${lat}, ${lng}] with radius ${radius}m` + 
                (keyword ? ` and keyword "${keyword}"` : ''));
    
    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    const radiusMeters = parseInt(radius) || 1500;
    
    // Calculate bounding box for locationRestriction (rectangle)
    // 1 degree latitude = ~111km, 1 degree longitude varies by latitude
    const latDelta = radiusMeters / 111000;
    const lngDelta = radiusMeters / (111000 * Math.cos(centerLat * Math.PI / 180));
    
    // Build the search query
    const searchQuery = keyword ? keyword : type;
    
    // Use New Places API (v1) with locationRestriction for accurate results
    const requestBody = {
      textQuery: searchQuery,
      locationRestriction: {
        rectangle: {
          low: {
            latitude: centerLat - latDelta,
            longitude: centerLng - lngDelta
          },
          high: {
            latitude: centerLat + latDelta,
            longitude: centerLng + lngDelta
          }
        }
      },
      maxResultCount: 40,
      languageCode: "en"
    };
    
    // Add includedType for better filtering
    const typeMapping = {
      'restaurant': 'restaurant',
      'hotel': 'hotel',
      'lodging': 'lodging',
      'bar': 'bar',
      'cafe': 'cafe',
      'bakery': 'bakery'
    };
    
    if (typeMapping[type]) {
      requestBody.includedType = typeMapping[type];
    }
    
    console.log(`Using New Places API (v1) with locationRestriction`);
    console.log(`Bounding box: [${(centerLat - latDelta).toFixed(4)}, ${(centerLng - lngDelta).toFixed(4)}] to [${(centerLat + latDelta).toFixed(4)}, ${(centerLng + lngDelta).toFixed(4)}]`);
    
    const apiUrl = 'https://places.googleapis.com/v1/places:searchText';
    const headers = {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.photos.name,places.photos.authorAttributions,places.priceLevel'
    };
    
    // Helper function for legacy API with auto-pagination (up to 60 results)
    async function useLegacyApi(reason) {
      console.log(`${reason}, using legacy API with pagination`);
      const legacyUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&location=${centerLat},${centerLng}&radius=${radiusMeters}&key=${apiKey}`;
      console.log(`Using legacy API: ${legacyUrl.replace(apiKey, 'API_KEY')}`);
      
      let allResults = [];
      let pageToken = null;
      let pageCount = 0;
      const maxPages = 3;
      
      // Helper to delay between page requests (Google requires ~2 seconds)
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      // Fetch first page
      const firstPageData = await makeRequest(legacyUrl);
      if (firstPageData.results) {
        allResults = allResults.concat(firstPageData.results);
        pageToken = firstPageData.next_page_token;
        pageCount++;
        console.log(`Page 1: ${firstPageData.results.length} results`);
      }
      
      // Fetch additional pages if available
      while (pageToken && pageCount < maxPages) {
        console.log(`Waiting 2 seconds before fetching page ${pageCount + 1}...`);
        await delay(2000);
        
        const nextPageUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${apiKey}`;
        try {
          const pageData = await makeRequest(nextPageUrl);
          if (pageData.results && pageData.results.length > 0) {
            allResults = allResults.concat(pageData.results);
            pageToken = pageData.next_page_token;
            pageCount++;
            console.log(`Page ${pageCount}: ${pageData.results.length} results (total: ${allResults.length})`);
          } else {
            console.log(`Page ${pageCount + 1} returned no results, stopping pagination`);
            break;
          }
        } catch (pageError) {
          console.log(`Error fetching page ${pageCount + 1}: ${pageError.message}`);
          break;
        }
      }
      
      console.log(`Legacy API returned ${allResults.length} total places across ${pageCount} pages`);
      
      // Process photos for all results
      allResults.forEach(place => {
        if (place.photos && place.photos.length > 0) {
          place.photos = place.photos.map(photo => ({
            ...photo,
            url: `/api/photo?reference=${photo.photo_reference}&maxwidth=800&maxheight=600`
          }));
        }
      });
      
      return { status: 'OK', results: allResults, html_attributions: [] };
    }
    
    // Use legacy API with pagination for maximum results (up to 60)
    // The new Places API (v1) only returns max 20 results without pagination
    console.log('Using legacy API with pagination to maximize results (up to 60)');
    const legacyData = await useLegacyApi('Preferring legacy API for pagination support');
    
    // Apply distance calculation and filtering to legacy results
    function getDistanceInMeters(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const φ1 = lat1 * Math.PI/180;
      const φ2 = lat2 * Math.PI/180;
      const Δφ = (lat2 - lat1) * Math.PI/180;
      const Δλ = (lng2 - lng1) * Math.PI/180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }
    
    // Add distance to each result
    if (legacyData.results) {
      legacyData.results = legacyData.results.map(place => {
        const placeLat = place.geometry?.location?.lat;
        const placeLng = place.geometry?.location?.lng;
        const distance = (placeLat && placeLng) ? 
          getDistanceInMeters(centerLat, centerLng, placeLat, placeLng) : null;
        return {
          ...place,
          distance_meters: distance ? Math.round(distance) : null
        };
      });
      
      // Apply distance filtering
      const originalCount = legacyData.results.length;
      legacyData.results = legacyData.results.filter(place => {
        if (!place.distance_meters) return true;
        return place.distance_meters <= radiusMeters;
      });
      console.log(`Distance filtering: ${legacyData.results.length} of ${originalCount} places within ${radiusMeters}m`);
      
      // Extra filtering for dessert places
      if (keyword === 'dessert') {
        const dessertKeywords = ['dessert', 'cake', 'ice cream', 'gelato', 'pastry', 'bakery', 'patisserie', 'sweet', 'chocolate', 'coffee', 'café', 'cafe'];
        const beforeCount = legacyData.results.length;
        legacyData.results = legacyData.results.filter(place => {
          const name = place.name.toLowerCase();
          const types = place.types || [];
          const nameMatch = dessertKeywords.some(kw => name.includes(kw));
          const typeMatch = types.some(t => ['bakery', 'cafe', 'meal_takeaway', 'restaurant', 'food'].includes(t));
          return nameMatch || typeMatch;
        });
        console.log(`Dessert filtering: ${legacyData.results.length} of ${beforeCount} places remain`);
      }
      
      // Filter out hotels from restaurant/bar searches
      if (type === "restaurant" || type === "bar") {
        const beforeCount = legacyData.results.length;
        legacyData.results = legacyData.results.filter(place => {
          if (!place.types) return true;
          return !place.types.includes("lodging") && !place.types.includes("hotel");
        });
        console.log(`Hotel filtering: ${legacyData.results.length} of ${beforeCount} places remain`);
      }
    }
    
    console.log(`Final result count: ${legacyData.results?.length || 0}`);
    return res.json(legacyData);
    
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Failed to fetch nearby places. Please check your API key configuration.' 
    });
  }
});

// Place details endpoint
app.get('/api/details', async (req, res) => {
  try {
    const { place_id } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!place_id) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing place_id parameter' });
    }
    
    // Check if API key is missing
    if (!apiKey) {
      console.log('API key is missing');
      return res.status(500).json({ 
        status: 'ERROR', 
        error: 'Google Maps API key is not configured'
      });
    }
    
    // Build URL with parameters
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,formatted_address,opening_hours,website,price_level,reviews,photos,vicinity,geometry,types';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${apiKey}`;
    
    console.log(`Fetching place details: ${url.replace(apiKey, 'API_KEY')}`);
    
    const data = await makeRequest(url);
    
    // Check if the API request was denied (likely due to domain restrictions)
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.log(`API request was denied with status: ${data.status}, error_message: ${data.error_message || 'No error message'}`);
      return res.json(data);
    }
    
    // Process photos to include direct URLs
    if (data.result && data.result.photos) {
      data.result.photos = data.result.photos.map(photo => {
        return {
          ...photo,
          url: `/api/photo?reference=${photo.photo_reference}&maxwidth=1200&maxheight=800`
        };
      });
    }
    
    console.log(`Found details for place: ${data.result ? data.result.name : 'not found'}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Failed to fetch place details. Please check your API key configuration.' 
    });
  }
});

// Geocoding proxy endpoint
app.get('/api/geocoding', async (req, res) => {
  try {
    const { address } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!address) {
      return res.status(400).json({ 
        status: 'ERROR', 
        error: 'Address parameter is required' 
      });
    }
    
    // Check if API key is missing
    if (!apiKey) {
      console.log('API key is missing');
      return res.status(500).json({ 
        status: 'ERROR', 
        error: 'Google Maps API key is not configured'
      });
    }
    
    // Build URL with parameters
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    console.log(`Geocoding: ${address}`);
    
    const data = await makeRequest(url);
    
    // Check if the API request was denied
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.log(`Geocoding API request was denied with status: ${data.status}`);
      return res.json(data); // Return the error response for debugging
    }
    
    console.log(`Geocoding response: status=${data.status}, results=${data.results ? data.results.length : 0}`);
    res.json(data);
  } catch (error) {
    console.error('Error with geocoding request:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Failed to complete geocoding request' 
    });
  }
});

// Health check endpoint 
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Weather API proxy endpoint
app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Latitude and longitude parameters are required'
      });
    }
    
    const cacheKey = `${lat},${lng}`;
    
    // Check if we have cached weather data that's still fresh
    if (weatherCache.has(cacheKey)) {
      const cachedData = weatherCache.get(cacheKey);
      const now = Date.now();
      
      // If cache is less than 30 minutes old, use it
      if (now - cachedData.timestamp < WEATHER_CACHE_EXPIRATION) {
        console.log(`Using cached weather data for [${lat}, ${lng}]`);
        return res.json(cachedData.data);
      }
      
      // Cache expired, delete it
      weatherCache.delete(cacheKey);
    }
    
    console.log(`Fetching weather data for location [${lat}, ${lng}]`);
    
    // Call OpenWeather API directly
    const openWeatherKey = process.env.OPENWEATHER_API_KEY;
    if (!openWeatherKey) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'OpenWeather API key is not configured'
      });
    }
    
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${openWeatherKey}&units=metric`;
    const weatherData = await makeRequest(weatherUrl);
    
    // Cache the result
    weatherCache.set(cacheKey, {
      timestamp: Date.now(),
      data: weatherData
    });
    
    res.json(weatherData);
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch weather data',
      details: error.message
    });
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
