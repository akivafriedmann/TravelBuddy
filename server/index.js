const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const placesRoutes = require('./routes/places');
const geocodingRoutes = require('./routes/geocoding');
const itineraryRoutes = require('./routes/itineraries');
const tripadvisorRoutes = require('./routes/tripadvisor');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable cross-origin requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Log all requests and disable caching
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  // Disable caching to ensure fresh content
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Serve static files from the public directory with no caching
app.use(express.static(path.join(__dirname, '../public'), {
  etag: false,
  lastModified: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Create a dedicated endpoint for a simplified travel planner app
app.get('/simple', (req, res) => {
  // This HTML has all of our updated place details panel code
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Travel Planner</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f8f9fa;
      margin: 0;
      padding: 0;
    }
    
    .app-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    header {
      background-color: #4285F4;
      color: white;
      padding: 20px 0;
      margin-bottom: 20px;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .header-logo {
      font-size: 2.5rem;
      margin-right: 10px;
      color: white;
    }
    
    #map {
      height: 500px;
      width: 100%;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    
    .search-container {
      margin: 20px 0;
    }
    
    .results-container {
      margin-top: 20px;
    }
    
    .place-card {
      margin-bottom: 15px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.3s;
      height: 100%;
      border: none;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    
    .place-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 15px rgba(0,0,0,0.1);
    }
    
    .card-img-top {
      height: 180px;
      object-fit: cover;
    }
    
    .loading {
      display: none;
      text-align: center;
      margin: 20px 0;
    }
    
    .error-message {
      display: none;
      color: #dc3545;
      padding: 12px 15px;
      border-radius: 8px;
      background-color: #f8d7da;
      margin: 0 0 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    /* Star Rating Display */
    .star-rating {
      color: #ffc107;
      font-size: 1.2rem;
    }
    
    .star-rating .rating-text {
      font-weight: bold;
      color: #333;
    }
    
    .detail-item {
      display: flex;
      align-items: flex-start;
    }
    
    .detail-item i {
      font-size: 1.2rem;
      margin-top: 3px;
    }
    
    .detail-item > div {
      flex: 1;
      margin-left: 5px;
    }
    
    .price-level {
      font-size: 1.2rem;
      letter-spacing: 2px;
      font-weight: bold;
    }
    
    /* Mobile Responsiveness */
    @media (max-width: 768px) {
      #map {
        height: 400px;
      }
      
      .header-logo {
        font-size: 2rem;
      }
      
      .card-img-top {
        height: 150px;
      }
      
      .app-container {
        padding: 15px;
      }
      
      h1 {
        font-size: 1.5rem;
      }
    }
    
    @media (max-width: 576px) {
      #map {
        height: 350px;
        border-radius: 0;
        margin-left: -15px;
        margin-right: -15px;
        width: calc(100% + 30px);
      }
      
      .app-container {
        padding: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="app-container">
    <header class="py-3 mb-4">
      <div class="d-flex align-items-center justify-content-center">
        <i class="fas fa-map-marked-alt header-logo"></i>
        <h1>Travel Planner</h1>
      </div>
    </header>

    <div class="search-container">
      <div class="input-group shadow-sm">
        <span class="input-group-text bg-white border-end-0">
          <i class="fas fa-map-marker-alt text-primary"></i>
        </span>
        <input type="text" id="searchInput" class="form-control border-start-0" 
          placeholder="Search for a location (e.g., New York, Paris, Tokyo)..."
          aria-label="Search location">
        <button class="btn btn-primary px-4" id="searchButton">
          <i class="fas fa-search me-md-2"></i> <span class="d-none d-md-inline">Search</span>
        </button>
      </div>
    </div>

    <div class="loading" id="loadingIndicator">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Searching for places...</p>
    </div>

    <div class="error-message" id="errorMessage"></div>

    <div id="map"></div>

    <div class="results-container">
      <h3 class="mb-3 mt-4" id="resultsTitle">Places of Interest</h3>
      <div class="row" id="placesResults"></div>
    </div>
  </div>

  <!-- Place Details Modal -->
  <div class="modal fade" id="placeDetailsModal" tabindex="-1" aria-labelledby="placeDetailsModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="placeDetailsModalLabel">Place Details</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" id="placeDetailsBody">
          <!-- Place details will be loaded here -->
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Global variables
    let map;
    let markers = [];
    let infoWindow;
    let placesService;
    let geocoder;
    let currentPlaceId = null;
    
    // Helper functions for UI
    function showLoading() {
      document.getElementById('loadingIndicator').style.display = 'block';
    }
    
    function hideLoading() {
      document.getElementById('loadingIndicator').style.display = 'none';
    }
    
    function showError(message) {
      const errorElement = document.getElementById('errorMessage');
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 5000);
    }
    
    function hideError() {
      document.getElementById('errorMessage').style.display = 'none';
    }
    
    // Format price level into $ symbols
    function getPriceLevel(level) {
      if (level === undefined || level === null) {
        return 'Not available';
      }
      
      switch(parseInt(level)) {
        case 0:
          return 'Free';
        case 1:
          return '$';
        case 2:
          return '$$';
        case 3:
          return '$$$';
        case 4:
          return '$$$$';
        default:
          return 'Not available';
      }
    }
    
    // Initialize Google Maps
    function initMap() {
      // Default location (New York City)
      const defaultLocation = { lat: 40.7128, lng: -74.0060 };
      
      // Create the map
      map = new google.maps.Map(document.getElementById('map'), {
        center: defaultLocation,
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });
      
      // Create geocoder and places service
      geocoder = new google.maps.Geocoder();
      placesService = new google.maps.places.PlacesService(map);
      infoWindow = new google.maps.InfoWindow();
      
      // Try to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            // Center map on user location
            map.setCenter(userLocation);
            
            // Add marker for user location
            new google.maps.Marker({
              position: userLocation,
              map: map,
              title: 'Your Location',
              icon: {
                url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
              }
            });
            
            // Search for places near the user's location
            searchNearbyPlaces(userLocation);
          },
          () => {
            // Handle geolocation error silently, use default location
            console.log('Geolocation failed, using default location');
            searchNearbyPlaces(defaultLocation);
          }
        );
      } else {
        // Browser doesn't support geolocation, use default location
        searchNearbyPlaces(defaultLocation);
      }
      
      // Set up search functionality
      document.getElementById('searchButton').addEventListener('click', searchLocation);
      document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          searchLocation();
        }
      });
    }
    
    // Search for a location
    function searchLocation() {
      const searchInput = document.getElementById('searchInput').value.trim();
      
      if (!searchInput) {
        showError('Please enter a location to search');
        return;
      }
      
      hideError();
      showLoading();
      clearMarkers();
      
      geocoder.geocode({ address: searchInput }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results.length > 0) {
          const location = results[0].geometry.location;
          
          // Center map on the searched location
          map.setCenter(location);
          map.setZoom(14);
          
          // Add marker for the searched location
          const marker = new google.maps.Marker({
            position: location,
            map: map,
            title: results[0].formatted_address
          });
          
          markers.push(marker);
          
          // Open info window with location name
          infoWindow.setContent(\`<div><strong>\${results[0].formatted_address}</strong></div>\`);
          infoWindow.open(map, marker);
          
          // Search for nearby places
          searchNearbyPlaces(location);
        } else {
          showError('Location not found. Please try a different search term.');
          hideLoading();
        }
      });
    }
    
    // Search for nearby places
    function searchNearbyPlaces(location) {
      const request = {
        location: location,
        radius: 1500,
        type: ['tourist_attraction', 'lodging', 'restaurant']
      };
      
      placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          displayPlaces(results);
          addPlaceMarkers(results);
        } else {
          showError('No places found near this location.');
        }
        hideLoading();
      });
    }
    
    // Display places in the results container
    function displayPlaces(places) {
      const resultsContainer = document.getElementById('placesResults');
      resultsContainer.innerHTML = '';
      
      if (places.length === 0) {
        resultsContainer.innerHTML = '<div class="col-12"><p>No places found.</p></div>';
        return;
      }
      
      places.forEach(place => {
        const placeCard = document.createElement('div');
        placeCard.className = 'col-md-4 col-sm-6 mb-4';
        
        const photoUrl = place.photos && place.photos.length > 0 
          ? place.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })
          : 'https://via.placeholder.com/300x200?text=No+Image';
        
        let placeType = 'point_of_interest';
        let typeIcon = 'fas fa-map-marker-alt';
        let typeBadge = 'secondary';
        
        if (place.types) {
          // Determine primary type and icon
          if (place.types.includes('restaurant') || place.types.includes('food')) {
            placeType = 'restaurant';
            typeIcon = 'fas fa-utensils';
            typeBadge = 'danger';
          } else if (place.types.includes('lodging') || place.types.includes('hotel')) {
            placeType = 'hotel';
            typeIcon = 'fas fa-bed';
            typeBadge = 'info';
          } else if (place.types.includes('tourist_attraction') || place.types.includes('museum')) {
            placeType = 'attraction';
            typeIcon = 'fas fa-landmark';
            typeBadge = 'warning';
          } else if (place.types.includes('park') || place.types.includes('natural_feature')) {
            placeType = 'nature';
            typeIcon = 'fas fa-tree';
            typeBadge = 'success';
          }
        }
        
        placeCard.innerHTML = \`
          <div class="card place-card shadow-sm h-100" data-place-id="\${place.place_id}">
            <div class="position-relative">
              <img src="\${photoUrl}" class="card-img-top" alt="\${place.name}" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
              <span class="badge bg-\${typeBadge} position-absolute top-0 start-0 m-2">
                <i class="\${typeIcon}"></i> \${placeType.replace('_', ' ')}
              </span>
              \${place.price_level ? \`<span class="badge bg-dark position-absolute top-0 end-0 m-2">\${getPriceLevel(place.price_level)}</span>\` : ''}
            </div>
            <div class="card-body d-flex flex-column">
              <h5 class="card-title">\${place.name}</h5>
              <div class="mb-2">
                \${place.rating ? 
                  \`<div class="text-warning mb-1">
                    \${Array(Math.floor(place.rating)).fill('<i class="fas fa-star"></i>').join('')}
                    \${place.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                    <span class="text-dark ms-1">\${place.rating}/5</span>
                    \${place.user_ratings_total ? \`<small class="text-muted">(\${place.user_ratings_total})</small>\` : ''}
                  </div>\` 
                  : ''}
              </div>
              <p class="card-text text-muted small">\${place.vicinity || ''}</p>
              <div class="mt-auto">
                <button class="btn btn-sm btn-primary view-details w-100">
                  <i class="fas fa-info-circle"></i> View Details
                </button>
              </div>
            </div>
          </div>
        \`;
        
        resultsContainer.appendChild(placeCard);
        
        // Add event listener to view details button
        placeCard.querySelector('.view-details').addEventListener('click', () => {
          getPlaceDetails(place.place_id);
        });
      });
    }
    
    // Add markers for places on the map
    function addPlaceMarkers(places) {
      places.forEach(place => {
        if (place.geometry && place.geometry.location) {
          const marker = new google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: place.name,
            animation: google.maps.Animation.DROP
          });
          
          markers.push(marker);
          
          // Add click listener to marker
          marker.addListener('click', () => {
            infoWindow.setContent(\`
              <div style="width: 200px; text-align: center; padding: 5px;">
                <strong style="font-size: 14px;">\${place.name}</strong>
                <p style="font-size: 12px; margin: 5px 0;">\${place.vicinity || ''}</p>
                \${place.rating ? \`<div style="margin-bottom: 5px;"><span style="color: #FFD700;"><i class="fas fa-star"></i></span> <strong>\${place.rating}</strong>/5</div>\` : ''}
                <button 
                  onclick="getPlaceDetails('\${place.place_id}')" 
                  style="background-color: #4285F4; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;"
                >
                  View Details
                </button>
              </div>
            \`);
            infoWindow.open(map, marker);
          });
        }
      });
    }
    
    // Get details for a specific place
    function getPlaceDetails(placeId) {
      showLoading();
      currentPlaceId = placeId;
      
      const request = {
        placeId: placeId,
        fields: ['name', 'rating', 'user_ratings_total', 'price_level', 'formatted_address', 'formatted_phone_number', 'website', 'opening_hours', 'review', 'photo', 'type']
      };
      
      placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          displayPlaceDetails(place);
        } else {
          showError('Place details not found.');
        }
        hideLoading();
      });
    }
    
    // Display place details in a modal
    function displayPlaceDetails(place) {
      if (!place) {
        showError('Place details not available');
        return;
      }
      
      const modalTitle = document.getElementById('placeDetailsModalLabel');
      const modalBody = document.getElementById('placeDetailsBody');
      
      modalTitle.textContent = place.name;
      
      const photoUrl = place.photos && place.photos.length > 0 
        ? place.photos[0].getUrl({ maxWidth: 800, maxHeight: 400 })
        : 'https://via.placeholder.com/800x400?text=No+Image';
      
      let reviewsHtml = '';
      if (place.reviews && place.reviews.length > 0) {
        reviewsHtml = '<h5 class="mt-4">Reviews</h5>';
        place.reviews.slice(0, 3).forEach(review => {
          reviewsHtml += \`
            <div class="card mb-2">
              <div class="card-body">
                <div class="d-flex justify-content-between">
                  <h6>\${review.author_name}</h6>
                  <div>
                    \${Array(Math.floor(review.rating)).fill(\`<i class="fas fa-star text-warning"></i>\`).join('')}
                    \${review.rating % 1 !== 0 ? \`<i class="fas fa-star-half-alt text-warning"></i>\` : ''}
                  </div>
                </div>
                <p class="mb-0">\${review.text}</p>
              </div>
            </div>
          \`;
        });
      }
      
      let hoursHtml = '';
      if (place.opening_hours && place.opening_hours.weekday_text) {
        hoursHtml = '<h5 class="mt-3">Opening Hours</h5><ul class="list-group mb-3">';
        place.opening_hours.weekday_text.forEach(day => {
          hoursHtml += \`<li class="list-group-item">\${day}</li>\`;
        });
        hoursHtml += '</ul>';
      }
      
      // Create a visual star rating display
      const starRatingHtml = place.rating ? 
        \`<div class="star-rating mb-2">
          \${Array(Math.floor(place.rating)).fill('<i class="fas fa-star"></i>').join('')}
          \${place.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
          \${Array(5 - Math.ceil(place.rating)).fill('<i class="far fa-star"></i>').join('')}
          <span class="ms-2 rating-text">\${place.rating.toFixed(1)}</span>
          <span class="text-muted ms-1 reviews-count">\${place.user_ratings_total ? \`(\${place.user_ratings_total} reviews)\` : ''}</span>
        </div>\` : 
        '<p class="text-muted">No ratings available</p>';
        
      // Format the price level more visually
      const priceLevelHtml = place.price_level !== undefined ? 
        \`<div class="price-level">
          <span class="\${place.price_level >= 1 ? 'text-success' : 'text-muted'}">$</span>
          <span class="\${place.price_level >= 2 ? 'text-success' : 'text-muted'}">$</span>
          <span class="\${place.price_level >= 3 ? 'text-success' : 'text-muted'}">$</span>
          <span class="\${place.price_level >= 4 ? 'text-success' : 'text-muted'}">$</span>
        </div>\` : 
        '<span class="text-muted">Price not available</span>';

      modalBody.innerHTML = \`
        <div class="place-detail-img-container position-relative mb-4">
          <img src="\${photoUrl}" class="img-fluid rounded shadow-sm w-100" alt="\${place.name}" 
            onerror="this.src='https://via.placeholder.com/800x400?text=No+Image'" style="max-height: 300px; object-fit: cover;">
          <div class="position-absolute bottom-0 end-0 p-2 bg-dark bg-opacity-75 rounded-start text-white">
            \${priceLevelHtml}
          </div>
        </div>
        
        <div class="mb-3">
          \${starRatingHtml}
        </div>
        
        <div class="row mb-4">
          <div class="col-md-6">
            <div class="detail-item mb-3">
              <i class="fas fa-map-marker-alt text-danger me-2"></i>
              <div>
                <strong>Address</strong>
                <p class="mb-0">\${place.formatted_address || 'Not available'}</p>
              </div>
            </div>
            
            <div class="detail-item mb-3">
              <i class="fas fa-phone text-success me-2"></i>
              <div>
                <strong>Phone</strong>
                <p class="mb-0">\${place.formatted_phone_number || 'Not available'}</p>
              </div>
            </div>
          </div>
          
          <div class="col-md-6">
            <div class="detail-item mb-3">
              <i class="fas fa-globe text-primary me-2"></i>
              <div>
                <strong>Website</strong>
                <p class="mb-0">\${place.website ? 
                  \`<a href="\${place.website}" target="_blank" class="text-truncate d-inline-block" style="max-width: 100%;">\${place.website}</a>\` : 
                  'Not available'}
                </p>
              </div>
            </div>
            
            <div class="detail-item">
              <i class="fas fa-tag text-info me-2"></i>
              <div>
                <strong>Price Level</strong>
                <p class="mb-0">\${getPriceLevel(place.price_level)}</p>
              </div>
            </div>
          </div>
        </div>
        
        \${hoursHtml}
        \${reviewsHtml}
      \`;
      
      // Show the modal
      const modal = new bootstrap.Modal(document.getElementById('placeDetailsModal'));
      modal.show();
    }
    
    // Clear all markers from the map
    function clearMarkers() {
      markers.forEach(marker => marker.setMap(null));
      markers = [];
    }
    
    // Make getPlaceDetails globally accessible for map popup buttons
    window.getPlaceDetails = getPlaceDetails;
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8&libraries=places&callback=initMap">
  </script>
</body>
</html>`;

  // Send the complete HTML file
  res.type('text/html');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(html);
  console.log('Sent simplified travel planner app');
});

// Dynamically inject the Google Maps API key into the HTML
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    const filePath = path.join(__dirname, '../public/index.html');
    
    // Always read the file directly to get the latest version (no caching)
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading index.html:', err);
        return next();
      }
      
      // Replace the placeholders with the actual API key
      const html = data
        .replace('GOOGLE_MAPS_API_KEY_PLACEHOLDER', process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8')
        .replace('const googleMapsApiKey = \'\';', `const googleMapsApiKey = '${process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8'}';`);
      
      // Ensure we're sending the latest content
      res.type('text/html');
      res.send(html);
      console.log('Sent fresh index.html with injected API key');
    });
  } else {
    next();
  }
});

