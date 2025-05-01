// Global variables
let map;
let markers = [];
let currentLocation = { lat: 52.3676, lng: 4.9041 }; // Default Amsterdam
let placeModal;
let currentPlaceType = 'restaurant';
let hoverMarker = null;
let hoverInfoWindow = null;
let hoverTimeout = null;
let lastHoverLocation = null;
let clickedLocation = null; // Stores the location when user clicks on the map
let clickedLocationMarker = null; // Marker to show where user clicked
let searchRadius = 1500; // Default search radius in meters
let isApiErrorShown = false; // Flag to track if API error is already displayed

// Initialize the map
function initMap() {
  // Make sure the map element exists
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    console.error("Map element not found in the DOM");
    return;
  }

  // Set Amsterdam as default location if not already set
  if (!currentLocation) {
    currentLocation = { lat: 52.3676, lng: 4.9041 }; // Amsterdam coordinates
    console.log("Setting Amsterdam as center");
  }
  
  console.log("Initializing map with center:", currentLocation);

  // Create map with explicit styles to ensure visibility  
  map = new google.maps.Map(mapElement, {
    center: currentLocation,
    zoom: 13,
    // Remove mapId to allow styles to work properly
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "on" }]
      }
    ]
  });
  
  // Add mousemove event to trigger hover search for nearby places
  let isMouseDown = false;
  
  // Track mouse state to prevent unwanted events
  google.maps.event.addListener(map, 'mousedown', function() {
    isMouseDown = true;
  });
  
  google.maps.event.addListener(map, 'mouseup', function() {
    isMouseDown = false;
  });
  
  google.maps.event.addListener(map, 'dragstart', function() {
    // Close any hover info window when dragging starts
    if (hoverInfoWindow) {
      hoverInfoWindow.close();
    }
  });
  
  // Track last hover position to reduce unnecessary searches
  let lastHoverPosition = null;
  const MIN_HOVER_DISTANCE = 50; // Minimum distance in pixels to trigger a new hover search
  
  google.maps.event.addListener(map, 'mousemove', debounce(function(event) {
    // Only search when the user is hovering (not actively dragging or clicking)
    if (!isMouseDown && (!map.getDraggable || map.getDraggable())) {
      const hoverLocation = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      
      // Check if we should trigger a new search based on distance from last hover
      let shouldSearch = true;
      
      // Simple distance check using lat/lng coordinates
      if (lastHoverPosition) {
        try {
          // Get coordinates from the LatLng object
          const lastLat = lastHoverPosition.lat();
          const lastLng = lastHoverPosition.lng();
          
          // Calculate distance in meters between two lat/lng points
          const earthRadius = 6371000; // meters
          const dLat = (hoverLocation.lat - lastLat) * Math.PI / 180;
          const dLng = (hoverLocation.lng - lastLng) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lastLat * Math.PI / 180) * Math.cos(hoverLocation.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = earthRadius * c; // distance in meters
          
          // Only search if we've moved at least 25 meters
          shouldSearch = distance > 25;
        } catch (e) {
          // If anything goes wrong in the calculation, default to allowing the search
          console.error("Error calculating hover distance:", e);
          shouldSearch = true;
          // Reset the last position to avoid future errors
          lastHoverPosition = null;
        }
      }
      
      // Store the hover point for visual reference
      updateHoverMarker(hoverLocation);
      
      // Only search in certain zoom levels and if we've moved enough
      if (map.getZoom() >= 15 && shouldSearch) {
        lastHoverPosition = event.latLng;
        searchNearbyOnHover(hoverLocation);
      }
    }
  }, 400)); // Increased debounce time
  
  // Add a marker for the current location
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
  
  // Initialize modal
  placeModal = new bootstrap.Modal(document.getElementById('place-modal'));
  
  // Initialize Places Service for the map with more fields
  const placesService = new google.maps.places.PlacesService(map);
  
  // Initialize InfoWindow for place clicks
  const infoWindow = new google.maps.InfoWindow();
  
  // Add click listener to the map for clicks anywhere on the map
  map.addListener('click', (event) => {
    // Close any hover info window
    if (hoverInfoWindow) {
      hoverInfoWindow.close();
    }
    
    // Store the clicked location for search functionality
    clickedLocation = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    
    // Show marker at clicked location
    if (clickedLocationMarker) {
      clickedLocationMarker.setMap(null); // Remove existing marker
    }
    
    // Create a new marker at the clicked location
    clickedLocationMarker = new google.maps.Marker({
      position: clickedLocation,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#FF5722", // Different color from current location
        fillOpacity: 0.8,
        strokeColor: "white",
        strokeWeight: 2,
      },
      title: "Clicked Location"
    });
    
    // Update location input field with the coordinates or address
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({
      location: clickedLocation
    }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        // Update input field with readable address
        document.getElementById('location-input').value = results[0].formatted_address;
      } else {
        // If geocoding fails, use coordinates
        document.getElementById('location-input').value = 
          `${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)}`;
      }
    });
    
    // Check if a POI (point of interest) was clicked
    if (event.placeId) {
      // Prevent the default info window from showing and stop the event from propagating
      event.stop();
      
      // Prevent map panning when clicking a place
      map.setOptions({ draggable: false });
      setTimeout(() => map.setOptions({ draggable: true }), 100);
      
      // Show loading in info window
      infoWindow.setContent('<div class="p-2"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading...</div>');
      infoWindow.setPosition(event.latLng);
      infoWindow.open(map);
      
      // Get comprehensive details for the clicked place
      placesService.getDetails({
        placeId: event.placeId,
        fields: [
          'name', 'place_id', 'rating', 'user_ratings_total',
          'formatted_address', 'photos', 'price_level', 'types',
          'vicinity', 'geometry'
        ]
      }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          // Format rating stars for display in info window
          let ratingStars = '';
          if (place.rating) {
            const fullStars = Math.floor(place.rating);
            const hasHalfStar = place.rating % 1 >= 0.5;
            
            // Full stars
            for (let i = 0; i < fullStars; i++) {
              ratingStars += '<i class="fas fa-star text-warning"></i>';
            }
            
            // Half star
            if (hasHalfStar) {
              ratingStars += '<i class="fas fa-star-half-alt text-warning"></i>';
            }
            
            // Empty stars
            const emptyStars = 5 - Math.ceil(place.rating);
            for (let i = 0; i < emptyStars; i++) {
              ratingStars += '<i class="far fa-star text-warning"></i>';
            }
          }
          
          // Create a view details button that calls our showPlaceDetails function
          const viewDetailsButton = document.createElement('button');
          viewDetailsButton.className = 'btn btn-primary btn-sm mt-2 w-100';
          viewDetailsButton.textContent = 'View Full Details';
          viewDetailsButton.onclick = () => {
            showPlaceDetails(place.place_id);
            infoWindow.close();
          };
          
          // Format place type
          let placeType = '';
          if (place.types && place.types.length > 0) {
            // Get the most relevant type
            const relevantTypes = place.types.filter(type => 
              type !== 'point_of_interest' && 
              type !== 'establishment' && 
              type !== 'food'
            );
            
            if (relevantTypes.length > 0) {
              placeType = formatPlaceType(relevantTypes[0]);
            }
          }
          
          // Format price level
          let priceLevel = '';
          if (place.price_level) {
            for (let i = 0; i < place.price_level; i++) {
              priceLevel += '$';
            }
          }
          
          // Create photo HTML if available
          let photoHtml = '';
          if (place.photos && place.photos.length > 0) {
            const photoUrl = `/api/photo?photoreference=${place.photos[0].photo_reference}&maxwidth=300`;
            photoHtml = `<img src="${photoUrl}" class="img-fluid mb-2 rounded" alt="${place.name}">`;
          }
          
          // Create info window content
          const content = document.createElement('div');
          content.className = 'p-2';
          content.style.maxWidth = '300px';
          
          // Add content with enhanced styling
          content.innerHTML = `
            ${photoHtml}
            <h5 class="mb-1">${place.name}</h5>
            ${placeType ? `<div class="badge bg-secondary mb-2">${placeType}</div>` : ''}
            ${priceLevel ? `<div class="ms-2 badge bg-success">${priceLevel}</div>` : ''}
            <div class="mb-2">
              ${ratingStars} <strong>${place.rating || 'No rating'}</strong>
              ${place.user_ratings_total ? 
                `<span class="text-muted">(${place.user_ratings_total} reviews)</span>` : 
                ''}
            </div>
            <small class="text-muted d-block mb-2">${place.vicinity || place.formatted_address || ''}</small>
          `;
          
          content.appendChild(viewDetailsButton);
          
          // Update info window content
          infoWindow.setContent(content);
        } else {
          infoWindow.setContent('<div class="p-2">Unable to load place details</div>');
        }
      });
    }
  });
  
  // Set up event listeners
  document.getElementById('search-button').addEventListener('click', searchLocation);
  document.getElementById('location-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') searchLocation();
  });
  
  // Set up use my location button
  document.getElementById('use-location-button').addEventListener('click', useMyLocation);
  
  // Set up radius slider
  const radiusSlider = document.getElementById('radius-slider');
  const radiusValueElement = document.getElementById('radius-value');
  
  // Initialize the radius value display
  radiusValueElement.textContent = (radiusSlider.value / 1000).toFixed(1);
  
  // Update search radius when the slider changes
  radiusSlider.addEventListener('input', function() {
    // Update the displayed value
    const radiusInKm = (this.value / 1000).toFixed(1);
    radiusValueElement.textContent = radiusInKm;
    
    // Update the global search radius variable
    searchRadius = parseInt(this.value);
  });
  
  // Automatically search for nearby places once the map is ready
  google.maps.event.addListenerOnce(map, 'idle', function() {
    console.log("Map is ready, searching for nearby restaurants and attractions");
    loadNearbyPlaces(currentLocation);
  });
  
  // When slider changes are complete, trigger a new search if we have a location
  radiusSlider.addEventListener('change', function() {
    // Only search if we have a location
    if (currentLocation) {
      // Get the keyword from the active category button
      const activeCategory = document.querySelector('.category-btn.active');
      const keyword = activeCategory ? activeCategory.dataset.keyword || '' : '';
      
      // Load nearby places with the new radius
      loadNearbyPlaces(currentLocation, keyword, searchRadius);
    }
  });
  
  // Set up category buttons
  const categoryButtons = document.querySelectorAll('.category-btn');
  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Update active state
      categoryButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update current place type and search again
      currentPlaceType = button.dataset.type;
      
      // Check if there's a keyword (for special categories like "cheap eats")
      const keyword = button.dataset.keyword || '';
      
      // Pass both type and keyword to loadNearbyPlaces
      loadNearbyPlaces(currentLocation, keyword);
    });
  });
  
  // Try to get user's current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        // Update map center
        map.setCenter(currentLocation);
        
        // Log success
        console.log("Successfully obtained user location on initial load:", currentLocation);
        
        // Load nearby places
        loadNearbyPlaces(currentLocation);
        
        // Try to get address for location
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({
          location: currentLocation
        }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results[0]) {
            // Update input field with readable address
            document.getElementById('location-input').value = results[0].formatted_address;
          }
        });
      },
      error => {
        console.log('Geolocation error or permission denied on initial load:', error);
        
        // Show a notification asking user to enter location manually
        const notification = document.createElement('div');
        notification.className = 'alert alert-info alert-dismissible fade show';
        notification.setAttribute('role', 'alert');
        notification.innerHTML = `
          <i class="fas fa-info-circle"></i> 
          Please enter a location to search for places.
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        try {
          // Add notification to the page
          const container = document.querySelector('.container');
          if (container) {
            container.insertBefore(notification, container.firstChild);
          }
          
          // Focus on input to encourage manual entry
          document.getElementById('location-input').focus();
        } catch (e) {
          console.error("Error showing notification:", e);
        }
      },
      {
        timeout: 8000, // 8 second timeout
        maximumAge: 0,
        enableHighAccuracy: true
      }
    );
  } else {
    // Browser doesn't support geolocation
    console.log('Geolocation not supported by this browser');
    
    // Show a notification asking user to enter location manually
    const notification = document.createElement('div');
    notification.className = 'alert alert-info alert-dismissible fade show';
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
      <i class="fas fa-info-circle"></i> 
      Your browser doesn't support location services. Please enter a location to search.
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    try {
      // Add notification to the page
      const container = document.querySelector('.container');
      if (container) {
        container.insertBefore(notification, container.firstChild);
      }
      
      // Focus on input to encourage manual entry
      document.getElementById('location-input').focus();
    } catch (e) {
      console.error("Error showing notification:", e);
    }
  }
}

// Use my location
function useMyLocation() {
  if (!navigator.geolocation) {
    console.error("Geolocation is not supported by this browser");
    useDefaultLocation("Geolocation is not supported by your browser");
    return;
  }
  
  // Show loading indicator
  showLoading();
  
  // Show status in button
  const locationButton = document.getElementById('use-location-button');
  const originalText = locationButton.innerHTML;
  locationButton.disabled = true;
  locationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';
  
  // Use Amsterdam as a fallback location if geolocation fails
  const fallbackLocation = {
    lat: 52.3676,
    lng: 4.9041
  };
  
  try {
    // Add a debug popup to make it very clear we're requesting location
    const notification = document.createElement('div');
    notification.className = 'alert alert-info alert-dismissible fade show';
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
      <i class="fas fa-info-circle"></i> 
      Requesting your location... Please allow location access in your browser when prompted.
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    try {
      // Add notification to the page
      const container = document.querySelector('.container');
      if (container) {
        container.insertBefore(notification, container.firstChild);
      }
    } catch (e) {
      console.error("Error showing notification:", e);
    }
    
    // Track when the request was started
    console.log("Requesting user location at: " + new Date().toISOString());
    
    navigator.geolocation.getCurrentPosition(
      position => {
        console.log("Successfully obtained user location at: " + new Date().toISOString());
        
        // Success - we have the location
        currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        console.log("Location coordinates:", currentLocation);
        
        // Update map center with animation and zoom
        map.panTo(currentLocation);
        map.setZoom(14); // Zoom in a bit
        
        // Add a marker at the current location
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
          title: "Your Location"
        });
        
        // Load nearby places
        loadNearbyPlaces(currentLocation);
        
        // Restore button
        locationButton.innerHTML = originalText;
        locationButton.disabled = false;
        
        // Try to get address for location
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({
          location: currentLocation
        }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results[0]) {
            // Update input field with readable address
            document.getElementById('location-input').value = results[0].formatted_address;
          }
        });
      },
      error => {
        console.error("Geolocation error:", error);
        let errorMessage = "Unknown error getting your location";
        
        // Determine specific error message
        if (error.code) {
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permission denied";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out";
              break;
          }
        }
        
        // Use default location with appropriate error message
        useDefaultLocation(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } catch (e) {
    console.error("Exception when accessing geolocation:", e);
    useDefaultLocation("Error accessing location services");
  }
  
  // Helper function to use a default location when geolocation fails
  function useDefaultLocation(reason) {
    console.log("Using default location because: ", reason);
    hideLoading();
    locationButton.innerHTML = originalText;
    locationButton.disabled = false;
    
    // Use the fallback Amsterdam location
    currentLocation = fallbackLocation;
    map.setCenter(currentLocation);
    
    // Set Amsterdam as the default location in the input field
    document.getElementById('location-input').value = "Amsterdam, Netherlands";
    
    // Load nearby places with the fallback location
    loadNearbyPlaces(currentLocation);
    
    // Display a notification that geolocation failed but we're using Amsterdam as fallback
    const notification = document.createElement('div');
    notification.className = 'alert alert-warning alert-dismissible fade show';
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i> 
      ${reason}. Using Amsterdam as default location. You can enter a different location manually.
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    try {
      // Add notification to the top of the page
      const container = document.querySelector('.container');
      if (container) {
        container.insertBefore(notification, container.firstChild);
      } else {
        console.error("Container element not found for notification");
        // Try an alternative approach
        document.body.insertBefore(notification, document.body.firstChild);
      }
    } catch (e) {
      console.error("Error showing notification:", e);
    }
  }
}

// Search for a location
async function searchLocation() {
  showLoading();
  
  // Get the keyword input to check if we're searching for a specific place
  // We don't have a separate keyword input in this version, so use location input
  const inputValue = document.getElementById('location-input').value.trim();
  console.log("Searching with input:", inputValue);
  
  // Skip searchForSpecificPlace and directly use geocoding for cities/locations
  // This ensures we get restaurants in the actual location, not elsewhere
  
  // If we have a clicked location, use that instead of geocoding
  if (clickedLocation) {
    console.log("Using clicked location for search:", clickedLocation);
    
    // Use the clicked location
    currentLocation = {
      lat: clickedLocation.lat,
      lng: clickedLocation.lng
    };
    
    // Update map center
    map.setCenter(currentLocation);
    map.setZoom(15); // Zoom in to show nearby places
    
    // Load nearby places based on clicked location and the current search radius
    loadNearbyPlaces(currentLocation, inputValue, searchRadius);
    
    // Keep the clickedLocation marker visible so user knows where they clicked
    // but clear the reference so another click will work
    clickedLocation = null;
    
    hideLoading();
    return;
  }
  
  // If no clicked location, proceed with location input search
  const locationInput = document.getElementById('location-input').value.trim();
  
  if (!locationInput) {
    hideLoading();
    alert('Please enter a location to search or click directly on the map');
    return;
  }
  
  try {
    // Use our server's geocoding endpoint instead of direct Google Maps API
    console.log("Geocoding using server endpoint for:", locationInput);
    
    // Call our backend geocoding endpoint
    const response = await fetch(`/api/geocoding?address=${encodeURIComponent(locationInput)}`);
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Geocoding API response:", data);
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;
      
      currentLocation = {
        lat: location.lat,
        lng: location.lng
      };
      
      // Update map center
      map.setCenter(currentLocation);
      
      // Add marker for the search location (replacing any clicked location marker)
      if (clickedLocationMarker) {
        clickedLocationMarker.setMap(null);
      }
      
      clickedLocationMarker = new google.maps.Marker({
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
      
      // Determine if this is a specific locality/neighborhood by checking the result types
      const isSpecificArea = result.types && result.types.some(type => 
        ['sublocality', 'neighborhood', 'postal_code'].includes(type)
      );
      
      // Use a smaller radius for more specific area searches to keep results relevant
      if (isSpecificArea) {
        // Smaller radius for specific areas like neighborhoods (700m)
        loadNearbyPlaces(currentLocation, '', 700);
      } else {
        // Use default radius for broader areas like cities
        loadNearbyPlaces(currentLocation);
      }
    } else {
      hideLoading();
      alert('Location not found. Please try another search term or click directly on the map.');
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    hideLoading();
    alert('Error searching for location. Please try again or click directly on the map.');
  }
}

// Load nearby places from our API endpoint
async function loadNearbyPlaces(location, keyword = '', radius = 1500) {
  showLoading();
  
  // Clear existing markers
  clearMarkers();
  
  try {
    // Build API URL with optional keyword parameter
    let apiUrl = `/api/nearby?lat=${location.lat}&lng=${location.lng}&type=${currentPlaceType}&radius=${radius}`;
    
    // Add keyword if provided (for special categories like "cheap eats")
    if (keyword) {
      apiUrl += `&keyword=${encodeURIComponent(keyword)}`;
    }
    
    // Update the sort indicator based on place type
    const sortIndicator = document.querySelector('.sort-indicator small');
    if (sortIndicator) {
      const minReviews = currentPlaceType === 'lodging' ? 8 : 
                        (currentPlaceType === 'restaurant' ? 20 : 10);
      sortIndicator.innerHTML = `
        <i class="fas fa-info-circle"></i> 
        Places are sorted by rating, prioritizing those with at least ${minReviews} reviews
      `;
    }
    
    // Call our backend API to get nearby places
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log("Nearby places API response:", data);
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // EMERGENCY FIX: Now with minimal filtering (only for low ratings)
      const container = document.getElementById('places-container');
      container.innerHTML = '';
      
      // Log the places we found
      console.log(`EMERGENCY MODE: Starting with ${data.results.length} places before rating filter`);
      
      // Minimum rating to show
      const MIN_RATING = 4.2; // User requested at least 4.2 rating

      // Filter places with too low ratings
      const filteredPlaces = data.results.filter(place => {
        // Only apply filter to places with ratings
        if (!place.rating) return true;
        
        // For restaurants, apply stricter filter
        if (currentPlaceType === 'restaurant') {
          return place.rating >= MIN_RATING;
        }
        
        // For other place types, be a bit more lenient
        return place.rating >= 4.0;
      });
      
      console.log(`After rating filter: ${filteredPlaces.length} places remain with rating >= ${MIN_RATING}`);
      
      // Sort places by rating (higher ratings first)
      const sortedPlaces = [...filteredPlaces].sort((a, b) => {
        // Minimum required reviews for statistical significance
        const currentMinReviews = currentPlaceType === 'lodging' ? 8 : 
                              (currentPlaceType === 'restaurant' ? 20 : 10);
                              
        const aSignificant = a.user_ratings_total >= currentMinReviews;
        const bSignificant = b.user_ratings_total >= currentMinReviews;
        
        // If both places have significant number of reviews, sort by rating
        if (aSignificant && bSignificant) {
          return b.rating - a.rating;
        }
        // If only one has significant reviews, prioritize that one
        else if (aSignificant) {
          return -1;
        }
        else if (bSignificant) {
          return 1;
        }
        // If neither has significant reviews, sort by number of reviews
        else if (a.user_ratings_total && b.user_ratings_total) {
          return b.user_ratings_total - a.user_ratings_total;
        }
        // Fallback to rating if available
        else if (a.rating && b.rating) {
          return b.rating - a.rating;
        }
        // Keep original order if no sorting criteria apply
        return 0;
      });
      
      console.log(`Sorted places: showing ${sortedPlaces.length} places sorted by rating`);
      
      // Clear existing markers
      clearMarkers();
      
      if (sortedPlaces.length === 0) {
        // Show a message if no places meet the rating criteria
        container.innerHTML = `
          <div class="col-12">
            <div class="alert alert-info">
              <strong>No high-rated places found</strong>
              <p>No ${formatPlaceType(currentPlaceType)} with a rating of ${MIN_RATING} or higher found in this area.</p>
              <p>Try another location or category, or adjust the search radius.</p>
            </div>
          </div>
        `;
      } else {
        // Display filtered and sorted places
        sortedPlaces.forEach((place, index) => {
          // Create a card for each place
          const card = createPlaceCard(place, index);
          container.appendChild(card);
          
          // Add a marker for this place
          addMarker(place, index);
        });
      }
    } else if (data.status === 'REQUEST_DENIED') {
      // API key issue
      console.error("Google Places API request denied:", data.error_message || "No error details available");
      document.getElementById('places-container').innerHTML = `
        <div class="col-12">
          <div class="alert alert-warning">
            <strong>API Request Denied</strong>
            <p>There was an issue with the Google Places API request: ${data.error_message || "Unknown error"}</p>
            <p>This is likely due to API key restrictions or quota limits.</p>
          </div>
        </div>
      `;
    } else {
      // No results
      document.getElementById('places-container').innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">No ${formatPlaceType(currentPlaceType)} found in this area. Try another location or category.</div>
        </div>
      `;
    }
    
    hideLoading();
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    document.getElementById('places-container').innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">Error fetching places. Please try again later.</div>
      </div>
    `;
    hideLoading();
  }
}

// Render place cards
function renderPlaces(places) {
  const container = document.getElementById('places-container');
  container.innerHTML = '';
  
  // Minimum required reviews for statistical significance
  // Different minimum reviews based on place type
  const MIN_REVIEWS = {
    restaurant: 20,
    lodging: 8,
    default: 10
  };
  const currentMinReviews = currentPlaceType === 'lodging' ? MIN_REVIEWS.lodging : 
                          (currentPlaceType === 'restaurant' ? MIN_REVIEWS.restaurant : MIN_REVIEWS.default);
  
  // Minimum rating to show (only for restaurants)
  const MIN_RATING = 4.3; // Increased from 4.1 to ensure better quality restaurants
  
  // Define unwanted business types
  const unwantedTypes = [
    "gas_station", 
    "convenience_store", 
    "car_repair", 
    "car_wash",
    "car_dealer",
    "ice_cream_parlor",
    "bakery",
    "cafe",
    "grocery_or_supermarket",
    "food",
    "store",
    "market",
    "liquor_store"
  ];
  
  // Make a copy of the places to filter
  let filteredPlaces = [...places];
  
  // Log the number of places before filtering
  console.log(`Before client filtering: ${filteredPlaces.length} places`);
  
  // Completely bypass filtering and force places to render
  console.log("SKIPPING FILTERING TO DEBUG - We should see places now");
  
  // Force rendering all places received from API
  const unfilteredPlaces = [...places]; 
  
  console.log(`Forcing display of all ${unfilteredPlaces.length} unfiltered places`);
  
  // Override the filteredPlaces variable to ensure we show something
  filteredPlaces = unfilteredPlaces;
  
  console.log(`After client filtering: ${filteredPlaces.length} places`);
  
  // If no results after filtering, show a message
  if (filteredPlaces.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">No high-rated ${formatPlaceType(currentPlaceType)} found in this area. Try another location or category.</div>
      </div>
    `;
    return;
  }
  
  // Sort places by rating but only consider places with at least currentMinReviews
  const sortedPlaces = [...filteredPlaces].sort((a, b) => {
    const aSignificant = a.user_ratings_total >= currentMinReviews;
    const bSignificant = b.user_ratings_total >= currentMinReviews;
    
    // If both places have significant number of reviews, sort by rating
    if (aSignificant && bSignificant) {
      return b.rating - a.rating;
    }
    // If only one has significant reviews, prioritize that one
    else if (aSignificant) {
      return -1;
    }
    else if (bSignificant) {
      return 1;
    }
    // If neither has significant reviews, sort by number of reviews
    else if (a.user_ratings_total && b.user_ratings_total) {
      return b.user_ratings_total - a.user_ratings_total;
    }
    // Fallback to rating if available
    else if (a.rating && b.rating) {
      return b.rating - a.rating;
    }
    // Keep original order if no sorting criteria apply
    return 0;
  });
  
  // Reset markers before adding new ones
  clearMarkers();
  
  sortedPlaces.forEach((place, index) => {
    // Create a card for each place
    const card = createPlaceCard(place, index);
    container.appendChild(card);
    
    // Add a marker for this place
    addMarker(place, index);
  });
}

