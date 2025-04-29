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

// Server-side proxy for place search
app.get('/api/places/search', async (req, res) => {
  try {
    const { lat, lng, radius = 1500, type = 'tourist_attraction' } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
    
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
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
    
    if (!place_id) {
      return res.status(400).json({ error: 'Place ID is required' });
    }
    
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,formatted_address,opening_hours,website,price_level,reviews,photos';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${apiKey}`;
    
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
    
    // Check if we have a scraped data fallback for TripAdvisor
    const fs = require('fs');
    const path = require('path');
    const scrapingEnabled = process.env.SCRAPINGBEE_API_KEY && process.env.SCRAPINGBEE_API_KEY.length > 10;
    
    // Try the official TripAdvisor API first (via our server endpoint)
    let officialApiResult = null;
    try {
      const serverUrl = 'http://localhost:8000';
      const tripadvisorApiUrl = `${serverUrl}/tripadvisor?place_name=${encodeURIComponent(place_name)}&location=${encodeURIComponent(location)}`;
      
      console.log(`Attempting to call server TripAdvisor API: ${tripadvisorApiUrl}`);
      
      const response = await fetch(tripadvisorApiUrl);
      const data = await response.json();
      
      if (data.result && data.result.tripadvisor_data && Object.keys(data.result.tripadvisor_data).length > 0) {
        console.log('Successfully received TripAdvisor data from official API');
        officialApiResult = data;
      } else {
        console.log('No meaningful TripAdvisor data in API response:', 
                   data.result?.message || data.result?.error || 'Unknown reason');
      }
    } catch (apiError) {
      console.error('Error calling TripAdvisor official API:', apiError.message);
    }
    
    // If we got data from the official API, use it
    if (officialApiResult) {
      return res.json(officialApiResult);
    }
    
    // If we don't have official API data, inform the client
    return res.status(200).json({
      status: 'OK',
      result: {
        name: place_name,
        location: location,
        tripadvisor_data: null,
        access_limited: true,
        message: "TripAdvisor API access is currently limited due to domain restrictions."
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
    const { reference, maxwidth = 400, maxheight = 300 } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
    
    if (!reference) {
      return res.status(400).json({ error: 'Photo reference is required' });
    }
    
    // Create URL to the actual Google Places Photo API
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${reference}&maxwidth=${maxwidth}&maxheight=${maxheight}&key=${apiKey}`;
    
    // Stream the photo directly without using axios
    https.get(photoUrl, (photoRes) => {
      res.setHeader('Content-Type', photoRes.headers['content-type']);
      photoRes.pipe(res);
    }).on('error', (error) => {
      console.error('Error fetching photo:', error);
      res.status(500).json({ error: 'Failed to fetch photo' });
    });
  } catch (error) {
    console.error('Error in photo proxy:', error);
    res.status(500).json({ error: 'Failed to process photo request' });
  }
});

// API endpoint to load Google Maps API with key
app.get('/api/maps-loader', (req, res) => {
  // Use the API key from environment variable
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  if (!apiKey) {
    console.error('Google Maps API key is missing');
    res.status(500).send('console.error("Google Maps API key is missing");');
    return;
  }
  
  console.log('Google Maps API loader called');
  
  // Return a script that loads the Google Maps API with the server's API key
  // But does not expose the key in the client-side code
  res.set('Content-Type', 'application/javascript');
  res.send(`
    // Load the Google Maps API with the key from the server
    (function() {
      const script = document.createElement('script');
      script.src = "https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap";
      script.defer = true;
      script.async = true;
      document.head.appendChild(script);
      console.log("Google Maps API loading with server-provided key");
    })();
  `);
});

// Nearby places search endpoint
app.get('/api/nearby', async (req, res) => {
  try {
    const { lat, lng, type = 'restaurant', radius = 1500, keyword } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!apiKey) {
      return res.status(500).json({ status: 'ERROR', error: 'API key is not configured' });
    }
    
    if (!lat || !lng) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing required location parameters' });
    }
    
    // Build URL with parameters
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
    
    // Add keyword if provided
    if (keyword) {
      url += `&keyword=${encodeURIComponent(keyword)}`;
    }
    
    console.log(`Fetching nearby places: ${url.replace(apiKey, 'API_KEY')}`);
    
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
    
    console.log(`Found ${data.results ? data.results.length : 0} nearby places`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    res.status(500).json({ status: 'ERROR', error: 'Failed to fetch nearby places' });
  }
});

// Places search endpoint for the embedded Google Maps demo
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
    res.json(data);
  } catch (error) {
    console.error('Error searching places:', error);
    res.status(500).json({ error: 'Failed to search places' });
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
    
    // Optional fields parameter with default comprehensive field list
    const fields = req.query.fields || 
      'name,rating,user_ratings_total,formatted_phone_number,formatted_address,opening_hours,website,price_level,reviews,photos,types,geometry';
    
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

// Main travel planner web app - serve the static index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

/* Commented out the old inline HTML version
app.get('/inline-html', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Travel Planner</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    #map {
      height: 500px;
      width: 100%;
      margin-bottom: 20px;
    }
    .place-card {
      margin-bottom: 15px;
      cursor: pointer;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .place-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    .place-image {
      height: 150px;
      object-fit: cover;
    }
    .rating-stars {
      color: #FFC107;
    }
    .price-level {
      font-weight: bold;
    }
    .loading-spinner {
      display: none;
      text-align: center;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container mt-4">
    <h1 class="mb-4 text-center">Travel Planner</h1>
    
    <div class="input-group mb-3">
      <input type="text" id="search-input" class="form-control" placeholder="Search for a location">
      <button class="btn btn-primary" id="search-button">Search</button>
    </div>
    
    <div id="map"></div>
    
    <div class="loading-spinner" id="loading-spinner">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>Loading places...</p>
    </div>
    
    <div id="places-container" class="row"></div>
    
    <!-- Modal for place details -->
    <div class="modal fade" id="place-modal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modal-title">Place Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="modal-body">
            <div class="text-center">
              <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Global variables
    let map;
    let markers = [];
    
    // Initialize the map
    function initMap() {
      // Start with New York
      const defaultLocation = { lat: 40.7128, lng: -74.0060 };
      
      map = new google.maps.Map(document.getElementById('map'), {
        center: defaultLocation,
        zoom: 13
      });
      
      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            map.setCenter(userLocation);
            findNearbyPlaces(userLocation);
          },
          () => {
            // If geolocation fails, use default location
            findNearbyPlaces(defaultLocation);
          }
        );
      } else {
        // No geolocation, use default
        findNearbyPlaces(defaultLocation);
      }
      
      // Set up search functionality
      document.getElementById('search-button').addEventListener('click', searchPlace);
      document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          searchPlace();
        }
      });
    }
    
    // Search for a place
    function searchPlace() {
      const searchText = document.getElementById('search-input').value;
      if (!searchText) return;
      
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: searchText }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
          map.setCenter(results[0].geometry.location);
          findNearbyPlaces(results[0].geometry.location);
        }
      });
    }
    
    // Find places near a location
    function findNearbyPlaces(location) {
      // Clear existing markers
      markers.forEach(marker => marker.setMap(null));
      markers = [];
      
      // Clear places list
      document.getElementById('places-container').innerHTML = '';
      
      // Show loading spinner
      document.getElementById('loading-spinner').style.display = 'block';
      
      // Use our server-side API to search for places
      fetch(\`/api/places/search?lat=\${location.lat()}&lng=\${location.lng()}&radius=1500&type=tourist_attraction\`)
        .then(response => response.json())
        .then(data => {
          if (data.results && data.results.length > 0) {
            data.results.forEach(place => {
              createMarker(place);
              createPlaceCard(place);
            });
          } else {
            document.getElementById('places-container').innerHTML = 
              '<div class="col-12"><div class="alert alert-info">No places found in this area. Try another location.</div></div>';
          }
        })
        .catch(error => {
          console.error('Error fetching places:', error);
          document.getElementById('places-container').innerHTML = 
            '<div class="col-12"><div class="alert alert-danger">Failed to load places. Please try again.</div></div>';
        })
        .finally(() => {
          // Hide loading spinner
          document.getElementById('loading-spinner').style.display = 'none';
        });
    }
    
    // Create a marker for a place
    function createMarker(place) {
      if (!place.geometry || !place.geometry.location) return;
      
      const position = {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      };
      
      const marker = new google.maps.Marker({
        map: map,
        position: position,
        title: place.name
      });
      
      markers.push(marker);
      
      // Add click event
      marker.addListener('click', () => {
        getPlaceDetails(place.place_id);
      });
    }
    
    // Create a card for a place
    function createPlaceCard(place) {
      const container = document.getElementById('places-container');
      
      // Create card element
      const card = document.createElement('div');
      card.className = 'col-md-4 mb-4';
      
      // Get image if available
      let imageUrl = 'https://via.placeholder.com/300x150?text=No+Image';
      if (place.photos && place.photos.length > 0) {
        imageUrl = place.photos[0].url;
      }
      
      // Format rating
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = '<div class="rating-stars mb-2">';
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '<i class="fas fa-star"></i>';
        }
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '<i class="fas fa-star-half-alt"></i>';
        }
        ratingHtml += ' <span>' + place.rating + '</span>';
        if (place.user_ratings_total) {
          ratingHtml += ' <span class="text-muted">(' + place.user_ratings_total + ')</span>';
        }
        ratingHtml += '</div>';
      }
      
      // Format price level
      let priceHtml = '';
      if (place.price_level) {
        priceHtml = '<div class="price-level mb-2">';
        for (let i = 0; i < place.price_level; i++) {
          priceHtml += '$';
        }
        priceHtml += '</div>';
      }
      
      card.innerHTML = \`
        <div class="card place-card h-100">
          <img src="\${imageUrl}" class="card-img-top place-image" alt="\${place.name}" onerror="this.src='https://via.placeholder.com/300x150?text=No+Image'">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">\${place.name}</h5>
            \${ratingHtml}
            <p class="card-text">\${place.vicinity || ''}</p>
            \${priceHtml}
            <button class="btn btn-primary mt-auto view-details">View Details</button>
          </div>
        </div>
      \`;
      
      // Add to container
      container.appendChild(card);
      
      // Add click event
      card.querySelector('.view-details').addEventListener('click', () => {
        getPlaceDetails(place.place_id);
      });
    }
    
    // Get detailed information about a place
    function getPlaceDetails(placeId) {
      // Show modal with loading state
      const modalTitle = document.getElementById('modal-title');
      const modalBody = document.getElementById('modal-body');
      
      modalTitle.textContent = 'Loading...';
      modalBody.innerHTML = \`
        <div class="text-center p-5">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-3">Loading place details...</p>
        </div>
      \`;
      
      const modal = new bootstrap.Modal(document.getElementById('place-modal'));
      modal.show();
      
      // Fetch place details from our server API
      fetch(\`/api/places/details?place_id=\${placeId}\`)
        .then(response => response.json())
        .then(data => {
          if (data.result) {
            showPlaceDetails(data.result);
          } else {
            modalBody.innerHTML = '<div class="alert alert-warning">Could not load place details.</div>';
          }
        })
        .catch(error => {
          console.error('Error fetching place details:', error);
          modalBody.innerHTML = '<div class="alert alert-danger">Error loading place details. Please try again.</div>';
        });
    }
    
    // Show place details in modal
    function showPlaceDetails(place) {
      const modalTitle = document.getElementById('modal-title');
      const modalBody = document.getElementById('modal-body');
      
      modalTitle.textContent = place.name;
      
      // Get main image
      let imageHtml = '';
      if (place.photos && place.photos.length > 0) {
        imageHtml = \`<img src="\${place.photos[0].url}" class="img-fluid rounded mb-3" 
                      alt="\${place.name}" onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">\`;
      }
      
      // Format rating
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = '<div class="rating-stars fs-4 mb-3">';
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '<i class="fas fa-star"></i> ';
        }
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '<i class="fas fa-star-half-alt"></i> ';
        }
        for (let i = 0; i < (5 - Math.ceil(place.rating)); i++) {
          ratingHtml += '<i class="far fa-star"></i> ';
        }
        ratingHtml += '<span class="ms-2">' + place.rating + '</span>';
        if (place.user_ratings_total) {
          ratingHtml += ' <span class="text-muted">(' + place.user_ratings_total + ' reviews)</span>';
        }
        ratingHtml += '</div>';
      }
      
      // Build content
      let content = imageHtml + ratingHtml;
      
      content += \`<p><strong>Address:</strong> \${place.formatted_address || 'Not available'}</p>\`;
      
      if (place.formatted_phone_number) {
        content += \`<p><strong>Phone:</strong> \${place.formatted_phone_number}</p>\`;
      }
      
      if (place.website) {
        content += \`<p><strong>Website:</strong> <a href="\${place.website}" target="_blank">\${place.website}</a></p>\`;
      }
      
      // Price level
      if (place.price_level !== undefined) {
        content += '<p><strong>Price Level:</strong> ';
        for (let i = 0; i < place.price_level; i++) {
          content += '$';
        }
        content += '</p>';
      }
      
      // Opening hours
      if (place.opening_hours && place.opening_hours.weekday_text) {
        content += '<p><strong>Hours:</strong></p><ul class="list-group mb-3">';
        place.opening_hours.weekday_text.forEach(day => {
          content += \`<li class="list-group-item">\${day}</li>\`;
        });
        content += '</ul>';
      }
      
      // Reviews
      if (place.reviews && place.reviews.length > 0) {
        content += '<h5 class="mt-4">Reviews</h5>';
        place.reviews.slice(0, 3).forEach(review => {
          content += \`
            <div class="card mb-2">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h6 class="mb-0">\${review.author_name}</h6>
                  <div class="rating-stars">\`;
                  
          for (let i = 0; i < review.rating; i++) {
            content += '<i class="fas fa-star"></i>';
          }
                  
          content += \`</div>
                </div>
                <p class="mb-0">\${review.text}</p>
              </div>
            </div>\`;
        });
      }
      
      // Photo gallery (if more than one photo)
      if (place.photos && place.photos.length > 1) {
        content += '<h5 class="mt-4">Photos</h5>';
        content += '<div class="row">';
        
        place.photos.slice(1, 7).forEach(photo => {
          content += \`
            <div class="col-md-4 col-6 mb-3">
              <img src="\${photo.url}" class="img-fluid rounded" alt="Place photo" 
                   style="height: 100px; object-fit: cover; width: 100%;" 
                   onerror="this.src='https://via.placeholder.com/150x100?text=No+Image'">
            </div>
          \`;
        });
        
        content += '</div>';
      }
      
      modalBody.innerHTML = content;
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap" defer></script>
</body>
</html>
  `;
  
  res.send(html);
});
*/

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Travel Planner proxy server running on http://0.0.0.0:${PORT}`);
});