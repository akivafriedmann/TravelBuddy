const express = require('express');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic static file server for the main page
app.get('/', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Travel Planner - Enhanced</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
      text-align: center;
      margin-bottom: 20px;
    }
    .header-logo {
      font-size: 2.5rem;
      margin-right: 10px;
    }
    #map {
      height: 500px;
      width: 100%;
      margin-bottom: 20px;
      border-radius: 8px;
    }
    .search-container {
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
    .star-rating {
      color: #FFC107;
    }
    .place-image {
      height: 200px;
      object-fit: cover;
    }
    .price-level {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="app-container">
    <header>
      <div class="d-flex align-items-center justify-content-center">
        <i class="fas fa-map-marked-alt header-logo"></i>
        <h1>Travel Planner</h1>
      </div>
    </header>

    <div class="search-container">
      <div class="input-group">
        <input type="text" id="searchInput" class="form-control" placeholder="Search for a location...">
        <button class="btn btn-primary" id="searchButton">Search</button>
      </div>
    </div>

    <div id="map"></div>

    <div class="row" id="placesContainer"></div>

    <!-- Place Details Modal -->
    <div class="modal fade" id="placeModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modalTitle">Place Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="modalBody"></div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    let map;
    let markers = [];
    let service;
    
    function initMap() {
      // Default center on New York
      const center = { lat: 40.7128, lng: -74.0060 };
      
      map = new google.maps.Map(document.getElementById('map'), {
        center: center,
        zoom: 13
      });
      
      // Create places service
      service = new google.maps.places.PlacesService(map);
      
      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            map.setCenter(pos);
            findNearbyPlaces(pos);
          },
          () => {
            // If geolocation fails, use default location
            findNearbyPlaces(center);
          }
        );
      } else {
        // Browser doesn't support geolocation
        findNearbyPlaces(center);
      }
      
      // Search button click event
      document.getElementById('searchButton').addEventListener('click', () => {
        searchLocation();
      });
      
      // Search input enter key event
      document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          searchLocation();
        }
      });
    }
    
    function searchLocation() {
      const input = document.getElementById('searchInput').value;
      if (!input) return;
      
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: input }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
          map.setCenter(results[0].geometry.location);
          findNearbyPlaces(results[0].geometry.location);
        }
      });
    }
    
    function clearMarkers() {
      markers.forEach(marker => marker.setMap(null));
      markers = [];
    }
    
    function findNearbyPlaces(location) {
      clearMarkers();
      document.getElementById('placesContainer').innerHTML = '';
      
      const request = {
        location: location,
        radius: 1500,
        type: ['tourist_attraction', 'lodging', 'restaurant']
      };
      
      service.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          results.forEach(place => {
            createMarker(place);
            createPlaceCard(place);
          });
        }
      });
    }
    
    function createMarker(place) {
      if (!place.geometry || !place.geometry.location) return;
      
      const marker = new google.maps.Marker({
        map: map,
        position: place.geometry.location,
        title: place.name,
        animation: google.maps.Animation.DROP
      });
      
      markers.push(marker);
      
      marker.addListener('click', () => {
        getPlaceDetails(place.place_id);
      });
    }
    
    function createPlaceCard(place) {
      const container = document.getElementById('placesContainer');
      
      const colDiv = document.createElement('div');
      colDiv.className = 'col-md-4 mb-4';
      
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card place-card';
      cardDiv.onclick = () => getPlaceDetails(place.place_id);
      
      // Image
      let imageUrl = 'https://via.placeholder.com/400x200?text=No+Image';
      if (place.photos && place.photos.length > 0) {
        imageUrl = place.photos[0].getUrl({ maxWidth: 400, maxHeight: 200 });
      }
      
      // Rating stars
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
        
        if (place.user_ratings_total) {
          ratingHtml += ` <span class="text-muted">(${place.user_ratings_total})</span>`;
        }
        
        ratingHtml += '</div>';
      }
      
      // Price level
      let priceHtml = '';
      if (place.price_level) {
        priceHtml = '<div class="price-level">';
        for (let i = 0; i < place.price_level; i++) {
          priceHtml += '$';
        }
        priceHtml += '</div>';
      }
      
      cardDiv.innerHTML = `
        <img src="${imageUrl}" class="card-img-top place-image" alt="${place.name}">
        <div class="card-body">
          <h5 class="card-title">${place.name}</h5>
          ${ratingHtml}
          <p class="card-text">${place.vicinity || ''}</p>
          ${priceHtml}
        </div>
      `;
      
      colDiv.appendChild(cardDiv);
      container.appendChild(colDiv);
    }
    
    function getPlaceDetails(placeId) {
      const request = {
        placeId: placeId,
        fields: ['name', 'rating', 'user_ratings_total', 'formatted_phone_number', 
                 'formatted_address', 'opening_hours', 'website', 'price_level', 
                 'review', 'photo', 'type']
      };
      
      service.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          showPlaceModal(place);
        }
      });
    }
    
    function showPlaceModal(place) {
      const modalTitle = document.getElementById('modalTitle');
      const modalBody = document.getElementById('modalBody');
      
      modalTitle.textContent = place.name;
      
      // Image
      let imageUrl = 'https://via.placeholder.com/800x400?text=No+Image';
      if (place.photos && place.photos.length > 0) {
        imageUrl = place.photos[0].getUrl({ maxWidth: 800, maxHeight: 400 });
      }
      
      // Rating stars
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = '<div class="star-rating mb-3 fs-4">';
        
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
        
        if (place.user_ratings_total) {
          ratingHtml += ` <span class="text-muted">(${place.user_ratings_total} reviews)</span>`;
        }
        
        ratingHtml += '</div>';
      }
      
      // Price level
      let priceHtml = '';
      if (place.price_level !== undefined) {
        priceHtml = '<div class="mb-3"><strong>Price Level:</strong> ';
        for (let i = 0; i < place.price_level; i++) {
          priceHtml += '$';
        }
        priceHtml += '</div>';
      }
      
      // Hours
      let hoursHtml = '';
      if (place.opening_hours && place.opening_hours.weekday_text) {
        hoursHtml = '<div class="mb-3"><strong>Hours:</strong><ul class="list-group mt-2">';
        place.opening_hours.weekday_text.forEach(day => {
          hoursHtml += `<li class="list-group-item">${day}</li>`;
        });
        hoursHtml += '</ul></div>';
      }
      
      // Reviews
      let reviewsHtml = '';
      if (place.reviews && place.reviews.length > 0) {
        reviewsHtml = '<div class="mt-4"><strong>Reviews:</strong>';
        place.reviews.slice(0, 3).forEach(review => {
          reviewsHtml += `
            <div class="card my-2">
              <div class="card-body">
                <div class="d-flex justify-content-between">
                  <h6>${review.author_name}</h6>
                  <div class="star-rating">`;
                  
          // Generate stars for this review
          for (let i = 0; i < review.rating; i++) {
            reviewsHtml += '<i class="fas fa-star"></i> ';
          }
                  
          reviewsHtml += `</div>
                </div>
                <p class="mb-0">${review.text}</p>
              </div>
            </div>`;
        });
        reviewsHtml += '</div>';
      }
      
      modalBody.innerHTML = `
        <img src="${imageUrl}" class="img-fluid rounded mb-3" alt="${place.name}">
        ${ratingHtml}
        ${priceHtml}
        <div class="mb-3">
          <strong>Address:</strong> ${place.formatted_address || 'Not available'}
        </div>
        <div class="mb-3">
          <strong>Phone:</strong> ${place.formatted_phone_number || 'Not available'}
        </div>
        <div class="mb-3">
          <strong>Website:</strong> ${place.website ? 
            `<a href="${place.website}" target="_blank">${place.website}</a>` : 
            'Not available'}
        </div>
        ${hoursHtml}
        ${reviewsHtml}
      `;
      
      // Display modal
      const modal = new bootstrap.Modal(document.getElementById('placeModal'));
      modal.show();
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap" async defer></script>
</body>
</html>
  `;
  
  res.send(html);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Basic server running on http://0.0.0.0:${PORT}`);
});