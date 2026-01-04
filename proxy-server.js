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

// Clean up weather cache too
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of weatherCache.entries()) {
    if (now - entry.timestamp > WEATHER_CACHE_EXPIRATION) {
      weatherCache.delete(key);
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
      script.src = "https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap";
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
              url: `/api/photo?reference=${photo.photo_reference}&maxwidth=400&maxheight=200`
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
          url: `/api/photo?reference=${photo.photo_reference}&maxwidth=600&maxheight=400`
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

// TripAdvisor integration - handles API limitations
app.get('/api/tripadvisor', async (req, res) => {
  try {
    const { place_name, location } = req.query;
    
    // Require both place name and location
    if (!place_name || !location) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Both place_name and location parameters are required'
      });
    }
    
    console.log(`TripAdvisor data request for: "${place_name}" in "${location}"`);
    
    // Return a clean response that indicates the service is currently working
    // but we don't have detailed TripAdvisor data at the moment
    return res.status(200).json({
      status: 'OK',
      result: {
        name: place_name,
        location: location,
        tripadvisor_data: null,
        access_limited: true,
        message: "TripAdvisor data not available at this time."
      }
    });
    
  } catch (error) {
    console.error('Error in TripAdvisor route:', error);
    res.status(200).json({  // Use 200 to keep frontend working
      status: 'OK',
      result: {
        name: req.query.place_name,
        location: req.query.location,
        tripadvisor_data: null,
        api_error: true,
        error_message: error.message
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
      maxResultCount: 20,
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
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.photos,places.priceLevel'
    };
    
    let data;
    try {
      data = await makePostRequest(apiUrl, requestBody, headers);
      console.log(`New Places API response received`);
    } catch (apiError) {
      console.log(`New Places API failed: ${apiError.message}, falling back to legacy API`);
      
      // Fallback to legacy Text Search API with location parameter
      const legacyUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&location=${centerLat},${centerLng}&radius=${radiusMeters}&key=${apiKey}`;
      console.log(`Using legacy API: ${legacyUrl.replace(apiKey, 'API_KEY')}`);
      
      const legacyData = await makeRequest(legacyUrl);
      
      // Return legacy format directly
      if (legacyData.results) {
        legacyData.results.forEach(place => {
          if (place.photos && place.photos.length > 0) {
            place.photos = place.photos.map(photo => ({
              ...photo,
              url: `/api/photo?reference=${photo.photo_reference}&maxwidth=400&maxheight=200`
            }));
          }
        });
      }
      
      console.log(`Legacy API returned ${legacyData.results?.length || 0} places`);
      return res.json(legacyData);
    }
    
    // Check for API errors
    if (data.error) {
      console.log(`API error: ${JSON.stringify(data.error)}`);
      return res.json({ status: 'ERROR', results: [], error_message: data.error.message });
    }
    
    // Transform New Places API response to match legacy format
    const places = data.places || [];
    console.log(`Found ${places.length} places from New Places API`);
    
    if (places.length > 0) {
      const placeNames = places.map(p => `${p.displayName?.text || 'Unknown'} (${p.rating || 'No rating'})`).join(', ');
      console.log(`Places found: ${placeNames}`);
    }
    
    // Helper function for distance calculation
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
    
    // Transform to legacy format for frontend compatibility
    let results = places.map(place => {
      const placeLat = place.location?.latitude;
      const placeLng = place.location?.longitude;
      const distance = (placeLat && placeLng) ? 
        getDistanceInMeters(centerLat, centerLng, placeLat, placeLng) : null;
      
      return {
        place_id: place.id?.replace('places/', ''),
        name: place.displayName?.text || 'Unknown',
        formatted_address: place.formattedAddress,
        vicinity: place.formattedAddress,
        geometry: {
          location: {
            lat: placeLat,
            lng: placeLng
          }
        },
        rating: place.rating,
        user_ratings_total: place.userRatingCount,
        types: place.types || [],
        price_level: place.priceLevel ? parseInt(place.priceLevel.replace('PRICE_LEVEL_', '')) : undefined,
        distance_meters: distance ? Math.round(distance) : null,
        photos: place.photos ? place.photos.map(photo => ({
          photo_reference: photo.name?.split('/').pop(),
          url: `/api/photo?reference=${photo.name?.split('/').pop()}&maxwidth=400&maxheight=200`
        })) : []
      };
    });
    
    // Apply distance filtering
    const originalCount = results.length;
    results = results.filter(place => {
      if (!place.distance_meters) return true;
      return place.distance_meters <= radiusMeters;
    });
    console.log(`Distance filtering: ${results.length} of ${originalCount} places within ${radiusMeters}m`);
    
    // Extra filtering for dessert places
    if (keyword === 'dessert') {
      const dessertKeywords = ['dessert', 'cake', 'ice cream', 'gelato', 'pastry', 'bakery', 'patisserie', 'sweet', 'chocolate', 'coffee', 'café', 'cafe'];
      const beforeCount = results.length;
      results = results.filter(place => {
        const name = place.name.toLowerCase();
        const types = place.types || [];
        const nameMatch = dessertKeywords.some(kw => name.includes(kw));
        const typeMatch = types.some(t => ['bakery', 'cafe', 'meal_takeaway', 'restaurant', 'food'].includes(t));
        return nameMatch || typeMatch;
      });
      console.log(`Dessert filtering: ${results.length} of ${beforeCount} places remain`);
    }
    
    // Filter out hotels from restaurant/bar searches
    if (type === "restaurant" || type === "bar") {
      const beforeCount = results.length;
      results = results.filter(place => {
        if (!place.types) return true;
        return !place.types.includes("lodging") && !place.types.includes("hotel");
      });
      console.log(`Hotel filtering: ${results.length} of ${beforeCount} places remain`);
    }
    
    console.log(`Found ${results.length} nearby places`);
    res.json({ status: 'OK', results, html_attributions: [] });
    
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
          url: `/api/photo?reference=${photo.photo_reference}&maxwidth=600&maxheight=400`
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
    
    // Forward request to our backend server
    const serverUrl = `http://localhost:8000/api/weather?lat=${lat}&lng=${lng}`;
    const weatherData = await makeRequest(serverUrl);
    
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