// Create a card for a place
function createPlaceCard(place, index) {
  const col = document.createElement('div');
  col.className = 'col-md-4 mb-4';
  
  // Add numerical identifier for this place
  const placeNumber = index + 1;
  
  // Format rating stars for Google
  let ratingHtml = '';
  if (place.rating) {
    ratingHtml = '<div class="mb-2 star-rating">';
    ratingHtml += '<div class="d-flex align-items-center mb-1">';
    ratingHtml += '<small class="text-muted me-1">Google:</small>';
    
    // Full stars
    for (let i = 0; i < Math.floor(place.rating); i++) {
      ratingHtml += '<i class="fas fa-star"></i>';
    }
    
    // Half star if needed
    if (place.rating % 1 >= 0.5) {
      ratingHtml += '<i class="fas fa-star-half-alt"></i>';
    }
    
    // Empty stars
    for (let i = 0; i < (5 - Math.ceil(place.rating)); i++) {
      ratingHtml += '<i class="far fa-star"></i>';
    }
    
    ratingHtml += ` <span class="ms-1">${place.rating}</span>`;
    
    // Add a more prominent display for the number of reviews
    if (place.user_ratings_total) {
      // Add badge indicating statistically significant ratings based on place type
      const minReviews = {
        restaurant: 20,
        lodging: 8,
        default: 10
      };
      const currentMin = currentPlaceType === 'lodging' ? minReviews.lodging : 
                        (currentPlaceType === 'restaurant' ? minReviews.restaurant : minReviews.default);
      
      if (place.user_ratings_total > 500) {
        ratingHtml += ` <span class="badge bg-danger ms-2"><i class="fas fa-fire"></i> ${place.user_ratings_total} reviews</span>`;
      } else if (place.user_ratings_total > 200) {
        ratingHtml += ` <span class="badge bg-success ms-2">${place.user_ratings_total} reviews</span>`;
      } else if (place.user_ratings_total >= currentMin) {
        ratingHtml += ` <span class="badge bg-primary ms-2">${place.user_ratings_total} reviews</span>`;
      } else {
        ratingHtml += ` <span class="text-muted">(${place.user_ratings_total} reviews)</span>`;
      }
    }
    
    ratingHtml += '</div>'; // End of Google rating div
    
    // TripAdvisor placeholder with loading indicator
    ratingHtml += `
      <div class="d-flex align-items-center mt-2" id="tripadvisor-${place.place_id}">
        <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" 
             alt="TripAdvisor" height="15" class="me-2">
        <div class="spinner-border spinner-border-sm text-success" role="status">
          <span class="visually-hidden">Loading TripAdvisor data...</span>
        </div>
        <small class="text-muted ms-2">Loading...</small>
      </div>
    `;
    
    ratingHtml += '</div>'; // End star-rating div
    
    // Trigger TripAdvisor data fetch
    fetchTripAdvisorData(place);
  }
  
  // Format price level
  let priceHtml = '';
  if (place.price_level) {
    priceHtml = '<div class="price-level">';
    for (let i = 0; i < place.price_level; i++) {
      priceHtml += '$';
    }
    priceHtml += '</div>';
  }
  
  // Create card content
  let photoHtml = '<div class="bg-light text-center py-5">No Image Available</div>';
  if (place.photos && place.photos.length > 0) {
    // Check if we have a photo_reference or if we have a reference property
    const photoRef = place.photos[0].photo_reference;
    if (photoRef) {
      const photoUrl = `/api/photo?photoreference=${photoRef}&maxwidth=400`;
      photoHtml = `<img src="${photoUrl}" class="card-img-top place-image" alt="${place.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=Image+Not+Available'">`;
    } else if (place.photos[0].url) {
      // Some API responses include a direct URL instead
      photoHtml = `<img src="${place.photos[0].url}" class="card-img-top place-image" alt="${place.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=Image+Not+Available'">`;
    }
  }
  
  // Create a numbered badge for the place
  const numberBadgeHtml = `
    <div class="place-number-badge">${placeNumber}</div>
  `;
  
  col.innerHTML = `
    <div class="card place-card h-100">
      <div class="position-relative">
        ${photoHtml}
        <div class="position-absolute top-0 start-0 mt-2 ms-2 bg-danger text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; font-weight: bold;">
          ${placeNumber}
        </div>
      </div>
      <div class="card-body">
        <h5 class="card-title">${placeNumber}. ${place.name}</h5>
        ${ratingHtml}
        <!-- TripAdvisor Rating Section -->
        <div id="tripadvisor-${place.place_id}"
             class="tripadvisor-rating-container small mb-1 py-2"
             style="min-height: 30px; border-top: 1px dotted #ddd; padding-top: 8px; margin-top: 6px;">
          <div class="d-flex align-items-center justify-content-center">
            <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" 
                 alt="TripAdvisor" height="15" class="me-2">
            <div class="spinner-border spinner-border-sm text-success" role="status">
              <span class="visually-hidden">Loading TripAdvisor data...</span>
            </div>
            <small class="text-muted ms-2">Loading...</small>
          </div>
        </div>
        ${priceHtml}
        <p class="card-text">${place.vicinity || ''}</p>
        <button class="btn btn-primary btn-sm view-details" data-place-id="${place.place_id}">View Details</button>
      </div>
    </div>
  `;
  
  // Add click event to view details button
  col.querySelector('.view-details').addEventListener('click', () => {
    showPlaceDetails(place.place_id);
  });
  
  // Add click event to card
  col.querySelector('.place-card').addEventListener('click', (e) => {
    if (!e.target.classList.contains('view-details')) {
      showPlaceDetails(place.place_id);
    }
  });
  
  // Fetch TripAdvisor data for this place after a slight delay to ensure DOM is updated
  setTimeout(() => {
    fetchTripAdvisorData(place);
  }, 100);
  
  return col;
}

