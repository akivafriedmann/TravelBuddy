const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Serve static files from the public directory
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
console.log('Serving static files from:', publicPath);

// Helper function to make HTTP requests
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
    (function() {
      const script = document.createElement('script');
      script.src = \`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap&loading=async\`;
      script.defer = true;
      script.async = true;
      document.head.appendChild(script);
      console.log("Google Maps API loading with server-provided key");
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

// Nearby places search endpoint
app.get('/api/nearby', async (req, res) => {
  try {
    const { lat, lng, type = 'restaurant', radius = 1500, keyword } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!lat || !lng) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing required location parameters' });
    }
    
    // Check if API key is missing
    if (!apiKey) {
      console.log('API key is missing');
      return res.status(500).json({ 
        status: 'ERROR', 
        error: 'Google Maps API key is not configured'
      });
    }
    
    // Log the search parameters for debugging
    console.log(`Search requested for ${type} near location [${lat}, ${lng}] with radius ${radius}m` + 
                (keyword ? ` and keyword "${keyword}"` : ''));
    
    // Build URL with parameters
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
    
    // Add keyword if provided
    if (keyword) {
      url += `&keyword=${encodeURIComponent(keyword)}`;
    }
    
    // Add params for restaurant searches
    if (type === 'restaurant') {
      url += '&minprice=0&maxprice=4&rankby=prominence';
    }
    
    console.log(`Fetching nearby places: ${url.replace(apiKey, 'API_KEY')}`);
    
    // Make the first request to get initial results
    const data = await makeRequest(url);
    
    // Fetch more results if pagetoken is available (up to 2 more pages)
    // This will give us up to 60 results instead of just 20
    let allResults = [...(data.results || [])];
    let pageToken = data.next_page_token;
    
    if (pageToken && allResults.length > 0) {
      // Need to wait a bit before using the page token
      console.log("Page token available, waiting to fetch more results...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        // Make second request with page token
        const secondPageUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${apiKey}`;
        const secondPageData = await makeRequest(secondPageUrl);
        
        if (secondPageData.status === 'OK' && secondPageData.results) {
          console.log(`Got ${secondPageData.results.length} more places from second page`);
          allResults = [...allResults, ...secondPageData.results];
          pageToken = secondPageData.next_page_token;
          
          // Get third page if available
          if (pageToken) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
              const thirdPageUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${apiKey}`;
              const thirdPageData = await makeRequest(thirdPageUrl);
              
              if (thirdPageData.status === 'OK' && thirdPageData.results) {
                console.log(`Got ${thirdPageData.results.length} more places from third page`);
                allResults = [...allResults, ...thirdPageData.results];
              }
            } catch (pageError) {
              console.log("Error fetching third page:", pageError.message);
            }
          }
        }
      } catch (pageError) {
        console.log("Error fetching second page:", pageError.message);
      }
    }
    
    // Replace the original results with all results
    data.results = allResults;
    console.log(`Total places found after pagination: ${allResults.length}`);
    
    // Check if the API request was denied (likely due to domain restrictions)
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.log(`API request was denied with status: ${data.status}, error_message: ${data.error_message || 'No error message'}`);
      
      // Instead of returning an error, return the actual response with the error
      // This helps debugging while keeping the app running
      console.log(`Nearby places response: status=${data.status}, results=${data.results ? data.results.length : 0}`);
      return res.json(data);
    }
    
    // Process the response to filter results and include direct photo URLs
    if (data.results) {
      // Show detailed debug information about results
      console.log(`Nearby places response: status=${data.status}, results=${data.results.length}`);
      
      // Log the names of places found
      const placeNames = data.results.map(p => `${p.name} (${p.rating || 'No rating'})`).join(', ');
      console.log(`Places found: ${placeNames}`);
      
      // Filter out hotels from restaurant or bar searches
      if (type === "restaurant" || type === "bar") {
        const originalCount = data.results.length;
        
        // Make sure we get enough results even after filtering
        if (originalCount > 0) {
          data.results = data.results.filter(place => {
            if (!place.types) return true; // Keep places with no types array
            
            // Keep places that don't have "lodging" in their types
            return !place.types.includes("lodging");
          });
        }
        
        console.log(`Filtered out hotels, remaining places: ${data.results.length}`);
      }

      // Add direct photo URLs to each place
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
    
    console.log(`Found ${data.results ? data.results.length : 0} nearby places`);
    res.json(data);
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

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
