const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Modern Travel Planner</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    #map {
      height: 400px;
      width: 100%;
      margin-bottom: 20px;
    }
    .place-card {
      margin-bottom: 20px;
      transition: transform 0.2s;
      cursor: pointer;
    }
    .place-card:hover {
      transform: translateY(-5px);
    }
    .place-image {
      height: 180px;
      object-fit: cover;
      width: 100%;
    }
    .star-rating {
      color: #FFC107;
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
    }
  </style>
</head>
<body>
  <div class="container mt-4">
    <h1 class="mb-3 text-center">Travel Planner</h1>
    <p class="text-center text-muted mb-4">Find interesting places to visit on your trip</p>
    
    <div class="input-group mb-3">
      <input type="text" id="search-input" class="form-control" placeholder="Enter a location (e.g., New York, Paris)">
      <button class="btn btn-primary" id="search-button">Search</button>
    </div>
    
    <div id="map"></div>
    
    <div id="places-container" class="row mt-3">
      <div class="col-12 loading">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Place Details Modal -->
  <div class="modal fade" id="place-modal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Place Details</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="modal-content">
          <div class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    let map;
    let markers = [];
    let modal;
    
    // Initialize the map and app
    async function initApp() {
      // Create modal instance
      modal = new bootstrap.Modal(document.getElementById('place-modal'));
      
      // Use dynamic import library
      const { Map } = await google.maps.importLibrary("maps");
      const { Place } = await google.maps.importLibrary("places");
      
      // Create a map centered on New York by default
      map = new Map(document.getElementById('map'), {
        center: { lat: 40.7128, lng: -74.0060 },
        zoom: 13,
        mapId: "TRAVEL_PLANNER_MAP"
      });
      
      // Set up search functionality
      document.getElementById('search-button').addEventListener('click', searchLocation);
      document.getElementById('search-input').addEventListener('keypress', event => {
        if (event.key === 'Enter') searchLocation();
      });
      
      // Try to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            // Center map on user location
            map.setCenter(userLocation);
            
            // Search for places near user location
            searchNearbyPlaces(userLocation);
          },
          error => {
            // Use default location (New York)
            console.log('Geolocation error or permission denied:', error);
            searchNearbyPlaces({ lat: 40.7128, lng: -74.0060 });
          }
        );
      } else {
        // Browser doesn't support geolocation, use default
        console.log('Geolocation not supported');
        searchNearbyPlaces({ lat: 40.7128, lng: -74.0060 });
      }
    }
    
    // Search for a location entered by the user
    async function searchLocation() {
      const searchInput = document.getElementById('search-input').value.trim();
      
      if (!searchInput) {
        alert('Please enter a location to search');
        return;
      }
      
      try {
        // Use geocoding to convert address to coordinates
        const { Geocoder } = await google.maps.importLibrary("geocoding");
        const geocoder = new Geocoder();
        
        const response = await geocoder.geocode({ address: searchInput });
        
        if (response.results && response.results.length > 0) {
          const location = response.results[0].geometry.location;
          
          // Center map on the found location
          map.setCenter(location);
          
          // Search for places around this location
          searchNearbyPlaces({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          alert('No results found for your search.');
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        alert('Error searching for location. Please try again.');
      }
    }
    
    // Search for places near a specific location
    async function searchNearbyPlaces(location) {
      // Show loading indicator
      document.getElementById('places-container').innerHTML = `
        <div class="col-12 loading">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      `;
      
      // Clear any existing markers
      clearMarkers();
      
      try {
        // Load Places library
        const { Place } = await google.maps.importLibrary("places");
        
        // Create search request
        const request = {
          locationRestriction: {
            circle: {
              center: location,
              radius: 1500 // meters
            }
          },
          includedType: 'tourist_attraction' 
        };
        
        // Create Place instance for searching
        const placeService = new Place();
        
        // Perform the nearby search
        const response = await placeService.searchNearby(request);
        
        if (response.places && response.places.length > 0) {
          const container = document.getElementById('places-container');
          container.innerHTML = '';
          
          // Process each place
          response.places.forEach(place => {
            // Fetch details for this place
            getPlaceDetails(place, container);
          });
        } else {
          document.getElementById('places-container').innerHTML = `
            <div class="col-12">
              <div class="alert alert-info">No places found in this area. Try another location.</div>
            </div>
          `;
        }
      } catch (error) {
        console.error('Error searching for places:', error);
        document.getElementById('places-container').innerHTML = `
          <div class="col-12">
            <div class="alert alert-danger">
              Error searching for places. Please try again later.
            </div>
          </div>
        `;
      }
    }
    
    // Get detailed information about a place
    async function getPlaceDetails(place, container) {
      try {
        // Fields to retrieve for the place
        const fields = [
          'displayName',
          'formattedAddress',
          'location',
          'rating',
          'userRatingCount',
          'types',
          'photos',
          'priceLevel',
          'websiteUri'
        ];
        
        // Fetch place details
        await place.fetchFields({ fields: fields });
        
        // Add marker on the map
        addMarker(place);
        
        // Create a card for this place
        createPlaceCard(place, container);
      } catch (error) {
        console.error('Error fetching place details:', error);
      }
    }
    
    // Add a marker on the map for a place
    function addMarker(place) {
      if (!place.location) return;
      
      const marker = new google.maps.Marker({
        position: place.location.latLng,
        map: map,
        title: place.displayName
      });
      
      markers.push(marker);
      
      // Add click event to show place details
      marker.addListener('click', () => {
        // Center the map on this marker
        map.setCenter(place.location.latLng);
        
        // Show place details in modal
        showPlaceDetails(place);
      });
    }
    
    // Clear all markers from the map
    function clearMarkers() {
      markers.forEach(marker => marker.setMap(null));
      markers = [];
    }
    
    // Create a card for a place
    function createPlaceCard(place, container) {
      const col = document.createElement('div');
      col.className = 'col-md-4 mb-4';
      
      // Get photo URL if available
      let photoHtml = '<div class="bg-light text-center py-5">No Image Available</div>';
      
      if (place.photos && place.photos.length > 0) {
        try {
          const photoUrl = place.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 });
          photoHtml = `<img src="${photoUrl}" class="card-img-top place-image" alt="${place.displayName}">`;
        } catch (error) {
          console.error('Error getting photo URL:', error);
        }
      }
      
      // Format rating stars
      let ratingHtml = '';
      
      if (place.rating) {
        ratingHtml = '<div class="mb-2 star-rating">';
        
        // Full stars
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '<i class="fas fa-star"></i>';
        }
        
        // Half star if needed
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '<i class="fas fa-star-half-alt"></i>';
        }
        
        // Empty stars to fill 5
        for (let i = 0; i < (5 - Math.ceil(place.rating)); i++) {
          ratingHtml += '<i class="far fa-star"></i>';
        }
        
        ratingHtml += ` <span class="ms-1">${place.rating}</span>`;
        
        if (place.userRatingCount) {
          ratingHtml += ` <span class="text-muted">(${place.userRatingCount})</span>`;
        }
        
        ratingHtml += '</div>';
      }
      
      // Create card HTML
      col.innerHTML = `
        <div class="card place-card h-100">
          ${photoHtml}
          <div class="card-body">
            <h5 class="card-title">${place.displayName}</h5>
            ${ratingHtml}
            <p class="card-text">${place.formattedAddress || ''}</p>
            <button class="btn btn-primary btn-sm view-details">View Details</button>
          </div>
        </div>
      `;
      
      // Add to container
      container.appendChild(col);
      
      // Add click event to view details button
      col.querySelector('.view-details').addEventListener('click', () => {
        showPlaceDetails(place);
      });
      
      // Add click event to the entire card
      col.querySelector('.place-card').addEventListener('click', (e) => {
        if (!e.target.classList.contains('view-details')) {
          showPlaceDetails(place);
        }
      });
    }
    
    // Show detailed information about a place in the modal
    function showPlaceDetails(place) {
      const modalContent = document.getElementById('modal-content');
      
      // Get photo URL if available
      let photoHtml = '';
      
      if (place.photos && place.photos.length > 0) {
        try {
          const photoUrl = place.photos[0].getUrl({ maxWidth: 600, maxHeight: 400 });
          photoHtml = `<img src="${photoUrl}" class="img-fluid rounded mb-3" alt="${place.displayName}">`;
        } catch (error) {
          console.error('Error getting photo URL for modal:', error);
        }
      }
      
      // Format rating
      let ratingHtml = '';
      
      if (place.rating) {
        ratingHtml = '<div class="star-rating fs-5 mb-3">';
        
        // Full stars
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '<i class="fas fa-star"></i> ';
        }
        
        // Half star if needed
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '<i class="fas fa-star-half-alt"></i> ';
        }
        
        // Empty stars
        for (let i = 0; i < (5 - Math.ceil(place.rating)); i++) {
          ratingHtml += '<i class="far fa-star"></i> ';
        }
        
        ratingHtml += `<span class="ms-2">${place.rating}</span>`;
        
        if (place.userRatingCount) {
          ratingHtml += ` <span class="text-muted">(${place.userRatingCount} reviews)</span>`;
        }
        
        ratingHtml += '</div>';
      }
      
      // Price level
      let priceHtml = '';
      
      if (place.priceLevel) {
        priceHtml = '<div class="mb-3">';
        priceHtml += '<i class="fas fa-tag text-secondary me-2"></i><strong>Price Level:</strong> ';
        
        for (let i = 0; i < place.priceLevel; i++) {
          priceHtml += '$';
        }
        
        priceHtml += '</div>';
      }
      
      // Types/categories
      let typesHtml = '';
      
      if (place.types && place.types.length > 0) {
        typesHtml = '<div class="mb-3">';
        typesHtml += '<i class="fas fa-list text-info me-2"></i><strong>Categories:</strong>';
        typesHtml += '<div class="mt-2">';
        
        place.types.forEach(type => {
          // Format the type string
          const formattedType = type.replace(/_/g, ' ').replace(/\w\S*/g, 
            txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
          
          typesHtml += `<span class="badge bg-secondary me-1 mb-1">${formattedType}</span>`;
        });
        
        typesHtml += '</div></div>';
      }
      
      // Website link
      let websiteHtml = '';
      
      if (place.websiteUri) {
        websiteHtml = `
          <div class="mb-3">
            <i class="fas fa-globe text-primary me-2"></i><strong>Website:</strong> 
            <a href="${place.websiteUri}" target="_blank" class="ms-1">${place.websiteUri}</a>
          </div>
        `;
      }
      
      // Additional photos
      let additionalPhotosHtml = '';
      
      if (place.photos && place.photos.length > 1) {
        additionalPhotosHtml = '<div class="mt-4 mb-3">';
        additionalPhotosHtml += '<i class="fas fa-images text-success me-2"></i><strong>Photos:</strong>';
        additionalPhotosHtml += '<div class="row mt-2">';
        
        // Display up to 6 additional photos
        for (let i = 1; i < Math.min(7, place.photos.length); i++) {
          try {
            const photoUrl = place.photos[i].getUrl({ maxWidth: 200, maxHeight: 150 });
            
            additionalPhotosHtml += `
              <div class="col-md-4 col-6 mb-2">
                <img src="${photoUrl}" class="img-fluid rounded" alt="Place photo" 
                     style="height: 100px; width: 100%; object-fit: cover;">
              </div>
            `;
          } catch (error) {
            console.error('Error getting additional photo URL:', error);
          }
        }
        
        additionalPhotosHtml += '</div></div>';
      }
      
      // Create HTML for the modal
      modalContent.innerHTML = `
        ${photoHtml}
        <h3>${place.displayName}</h3>
        ${ratingHtml}
        <div class="mb-3">
          <i class="fas fa-map-marker-alt text-danger me-2"></i>
          <strong>Address:</strong> ${place.formattedAddress || 'Not available'}
        </div>
        ${priceHtml}
        ${websiteHtml}
        ${typesHtml}
        ${additionalPhotosHtml}
      `;
      
      // Show the modal
      modal.show();
    }
  </script>
  
  <script async defer 
          src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initApp&v=beta">
  </script>
</body>
</html>
  `;
  
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Modern Travel Planner running on http://0.0.0.0:${PORT}`);
});