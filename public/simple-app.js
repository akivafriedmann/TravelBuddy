// Global variables
let map;
let markers = [];
let currentLocation = { lat: 52.3676, lng: 4.9041 }; // Default Amsterdam
let placeModal;

// Initialize the map
function initMap() {
  console.log("Initializing map with center:", currentLocation);

  // Create map with minimal settings for stability
  map = new google.maps.Map(document.getElementById('map'), {
    center: currentLocation,
    zoom: 13,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false
  });
  
  // Add marker for current location
  new google.maps.Marker({
    position: currentLocation,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#4285F4",
      fillOpacity: 0.8,
      strokeColor: "white",
      strokeWeight: 2,
    },
    title: "Current Location"
  });
  
  // Initialize modal for place details
  placeModal = new bootstrap.Modal(document.getElementById('place-modal'));
  
  // Set up event listeners
  document.getElementById('search-button').addEventListener('click', searchLocation);
  document.getElementById('location-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') searchLocation();
  });
  document.getElementById('use-location-button').addEventListener('click', useMyLocation);
  
  // Set up category buttons
  const categoryButtons = document.querySelectorAll('.category-btn');
  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Update active state
      categoryButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Get category type and search
      const type = button.dataset.type || 'restaurant';
      loadNearbyPlaces(currentLocation, '', type);
    });
  });
  
  // Initial search for places
  loadNearbyPlaces(currentLocation);
}

// Handle "Use My Location" button click
function useMyLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }
  
  // Show loading indicator
  document.getElementById('loading-indicator').style.display = 'block';
  
  // Update button state
  const locationButton = document.getElementById('use-location-button');
  const originalText = locationButton.innerHTML;
  locationButton.disabled = true;
  locationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';
  
  // Show a notification about location request
  const notification = document.createElement('div');
  notification.className = 'alert alert-info alert-dismissible fade show mb-3';
  notification.setAttribute('role', 'alert');
  notification.innerHTML = `
    <i class="fas fa-info-circle"></i> 
    Requesting your location... Please allow location access when prompted.
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  document.querySelector('.container').insertBefore(notification, document.querySelector('.row'));
  
  // Request location with generous timeout
  navigator.geolocation.getCurrentPosition(
    position => {
      // Success - we have the location
      console.log("Successfully obtained user location:", position.coords);
      
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      // Update map
      map.panTo(currentLocation);
      map.setZoom(14);
      
      // Load places
      loadNearbyPlaces(currentLocation);
      
      // Try to get address for location
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: currentLocation }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
          document.getElementById('location-input').value = results[0].formatted_address;
        }
      });
      
      // Restore button
      locationButton.innerHTML = originalText;
      locationButton.disabled = false;
      document.getElementById('loading-indicator').style.display = 'none';
    },
    error => {
      console.error("Geolocation error:", error);
      
      // Restore button
      locationButton.innerHTML = originalText;
      locationButton.disabled = false;
      document.getElementById('loading-indicator').style.display = 'none';
      
      // Show error message
      let errorMessage = "Unable to get your location";
      if (error.code === error.PERMISSION_DENIED) {
        errorMessage = "Location permission denied. Please enter a location manually.";
      }
      
      alert(errorMessage);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,  // 15 seconds
      maximumAge: 0
    }
  );
}

// Search for a location from the search box
async function searchLocation() {
  const searchText = document.getElementById('location-input').value.trim();
  
  if (!searchText) {
    alert('Please enter a location to search');
    return;
  }
  
  document.getElementById('loading-indicator').style.display = 'block';
  
  try {
    // Use geocoding to convert address to coordinates
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchText }, (results, status) => {
      document.getElementById('loading-indicator').style.display = 'none';
      
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        const location = results[0].geometry.location;
        
        currentLocation = {
          lat: location.lat(),
          lng: location.lng()
        };
        
        // Update map
        map.setCenter(currentLocation);
        map.setZoom(14);
        
        // Add marker for the searched location
        clearMarkers();
        new google.maps.Marker({
          position: currentLocation,
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#FF5722",
            fillOpacity: 0.8,
            strokeColor: "white",
            strokeWeight: 2,
          },
          title: "Search Location"
        });
        
        // Load nearby places
        const activeCategory = document.querySelector('.category-btn.active');
        const type = activeCategory ? activeCategory.dataset.type || 'restaurant' : 'restaurant';
        loadNearbyPlaces(currentLocation, '', type);
      } else {
        alert('Location not found. Please try a different search term.');
      }
    });
  } catch (error) {
    console.error('Error searching location:', error);
    document.getElementById('loading-indicator').style.display = 'none';
    alert('Error searching for location. Please try again.');
  }
}

// Load nearby places from the API
async function loadNearbyPlaces(location, keyword = '', type = 'restaurant') {
  document.getElementById('loading-indicator').style.display = 'block';
  document.getElementById('places-container').innerHTML = '';
  
  // Clear existing markers
  clearMarkers();
  
  try {
    // Build API URL
    let apiUrl = `/api/nearby?lat=${location.lat}&lng=${location.lng}&type=${type}&radius=1500`;
    
    // Add keyword if provided
    if (keyword) {
      apiUrl += `&keyword=${encodeURIComponent(keyword)}`;
    }
    
    // Call our backend API
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    document.getElementById('loading-indicator').style.display = 'none';
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Display the places
      renderPlaces(data.results);
    } else if (data.status === 'ZERO_RESULTS') {
      document.getElementById('places-container').innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">No places found in this area. Try another location or category.</div>
        </div>
      `;
    } else {
      document.getElementById('places-container').innerHTML = `
        <div class="col-12">
          <div class="alert alert-warning">
            <strong>Error loading places</strong>
            <p>${data.error_message || 'Please try again or try another location.'}</p>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    document.getElementById('loading-indicator').style.display = 'none';
    document.getElementById('places-container').innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">Error fetching places. Please try again later.</div>
      </div>
    `;
  }
}