// API routes - update to non-prefixed paths for client compatibility
app.use('/places', placesRoutes);
app.use('/geocoding', geocodingRoutes);
app.use('/itineraries', itineraryRoutes);
app.use('/tripadvisor', tripadvisorRoutes);

// Keep prefixed routes for backward compatibility
app.use('/api/places', placesRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/itineraries', itineraryRoutes);
app.use('/api/tripadvisor', tripadvisorRoutes);

// Direct API endpoint for photo proxy
app.get('/api/photo', async (req, res) => {
  try {
    const { photoreference, maxwidth = 400, maxheight } = req.query;
    
    if (!photoreference) {
      return res.status(400).json({ error: 'Photo reference is required' });
    }
    
    // Build URL for the Google Places Photo API
    const url = new URL('https://maps.googleapis.com/maps/api/place/photo');
    const params = {
      photoreference,
      key: process.env.GOOGLE_MAPS_API_KEY,
      maxwidth
    };
    
    // Add maxheight if provided
    if (maxheight) {
      params.maxheight = maxheight;
    }
    
    // Set URL parameters
    url.search = new URLSearchParams(params).toString();
    
    // Fetch the image from Google
    const response = await fetch(url.toString(), { 
      redirect: 'follow'
    });
    
    // If Google redirects, forward that redirect
    const finalUrl = response.url;
    
    // If we get redirected, just redirect the client
    if (response.redirected) {
      res.redirect(finalUrl);
      return;
    }
    
    // Otherwise forward the response
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');
    
    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('Error fetching photo:', error);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// Direct API endpoint for nearby places to fix route mismatch
app.get('/api/nearby', async (req, res) => {
  try {
    const { lat, lng, type = 'restaurant', radius = 1500, keyword } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing required location parameters' });
    }
    
    // Build URL with optional parameters
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    const params = {
      location: `${lat},${lng}`,
      radius,
      type,
      key: process.env.GOOGLE_MAPS_API_KEY
    };
    
    // Add keyword if provided
    if (keyword) {
      params.keyword = keyword;
    }
    
    // Set URL parameters
    url.search = new URLSearchParams(params).toString();
    
    // Make request to Google Places API
    const response = await fetch(url.toString());
    const data = await response.json();
    
    // Return the results with the original status
    res.json({
      status: data.status,
      results: data.results || []
    });
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Failed to fetch nearby places',
      message: error.message
    });
  }
});

// Direct API endpoint for place details
app.get('/api/details', async (req, res) => {
  try {
    const { place_id, fields } = req.query;
    
    if (!place_id) {
      return res.status(400).json({ error: 'Place ID is required' });
    }
    
    // Build URL for the Google Places Details API
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    const params = {
      place_id,
      key: process.env.GOOGLE_MAPS_API_KEY,
    };
    
    // Add fields if provided
    if (fields) {
      params.fields = fields;
    }
    
    // Set URL parameters
    url.search = new URLSearchParams(params).toString();
    
    // Make request to Google Places API
    const response = await fetch(url.toString());
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Handle server errors
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