// Simple string similarity function (without requiring external library)
function calculateStringSimilarity(str1, str2) {
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();
  
  // Quick check
  if (str1 === str2) return 1.0;
  
  // Check if one string contains the other
  if (str1.includes(str2) || str2.includes(str1)) {
    const longerLength = Math.max(str1.length, str2.length);
    const shorterLength = Math.min(str1.length, str2.length);
    return shorterLength / longerLength * 0.8; // 80% similarity if one contains the other
  }
  
  // Split into words and check for common words
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  
  let matches = 0;
  for (const word1 of words1) {
    if (word1.length <= 2) continue; // Skip short words
    for (const word2 of words2) {
      if (word2.length <= 2) continue;
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matches++;
        break;
      }
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

// Helper function to fetch TripAdvisor data for a place and update its card
async function fetchTripAdvisorData(place) {
  try {
    const { place_id, name, vicinity } = place;
    
    // Find the placeholder element for this place by ID
    let taRatingElement = document.getElementById(`tripadvisor-${place.place_id}`);
    
    // If not found by ID, log the error and exit
    if (!taRatingElement) {
      console.error(`TripAdvisor rating element not found for ${place.place_id}`);
      return;
    }
    
    console.log(`Fetching TripAdvisor data for ${name} in ${vicinity}`);
    
    // Show loading state
    taRatingElement.innerHTML = `
      <div class="d-flex align-items-center justify-content-center">
        <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" 
             alt="TripAdvisor" height="15" class="me-2">
        <div class="spinner-border spinner-border-sm text-success" role="status">
          <span class="visually-hidden">Loading TripAdvisor data...</span>
        </div>
        <small class="text-muted ms-2">Loading...</small>
      </div>
    `;
    
    if (name && vicinity) {
      try {
        // Make the API call with full address (both name and vicinity/location)
        const taResponse = await fetch(`/api/tripadvisor?place_name=${encodeURIComponent(name)}&location=${encodeURIComponent(vicinity)}`);
        const taData = await taResponse.json();
        console.log("TripAdvisor data response for", name, ":", taData);
        
        if (taData.status === 'OK' && taData.result && taData.result.tripadvisor_data) {
          const tripadvisorData = taData.result.tripadvisor_data;
          
          // Check if we have meaningful TripAdvisor data (rating or any other useful info)
          if (tripadvisorData && (tripadvisorData.rating || tripadvisorData.url || tripadvisorData.ranking)) {
            console.log(`Got TripAdvisor data for ${name}:`, tripadvisorData);
            
            // Start building the HTML for the TripAdvisor section
            let taHtml = '<div class="d-flex align-items-center justify-content-center">';
            taHtml += '<img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="15" class="me-2">';
            
            // If we have a rating, display it
            if (tripadvisorData.rating) {
              taHtml += '<div class="d-flex align-items-center">';
              
              // TripAdvisor uses circles instead of stars
              for (let i = 0; i < Math.floor(tripadvisorData.rating); i++) {
                taHtml += '<i class="fas fa-circle text-success" style="font-size: 0.7rem;"></i>';
              }
              
              // Half circle if needed
              if (tripadvisorData.rating % 1 >= 0.5) {
                taHtml += '<i class="fas fa-adjust text-success" style="font-size: 0.7rem;"></i>';
              }
              
              // Empty circles
              for (let i = 0; i < (5 - Math.ceil(tripadvisorData.rating)); i++) {
                taHtml += '<i class="far fa-circle text-success" style="font-size: 0.7rem;"></i>';
              }
              
              taHtml += ` <span class="ms-1">${tripadvisorData.rating}</span>`;
              
              // Show review count if available (might be num_reviews in official API)
              if (tripadvisorData.num_reviews) {
                taHtml += ` <span class="text-muted ms-1">(${tripadvisorData.num_reviews})</span>`;
              } else if (tripadvisorData.review_count) {
                taHtml += ` <span class="text-muted ms-1">(${tripadvisorData.review_count})</span>`;
              }
              
              taHtml += '</div>';
            } else {
              // If no rating but we have a URL, show a message
              taHtml += '<span class="text-muted">Listed on TripAdvisor</span>';
            }
            
            // Show ranking information if available (from official API)
            if (tripadvisorData.ranking) {
              // Extract ranking position from text like "#10 of 500 hotels in Amsterdam"
              const rankMatch = tripadvisorData.ranking.match(/#(\d+)/);
              if (rankMatch) {
                taHtml += `<div class="ms-2 badge bg-success">${rankMatch[0]}</div>`;
              } else {
                taHtml += `<div class="ms-2 badge bg-success">Ranked</div>`;
              }
            } 
            // Legacy ranking format support
            else if (tripadvisorData.rank_position && tripadvisorData.rank_total) {
              taHtml += `<div class="ms-2 badge bg-success">#${tripadvisorData.rank_position}/${tripadvisorData.rank_total}</div>`;
            }
            
            taHtml += '</div>';
            
            // If we have a TripAdvisor URL, add a link button
            const taUrl = tripadvisorData.url || 
                         (tripadvisorData.location_id ? `https://www.tripadvisor.com/AttractionProductReview-g-d${tripadvisorData.location_id}` : null);
            
            if (taUrl) {
              taHtml += `
                <div class="mt-1 text-center">
                  <a href="${taUrl}" target="_blank" class="btn btn-sm btn-outline-success">
                    <i class="fas fa-external-link-alt fa-xs me-1"></i> View on TripAdvisor
                  </a>
                </div>
              `;
            }
            
            // Show category if available (from official API)
            if (tripadvisorData.category) {
              taHtml += `<div class="mt-1 text-center"><small class="text-muted">${tripadvisorData.category}</small></div>`;
            }
            
            taRatingElement.innerHTML = taHtml;
            console.log("Updated TripAdvisor HTML for", name);
            return;
          } else {
            console.log("TripAdvisor data didn't have rating or URL for", name);
          }
        }
        
        // Handle specific result flags from the API
        if (taData.result) {
          if (taData.result.access_limited) {
            taRatingElement.innerHTML = `
              <div class="text-center">
                <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="15" class="mb-1">
                <small class="d-block text-muted"><i class="fas fa-info-circle fa-xs"></i> Data unavailable</small>
              </div>
            `;
          } else if (taData.result.error || taData.result.source_error) {
            taRatingElement.innerHTML = `
              <div class="text-center">
                <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="15" class="mb-1">
                <small class="d-block text-muted"><i class="fas fa-exclamation-circle fa-xs"></i> Connection issue</small>
              </div>
            `;
          } else if (taData.result.message === 'No matching places found') {
            taRatingElement.innerHTML = `
              <div class="text-center">
                <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="15" class="mb-1">
                <small class="d-block text-muted"><i class="fas fa-question-circle fa-xs"></i> Not found</small>
              </div>
            `;
          } else {
            // Generic message for other cases
            taRatingElement.innerHTML = `
              <div class="text-center">
                <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="15" class="mb-1">
                <small class="d-block text-muted"><i class="fas fa-info-circle fa-xs"></i> No data available</small>
              </div>
            `;
          }
        } else {
          // API error
          taRatingElement.innerHTML = `
            <div class="text-center">
              <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="15" class="mb-1">
              <small class="d-block text-muted"><i class="fas fa-exclamation-triangle fa-xs"></i> API error</small>
            </div>
          `;
        }
      } catch (fetchError) {
        console.error('Error fetching TripAdvisor data:', fetchError);
        taRatingElement.innerHTML = `
          <div class="text-center">
            <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="15" class="mb-1">
            <small class="d-block text-muted"><i class="fas fa-exclamation-circle fa-xs"></i> Connection failed</small>
          </div>
        `;
      }
    } else {
      // Not enough information to fetch TripAdvisor data
      taRatingElement.innerHTML = `
        <div class="text-center">
          <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="15" class="mb-1">
          <small class="d-block text-muted"><i class="fas fa-info-circle fa-xs"></i> Insufficient details</small>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error in TripAdvisor data processing:', error);
    // Try to find and update the element with an error message
    try {
      const taRatingElement = document.getElementById(`tripadvisor-${place.place_id}`);
      if (taRatingElement) {
        taRatingElement.innerHTML = `
          <div class="text-center">
            <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="15" class="mb-1">
            <small class="d-block text-muted"><i class="fas fa-exclamation-triangle fa-xs"></i> Error</small>
          </div>
        `;
      }
    } catch (e) {
      // Cannot update the error message, just log it
      console.error('Cannot update TripAdvisor element with error:', e);
    }
  }
}

// Add a marker to the map
function addMarker(place, index) {
  if (!place.geometry || !place.geometry.location) return;
  
  const position = {
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng
  };
  
  // Create a custom marker with a number
  const markerNumber = index + 1;
  
  // Create the marker with labeled content
  const marker = new google.maps.Marker({
    position: position,
    map: map,
    title: `${markerNumber}. ${place.name}`,
    animation: google.maps.Animation.DROP,
    label: {
      text: markerNumber.toString(),
      color: 'white',
      fontSize: '12px',
      fontWeight: 'bold'
    },
    // Set marker color to red
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#E21818',
      fillOpacity: 0.9,
      strokeWeight: 0,
      scale: 12
    }
  });
  
  markers.push(marker);
  
  // Add click event to marker
  marker.addListener('click', () => {
    map.panTo(position);
    showPlaceDetails(place.place_id);
  });
}

// Clear all markers from the map
function clearMarkers() {
  markers.forEach(marker => marker.setMap(null));
  markers = [];
}

// Show place details in modal
async function showPlaceDetails(placeId) {
  // Show the modal with loading state
  document.getElementById('place-details').innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  `;
  
  placeModal.show();
  
  try {
    // Call our backend API to get place details
    const response = await fetch(`/api/details?place_id=${placeId}`);
    const data = await response.json();
    
    // Fetch TripAdvisor data if Google place data is available
    let tripadvisorData = null;
    if (data.status === 'OK' && data.result) {
      try {
        const place = data.result;
        const placeName = place.name;
        // Use the full address for better TripAdvisor matching
        let location = '';
        if (place.formatted_address) {
          // Use the full address for better matching
          location = place.formatted_address.trim();
        }
        
        if (placeName && location) {
          console.log(`Fetching TripAdvisor data for ${placeName} in ${location}`);
          const taResponse = await fetch(`/api/tripadvisor?place_name=${encodeURIComponent(placeName)}&location=${encodeURIComponent(location)}`);
          const taData = await taResponse.json();
          
          if (taData.status === 'OK' && taData.result && taData.result.tripadvisor_data) {
            tripadvisorData = taData.result.tripadvisor_data;
            console.log('TripAdvisor data:', tripadvisorData);
          }
        }
      } catch (taError) {
        console.error('Error fetching TripAdvisor data:', taError);
      }
    }
    
    if (data.status === 'OK' && data.result) {
      const place = data.result;
      
      // Prepare photo carousel HTML
      let photoHtml = '';
      if (place.photos && place.photos.length > 0) {
        // Use Bootstrap carousel for better arrow navigation
        photoHtml = `
          <div id="place-photos" class="carousel slide" data-bs-ride="false">
            <div class="carousel-inner">
              ${place.photos.map((photo, index) => `
                <div class="carousel-item ${index === 0 ? 'active' : ''}">
                  <img src="${photo.url || `/api/photo?photoreference=${photo.photo_reference}&maxwidth=800`}" 
                    class="d-block w-100" alt="Photo ${index + 1}" onerror="this.src='https://via.placeholder.com/800x600?text=Image+Not+Available'">
                </div>
              `).join('')}
            </div>
            ${place.photos.length > 1 ? `
              <button class="carousel-control-prev" type="button" data-bs-target="#place-photos" data-bs-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Previous</span>
              </button>
              <button class="carousel-control-next" type="button" data-bs-target="#place-photos" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Next</span>
              </button>
              <div class="carousel-indicator-custom" id="photo-counter">1 / ${place.photos.length}</div>
            ` : ''}
          </div>
          ${place.photos.length > 1 ? `
            <div class="thumbnail-container mt-2 d-flex">
              ${place.photos.map((photo, index) => `
                <img src="${photo.url || `/api/photo?photoreference=${photo.photo_reference}&maxwidth=120`}" 
                    class="thumbnail mx-1 ${index === 0 ? 'active' : ''}" 
                    data-bs-target="#place-photos" data-bs-slide-to="${index}"
                    alt="Thumbnail ${index + 1}" style="width: 60px; height: 45px; object-fit: cover; cursor: pointer;"
                    onerror="this.src='https://via.placeholder.com/120x90?text=Thumbnail'">
              `).join('')}
            </div>
          ` : ''}
        `;
        
        // Store photos data for later use
        window.currentPlacePhotos = place.photos;
      }
      
      // TripAdvisor data is already fetched at the beginning of this function
      
      // Format Google rating stars
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = '<div class="ratings-container mb-4">';
        
        // Google Rating
        ratingHtml += '<div class="star-rating mb-3 fs-5">';
        ratingHtml += '<div class="d-flex align-items-center mb-2">';
        ratingHtml += '<img src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png" alt="Google" height="20" class="me-2">';
        ratingHtml += '<strong>Google Rating:</strong>';
        ratingHtml += '</div>';
        
        // Full stars
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '<i class="fas fa-star"></i>';
        }
        
        // Half star if needed
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '<i class="fas fa-star-half-alt"></i>';
        }
        
        // Empty stars
        for (let i = 0; i < (5 - Math.ceil(place.rating)); i++) {
          ratingHtml += '<i class="far fa-star"></i>';
        }
        
        ratingHtml += ` <span class="ms-2">${place.rating}</span>`;
        
        if (place.user_ratings_total) {
          // Add badge indicating statistically significant ratings
          const MIN_REVIEWS = currentPlaceType === 'lodging' ? 8 : 
                             (currentPlaceType === 'restaurant' ? 20 : 10);
          
          if (place.user_ratings_total > 500) {
            ratingHtml += ` <span class="badge bg-danger ms-2"><i class="fas fa-fire"></i> ${place.user_ratings_total} reviews</span>`;
          } else if (place.user_ratings_total > 200) {
            ratingHtml += ` <span class="badge bg-success ms-2">${place.user_ratings_total} reviews</span>`;
          } else if (place.user_ratings_total >= MIN_REVIEWS) {
            ratingHtml += ` <span class="badge bg-primary ms-2">${place.user_ratings_total} reviews</span>`;
          } else {
            ratingHtml += ` <span class="text-muted">(${place.user_ratings_total} reviews)</span>`;
          }
        }
        
        ratingHtml += '</div>'; // End Google Rating
        
        // TripAdvisor Rating (if available)
        if (tripadvisorData && tripadvisorData.rating) {
          ratingHtml += '<div class="star-rating mb-3 fs-5">';
          ratingHtml += '<div class="d-flex align-items-center mb-2">';
          ratingHtml += '<img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="TripAdvisor" height="20" class="me-2">';
          ratingHtml += '<strong>TripAdvisor Rating:</strong>';
          ratingHtml += '</div>';
          
          // Full circles (bubbles in TripAdvisor)
          for (let i = 0; i < Math.floor(tripadvisorData.rating); i++) {
            ratingHtml += '<i class="fas fa-circle text-success"></i>';
          }
          
          // Half circle if needed
          if (tripadvisorData.rating % 1 >= 0.5) {
            ratingHtml += '<i class="fas fa-adjust text-success"></i>';
          }
          
          // Empty circles
          for (let i = 0; i < (5 - Math.ceil(tripadvisorData.rating)); i++) {
            ratingHtml += '<i class="far fa-circle text-success"></i>';
          }
          
          ratingHtml += ` <span class="ms-2">${tripadvisorData.rating}</span>`;
          
          if (tripadvisorData.review_count) {
            ratingHtml += ` <span class="text-muted">(${tripadvisorData.review_count} reviews)</span>`;
          }
          
          // Add TripAdvisor ranking if available
          if (tripadvisorData.rank_position && tripadvisorData.rank_total) {
            ratingHtml += `
              <div class="mt-1">
                <span class="badge bg-success">
                  #${tripadvisorData.rank_position} of ${tripadvisorData.rank_total} 
                  ${currentPlaceType === 'restaurant' ? 'restaurants' : 
                     currentPlaceType === 'lodging' ? 'hotels' : 'places'}
                </span>
              </div>
            `;
          }
          
          // If we have a TripAdvisor URL, add a link
          if (tripadvisorData.url) {
            ratingHtml += `
              <div class="mt-2">
                <a href="${tripadvisorData.url}" target="_blank" class="btn btn-sm btn-outline-success">
                  <i class="fas fa-external-link-alt me-1"></i> View on TripAdvisor
                </a>
              </div>
            `;
          }
          
          ratingHtml += '</div>'; // End TripAdvisor Rating
          
          // Add detailed ratings breakdown if available
          if (tripadvisorData.detailed_ratings) {
            const details = tripadvisorData.detailed_ratings;
            
            ratingHtml += `
              <div class="detailed-ratings mt-3">
                <h6>Rating Breakdown (TripAdvisor)</h6>
                <div class="rating-bars">
            `;
            
            if (details.excellent) {
              ratingHtml += `
                <div class="rating-bar">
                  <span class="rating-label">Excellent</span>
                  <div class="progress">
                    <div class="progress-bar bg-success" style="width: ${details.excellent}%"></div>
                  </div>
                  <span class="rating-count">${details.excellent}</span>
                </div>
              `;
            }
            
            if (details.very_good) {
              ratingHtml += `
                <div class="rating-bar">
                  <span class="rating-label">Very Good</span>
                  <div class="progress">
                    <div class="progress-bar bg-info" style="width: ${details.very_good}%"></div>
                  </div>
                  <span class="rating-count">${details.very_good}</span>
                </div>
              `;
            }
            
            if (details.average) {
              ratingHtml += `
                <div class="rating-bar">
                  <span class="rating-label">Average</span>
                  <div class="progress">
                    <div class="progress-bar bg-warning" style="width: ${details.average}%"></div>
                  </div>
                  <span class="rating-count">${details.average}</span>
                </div>
              `;
            }
            
            if (details.poor) {
              ratingHtml += `
                <div class="rating-bar">
                  <span class="rating-label">Poor</span>
                  <div class="progress">
                    <div class="progress-bar bg-danger" style="width: ${details.poor}%"></div>
                  </div>
                  <span class="rating-count">${details.poor}</span>
                </div>
              `;
            }
            
            if (details.terrible) {
              ratingHtml += `
                <div class="rating-bar">
                  <span class="rating-label">Terrible</span>
                  <div class="progress">
                    <div class="progress-bar bg-dark" style="width: ${details.terrible}%"></div>
                  </div>
                  <span class="rating-count">${details.terrible}</span>
                </div>
              `;
            }
            
            ratingHtml += `
                </div>
              </div>
            `;
          }
        }
        
        ratingHtml += '</div>'; // End ratings-container
      }
      
      // Format price level
      let priceHtml = '';
      if (place.price_level) {
        priceHtml = '<div class="mb-3">';
        priceHtml += '<i class="fas fa-tag text-success me-2"></i><strong>Price Level:</strong> ';
        
        for (let i = 0; i < place.price_level; i++) {
          priceHtml += '$';
        }
        
        priceHtml += '</div>';
      }
      
      // Format phone number and website
      let contactHtml = '';
      
      if (place.formatted_phone_number) {
        contactHtml += `
          <div class="mb-3">
            <i class="fas fa-phone text-primary me-2"></i><strong>Phone:</strong> 
            <a href="tel:${place.formatted_phone_number}">${place.formatted_phone_number}</a>
          </div>
        `;
      }
      
      if (place.website) {
        contactHtml += `
          <div class="mb-3">
            <i class="fas fa-globe text-primary me-2"></i><strong>Website:</strong> 
            <a href="${place.website}" target="_blank">${place.website}</a>
          </div>
        `;
      }
      
      // Format place types/categories
      let typesHtml = '';
      
      if (place.types && place.types.length > 0) {
        typesHtml = '<div class="mb-3">';
        typesHtml += '<i class="fas fa-list text-info me-2"></i><strong>Categories:</strong>';
        typesHtml += '<div class="mt-2">';
        
        place.types.forEach(type => {
          if (type !== 'point_of_interest' && type !== 'establishment') {
            const formattedType = formatPlaceType(type);
            typesHtml += `<span class="badge bg-secondary me-1 mb-1">${formattedType}</span>`;
          }
        });
        
        typesHtml += '</div></div>';
      }
      
      // Format reviews with carousel
      let reviewsHtml = '';
      
      if (place.reviews && place.reviews.length > 0) {
        reviewsHtml = '<div class="mt-4 mb-3">';
        reviewsHtml += '<h5><i class="fas fa-comment-alt text-primary me-2"></i>Top Reviews</h5>';
        
        // Create review carousel
        reviewsHtml += '<div class="reviews-carousel">';
        reviewsHtml += '<div class="reviews-container">';
        
        // Add all reviews to carousel
        place.reviews.forEach((review, index) => {
          // Format rating stars for this review
          let reviewRating = '<div class="star-rating mb-1">';
          
          for (let i = 0; i < review.rating; i++) {
            reviewRating += '<i class="fas fa-star"></i>';
          }
          
          for (let i = 0; i < (5 - review.rating); i++) {
            reviewRating += '<i class="far fa-star"></i>';
          }
          
          reviewRating += '</div>';
          
          // Format time
          const date = new Date(review.time * 1000);
          const formattedDate = date.toLocaleDateString();
          
          reviewsHtml += `
            <div class="reviews-slide ${index === 0 ? 'active' : ''}">
              <div class="review">
                <div class="review-author">
                  <img src="${review.profile_photo_url || 'https://via.placeholder.com/40'}" alt="${review.author_name}">
                  <div>
                    <strong>${review.author_name}</strong>
                    <div class="text-muted small">${formattedDate}</div>
                  </div>
                </div>
                ${reviewRating}
                <p>${review.text}</p>
              </div>
            </div>
          `;
        });
        
        // Only add navigation if there are multiple reviews
        if (place.reviews.length > 1) {
          // Add carousel navigation
          reviewsHtml += `
            <div class="reviews-nav reviews-prev">
              <i class="fas fa-chevron-left"></i>
            </div>
            <div class="reviews-nav reviews-next">
              <i class="fas fa-chevron-right"></i>
            </div>
          `;
        }
        
        reviewsHtml += '</div>'; // Close reviews-container
        
        // Add counter
        if (place.reviews.length > 1) {
          reviewsHtml += `
            <div class="reviews-counter">
              <span class="current-review">1</span> / ${place.reviews.length}
            </div>
          `;
        }
        
        reviewsHtml += '</div>'; // Close reviews-carousel
        reviewsHtml += '</div>'; // Close the mt-4 mb-3 div
        
        // Store reviews data for later use
        window.currentPlaceReviews = place.reviews;
      }
      
      // Additional photos
      let photosHtml = '';
      
      if (place.photos && place.photos.length > 1) {
        photosHtml = '<div class="photo-gallery mt-4">';
        photosHtml += '<h5><i class="fas fa-images text-success me-2"></i>Photos</h5>';
        photosHtml += '<div class="row mt-2">';
        
        // Show up to 6 additional photos
        const photosToShow = place.photos.slice(1, 7);
        
        photosToShow.forEach(photo => {
          const photoUrl = `/api/photo?photoreference=${photo.photo_reference}&maxwidth=200`;
          
          photosHtml += `
            <div class="col-md-4 col-6 mb-2">
              <img src="${photoUrl}" class="w-100" alt="Place photo">
            </div>
          `;
        });
        
        photosHtml += '</div></div>';
      }
      
      // Add nearby recommendations section
      let nearbyRecommendationsHtml = `
        <div class="mt-4 nearby-recommendations">
          <h5><i class="fas fa-compass text-primary me-2"></i>Nearby Recommendations</h5>
          <div id="nearby-places-container" class="mt-3">
            <div class="text-center py-3">
              <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
              <span class="ms-2">Loading recommendations...</span>
            </div>
          </div>
        </div>
      `;
      
      // Add Google Maps link
      const googleMapsLink = place.geometry && place.geometry.location ? 
        `https://www.google.com/maps/search/?api=1&query=${place.geometry.location.lat},${place.geometry.location.lng}&query_place_id=${place.place_id}` : null;
      
      let mapsLinkHtml = '';
      if (googleMapsLink) {
        mapsLinkHtml = `
          <div class="mb-3">
            <i class="fab fa-google text-primary me-2"></i>
            <a href="${googleMapsLink}" target="_blank" class="btn btn-sm btn-outline-primary">
              <i class="fas fa-map-marked-alt me-1"></i> View on Google Maps
            </a>
          </div>
        `;
      }
      
      // Put it all together
      document.getElementById('place-details').innerHTML = `
        ${photoHtml}
        <h3>${place.name}</h3>
        ${ratingHtml}
        <div class="mb-3">
          <i class="fas fa-map-marker-alt text-danger me-2"></i>
          <strong>Address:</strong> ${place.formatted_address || 'Not available'}
        </div>
        ${mapsLinkHtml}
        ${priceHtml}
        ${contactHtml}
        ${typesHtml}
        ${reviewsHtml}
        ${photosHtml}
        ${nearbyRecommendationsHtml}
      `;
      
      // Initialize photo carousel if there are multiple photos
      if (place.photos && place.photos.length > 1) {
        initPhotoCarousel();
      }
      
      // Initialize reviews carousel if there are multiple reviews
      if (place.reviews && place.reviews.length > 1) {
        initReviewsCarousel();
      }
      
      // After rendering the place details, load nearby recommendations
      if (place.geometry && place.geometry.location) {
        loadNearbyRecommendations(place);
      }
    } else {
      document.getElementById('place-details').innerHTML = `
        <div class="alert alert-warning">
          Unable to load place details. Please try again later.
        </div>
      `;
    }
  } catch (error) {
    console.error('Error fetching place details:', error);
    document.getElementById('place-details').innerHTML = `
      <div class="alert alert-danger">
        Error loading place details. Please try again later.
      </div>
    `;
  }
}

// Load nearby recommendations for a place
async function loadNearbyRecommendations(place) {
  const container = document.getElementById('nearby-places-container');
  
  try {
    // Get place location
    const location = {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng
    };
    
    // Always focus on restaurant recommendations
    const recommendedType = 'restaurant';
    const radius = 500; // 500 meters radius
    
    // Fetch nearby restaurants
    const response = await fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&type=${recommendedType}&radius=${radius}`);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          No nearby restaurants found within ${radius}m.
        </div>
      `;
      return;
    }
    
    // Remove the current place from recommendations
    let nearbyRestaurants = data.results.filter(nearbyPlace => 
      nearbyPlace.place_id !== place.place_id
    );
    
    // Define unwanted business types
    const unwantedTypes = [
      "gas_station", 
      "convenience_store", 
      "car_repair", 
      "car_wash",
      "car_dealer"
    ];
    
    // Filter out unwanted businesses
    nearbyRestaurants = nearbyRestaurants.filter(restaurant => {
      // Keep only places with ratings or significant number of reviews
      if (!restaurant.rating && !restaurant.user_ratings_total) {
        return false;
      }
      
      // Check if this is an unwanted business type
      if (restaurant.types) {
        for (const type of unwantedTypes) {
          if (restaurant.types.includes(type)) {
            return false;
          }
        }
      }
      
      // Filter by minimum rating
      if (restaurant.rating && restaurant.rating < MIN_RATING) {
        return false;
      }
      
      return true;
    });
    
    if (nearbyRestaurants.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          No high-quality restaurants found nearby within ${radius}m.
        </div>
      `;
      return;
    }
    
    // Minimum required reviews for statistical significance
    // Different minimum reviews based on place type
    const MIN_REVIEWS = {
      restaurant: 20,
      lodging: 8,
      default: 10
    };
    
    // Get the appropriate minimum review count based on place type
    const getMinReviews = (placeType) => {
      if (placeType === 'lodging') return MIN_REVIEWS.lodging;
      if (placeType === 'restaurant') return MIN_REVIEWS.restaurant;
      return MIN_REVIEWS.default;
    };
    
    // Determine the minimum reviews required for the current place type
    const currentMinReviews = getMinReviews(currentPlaceType);
    
    // Sort places by rating but only consider places with sufficient reviews
    nearbyRestaurants.sort((a, b) => {
      const aSignificant = a.user_ratings_total >= currentMinReviews;
      const bSignificant = b.user_ratings_total >= currentMinReviews;
      
      // If both places have significant number of reviews, sort by rating
      if (aSignificant && bSignificant) {
        return b.rating - a.rating;
      }
      // If only one has significant reviews, prioritize that one
      else if (aSignificant) {
        return -1;
      }
      else if (bSignificant) {
        return 1;
      }
      // If neither has significant reviews, sort by number of reviews
      else if (a.user_ratings_total && b.user_ratings_total) {
        return b.user_ratings_total - a.user_ratings_total;
      }
      // Fallback to rating if available
      else if (a.rating && b.rating) {
        return b.rating - a.rating;
      }
      // Keep original order if no sorting criteria apply
      return 0;
    });
    
    // Limit to top 6 recommendations
    const topRecommendations = nearbyRestaurants.slice(0, 6);
    
    if (topRecommendations.length > 0) {
      // Create HTML for recommendations
      let recommendationsHtml = '<div class="row">';
      
      topRecommendations.forEach((recommendation, index) => {
        // For restaurant recommendations, use consistent utensils icon
        const typeIcon = 'fa-utensils';
        const typeLabel = 'Restaurant';
        
        // Add numerical identifier for this recommendation
        const recNumber = index + 1;
        
        // Prepare photo HTML
        let photoHtml = '<div class="bg-light text-center py-2">No Image</div>';
        if (recommendation.photos && recommendation.photos.length > 0) {
          const photoUrl = recommendation.photos[0].url || `/api/photo?photoreference=${recommendation.photos[0].photo_reference}&maxwidth=200`;
          photoHtml = `<img src="${photoUrl}" class="card-img-top recommendation-image" alt="${recommendation.name}" onerror="this.src='https://via.placeholder.com/200x120?text=No+Image'">`;
        }
        
        // Create Google Maps link
        const googleMapsLink = recommendation.geometry && recommendation.geometry.location ? 
          `https://www.google.com/maps/search/?api=1&query=${recommendation.geometry.location.lat},${recommendation.geometry.location.lng}&query_place_id=${recommendation.place_id}` : null;

        recommendationsHtml += `
          <div class="col-md-4 col-6 mb-3">
            <div class="card recommendation-card h-100" data-place-id="${recommendation.place_id}">
              <div class="position-relative">
                ${photoHtml}
                <div class="position-absolute top-0 start-0 mt-1 ms-1 bg-danger text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 24px; height: 24px; font-weight: bold; font-size: 12px;">
                  ${recNumber}
                </div>
              </div>
              <div class="card-body p-2">
                <h6 class="card-title mb-1">${recNumber}. ${recommendation.name}</h6>
                <div class="small mb-1">
                  <i class="fas ${typeIcon} text-secondary me-1"></i> ${typeLabel}
                </div>
                ${recommendation.rating ? 
                  `<div class="star-rating small">
                    <i class="fas fa-star"></i> ${recommendation.rating}
                    ${recommendation.user_ratings_total ? 
                      `<span class="text-muted">(${recommendation.user_ratings_total})</span>` : 
                      ''}
                  </div>` : 
                  ''}
                ${googleMapsLink ? 
                  `<div class="mt-2">
                    <a href="${googleMapsLink}" target="_blank" class="btn btn-sm btn-outline-secondary w-100" onclick="event.stopPropagation();">
                      <i class="fas fa-map-marker-alt"></i> Maps
                    </a>
                  </div>` : 
                  ''}
              </div>
            </div>
          </div>
        `;
      });
      
      recommendationsHtml += '</div>';
      container.innerHTML = recommendationsHtml;
      
      // Add click event to each recommendation card
      document.querySelectorAll('.recommendation-card').forEach(card => {
        card.addEventListener('click', () => {
          const placeId = card.getAttribute('data-place-id');
          showPlaceDetails(placeId);
        });
      });
    } else {
      container.innerHTML = `
        <div class="alert alert-info">
          No nearby recommendations found.
        </div>
      `;
    }
  } catch (error) {
    console.error('Error fetching nearby recommendations:', error);
    container.innerHTML = `
      <div class="alert alert-warning">
        Error loading recommendations. Please try again later.
      </div>
    `;
  }
}

