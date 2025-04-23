const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Travel Planner</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    #map {
      height: 500px;
      width: 100%;
      margin-bottom: 20px;
    }
    .place-card {
      margin-bottom: 15px;
      cursor: pointer;
    }
    .place-card:hover {
      transform: translateY(-5px);
      transition: transform 0.3s;
    }
    .place-image {
      height: 150px;
      object-fit: cover;
    }
    .rating-stars {
      color: #FFC107;
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
    
    <div id="places-container" class="row"></div>
    
    <!-- Modal for place details -->
    <div class="modal fade" id="place-modal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modal-title">Place Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="modal-body"></div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Global variables
    let map;
    let markers = [];
    let placesService;
    
    // Initialize the map
    function initMap() {
      // Start with New York
      const defaultLocation = { lat: 40.7128, lng: -74.0060 };
      
      map = new google.maps.Map(document.getElementById('map'), {
        center: defaultLocation,
        zoom: 13
      });
      
      // Initialize places service
      placesService = new google.maps.places.PlacesService(map);
      
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
      
      // Search for nearby places
      const request = {
        location: location,
        radius: 1500,
        type: ['tourist_attraction', 'restaurant', 'lodging']
      };
      
      placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          // Display results
          results.forEach(place => {
            createMarker(place);
            createPlaceCard(place);
          });
        }
      });
    }
    
    // Create a marker for a place
    function createMarker(place) {
      if (!place.geometry || !place.geometry.location) return;
      
      const marker = new google.maps.Marker({
        map: map,
        position: place.geometry.location,
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
      card.className = 'col-md-4';
      
      // Get image if available
      let imageUrl = 'https://via.placeholder.com/300x150?text=No+Image';
      if (place.photos && place.photos.length > 0) {
        imageUrl = place.photos[0].getUrl({ maxWidth: 300, maxHeight: 150 });
      }
      
      // Format rating
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = '<div class="rating-stars">';
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '★';
        }
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '½';
        }
        ratingHtml += ' ' + place.rating;
        if (place.user_ratings_total) {
          ratingHtml += ' (' + place.user_ratings_total + ' reviews)';
        }
        ratingHtml += '</div>';
      }
      
      // Build card HTML
      card.innerHTML = \`
        <div class="card place-card">
          <img src="\${imageUrl}" class="card-img-top place-image" alt="\${place.name}">
          <div class="card-body">
            <h5 class="card-title">\${place.name}</h5>
            \${ratingHtml}
            <p class="card-text">\${place.vicinity || ''}</p>
            <button class="btn btn-primary btn-sm view-details">View Details</button>
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
      const request = {
        placeId: placeId,
        fields: ['name', 'rating', 'formatted_phone_number', 'formatted_address', 
                'website', 'opening_hours', 'photos', 'reviews', 'price_level']
      };
      
      placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          showPlaceDetails(place);
        }
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
        imageHtml = \`<img src="\${place.photos[0].getUrl({ maxWidth: 600, maxHeight: 400 })}" 
                      class="img-fluid mb-3" alt="\${place.name}">\`;
      }
      
      // Format rating
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = '<div class="rating-stars fs-4 mb-3">';
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '★';
        }
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '½';
        }
        ratingHtml += ' ' + place.rating;
        if (place.user_ratings_total) {
          ratingHtml += ' (' + place.user_ratings_total + ' reviews)';
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
        content += '<p><strong>Hours:</strong></p><ul>';
        place.opening_hours.weekday_text.forEach(day => {
          content += \`<li>\${day}</li>\`;
        });
        content += '</ul>';
      }
      
      // Reviews
      if (place.reviews && place.reviews.length > 0) {
        content += '<h5 class="mt-3">Reviews</h5>';
        place.reviews.slice(0, 3).forEach(review => {
          content += \`
            <div class="card mb-2">
              <div class="card-body">
                <div class="d-flex justify-content-between">
                  <h6>\${review.author_name}</h6>
                  <div class="rating-stars">\`;
                  
          for (let i = 0; i < review.rating; i++) {
            content += '★';
          }
                  
          content += \`</div>
                </div>
                <p class="mb-0">\${review.text}</p>
              </div>
            </div>\`;
        });
      }
      
      modalBody.innerHTML = content;
      
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('place-modal'));
      modal.show();
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap" defer></script>
</body>
</html>
  `;
  
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple Travel App running on http://0.0.0.0:${PORT}`);
});