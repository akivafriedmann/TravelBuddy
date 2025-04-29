// Simple Express server for travel app
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 5000;

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to make API requests with retries
async function makeRequest(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Request failed (attempt ${i+1}/${retries}):`, error.message);
      if (i === retries - 1) throw error;
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Nearby places endpoint
app.get('/api/nearby', async (req, res) => {
  try {
    const { lat, lng, type = 'restaurant', radius = 1500, keyword = '' } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!apiKey) {
      return res.status(500).json({ status: 'ERROR', error: 'API key is not configured' });
    }
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    // Build URL with type and radius
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
    
    // Add keyword if provided
    if (keyword) {
      url += `&keyword=${encodeURIComponent(keyword)}`;
    }
    
    console.log(`Fetching nearby places: ${url.replace(apiKey, 'API_KEY')}`);
    
    const data = await makeRequest(url);
    
    // Process photos to include direct URLs
    if (data.results) {
      data.results.forEach(place => {
        if (place.photos && place.photos.length > 0) {
          place.photos = place.photos.map(photo => {
            return {
              ...photo,
              url: `/api/photo?reference=${photo.photo_reference}&maxwidth=400`
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

// Photo proxy endpoint
app.get('/api/photo', async (req, res) => {
  try {
    const { reference, maxwidth = 400, maxheight } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!apiKey) {
      return res.status(500).json({ status: 'ERROR', error: 'API key is not configured' });
    }
    
    if (!reference) {
      return res.status(400).json({ error: 'Photo reference is required' });
    }
    
    // Build the Google Places Photo request URL
    let url = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${reference}&key=${apiKey}&maxwidth=${maxwidth}`;
    if (maxheight) {
      url += `&maxheight=${maxheight}`;
    }
    
    // Use axios to get the photo as a stream and pipe it to the response
    const response = await axios.get(url, { responseType: 'stream' });
    
    // Set appropriate headers
    res.set('Content-Type', response.headers['content-type']);
    
    // Pipe the image data directly to the response
    response.data.pipe(res);
  } catch (error) {
    console.error('Error fetching photo:', error);
    res.status(500).send('Failed to load image');
  }
});

// Place details endpoint
app.get('/api/details', async (req, res) => {
  try {
    const { place_id } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!apiKey) {
      return res.status(500).json({ status: 'ERROR', error: 'API key is not configured' });
    }
    
    if (!place_id) {
      return res.status(400).json({ status: 'ERROR', error: 'Place ID is required' });
    }
    
    // Comprehensive field list for detailed place information
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,formatted_address,opening_hours,website,price_level,reviews,photos,types,geometry';
    
    // Build URL
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${apiKey}`;
    
    console.log(`Fetching place details for ID ${place_id}`);
    
    const data = await makeRequest(url);
    
    // Process photos to include direct URLs
    if (data.result && data.result.photos) {
      data.result.photos = data.result.photos.map(photo => {
        return {
          ...photo,
          url: `/api/photo?reference=${photo.photo_reference}&maxwidth=800&maxheight=500`
        };
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ status: 'ERROR', error: 'Failed to fetch place details' });
  }
});

// Google Maps API loader endpoint
app.get('/api/maps-loader', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  if (!apiKey) {
    return res.status(500).json({ status: 'ERROR', error: 'API key is not configured' });
  }
  
  res.send(`
    <script>
      console.log("Google Maps API loading with server-provided key");
      const script = document.createElement('script');
      script.src = "https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap";
      document.head.appendChild(script);
    </script>
  `);
});

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Simple Travel App server running on port ${port}`);
});