// Format place type to user-friendly format
function formatPlaceType(type) {
  // Replace underscores with spaces and capitalize each word
  return type.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.substring(1))
    .join(' ');
}

// Function to search for a specific place by name
async function searchForSpecificPlace(placeName) {
  console.log("Searching for specific place:", placeName);
  
  try {
    // Create a places service instance
    const placesService = new google.maps.places.PlacesService(map);
    
    // Get the location input to use as a bias for the search
    const locationInput = document.getElementById('location-input').value.trim();
    let locationBias = null;
    
    // If there's a location input, try to geocode it for search bias
    if (locationInput) {
      const geocoder = new google.maps.Geocoder();
      const geocodePromise = new Promise((resolve) => {
        geocoder.geocode({ address: locationInput }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results[0]) {
            resolve(results[0].geometry.location);
          } else {
            resolve(null);
          }
        });
      });
      
      // Wait for geocoding result
      const location = await geocodePromise;
      if (location) {
        locationBias = {
          center: location,
          radius: searchRadius
        };
      }
    }
    
    // Create search request
    const searchRequest = {
      query: placeName,
      fields: ['name', 'geometry', 'place_id', 'formatted_address', 'photos', 'rating', 'types']
    };
    
    // Add location bias if available
    if (locationBias) {
      searchRequest.locationBias = locationBias;
    }
    
    // Perform place search
    const searchPromise = new Promise((resolve) => {
      placesService.findPlaceFromQuery(searchRequest, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          resolve(results[0]);
        } else {
          // Try text search if findPlaceFromQuery fails
          const textSearchRequest = {
            query: placeName,
            type: currentPlaceType !== 'attraction' ? currentPlaceType : undefined
          };
          if (locationBias) {
            textSearchRequest.location = locationBias.center;
            textSearchRequest.radius = locationBias.radius;
          }
          
          placesService.textSearch(textSearchRequest, (textResults, textStatus) => {
            if (textStatus === google.maps.places.PlacesServiceStatus.OK && textResults && textResults.length > 0) {
              resolve(textResults[0]);
            } else {
              resolve(null);
            }
          });
        }
      });
    });
    
    // Wait for search result
    const place = await searchPromise;
    if (place) {
      // Found a place, center the map on it
      map.setCenter(place.geometry.location);
      map.setZoom(17); // Closer zoom for specific place
      
      // Clear existing markers
      clearMarkers();
      
      // Add marker for this specific place
      const marker = new google.maps.Marker({
        position: place.geometry.location,
        map: map,
        animation: google.maps.Animation.DROP,
        title: place.name
      });
      
      // Keep track of marker
      markers.push(marker);
      
      // Get detailed information about this place
      const detailsPromise = new Promise((resolve) => {
        placesService.getDetails({
          placeId: place.place_id,
          fields: [
            'name', 'place_id', 'rating', 'user_ratings_total',
            'formatted_address', 'photos', 'price_level', 'types',
            'vicinity', 'geometry', 'opening_hours', 'website',
            'formatted_phone_number', 'reviews'
          ]
        }, (placeDetails, detailsStatus) => {
          if (detailsStatus === google.maps.places.PlacesServiceStatus.OK && placeDetails) {
            resolve(placeDetails);
          } else {
            resolve(place); // Fall back to original place object
          }
        });
      });
      
      // Wait for details
      const placeDetails = await detailsPromise;
      
      // Show place in the places container
      const container = document.getElementById('places-container');
      container.innerHTML = '';
      
      // Create a full-width card for this specific place
      const col = document.createElement('div');
      col.className = 'col-12 mb-4';
      
      // Create a special highlighted card for the specific place
      const card = document.createElement('div');
      card.className = 'card h-100 shadow-sm border-primary specific-place-card';
      
      // Format photos
      let photoHtml = '';
      if (placeDetails.photos && placeDetails.photos.length > 0) {
        // Try to use the Google Photos API or direct URL if available
        let photoUrl;
        try {
          photoUrl = placeDetails.photos[0].getUrl({ maxWidth: 800, maxHeight: 400 });
        } catch(e) {
          // If getUrl fails, check if we have a photo_reference
          if (placeDetails.photos[0].photo_reference) {
            photoUrl = `/api/photo?photoreference=${placeDetails.photos[0].photo_reference}&maxwidth=800`;
          } else {
            // Last resort fallback
            photoUrl = '';
          }
        }
        
        photoHtml = `
          <div class="position-relative">
            <img src="${photoUrl}" 
                 class="card-img-top" alt="${placeDetails.name}" 
                 style="height: 200px; object-fit: cover;"
                 onerror="this.src='https://via.placeholder.com/800x400?text=No+Image'">
            <div class="position-absolute bottom-0 end-0 p-2">
              <button class="btn btn-sm btn-light" onclick="showPlaceDetails('${placeDetails.place_id}')">
                <i class="fas fa-images"></i> More Photos
              </button>
            </div>
          </div>
        `;
      } else {
        photoHtml = `
          <div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="height: 200px;">
            <i class="fas fa-image text-muted fa-3x"></i>
          </div>
        `;
      }
      
      // Format rating stars for Google
      let ratingHtml = '';
      if (placeDetails.rating) {
        ratingHtml = '<div class="mb-2 star-rating">';
        ratingHtml += '<div class="d-flex align-items-center mb-1">';
        ratingHtml += '<small class="text-muted me-1">Google:</small>';
        
        // Full stars
        for (let i = 0; i < Math.floor(placeDetails.rating); i++) {
          ratingHtml += '<i class="fas fa-star"></i>';
        }
        
        // Half star if needed
        if (placeDetails.rating % 1 >= 0.5) {
          ratingHtml += '<i class="fas fa-star-half-alt"></i>';
        }
        
        // Empty stars
        for (let i = 0; i < (5 - Math.ceil(placeDetails.rating)); i++) {
          ratingHtml += '<i class="far fa-star"></i>';
        }
        
        ratingHtml += ` <span class="ms-1">${placeDetails.rating}</span>`;
        
        // Add review count with visual indicator
        if (placeDetails.user_ratings_total) {
          if (placeDetails.user_ratings_total > 500) {
            ratingHtml += ` <span class="badge bg-danger ms-2"><i class="fas fa-fire"></i> ${placeDetails.user_ratings_total} reviews</span>`;
          } else if (placeDetails.user_ratings_total > 200) {
            ratingHtml += ` <span class="badge bg-success ms-2">${placeDetails.user_ratings_total} reviews</span>`;
          } else if (placeDetails.user_ratings_total >= 20) {
            ratingHtml += ` <span class="badge bg-primary ms-2">${placeDetails.user_ratings_total} reviews</span>`;
          } else {
            ratingHtml += ` <span class="text-muted">(${placeDetails.user_ratings_total} reviews)</span>`;
          }
        }
        
        ratingHtml += '</div>'; // End of Google rating div
        
        // TripAdvisor placeholder
        ratingHtml += `
          <div class="d-flex align-items-center mt-2" id="tripadvisor-${placeDetails.place_id}">
            <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" 
                 alt="TripAdvisor" height="15" class="me-2">
            <div class="spinner-border spinner-border-sm text-success" role="status">
              <span class="visually-hidden">Loading TripAdvisor data...</span>
            </div>
            <small class="text-muted ms-2">Loading...</small>
          </div>
        `;
        
        ratingHtml += '</div>'; // End star-rating div
      }
      
      // Create the card body
      card.innerHTML = `
        ${photoHtml}
        <div class="card-body">
          <h5 class="card-title">${placeDetails.name}</h5>
          <p class="card-text text-muted mb-2">${placeDetails.formatted_address || placeDetails.vicinity || ''}</p>
          ${ratingHtml}
          <div class="mt-3 d-flex justify-content-between">
            <button class="btn btn-primary btn-sm" onclick="showPlaceDetails('${placeDetails.place_id}')">
              <i class="fas fa-info-circle"></i> View Details
            </button>
            <a href="https://www.google.com/maps/place/?q=place_id:${placeDetails.place_id}" 
               target="_blank" class="btn btn-outline-secondary btn-sm">
              <i class="fas fa-directions"></i> Directions
            </a>
          </div>
        </div>
      `;
      
      // Append card to column and column to container
      col.appendChild(card);
      container.appendChild(col);
      
      // Fetch TripAdvisor data for this place
      fetchTripAdvisorData(placeDetails);
      
      // Indicate that we successfully found and displayed a specific place
      return true;
    }
    
    // No places found
    return false;
  } catch (error) {
    console.error("Error searching for specific place:", error);
    return false;
  }
}