// Render the places as cards
function renderPlaces(places) {
  const container = document.getElementById('places-container');
  container.innerHTML = '';
  
  // Sort places by rating (highest first)
  const sortedPlaces = [...places].sort((a, b) => {
    if (a.rating && b.rating) {
      return b.rating - a.rating;
    }
    if (a.rating) return -1;
    if (b.rating) return 1;
    return 0;
  });
  
  sortedPlaces.forEach((place, index) => {
    // Create a card for each place
    const col = document.createElement('div');
    col.className = 'col-md-4 mb-4';
    
    // Format rating display
    let ratingHtml = '';
    if (place.rating) {
      ratingHtml = `<div class="mb-2">
        <strong>${place.rating}</strong> ⭐ 
        ${place.user_ratings_total ? `(${place.user_ratings_total} reviews)` : ''}
      </div>`;
    }
    
    // Create card HTML
    let photoHtml = '<div class="bg-light text-center py-5">No Image Available</div>';
    if (place.photos && place.photos.length > 0) {
      photoHtml = `<img src="${place.photos[0].url}" class="card-img-top" alt="${place.name}" style="height: 180px; object-fit: cover;">`;
    }
    
    col.innerHTML = `
      <div class="card h-100 shadow-sm">
        ${photoHtml}
        <div class="card-body">
          <h5 class="card-title">${place.name}</h5>
          ${ratingHtml}
          <p class="card-text small text-muted">${place.vicinity || ''}</p>
          <button class="btn btn-primary btn-sm mt-2 view-details" data-place-id="${place.place_id}">View Details</button>
        </div>
      </div>
    `;
    
    // Add click handler to view details button
    col.querySelector('.view-details').addEventListener('click', () => {
      showPlaceDetails(place.place_id);
    });
    
    container.appendChild(col);
    
    // Add a marker for this place
    addMarker(place, index);
  });
}

// Add a marker to the map for a place
function addMarker(place, index) {
  if (!place.geometry || !place.geometry.location) return;
  
  const marker = new google.maps.Marker({
    position: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng
    },
    map: map,
    title: place.name,
    label: {
      text: (index + 1).toString(),
      color: 'white'
    }
  });
  
  // Add click listener
  marker.addListener('click', () => {
    showPlaceDetails(place.place_id);
  });
  
  markers.push(marker);
}

// Clear all markers from the map
function clearMarkers() {
  markers.forEach(marker => marker.setMap(null));
  markers = [];
}

