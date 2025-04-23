const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Travel Planner - Modern API</title>
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
      transition: transform 0.3s;
    }
    .place-card:hover {
      transform: translateY(-5px);
    }
    .star-rating {
      color: #FFC107;
    }
  </style>
</head>
<body>
  <div class="container mt-4">
    <h1 class="text-center">Travel Planner</h1>
    <p class="text-center text-muted">Using Modern Places API</p>
    
    <div class="input-group mb-3">
      <input type="text" id="search-input" class="form-control" placeholder="Search for a location">
      <button class="btn btn-primary" id="search-button">Search</button>
    </div>
    
    <div id="map"></div>
    
    <div id="results-container" class="row mt-4"></div>
  </div>
  
  <!-- Loading Indicator -->
  <div id="loading" class="position-fixed top-50 start-50 translate-middle d-none">
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  </div>
  
  <!-- Place Details Modal -->
  <div class="modal fade" id="details-modal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Place Details</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div id="modal-content"></div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    let map;
    let markers = [];
    
    // Show loading indicator
    function showLoading() {
      document.getElementById('loading').classList.remove('d-none');
    }
    
    // Hide loading indicator
    function hideLoading() {
      document.getElementById('loading').classList.add('d-none');
    }
    
    // Initialize map
    async function initMap() {
      // Load Maps JavaScript API libraries
      const { Map } = await google.maps.importLibrary("maps");
      
      // New York City coordinates
      const center = { lat: 40.7128, lng: -74.0060 };
      
      // Create map
      map = new Map(document.getElementById("map"), {
        center: center,
        zoom: 13,
        mapId: "MAP_ID"
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
            searchNearby(userLocation);
          },
          () => {
            // Geolocation failed, use default location
            searchNearby(center);
          }
        );
      } else {
        // Browser doesn't support geolocation
        searchNearby(center);
      }
      
      // Set up search button
      document.getElementById('search-button').addEventListener('click', performSearch);
      document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
      });
    }
    
    // Perform a search for a location
    async function performSearch() {
      const searchText = document.getElementById('search-input').value;
      if (!searchText) return;
      
      showLoading();
      
      try {
        // Load Geocoding API
        const { Geocoder } = await google.maps.importLibrary("geocoding");
        const geocoder = new Geocoder();
        
        // Geocode the search text
        const response = await geocoder.geocode({ address: searchText });
        
        if (response.results.length > 0) {
          const location = response.results[0].geometry.location;
          map.setCenter(location);
          searchNearby({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          alert('No results found for your search.');
          hideLoading();
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        alert('Error searching for location.');
        hideLoading();
      }
    }
    
    // Search for nearby places
    async function searchNearby(location) {
      showLoading();
      
      // Clear previous results
      clearMarkers();
      document.getElementById('results-container').innerHTML = '';
      
      try {
        // Load Places API
        const { Place } = await google.maps.importLibrary("places");
        
        // Search request for nearby places
        const request = {
          locationRestriction: {
            circle: {
              center: location,
              radius: 1500 // meters
            }
          },
          includedType: 'tourist_attraction'
        };
        
        // Create a new Place instance
        const placeService = new Place();
        
        // Search for nearby places using the modern API
        const response = await placeService.searchNearby(request);
        
        if (response.places && response.places.length > 0) {
          // Process each place
          response.places.forEach(place => {
            fetchPlaceDetails(place);
          });
        } else {
          document.getElementById('results-container').innerHTML = 
            '<div class="col-12"><div class="alert alert-info">No places found in this area.</div></div>';
          hideLoading();
        }
      } catch (error) {
        console.error('Error searching for places:', error);
        document.getElementById('results-container').innerHTML = 
          '<div class="col-12"><div class="alert alert-danger">Error searching for places.</div></div>';
        hideLoading();
      }
    }
    
    // Fetch detailed information about a place
    async function fetchPlaceDetails(place) {
      try {
        // Fields to retrieve
        const fields = [
          'displayName',
          'formattedAddress',
          'location',
          'rating',
          'userRatingCount',
          'types',
          'photos',
          'priceLevel',
          'websiteUri',
          'internationalPhoneNumber'
        ];
        
        // Fetch the place details using the modern API
        const placeDetails = await place.fetchFields({ fields: fields });
        
        // Add marker to the map
        addMarker(placeDetails);
        
        // Create a card for the place
        createPlaceCard(placeDetails);
        
        // Check if all places are loaded
        if (document.querySelectorAll('.place-card').length >= markers.length) {
          hideLoading();
        }
      } catch (error) {
        console.error('Error fetching place details:', error);
      }
    }
    
    // Add a marker for a place
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
        showPlaceDetails(place);
      });
    }
    
    // Clear all markers from the map
    function clearMarkers() {
      markers.forEach(marker => marker.setMap(null));
      markers = [];
    }
    
    // Create a card for the place
    function createPlaceCard(place) {
      const container = document.getElementById('results-container');
      
      // Create column
      const col = document.createElement('div');
      col.className = 'col-md-4 mb-4';
      
      // Get photo URL if available
      let photoHtml = '<div class="bg-light text-center py-5">No Image Available</div>';
      
      if (place.photos && place.photos.length > 0) {
        try {
          const photoUrl = place.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 });
          photoHtml = `<img src="${photoUrl}" class="card-img-top" alt="${place.displayName}" 
                      style="height: 180px; object-fit: cover;">`;
        } catch (error) {
          console.error('Error getting photo URL:', error);
        }
      }
      
      // Format rating
      let ratingHtml = '';
      
      if (place.rating) {
        ratingHtml = '<div class="star-rating mb-2">';
        
        // Full stars
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '<i class="fas fa-star"></i> ';
        }
        
        // Half star if needed
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '<i class="fas fa-star-half-alt"></i> ';
        }
        
        ratingHtml += `<span class="ms-1">${place.rating}</span>`;
        
        if (place.userRatingCount) {
          ratingHtml += ` <span class="text-muted">(${place.userRatingCount})</span>`;
        }
        
        ratingHtml += '</div>';
      }
      
      // Create HTML for the card
      col.innerHTML = `
        <div class="card place-card h-100">
          ${photoHtml}
          <div class="card-body">
            <h5 class="card-title">${place.displayName}</h5>
            ${ratingHtml}
            <p class="card-text">${place.formattedAddress || ''}</p>
            <button class="btn btn-primary btn-sm">View Details</button>
          </div>
        </div>
      `;
      
      // Add to container
      container.appendChild(col);
      
      // Add click event to view details button
      col.querySelector('.btn').addEventListener('click', () => {
        showPlaceDetails(place);
      });
    }
    
    // Show detailed information about a place in a modal
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
        ratingHtml = '<div class="star-rating fs-4 mb-3">';
        
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
      
      // Create HTML for the modal
      let detailsHtml = `
        ${photoHtml}
        <h3>${place.displayName}</h3>
        ${ratingHtml}
        <div class="mb-3">
          <i class="fas fa-map-marker-alt text-danger me-2"></i>
          <strong>Address:</strong> ${place.formattedAddress || 'Not available'}
        </div>
      `;
      
      // Phone
      if (place.internationalPhoneNumber) {
        detailsHtml += `
          <div class="mb-3">
            <i class="fas fa-phone text-success me-2"></i>
            <strong>Phone:</strong> ${place.internationalPhoneNumber}
          </div>
        `;
      }
      
      // Website
      if (place.websiteUri) {
        detailsHtml += `
          <div class="mb-3">
            <i class="fas fa-globe text-primary me-2"></i>
            <strong>Website:</strong> 
            <a href="${place.websiteUri}" target="_blank">${place.websiteUri}</a>
          </div>
        `;
      }
      
      // Price level
      if (place.priceLevel) {
        detailsHtml += `
          <div class="mb-3">
            <i class="fas fa-tag text-secondary me-2"></i>
            <strong>Price Level:</strong> 
            <span>`;
        
        for (let i = 0; i < place.priceLevel; i++) {
          detailsHtml += '$';
        }
        
        detailsHtml += '</span></div>';
      }
      
      // Categories/Types
      if (place.types && place.types.length > 0) {
        detailsHtml += `
          <div class="mb-3">
            <i class="fas fa-list text-info me-2"></i>
            <strong>Categories:</strong> 
            <div class="mt-2">`;
        
        place.types.forEach(type => {
          // Format the type string
          const formattedType = type.replace(/_/g, ' ').replace(/\w\S*/g, 
            txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
          
          detailsHtml += `<span class="badge bg-secondary me-1 mb-1">${formattedType}</span>`;
        });
        
        detailsHtml += '</div></div>';
      }
      
      // Additional photos
      if (place.photos && place.photos.length > 1) {
        detailsHtml += `
          <div class="mt-4 mb-3">
            <i class="fas fa-images text-success me-2"></i>
            <strong>Photos:</strong>
            <div class="row mt-2">`;
        
        // Display up to 6 additional photos
        for (let i = 1; i < Math.min(7, place.photos.length); i++) {
          try {
            const photoUrl = place.photos[i].getUrl({ maxWidth: 200, maxHeight: 150 });
            
            detailsHtml += `
              <div class="col-md-4 col-6 mb-2">
                <img src="${photoUrl}" class="img-fluid rounded" alt="Place photo" 
                     style="height: 100px; width: 100%; object-fit: cover;">
              </div>
            `;
          } catch (error) {
            console.error('Error getting additional photo URL:', error);
          }
        }
        
        detailsHtml += '</div></div>';
      }
      
      // Set the modal content
      modalContent.innerHTML = detailsHtml;
      
      // Show the modal
      const modal = new bootstrap.Modal(document.getElementById('details-modal'));
      modal.show();
    }
  </script>
  <script async 
          src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding&callback=initMap&v=beta">
  </script>
</body>
</html>
  `;
  
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Final Travel Planner server running on http://0.0.0.0:${PORT}`);
});