// Debounce function to limit how often a function is called
function debounce(func, delay) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

// Update the hover marker on the map
function updateHoverMarker(location) {
  // Only update if the location has changed significantly
  if (lastHoverLocation && 
      Math.abs(location.lat - lastHoverLocation.lat) < 0.0001 && 
      Math.abs(location.lng - lastHoverLocation.lng) < 0.0001) {
    return;
  }
  
  lastHoverLocation = location;
  
  // Remove existing hover marker if it exists
  if (hoverMarker) {
    hoverMarker.setMap(null);
  }
  
  // Create a new marker at the hover location
  hoverMarker = new google.maps.Marker({
    position: location,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: "#FF6B6B",
      fillOpacity: 0.6,
      strokeColor: "white",
      strokeWeight: 1,
    },
    zIndex: 1,
    title: "Hover Location"
  });
}

// Search for nearby places when hovering over an area
function searchNearbyOnHover(location) {
  // Don't search if we're already showing a place info window or modal
  if (document.getElementById('place-modal').classList.contains('show')) {
    return;
  }
  
  // Cancel any existing hover search timeout
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }
  
  // Set a timeout to avoid too many API calls
  hoverTimeout = setTimeout(() => {
    // Create a new info window if needed
    if (!hoverInfoWindow) {
      hoverInfoWindow = new google.maps.InfoWindow({
        disableAutoPan: true, // Prevent the map from auto-panning when opening the hover info window
        maxWidth: 320, // Make the window larger 
        content: '<div class="p-2"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Finding nearby places...</div>'
      });
      
      // Add a click listener to the map to close the hover info window
      google.maps.event.addListener(map, 'click', function() {
        if (hoverInfoWindow) {
          hoverInfoWindow.close();
        }
      });
      
      // Add a close listener
      google.maps.event.addListener(hoverInfoWindow, 'closeclick', function() {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
        }
      });
    } else {
      // Close any existing hover info window before showing a new one
      hoverInfoWindow.close();
    }
    
    // Show loading indicator in the info window
    hoverInfoWindow.setContent('<div class="p-2"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Finding nearby places...</div>');
    hoverInfoWindow.setPosition(location);
    hoverInfoWindow.open(map);
    
    // Search for nearby places using Places API
    const placesService = new google.maps.places.PlacesService(map);
    placesService.nearbySearch({
      location: location,
      radius: 200, // Increased radius for better search results
      type: currentPlaceType,
      rankBy: google.maps.places.RankBy.PROMINENCE // Prioritize more prominent places
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
        // Sort by rating (highest first)
        results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        
        // Take only the top 5 places
        const topPlaces = results.slice(0, 5);
        
        // Create the content for the info window with clickable places
        let content = '<div class="p-2" style="max-width: 300px;">';
        content += `<h6 class="mb-2">Nearby ${formatPlaceType(currentPlaceType)}s</h6>`;
        content += '<ul class="list-group list-group-flush ps-0">';
        
        topPlaces.forEach(place => {
          const rating = place.rating ? 
            `<span class="text-warning">${'★'.repeat(Math.round(place.rating))}</span>` : 
            '<span class="text-muted">No rating</span>';
          
          // Create a place icon if available
          let placeIcon = '';
          if (place.photos && place.photos.length > 0) {
            const photoUrl = place.photos[0].url || `/api/photo?photoreference=${place.photos[0].photo_reference}&maxwidth=100`;
            placeIcon = `<img src="${photoUrl}" class="float-start me-2 rounded" style="width: 40px; height: 40px; object-fit: cover;" alt="${place.name}" onerror="this.src='https://via.placeholder.com/40?text=...'">`;
          }
          
          // Make each list item a clickable button
          content += `
            <li class="list-group-item p-2 mb-1 border-0" style="cursor: pointer" 
                onclick="showPlaceDetails('${place.place_id}'); if(hoverInfoWindow) hoverInfoWindow.close();">
              <div class="d-flex align-items-center">
                ${placeIcon}
                <div>
                  <strong>${place.name}</strong><br>
                  ${rating} ${place.user_ratings_total ? `<small>(${place.user_ratings_total})</small>` : ''}
                </div>
              </div>
            </li>
          `;
        });
        
        content += '</ul>';
        content += '<div class="text-center"><small class="text-muted">Click on a place to view details</small></div>';
        content += '</div>';
        
        // Update the info window
        hoverInfoWindow.setContent(content);
      } else {
        // No places found or error
        hoverInfoWindow.setContent(`<div class="p-2">No ${formatPlaceType(currentPlaceType)}s found in this area</div>`);
      }
    });
  }, 500); // Wait 500ms before searching
}