// Show detailed information about a place
async function showPlaceDetails(placeId) {
  try {
    // Show loading in modal
    document.getElementById('modal-title').textContent = 'Loading...';
    document.getElementById('modal-body').innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Loading place details...</p>
      </div>
    `;
    
    // Show the modal
    placeModal.show();
    
    // Fetch place details
    const response = await fetch(`/api/details?place_id=${placeId}`);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      const place = data.result;
      
      // Update modal title
      document.getElementById('modal-title').textContent = place.name;
      
      // Build photo carousel if there are photos
      let photosHtml = '';
      if (place.photos && place.photos.length > 0) {
        photosHtml = `
          <div id="placePhotosCarousel" class="carousel slide mb-4" data-bs-ride="carousel">
            <div class="carousel-inner">
              ${place.photos.map((photo, i) => `
                <div class="carousel-item ${i === 0 ? 'active' : ''}">
                  <img src="${photo.url}" class="d-block w-100 rounded" alt="Place photo ${i+1}" style="max-height: 300px; object-fit: cover;">
                </div>
              `).join('')}
            </div>
            ${place.photos.length > 1 ? `
              <button class="carousel-control-prev" type="button" data-bs-target="#placePhotosCarousel" data-bs-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Previous</span>
              </button>
              <button class="carousel-control-next" type="button" data-bs-target="#placePhotosCarousel" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Next</span>
              </button>
            ` : ''}
          </div>
        `;
      }
      
      // Format rating
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = `
          <div class="mb-3">
            <h5>Rating</h5>
            <div class="d-flex align-items-center">
              <span class="h4 mb-0 me-2">${place.rating}</span>
              <div class="rating-stars">
                ${Array(Math.floor(place.rating)).fill('<i class="fas fa-star text-warning"></i>').join('')}
                ${place.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt text-warning"></i>' : ''}
                ${Array(5 - Math.ceil(place.rating)).fill('<i class="far fa-star text-warning"></i>').join('')}
              </div>
              <span class="ms-2 text-muted">(${place.user_ratings_total || 0} reviews)</span>
            </div>
          </div>
        `;
      }
      
      // Format address and contact info
      const addressHtml = place.formatted_address ? `
        <div class="mb-3">
          <h5>Address</h5>
          <p>${place.formatted_address}</p>
        </div>
      ` : '';
      
      const phoneHtml = place.formatted_phone_number ? `
        <div class="mb-3">
          <h5>Phone</h5>
          <p><a href="tel:${place.formatted_phone_number}">${place.formatted_phone_number}</a></p>
        </div>
      ` : '';
      
      const websiteHtml = place.website ? `
        <div class="mb-3">
          <h5>Website</h5>
          <p><a href="${place.website}" target="_blank" rel="noopener noreferrer">${place.website}</a></p>
        </div>
      ` : '';
      
      // Format hours if available
      let hoursHtml = '';
      if (place.opening_hours && place.opening_hours.weekday_text) {
        hoursHtml = `
          <div class="mb-3">
            <h5>Hours</h5>
            <ul class="list-unstyled">
              ${place.opening_hours.weekday_text.map(day => `<li>${day}</li>`).join('')}
            </ul>
          </div>
        `;
      }
      
      // Format reviews if available
      let reviewsHtml = '';
      if (place.reviews && place.reviews.length > 0) {
        reviewsHtml = `
          <div class="mb-3">
            <h5>Top Reviews</h5>
            <div class="reviews-container">
              ${place.reviews.slice(0, 3).map(review => `
                <div class="card mb-2">
                  <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                      <img src="${review.profile_photo_url}" alt="${review.author_name}" class="rounded-circle me-2" width="40" height="40">
                      <div>
                        <strong>${review.author_name}</strong>
                        <div class="text-warning">
                          ${Array(Math.floor(review.rating)).fill('<i class="fas fa-star"></i>').join('')}
                          ${review.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                          ${Array(5 - Math.ceil(review.rating)).fill('<i class="far fa-star"></i>').join('')}
                        </div>
                      </div>
                    </div>
                    <p class="card-text small">${review.text}</p>
                    <small class="text-muted">${review.relative_time_description}</small>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      
      // Format place types as badges
      let typesHtml = '';
      if (place.types && place.types.length > 0) {
        typesHtml = `
          <div class="mb-3">
            <h5>Categories</h5>
            <div>
              ${place.types.map(type => `
                <span class="badge bg-secondary me-1 mb-1">${type.replace(/_/g, ' ')}</span>
              `).join('')}
            </div>
          </div>
        `;
      }
      
      // Combine all sections into the modal body
      document.getElementById('modal-body').innerHTML = `
        ${photosHtml}
        ${ratingHtml}
        ${addressHtml}
        ${phoneHtml}
        ${websiteHtml}
        ${hoursHtml}
        ${typesHtml}
        ${reviewsHtml}
        
        <div class="mt-4">
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}" 
             class="btn btn-outline-primary" target="_blank" rel="noopener noreferrer">
            <i class="fas fa-map-marker-alt me-1"></i> View on Google Maps
          </a>
        </div>
      `;
    } else {
      document.getElementById('modal-body').innerHTML = `
        <div class="alert alert-warning">
          Failed to load place details. Please try again.
        </div>
      `;
    }
  } catch (error) {
    console.error('Error fetching place details:', error);
    document.getElementById('modal-body').innerHTML = `
      <div class="alert alert-danger">
        An error occurred while loading place details. Please try again later.
      </div>
    `;
  }
}