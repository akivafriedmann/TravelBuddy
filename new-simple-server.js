const express = require('express');
const https = require('https');
const http = require('http');

const app = express();

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
const PORT = process.env.PORT || 5000;

// Add JSON parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Server-side API endpoint for place details
app.get('/api/place-details/:placeId', async (req, res) => {
  try {
    const placeId = req.params.placeId;
    const fields = req.query.fields || 'name,rating,user_ratings_total,price_level,formatted_address,formatted_phone_number,website,opening_hours,reviews,photos,types';
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
    
    console.log(`Fetching details for place: ${placeId}`);
    
    // Make request to Google Places API
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
    
    const responseData = await makeRequest(url);
    
    if (responseData.status === 'OK' && responseData.result) {
      // Add API key to the result to use for photos
      const result = responseData.result;
      return res.json(result);
    } else {
      console.log('Error fetching place details:', responseData.status);
      return res.status(404).json({ error: 'Place details not found', status: responseData.status });
    }
  } catch (error) {
    console.error('Server error fetching place details:', error.message);
    return res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

// Proxy endpoint for place photos
app.get('/api/place-photo', async (req, res) => {
  try {
    const { photo_reference, maxwidth = 800, maxheight = 600 } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
    
    if (!photo_reference) {
      return res.status(400).json({ error: 'Photo reference is required' });
    }
    
    // Make request to Google Places Photo API
    const url = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${photo_reference}&maxwidth=${maxwidth}&maxheight=${maxheight}&key=${apiKey}`;
    
    // Stream the photo response directly to the client
    const photoResponse = await axios.get(url, { responseType: 'stream' });
    
    // Forward the content type
    res.setHeader('Content-Type', photoResponse.headers['content-type']);
    
    // Pipe the photo stream to the response
    photoResponse.data.pipe(res);
  } catch (error) {
    console.error('Server error fetching place photo:', error.message);
    return res.status(500).json({ error: 'Failed to fetch place photo' });
  }
});

// Create a dedicated endpoint for a simplified travel planner app
app.get('/', (req, res) => {
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
      
      // Use PlacesService for compatibility
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
          infoWindow.setContent('<div><strong>' + results[0].formatted_address + '</strong></div>');
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
        
        let cardHtml = '<div class="card place-card shadow-sm h-100" data-place-id="' + place.place_id + '">';
        cardHtml += '<div class="position-relative">';
        cardHtml += '<img src="' + photoUrl + '" class="card-img-top" alt="' + place.name + '" onerror="this.src=\'https://via.placeholder.com/300x200?text=No+Image\'">';
        cardHtml += '<span class="badge bg-' + typeBadge + ' position-absolute top-0 start-0 m-2">';
        cardHtml += '<i class="' + typeIcon + '"></i> ' + placeType.replace('_', ' ') + '</span>';
        
        if (place.price_level) {
          cardHtml += '<span class="badge bg-dark position-absolute top-0 end-0 m-2">' + getPriceLevel(place.price_level) + '</span>';
        }
        
        cardHtml += '</div>';
        cardHtml += '<div class="card-body d-flex flex-column">';
        cardHtml += '<h5 class="card-title">' + place.name + '</h5>';
        cardHtml += '<div class="mb-2">';
        
        if (place.rating) {
          cardHtml += '<div class="text-warning mb-1">';
          for (let i = 0; i < Math.floor(place.rating); i++) {
            cardHtml += '<i class="fas fa-star"></i>';
          }
          if (place.rating % 1 >= 0.5) {
            cardHtml += '<i class="fas fa-star-half-alt"></i>';
          }
          cardHtml += '<span class="text-dark ms-1">' + place.rating + '/5</span>';
          if (place.user_ratings_total) {
            cardHtml += '<small class="text-muted">(' + place.user_ratings_total + ')</small>';
          }
          cardHtml += '</div>';
        }
        
        cardHtml += '</div>';
        cardHtml += '<p class="card-text text-muted small">' + (place.vicinity || '') + '</p>';
        cardHtml += '<div class="mt-auto">';
        cardHtml += '<button class="btn btn-sm btn-primary view-details w-100">';
        cardHtml += '<i class="fas fa-info-circle"></i> View Details</button>';
        cardHtml += '</div></div></div>';
        
        placeCard.innerHTML = cardHtml;
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
            let infoContent = '<div style="width: 200px; text-align: center; padding: 5px;">';
            infoContent += '<strong style="font-size: 14px;">' + place.name + '</strong>';
            infoContent += '<p style="font-size: 12px; margin: 5px 0;">' + (place.vicinity || '') + '</p>';
            
            if (place.rating) {
              infoContent += '<div style="margin-bottom: 5px;"><span style="color: #FFD700;"><i class="fas fa-star"></i></span> <strong>' + place.rating + '</strong>/5</div>';
            }
            
            infoContent += '<button onclick="getPlaceDetails(\'' + place.place_id + '\')" style="background-color: #4285F4; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">View Details</button>';
            infoContent += '</div>';
            
            infoWindow.setContent(infoContent);
            infoWindow.open(map, marker);
          });
        }
      });
    }
    
    // Get details for a specific place using our server-side API
    function getPlaceDetails(placeId) {
      showLoading();
      currentPlaceId = placeId;
      
      // Use our server-side API endpoint to get place details
      fetch("/api/place-details/" + placeId)
        .then(response => {
          if (!response.ok) {
            throw new Error("Server returned " + response.status + ": " + response.statusText);
          }
          return response.json();
        })
        .then(place => {
          console.log("Successfully retrieved place details from server API");
          
          // Process photos to add full URL
          if (place.photos && place.photos.length > 0) {
            place.photos = place.photos.map(photo => {
              // Add a getUrl method that returns the photo reference URL
              photo.getUrl = function(options) {
                const width = options.maxWidth || 800;
                const height = options.maxHeight || 600;
                return "/api/place-photo?photo_reference=" + photo.photo_reference + 
                       "&maxwidth=" + width + "&maxheight=" + height;
              };
              return photo;
            });
          }
          
          displayPlaceDetails(place);
        })
        .catch(error => {
          console.error("Error fetching place details:", error);
          
          // If server API fails, try using the client-side API
          try {
            const request = {
              placeId: placeId,
              fields: ['name', 'rating', 'user_ratings_total', 'price_level', 'formatted_address', 'formatted_phone_number', 'website', 'opening_hours', 'reviews', 'photos', 'types']
            };
            
            placesService.getDetails(request, (place, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK) {
                displayPlaceDetails(place);
                console.log("Successfully retrieved place details with PlacesService");
              } else {
                // Create basic fallback
                const fallbackPlace = {
                  name: document.getElementById('placeDetailsModalLabel').textContent || "Place Details",
                  formatted_address: "Address information not available",
                  rating: 0,
                  user_ratings_total: 0,
                  photos: [],
                  price_level: undefined,
                  website: "",
                  formatted_phone_number: "",
                  opening_hours: { weekday_text: [] },
                  reviews: []
                };
                
                displayPlaceDetails(fallbackPlace);
                showError('Unable to load complete place details. Try a different location.');
              }
            });
          } catch (clientError) {
            console.error("Client-side fallback also failed:", clientError);
            showError('An error occurred while fetching place details.');
          }
        })
        .finally(() => {
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
          let reviewHtml = '<div class="card mb-2"><div class="card-body">';
          reviewHtml += '<div class="d-flex justify-content-between">';
          reviewHtml += '<h6>' + review.author_name + '</h6>';
          reviewHtml += '<div>';
          
          for (let i = 0; i < Math.floor(review.rating); i++) {
            reviewHtml += '<i class="fas fa-star text-warning"></i>';
          }
          
          if (review.rating % 1 !== 0) {
            reviewHtml += '<i class="fas fa-star-half-alt text-warning"></i>';
          }
          
          reviewHtml += '</div></div>';
          reviewHtml += '<p class="mb-0">' + review.text + '</p>';
          reviewHtml += '</div></div>';
          
          reviewsHtml += reviewHtml;
        });
      }
      
      let hoursHtml = '';
      if (place.opening_hours && place.opening_hours.weekday_text) {
        hoursHtml = '<h5 class="mt-3">Opening Hours</h5><ul class="list-group mb-3">';
        place.opening_hours.weekday_text.forEach(day => {
          hoursHtml += '<li class="list-group-item">' + day + '</li>';
        });
        hoursHtml += '</ul>';
      }
      
      // Create a visual star rating display
      let starRatingHtml = '';
      if (place.rating) {
        starRatingHtml = '<div class="star-rating mb-2">';
        
        for (let i = 0; i < Math.floor(place.rating); i++) {
          starRatingHtml += '<i class="fas fa-star"></i>';
        }
        
        if (place.rating % 1 >= 0.5) {
          starRatingHtml += '<i class="fas fa-star-half-alt"></i>';
        }
        
        for (let i = 0; i < (5 - Math.ceil(place.rating)); i++) {
          starRatingHtml += '<i class="far fa-star"></i>';
        }
        
        starRatingHtml += '<span class="ms-2 rating-text">' + place.rating.toFixed(1) + '</span>';
        
        if (place.user_ratings_total) {
          starRatingHtml += '<span class="text-muted ms-1 reviews-count">(' + place.user_ratings_total + ' reviews)</span>';
        }
        
        starRatingHtml += '</div>';
      } else {
        starRatingHtml = '<p class="text-muted">No ratings available</p>';
      }
      
      // Format the price level more visually
      let priceLevelHtml = '';
      if (place.price_level !== undefined) {
        priceLevelHtml = '<div class="price-level">';
        priceLevelHtml += '<span class="' + (place.price_level >= 1 ? 'text-success' : 'text-muted') + '">$</span>';
        priceLevelHtml += '<span class="' + (place.price_level >= 2 ? 'text-success' : 'text-muted') + '">$</span>';
        priceLevelHtml += '<span class="' + (place.price_level >= 3 ? 'text-success' : 'text-muted') + '">$</span>';
        priceLevelHtml += '<span class="' + (place.price_level >= 4 ? 'text-success' : 'text-muted') + '">$</span>';
        priceLevelHtml += '</div>';
      } else {
        priceLevelHtml = '<span class="text-muted">Price not available</span>';
      }

      let modalHtml = '<div class="place-detail-img-container position-relative mb-4">';
      modalHtml += '<img src="' + photoUrl + '" class="img-fluid rounded shadow-sm w-100" alt="' + place.name + '" ';
      modalHtml += 'onerror="this.src=\'https://via.placeholder.com/800x400?text=No+Image\'" style="max-height: 300px; object-fit: cover;">';
      modalHtml += '<div class="position-absolute bottom-0 end-0 p-2 bg-dark bg-opacity-75 rounded-start text-white">';
      modalHtml += priceLevelHtml;
      modalHtml += '</div></div>';
      
      modalHtml += '<div class="mb-3">' + starRatingHtml + '</div>';
      
      modalHtml += '<div class="row mb-4">';
      modalHtml += '<div class="col-md-6">';
      
      modalHtml += '<div class="detail-item mb-3">';
      modalHtml += '<i class="fas fa-map-marker-alt text-danger me-2"></i>';
      modalHtml += '<div><strong>Address</strong>';
      modalHtml += '<p class="mb-0">' + (place.formatted_address || 'Not available') + '</p>';
      modalHtml += '</div></div>';
      
      modalHtml += '<div class="detail-item mb-3">';
      modalHtml += '<i class="fas fa-phone text-success me-2"></i>';
      modalHtml += '<div><strong>Phone</strong>';
      modalHtml += '<p class="mb-0">' + (place.formatted_phone_number || 'Not available') + '</p>';
      modalHtml += '</div></div>';
      
      modalHtml += '</div>';
      modalHtml += '<div class="col-md-6">';
      
      modalHtml += '<div class="detail-item mb-3">';
      modalHtml += '<i class="fas fa-globe text-primary me-2"></i>';
      modalHtml += '<div><strong>Website</strong>';
      modalHtml += '<p class="mb-0">';
      
      if (place.website) {
        modalHtml += '<a href="' + place.website + '" target="_blank" class="text-truncate d-inline-block" style="max-width: 100%;">' + place.website + '</a>';
      } else {
        modalHtml += 'Not available';
      }
      
      modalHtml += '</p></div></div>';
      
      modalHtml += '<div class="detail-item">';
      modalHtml += '<i class="fas fa-tag text-info me-2"></i>';
      modalHtml += '<div><strong>Price Level</strong>';
      modalHtml += '<p class="mb-0">' + getPriceLevel(place.price_level) + '</p>';
      modalHtml += '</div></div>';
      
      modalHtml += '</div></div>';
      
      modalHtml += hoursHtml;
      modalHtml += reviewsHtml;
      
      modalBody.innerHTML = modalHtml;
      
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
  <script src="https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8'}&libraries=places"></script>
  <script>
    // Initialize the map when the page is loaded
    window.onload = function() {
      initMap();
    }
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

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple server running on http://0.0.0.0:${PORT}`);
});