// Show loading indicator
function showLoading() {
  document.getElementById('loading-indicator').classList.remove('d-none');
}

// Hide loading indicator
function hideLoading() {
  document.getElementById('loading-indicator').classList.add('d-none');
}

// Initialize photo carousel
function initPhotoCarousel() {
  // We're now using Bootstrap's built-in carousel functionality
  const carousel = document.getElementById('place-photos');
  const counter = document.getElementById('photo-counter');
  const thumbnails = document.querySelectorAll('.thumbnail');
  const photos = window.currentPlacePhotos || [];
  
  if (!photos || photos.length <= 1 || !carousel) return;
  
  // Initialize Bootstrap carousel
  const carouselInstance = new bootstrap.Carousel(carousel, {
    interval: false, // Don't auto-rotate
    wrap: true       // Allow wrapping
  });
  
  // Update counter when carousel slides
  carousel.addEventListener('slid.bs.carousel', (event) => {
    const activeIndex = [...carousel.querySelectorAll('.carousel-item')].findIndex(
      item => item.classList.contains('active')
    );
    
    // Update counter
    if (counter) {
      counter.textContent = `${activeIndex + 1} / ${photos.length}`;
    }
    
    // Update thumbnails
    thumbnails.forEach((thumb, idx) => {
      if (idx === activeIndex) {
        thumb.classList.add('active');
      } else {
        thumb.classList.remove('active');
      }
    });
  });
  
  // Thumbnail clicks
  thumbnails.forEach((thumb, idx) => {
    thumb.addEventListener('click', () => {
      carouselInstance.to(idx);
    });
  });
}

// Initialize reviews carousel
function initReviewsCarousel() {
  // Get carousel elements
  const carousel = document.querySelector('.reviews-carousel');
  if (!carousel) return;
  
  const slides = carousel.querySelectorAll('.reviews-slide');
  const prevBtn = carousel.querySelector('.reviews-prev');
  const nextBtn = carousel.querySelector('.reviews-next');
  const counter = carousel.querySelector('.reviews-counter');
  
  // Store current index
  let currentIndex = 0;
  const reviews = window.currentPlaceReviews || [];
  
  if (!reviews || reviews.length <= 1 || slides.length <= 1) return;
  
  // Function to update reviews carousel display
  function updateReviewsCarousel() {
    // Hide all slides
    slides.forEach(slide => {
      slide.classList.remove('active');
    });
    
    // Show current slide
    slides[currentIndex].classList.add('active');
    
    // Update counter if present
    if (counter) {
      const currentCounterElement = counter.querySelector('.current-review');
      if (currentCounterElement) {
        currentCounterElement.textContent = currentIndex + 1;
      }
    }
  }
  
  // Previous button click
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      updateReviewsCarousel();
    });
  }
  
  // Next button click
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % slides.length;
      updateReviewsCarousel();
    });
  }
}