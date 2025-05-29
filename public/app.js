/**
 * Shared utility for filtering places based on radius, rating, and unwanted types
 * @param {Array} places - The array of place objects to filter
 * @param {Object} origin - The origin location with lat and lng properties
 * @param {Object} options - Optional configuration for filtering
 * @returns {Array} - Filtered and sorted places
 */
function filterAndSortPlaces(places, origin, options = {}) {
  const {
    radius = 1500,
    minRating = 4.0,
    minReviews = 20,
    unwantedTypes = []
  } = options;

  const filteredPlaces = places.filter(place => {
    // Skip places without geometry
    if (!place.geometry || !place.geometry.location) return false;
    
    // Check if this place has unwanted business types
    if (unwantedTypes.length > 0 && place.types) {
      for (const unwantedType of unwantedTypes) {
        if (place.types.includes(unwantedType)) {
          console.log(`Filtering out ${place.name} because it's a ${unwantedType}`);
          return false;
        }
      }
    }
    
    // Skip places with insufficient reviews for statistical significance
    if (place.user_ratings_total < minReviews) {
      console.log(`Filtering out ${place.name} because it only has ${place.user_ratings_total} reviews (minimum: ${minReviews})`);
      return false;
    }
    
    // Skip places with lower ratings
    if (place.rating < minRating) {
      console.log(`Filtering out ${place.name} because its rating is only ${place.rating} (minimum: ${minRating})`);
      return false;
    }
    
    // Skip places too far away
    const placeLocation = place.geometry.location;
    const distance = getDistanceInMeters(
      origin.lat, 
      origin.lng, 
      placeLocation.lat || placeLocation.latitude, 
      placeLocation.lng || placeLocation.longitude
    );
    
    if (distance > radius) {
      console.log(`Filtering out ${place.name} because it's ${Math.round(distance)}m away (radius: ${radius}m)`);
      return false;
    }
    
    return true;
  });
  
  // Sort by rating (highest first), with a small boost for those closer to the user
  return filteredPlaces.sort((a, b) => {
    const locationA = a.geometry.location;
    const locationB = b.geometry.location;
    
    const distanceA = getDistanceInMeters(
      origin.lat, 
      origin.lng, 
      locationA.lat || locationA.latitude, 
      locationA.lng || locationA.longitude
    );
    
    const distanceB = getDistanceInMeters(
      origin.lat, 
      origin.lng, 
      locationB.lat || locationB.latitude, 
      locationB.lng || locationB.longitude
    );
    
    // Rating difference has more weight than distance
    // This gives a slight advantage to closer places when ratings are very close
    const ratingDiff = (b.rating - a.rating) * 10;
    const distanceFactor = (distanceA - distanceB) / 100;
    
    return ratingDiff + distanceFactor;
  });
}

function toggleDarkMode(enabled) {
  const body = document.body;
  
  if (enabled) {
    body.classList.add('dark-mode');
    // Apply dark mode map style if map is initialized
    if (window.map) {
      window.map.setOptions({
        styles: [
          { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
          {
            featureType: "administrative.locality",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
          },
          {
            featureType: "poi",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
          },
          {
            featureType: "poi.park",
            elementType: "geometry",
            stylers: [{ color: "#263c3f" }],
          },
          {
            featureType: "poi.park",
            elementType: "labels.text.fill",
            stylers: [{ color: "#6b9a76" }],
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#38414e" }],
          },
          {
            featureType: "road",
            elementType: "geometry.stroke",
            stylers: [{ color: "#212a37" }],
          },
          {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9ca5b3" }],
          },
          {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ color: "#746855" }],
          },
          {
            featureType: "road.highway",
            elementType: "geometry.stroke",
            stylers: [{ color: "#1f2835" }],
          },
          {
            featureType: "road.highway",
            elementType: "labels.text.fill",
            stylers: [{ color: "#f3d19c" }],
          },
          {
            featureType: "transit",
            elementType: "geometry",
            stylers: [{ color: "#2f3948" }],
          },
          {
            featureType: "transit.station",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#17263c" }],
          },
          {
            featureType: "water",
            elementType: "labels.text.fill",
            stylers: [{ color: "#515c6d" }],
          },
          {
            featureType: "water",
            elementType: "labels.text.stroke",
            stylers: [{ color: "#17263c" }],
          },
        ]
      });
    }
    
    // Update weather widget appearance
    const weatherWidget = document.getElementById('weather-widget');
    if (weatherWidget) {
      weatherWidget.classList.add('dark-mode');
    }
  } else {
    body.classList.remove('dark-mode');
    // Reset to default map style
    if (window.map) {
      window.map.setOptions({
        styles: []
      });
    }
    
    // Update weather widget appearance
    const weatherWidget = document.getElementById('weather-widget');
    if (weatherWidget) {
      weatherWidget.classList.remove('dark-mode');
    }
  }
}

// Initialize the map when the page loads
function initMap() {
  console.log("Initializing map...");
  // Default center location (Amsterdam)
  const defaultCenter = { lat: 52.3676, lng: 4.9041 };
  
  // Find the map element and make sure it exists
  const mapElement = document.getElementById("map");
  if (!mapElement) {
    console.error("Map element not found!");
    return;
  }
  
  // Create the map with minimal configuration to ensure it works
  window.map = new google.maps.Map(mapElement, {
    zoom: 12,
    center: defaultCenter,
  });
  
  // Add a marker at the center
  new google.maps.Marker({
    position: defaultCenter,
    map: window.map,
    title: "Amsterdam"
  });
  
  console.log("Map created successfully!");
  
  // Load places for the default location immediately
  loadNearbyPlaces(defaultCenter);
  
  // Add click event to the map
  google.maps.event.addListener(window.map, "click", function(event) {
    const clickedLocation = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    
    // Center the map on the clicked location
    window.map.setCenter(clickedLocation);
    
    // Load nearby places for this location
    loadNearbyPlaces(clickedLocation);
  });
  
  // Detect system dark mode preference
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.getElementById('dark-mode-toggle').checked = prefersDarkMode;
  toggleDarkMode(prefersDarkMode);
  
  // Listen for dark mode toggle changes
  document.getElementById('dark-mode-toggle').addEventListener('change', function(e) {
    toggleDarkMode(e.target.checked);
  });
  
  // Set up event listeners for UI elements
  document.getElementById("use-location-button").addEventListener("click", useMyLocation);
  document.getElementById("search-button").addEventListener("click", searchLocation);
  document.getElementById("location-input").addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
      searchLocation();
    }
  });
  
  // Set up place type filter events
  document.getElementById("place-type-select").addEventListener("change", function() {
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    
    // Get the search input value
    const searchInput = document.getElementById("search-input").value.trim();
    
    // If there's a search term, use it as a keyword
    if (searchInput) {
      loadNearbyPlaces(location, searchInput);
    } else {
      loadNearbyPlaces(location);
    }
  });
  
  // Set up the open now checkbox event
  document.getElementById("open-now-checkbox").addEventListener("change", function() {
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    
    // Get the search input value
    const searchInput = document.getElementById("search-input").value.trim();
    
    // If there's a search term, use it as a keyword
    if (searchInput) {
      loadNearbyPlaces(location, searchInput);
    } else {
      loadNearbyPlaces(location);
    }
  });
  
  // Set up event listeners for category buttons
  document.getElementById("restaurants-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "restaurant";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location);
  });
  
  document.getElementById("hotels-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "lodging";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location);
  });
  
  document.getElementById("attractions-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "tourist_attraction";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location);
  });
  
  document.getElementById("coffee-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "cafe";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location);
  });
  
  document.getElementById("dessert-button").addEventListener("click", function() {
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    // Pass 'dessert' as the keyword to trigger special dessert search behavior
    loadNearbyPlaces(location, 'dessert');
  });
  
  document.getElementById("nightlife-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "night_club";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location);
  });
}

// Use the user's current location
function useMyLocation() {
  if (navigator.geolocation) {
    // Show a loading indicator
    showLoading();
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        // Center the map on the user's location
        window.map.setCenter(userLocation);
        
        // Add a marker at the user's location
        new google.maps.Marker({
          position: userLocation,
          map: window.map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          title: "Your Location",
        });
        
        // Load nearby places
        loadNearbyPlaces(userLocation);
      },
      (error) => {
        console.error("Error getting user location:", error);
        useDefaultLocation("We couldn't get your location: " + error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  } else {
    useDefaultLocation("Geolocation is not supported by your browser");
  }
  
  function useDefaultLocation(reason) {
    console.warn(reason);
    alert(reason + ". Using default location (Amsterdam).");
    
    // Default location (Amsterdam)
    const defaultLocation = { lat: 52.3676, lng: 4.9041 };
    
    // Center the map on the default location
    window.map.setCenter(defaultLocation);
    
    // Load nearby places for the default location
    loadNearbyPlaces(defaultLocation);
  }
}

// Search for a location by name
async function searchLocation() {
  const searchInput = document.getElementById("location-input").value.trim();
  
  if (!searchInput) {
    alert("Please enter a location to search");
    return;
  }
  
  showLoading();
  
  try {
    // First try to use the search term as a direct place search
    const specificPlaceResult = await searchForSpecificPlace(searchInput);
    
    if (specificPlaceResult && specificPlaceResult.geometry) {
      // We found a specific place!
      const placeLocation = {
        lat: specificPlaceResult.geometry.location.lat,
        lng: specificPlaceResult.geometry.location.lng
      };
      
      // Center the map on this place
      window.map.setCenter(placeLocation);
      window.map.setZoom(16); // Closer zoom for a specific place
      
      // Load nearby places around this specific place
      loadNearbyPlaces(placeLocation);
      
      // Show this place's details
      if (specificPlaceResult.place_id) {
        showPlaceDetails(specificPlaceResult.place_id);
      }
      
      return;
    }
    
    // If no specific place found, try geocoding the search term as an address/location
    const response = await fetch(`/api/geocode?address=${encodeURIComponent(searchInput)}`);
    const data = await response.json();
    
    if (data.status === "OK" && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      
      // Center the map on the geocoded location
      window.map.setCenter(location);
      
      // Adjust zoom level based on the result type
      if (data.results[0].geometry.viewport) {
        window.map.fitBounds({
          east: data.results[0].geometry.viewport.northeast.lng,
          north: data.results[0].geometry.viewport.northeast.lat,
          west: data.results[0].geometry.viewport.southwest.lng,
          south: data.results[0].geometry.viewport.southwest.lat
        });
      } else {
        window.map.setZoom(14);
      }
      
      // Load nearby places for this location
      loadNearbyPlaces(location);
    } else {
      alert("Location not found. Please try a different search term.");
      hideLoading();
    }
  } catch (error) {
    console.error("Error searching for location:", error);
    alert('Error searching for location. Please try again or click directly on the map.');
  }
}

// Load nearby places from our API endpoint
async function loadNearbyPlaces(location, keyword = '', radius = 1500) {
  showLoading();
  
  // Fetch weather data for this location
  fetchWeatherData(location);
  
  // Clear existing markers
  clearMarkers();
  
  try {
    // Check if the "Open Now" checkbox is checked
    const openNowChecked = document.getElementById('open-now-checkbox').checked;
    
    // Check if this is a dessert search by keyword
    const isDessertSearch = keyword === 'dessert';
    
    // Collection to store unique places when performing multi-query search
    let placesMap = new Map();
    let places = [];
    
    if (isDessertSearch) {
      console.log("Performing specialized dessert multi-query search");
      // Multi-query approach for dessert places
      
      // First search specifically for dessert places
      let dessertApiUrl = `/api/nearby?lat=${location.lat}&lng=${location.lng}&type=restaurant&keyword=dessert&radius=${radius}`;
      
      if (openNowChecked) {
        dessertApiUrl += '&opennow=true';
      }
      
      const dessertResponse = await fetch(dessertApiUrl);
      const dessertData = await dessertResponse.json();
      
      console.log("Dessert API response:", dessertData);
      
      if (dessertData.status === 'OK' && dessertData.results && dessertData.results.length > 0) {
        // Add dessert places to our collection
        dessertData.results.forEach(place => {
          placesMap.set(place.place_id, place);
        });
      }
      
      // Also search for cafes since many serve desserts
      let cafeApiUrl = `/api/nearby?lat=${location.lat}&lng=${location.lng}&type=cafe&radius=${radius}`;
      
      if (openNowChecked) {
        cafeApiUrl += '&opennow=true';
      }
      
      const cafeResponse = await fetch(cafeApiUrl);
      const cafeData = await cafeResponse.json();
      
      console.log("Cafe API response for desserts:", cafeData);
      
      if (cafeData.status === 'OK' && cafeData.results && cafeData.results.length > 0) {
        // Add cafes to our collection
        cafeData.results.forEach(place => {
          placesMap.set(place.place_id, place);
        });
      }
      
      // Also search for bakeries
      let bakeryApiUrl = `/api/nearby?lat=${location.lat}&lng=${location.lng}&type=bakery&radius=${radius}`;
      
      if (openNowChecked) {
        bakeryApiUrl += '&opennow=true';
      }
      
      const bakeryResponse = await fetch(bakeryApiUrl);
      const bakeryData = await bakeryResponse.json();
      
      console.log("Bakery API response for desserts:", bakeryData);
      
      if (bakeryData.status === 'OK' && bakeryData.results && bakeryData.results.length > 0) {
        // Add bakeries to our collection
        bakeryData.results.forEach(place => {
          placesMap.set(place.place_id, place);
        });
      }
      
      // Convert our Map back to an array
      places = Array.from(placesMap.values());
      console.log(`Combined ${places.length} unique dessert places`);
      
      // For dessert places, we would normally use a lower minimum rating threshold
      // But this is handled in the renderPlaces function
      
      renderPlaces(places, location, "restaurant", true);
    } else {
      // Regular search for other place types
      // Get the currently selected place type
      const placeTypeSelect = document.getElementById('place-type-select');
      const currentPlaceType = placeTypeSelect ? placeTypeSelect.value : 'restaurant';
      
      console.log(`Searching for places of type: ${currentPlaceType}`);
      
      // Build API URL with required parameters
      let apiUrl = `/api/nearby?lat=${location.lat}&lng=${location.lng}&type=${currentPlaceType}&radius=${radius}`;
      
      // Add keyword if provided and it's not the dessert keyword (handled separately above)
      if (keyword && !isDessertSearch) {
        apiUrl += `&keyword=${encodeURIComponent(keyword)}`;
      }
      
      // Add the opennow parameter if checked
      if (openNowChecked) {
        apiUrl += '&opennow=true';
        console.log('Filtering for places open now');
      }
      
      // Call our backend API to get nearby places
      console.log('Fetching nearby places with URL:', apiUrl);
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      console.log("Nearby places API response:", data);
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        renderPlaces(data.results, location, currentPlaceType);
      } else if (data.status === 'REQUEST_DENIED') {
        // API key issue
        console.error("API request denied:", data.error_message || "No error details available");
        document.getElementById('places-container').innerHTML = `
          <div class="col-12">
            <div class="alert alert-warning">
              <strong>API Request Denied</strong>
              <p>There was an issue with the API request: ${data.error_message || "Unknown error"}</p>
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
    }
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    document.getElementById('places-container').innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">Error fetching places. Please try again later.</div>
      </div>
    `;
  } finally {
    hideLoading();
  }
}

// Render place cards
function renderPlaces(places, origin, currentPlaceType, isDessertSearch = false) {
  const container = document.getElementById('places-container');
  container.innerHTML = '';
  
  // Minimum required reviews for statistical significance
  // Different minimum reviews based on place type
  const MIN_REVIEWS = {
    restaurant: 20,
    lodging: 8,
    night_club: 10,
    supermarket: 5,
    default: 10
  };
  const currentMinReviews = MIN_REVIEWS[currentPlaceType] || MIN_REVIEWS.default;
  
  // Minimum rating to show (different minimum ratings based on place type)
  let MIN_RATING;
  if (currentPlaceType === 'restaurant') {
    MIN_RATING = 4.0;
  } else if (currentPlaceType === 'night_club') {
    MIN_RATING = 3.7; // Lower threshold for nightclubs
  } else if (currentPlaceType === 'supermarket') {
    MIN_RATING = 3.5; // Lower threshold for supermarkets
  } else {
    MIN_RATING = 3.8; // Default threshold for other places
  }
  
  // For dessert searches, lower the threshold slightly
  if (isDessertSearch) {
    MIN_RATING = 3.7;
  }
  
  console.log(`Filtering with minimum rating of ${MIN_RATING} for ${isDessertSearch ? 'desserts' : currentPlaceType}`);
  
  // Define unwanted business types
  const UNWANTED_TYPES = [
    "gas_station", 
    "convenience_store", 
    "car_repair", 
    "car_wash",
    "car_dealer"
  ];
  
  // Use our shared utility function to filter and sort places
  const filteredPlaces = filterAndSortPlaces(places, origin, {
    radius: 1500,
    minRating: MIN_RATING,
    minReviews: currentMinReviews,
    unwantedTypes: UNWANTED_TYPES
  });
  
  console.log(`After filtering: ${filteredPlaces.length} of ${places.length} places remaining`);
  
  // Clear markers before adding new ones
  clearMarkers();
  
  if (filteredPlaces.length === 0) {
    // Show a message if no places meet the criteria
    const messageText = isDessertSearch ? 
      `No dessert places found matching your criteria` : 
      `No places found matching your criteria`;
      
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">
          <strong>${messageText}</strong>
          <p>No ${formatPlaceType(currentPlaceType)}${isDessertSearch ? ' serving desserts' : ''} with a rating of ${MIN_RATING}+ found in this area.</p>
          <p>Try another location or category, or adjust the search radius.</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Display filtered and sorted places
  filteredPlaces.forEach((place, index) => {
    const card = createPlaceCard(place, index);
    container.appendChild(card);
    
    // Add a marker for this place
    addMarker(place, index);
  });
}

// Create a card for a place
function createPlaceCard(place, index) {
  const card = document.createElement('div');
  card.className = 'col-md-6 col-lg-4 mb-4';
  
  // Format the price level
  let priceLevel = '';
  if (place.price_level) {
    for (let i = 0; i < place.price_level; i++) {
      priceLevel += '$';
    }
  }
  
  // Check if the place is open now
  let openNowText = '';
  if (place.opening_hours) {
    if (place.opening_hours.open_now) {
      openNowText = '<span class="badge bg-success ms-2">Open Now</span>';
    } else if (place.opening_hours.open_now === false) {
      openNowText = '<span class="badge bg-danger ms-2">Closed</span>';
    }
  }
  
  // Format the rating stars
  let ratingStars = '';
  if (place.rating) {
    // Full stars
    const fullStars = Math.floor(place.rating);
    for (let i = 0; i < fullStars; i++) {
      ratingStars += '<i class="fas fa-star text-warning"></i>';
    }
    
    // Half star if needed
    if (place.rating % 1 >= 0.5) {
      ratingStars += '<i class="fas fa-star-half-alt text-warning"></i>';
    }
    
    // Empty stars
    const emptyStars = 5 - Math.ceil(place.rating);
    for (let i = 0; i < emptyStars; i++) {
      ratingStars += '<i class="far fa-star text-warning"></i>';
    }
  }
  
  // Format place types for display
  let typesBadges = '';
  if (place.types && place.types.length > 0) {
    const displayTypes = place.types
      .filter(type => !['point_of_interest', 'establishment'].includes(type))
      .slice(0, 3);
    
    displayTypes.forEach(type => {
      typesBadges += `<span class="badge bg-secondary me-1">${formatPlaceType(type)}</span>`;
    });
  }
  
  // Create the card HTML
  card.innerHTML = `
    <div class="card h-100">
      <div class="card-body">
        <h5 class="card-title">
          ${index + 1}. ${place.name}
          ${openNowText}
        </h5>
        <p class="card-text">
          <small class="text-muted">${place.vicinity || place.formatted_address || ''}</small>
        </p>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="rating">
            ${ratingStars}
            <span class="ms-1">${place.rating}</span>
            <small class="text-muted ms-1">(${place.user_ratings_total})</small>
          </div>
          <div class="price">
            <strong>${priceLevel}</strong>
          </div>
        </div>
        <div class="mb-3">
          ${typesBadges}
        </div>
        <button class="btn btn-primary btn-sm view-details-btn" 
          data-place-id="${place.place_id}" 
          onclick="showPlaceDetails('${place.place_id}')">
          View Details
        </button>
        <button class="btn btn-outline-secondary btn-sm ms-2" 
          onmouseover="updateHoverMarker({lat: ${place.geometry.location.lat}, lng: ${place.geometry.location.lng}})">
          <i class="fas fa-map-marker-alt"></i>
        </button>
      </div>
    </div>
  `;
  
  return card;
}

// Calculate string similarity (for fuzzy matching)
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Convert to lowercase
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Check for exact match or contains
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Calculate Levenshtein distance
  const len1 = s1.length;
  const len2 = s2.length;
  
  // Create distance matrix
  const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  // The Levenshtein distance
  const distance = matrix[len1][len2];
  
  // Normalize the result (0 to 1, where 1 is perfect match)
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1; // Both strings are empty
  
  return 1 - (distance / maxLen);
}

// Fetch TripAdvisor data for a place
async function fetchTripAdvisorData(place) {
  try {
    const placeName = encodeURIComponent(place.name);
    const placeLocation = encodeURIComponent(place.vicinity || '');
    
    const response = await fetch(`/api/tripadvisor?place_name=${placeName}&location=${placeLocation}`);
    const data = await response.json();
    
    console.log("TripAdvisor API response:", data);
    
    if (data && data.status === 'success' && data.data) {
      return data.data;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching TripAdvisor data:", error);
    return null;
  }
}

// Global array to keep track of markers
window.markers = [];

// Add a marker for a place
function addMarker(place, index) {
  if (!place.geometry || !place.geometry.location) return;
  
  const position = {
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng
  };
  
  // Create marker with label
  const marker = new google.maps.Marker({
    position: position,
    map: window.map,
    title: place.name,
    label: {
      text: (index + 1).toString(),
      color: 'white'
    },
    animation: google.maps.Animation.DROP
  });
  
  // Add click event to marker
  marker.addListener("click", () => {
    window.map.setCenter(position);
    window.map.setZoom(16);
    showPlaceDetails(place.place_id);
  });
  
  // Store marker in global array
  window.markers.push(marker);
}

// Clear all markers from the map
function clearMarkers() {
  if (window.markers) {
    for (let marker of window.markers) {
      marker.setMap(null);
    }
  }
  window.markers = [];
  
  // Also clear the hover marker if it exists
  if (window.hoverMarker) {
    window.hoverMarker.setMap(null);
    window.hoverMarker = null;
  }
}

// Show details for a specific place
async function showPlaceDetails(placeId) {
  showLoading();
  
  try {
    const response = await fetch(`/api/details?place_id=${placeId}`);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      const place = data.result;
      console.log("Place details:", place);
      
      // Get TripAdvisor data if available
      let tripAdvisorData = null;
      try {
        tripAdvisorData = await fetchTripAdvisorData(place);
        console.log("TripAdvisor data:", tripAdvisorData);
      } catch (tripadvisorError) {
        console.error("Error fetching TripAdvisor data:", tripadvisorError);
      }
      
      // Format opening hours
      let hoursHtml = '';
      if (place.opening_hours && place.opening_hours.weekday_text) {
        hoursHtml = '<h5 class="mt-3">Opening Hours</h5><ul class="list-group mb-3">';
        place.opening_hours.weekday_text.forEach(day => {
          hoursHtml += `<li class="list-group-item">${day}</li>`;
        });
        hoursHtml += '</ul>';
      }
      
      // Format reviews
      let reviewsHtml = '';
      if (place.reviews && place.reviews.length > 0) {
        reviewsHtml = '<h5 class="mt-3">Reviews</h5><div class="reviews-carousel mb-3">';
        place.reviews.forEach(review => {
          const reviewDate = new Date(review.time * 1000).toLocaleDateString();
          reviewsHtml += `
            <div class="review-card">
              <div class="d-flex align-items-center mb-2">
                <img src="${review.profile_photo_url}" alt="${review.author_name}" class="review-avatar me-2">
                <div>
                  <strong>${review.author_name}</strong>
                  <div>
                    ${Array(Math.round(review.rating)).fill('<i class="fas fa-star text-warning"></i>').join('')}
                    <small class="text-muted ms-2">${reviewDate}</small>
                  </div>
                </div>
              </div>
              <p>${review.text}</p>
            </div>
          `;
        });
        reviewsHtml += '</div>';
      }
      
      // Format photos
      let photosHtml = '';
      if (place.photos && place.photos.length > 0) {
        photosHtml = '<h5 class="mt-3">Photos</h5><div class="photo-carousel mb-3">';
        place.photos.forEach(photo => {
          const photoUrl = photo.photo_reference ? 
            `/api/photo?photo_reference=${photo.photo_reference}&maxwidth=400` : 
            'https://via.placeholder.com/400x300?text=No+Image';
          
          photosHtml += `
            <div class="photo-item">
              <img src="${photoUrl}" alt="${place.name}" class="img-fluid rounded">
            </div>
          `;
        });
        photosHtml += '</div>';
      }
      
      // TripAdvisor data section
      let tripAdvisorHtml = '';
      if (tripAdvisorData) {
        tripAdvisorHtml = `
          <div class="tripadvisor-section mt-3">
            <h5>TripAdvisor Information</h5>
            <div class="card mb-3">
              <div class="card-body">
                ${tripAdvisorData.rating ? `
                  <div class="d-flex align-items-center mb-2">
                    <span class="me-2">TripAdvisor Rating:</span>
                    <strong class="me-1">${tripAdvisorData.rating}</strong>
                    ${Array(Math.round(tripAdvisorData.rating)).fill('<i class="fas fa-star text-warning"></i>').join('')}
                    <small class="text-muted ms-2">(${tripAdvisorData.review_count || 0} reviews)</small>
                  </div>
                ` : ''}
                
                ${tripAdvisorData.price_range ? `
                  <div class="mb-2">
                    <span>Price Range: <strong>${tripAdvisorData.price_range}</strong></span>
                  </div>
                ` : ''}
                
                ${tripAdvisorData.cuisine ? `
                  <div class="mb-2">
                    <span>Cuisine: <strong>${tripAdvisorData.cuisine}</strong></span>
                  </div>
                ` : ''}
                
                ${tripAdvisorData.website ? `
                  <div class="mb-2">
                    <a href="${tripAdvisorData.website}" target="_blank" class="btn btn-sm btn-outline-primary">
                      <i class="fas fa-globe me-1"></i> Visit Website
                    </a>
                  </div>
                ` : ''}
                
                ${tripAdvisorData.tripadvisor_url ? `
                  <div>
                    <a href="${tripAdvisorData.tripadvisor_url}" target="_blank" class="btn btn-sm btn-outline-secondary">
                      <i class="fab fa-tripadvisor me-1"></i> TripAdvisor Page
                    </a>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }
      
      // Nearby recommendations section
      let recommendationsHtml = '';
      recommendationsHtml = `
        <div class="mt-4">
          <h5>Nearby Recommendations</h5>
          <div id="recommendations-container" class="row">
            <div class="col-12 loading">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <span class="ms-2">Loading recommendations...</span>
            </div>
          </div>
        </div>
      `;
      
      // Create modal content
      const modalHtml = `
        <div class="modal fade" id="placeDetailsModal" tabindex="-1" aria-labelledby="placeDetailsModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="placeDetailsModalLabel">${place.name}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <p class="text-muted">${place.vicinity || place.formatted_address || ''}</p>
                    ${place.rating ? `
                      <div class="rating mb-2">
                        ${Array(Math.round(place.rating)).fill('<i class="fas fa-star text-warning"></i>').join('')}
                        <span class="ms-1">${place.rating}</span>
                        <small class="text-muted ms-1">(${place.user_ratings_total} reviews)</small>
                      </div>
                    ` : ''}
                    ${place.price_level ? `
                      <div class="price mb-2">
                        <strong>${'$'.repeat(place.price_level)}</strong>
                      </div>
                    ` : ''}
                    ${place.website ? `
                      <div class="mb-2">
                        <a href="${place.website}" target="_blank" class="btn btn-sm btn-outline-primary">
                          <i class="fas fa-globe me-1"></i> Visit Website
                        </a>
                      </div>
                    ` : ''}
                  </div>
                  <div>
                    ${place.formatted_phone_number ? `
                      <div class="mb-2">
                        <a href="tel:${place.formatted_phone_number}" class="btn btn-sm btn-outline-success">
                          <i class="fas fa-phone me-1"></i> ${place.formatted_phone_number}
                        </a>
                      </div>
                    ` : ''}
                    ${place.url ? `
                      <div>
                        <a href="${place.url}" target="_blank" class="btn btn-sm btn-outline-secondary">
                          <i class="fas fa-map-marked-alt me-1"></i> Google Maps
                        </a>
                      </div>
                    ` : ''}
                  </div>
                </div>
                
                ${photosHtml}
                ${tripAdvisorHtml}
                ${hoursHtml}
                ${reviewsHtml}
                ${recommendationsHtml}
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" onclick="window.map.setCenter({lat: ${place.geometry.location.lat}, lng: ${place.geometry.location.lng}})">
                  <i class="fas fa-map-marker-alt me-1"></i> Show on Map
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Remove any existing modal
      const existingModal = document.getElementById('placeDetailsModal');
      if (existingModal) {
        existingModal.remove();
      }
      
      // Add modal to the document
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      // Show the modal
      const modal = new bootstrap.Modal(document.getElementById('placeDetailsModal'));
      modal.show();
      
      // Initialize photo carousel once the modal is shown
      document.getElementById('placeDetailsModal').addEventListener('shown.bs.modal', function () {
        if (place.photos && place.photos.length > 0) {
          $('.photo-carousel').slick({
            dots: true,
            infinite: true,
            speed: 500,
            slidesToShow: 1,
            slidesToScroll: 1,
            autoplay: true,
            autoplaySpeed: 3000
          });
        }
        
        // Initialize reviews carousel
        if (place.reviews && place.reviews.length > 0) {
          initReviewsCarousel();
        }
        
        // Load nearby recommendations
        if (place.geometry && place.geometry.location) {
          const placeLocation = {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng
          };
          loadNearbyRecommendations(place);
        }
      });
    } else {
      alert("Could not load place details. Please try again.");
    }
  } catch (error) {
    console.error("Error fetching place details:", error);
    alert("Error loading place details. Please try again later.");
  } finally {
    hideLoading();
  }
}

// Load nearby recommendations based on a place
async function loadNearbyRecommendations(place) {
  try {
    const placeLocation = {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng
    };
    
    // Determine what kind of place this is to make better recommendations
    let recommendationType = 'restaurant'; // Default
    
    if (place.types) {
      // Check for common place types and adjust recommendations accordingly
      if (place.types.includes('restaurant') || place.types.includes('cafe') || 
          place.types.includes('bakery') || place.types.includes('bar')) {
        // For food places, recommend more food places
        recommendationType = 'restaurant';
      } else if (place.types.includes('lodging') || place.types.includes('hotel')) {
        // For hotels, recommend attractions and restaurants
        recommendationType = Math.random() > 0.5 ? 'restaurant' : 'tourist_attraction';
      } else if (place.types.includes('museum') || place.types.includes('tourist_attraction') ||
                place.types.includes('art_gallery')) {
        // For attractions, recommend other attractions or restaurants
        recommendationType = Math.random() > 0.4 ? 'tourist_attraction' : 'restaurant';
      } else if (place.types.includes('night_club') || place.types.includes('bar')) {
        // For nightlife, recommend other nightlife spots
        recommendationType = 'night_club';
      } else {
        // For other places, recommend a mix
        const types = ['restaurant', 'tourist_attraction', 'cafe'];
        recommendationType = types[Math.floor(Math.random() * types.length)];
      }
    }
    
    // Build API URL for nearby places of the recommendation type
    const apiUrl = `/api/nearby?lat=${placeLocation.lat}&lng=${placeLocation.lng}&type=${recommendationType}&radius=500`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    const recommendationsContainer = document.getElementById('recommendations-container');
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Filter out the current place and get up to 3 other places
      const otherPlaces = data.results
        .filter(p => p.place_id !== place.place_id)
        .slice(0, 3);
      
      if (otherPlaces.length > 0) {
        recommendationsContainer.innerHTML = '';
        
        otherPlaces.forEach(recommendation => {
          const card = document.createElement('div');
          card.className = 'col-md-4 mb-3';
          
          // Format the price level
          let priceLevel = '';
          if (recommendation.price_level) {
            for (let i = 0; i < recommendation.price_level; i++) {
              priceLevel += '$';
            }
          }
          
          // Format rating stars
          let ratingStars = '';
          if (recommendation.rating) {
            const fullStars = Math.floor(recommendation.rating);
            for (let i = 0; i < fullStars; i++) {
              ratingStars += '<i class="fas fa-star text-warning"></i>';
            }
            
            if (recommendation.rating % 1 >= 0.5) {
              ratingStars += '<i class="fas fa-star-half-alt text-warning"></i>';
            }
          }
          
          card.innerHTML = `
            <div class="card h-100">
              <div class="card-body">
                <h6 class="card-title">${recommendation.name}</h6>
                <small class="text-muted">${recommendation.vicinity || ''}</small>
                <div class="mt-2">
                  ${ratingStars}
                  <small class="ms-1">${recommendation.rating || 'No rating'}</small>
                </div>
                <div class="mt-2">
                  <strong>${priceLevel}</strong>
                </div>
                <button class="btn btn-outline-primary btn-sm mt-2" onclick="showPlaceDetails('${recommendation.place_id}')">
                  View Details
                </button>
              </div>
            </div>
          `;
          
          recommendationsContainer.appendChild(card);
        });
      } else {
        recommendationsContainer.innerHTML = `
          <div class="col-12">
            <div class="alert alert-info">No nearby recommendations found.</div>
          </div>
        `;
      }
    } else {
      recommendationsContainer.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">No nearby recommendations found.</div>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error loading recommendations:", error);
    document.getElementById('recommendations-container').innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">Error loading recommendations. Please try again later.</div>
      </div>
    `;
  }
}

// Format a place type for display
function formatPlaceType(type) {
  if (!type) return '';
  
  // Special cases
  const specialCases = {
    'lodging': 'Hotel',
    'establishment': 'Business',
    'health': 'Health & Fitness',
    'restaurant': 'Restaurant',
    'cafe': 'Café',
    'food': 'Food',
    'point_of_interest': 'Attraction',
    'tourist_attraction': 'Tourist Attraction',
    'store': 'Shop',
    'bar': 'Bar',
    'bakery': 'Bakery',
    'amusement_park': 'Amusement Park',
    'night_club': 'Nightclub',
    'shopping_mall': 'Shopping Mall',
    'zoo': 'Zoo',
    'aquarium': 'Aquarium',
    'supermarket': 'Supermarket',
    'convenience_store': 'Convenience Store',
    'park': 'Park',
    'museum': 'Museum',
    'art_gallery': 'Art Gallery',
    'movie_theater': 'Cinema',
    'spa': 'Spa'
  };
  
  // Return special case or format the type string
  return specialCases[type] || type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Search for a specific place by name
async function searchForSpecificPlace(placeName) {
  try {
    const encodedName = encodeURIComponent(placeName);
    const response = await fetch(`/api/search?query=${encodedName}`);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      console.log(`Found ${data.results.length} places matching "${placeName}"`);
      
      // Return the first result
      return data.results[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error searching for specific place:', error);
    return null;
  }
}

// Debounce function to limit the frequency of function calls
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
  // Remove existing hover marker
  if (window.hoverMarker) {
    window.hoverMarker.setMap(null);
  }
  
  // Create a new hover marker
  window.hoverMarker = new google.maps.Marker({
    position: location,
    map: window.map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#FF4081",
      fillOpacity: 0.8,
      strokeColor: "#FFFFFF",
      strokeWeight: 2
    },
    zIndex: 999  // Make sure it appears above other markers
  });
  
  // Animate the marker
  window.hoverMarker.setAnimation(google.maps.Animation.BOUNCE);
  
  // Stop animation after a short time
  setTimeout(() => {
    if (window.hoverMarker) {
      window.hoverMarker.setAnimation(null);
    }
  }, 1500);
}

// Search for places nearby the hover location
function searchNearbyOnHover(location) {
  // Clear the current hover timeout
  if (window.hoverSearchTimeout) {
    clearTimeout(window.hoverSearchTimeout);
  }
  
  // Set a new timeout to search after a delay
  window.hoverSearchTimeout = setTimeout(() => {
    // Only search if the hover marker is still visible
    if (window.hoverMarker && window.hoverMarker.getMap()) {
      loadNearbyPlaces(location);
    }
  }, 1000);
}

// Show loading indicator
function showLoading() {
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "flex";
  }
}

// Hide loading indicator
function hideLoading() {
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "none";
  }
}

/**
 * Fetch weather data for a specific location
 * @param {Object} location - Location coordinates {lat, lng}
 */
async function fetchWeatherData(location) {
  try {
    const response = await fetch(`/api/weather?lat=${location.lat}&lng=${location.lng}`);
    const data = await response.json();
    
    if (data && data.status === 'success') {
      displayWeatherData(data);
    } else {
      console.error("Weather API error:", data.message || "Unknown error");
      // Clear weather display on error
      document.getElementById('weather-widget').innerHTML = '';
    }
  } catch (error) {
    console.error("Error fetching weather data:", error);
    // Clear weather display on error
    document.getElementById('weather-widget').innerHTML = '';
  }
}

/**
 * Display weather data in the UI
 * @param {Object} data - Weather data
 */
function displayWeatherData(data) {
  const weatherWidget = document.getElementById('weather-widget');
  
  if (!weatherWidget) return;
  
  if (!data || !data.current) {
    weatherWidget.innerHTML = '';
    return;
  }
  
  const current = data.current;
  const forecast = data.forecast || [];
  
  // Current weather HTML
  let currentWeatherHtml = `
    <div class="current-weather">
      <div class="d-flex align-items-center">
        <img src="${current.icon}" alt="${current.description}" class="weather-icon">
        <div class="ms-3">
          <div class="current-temp">${Math.round(current.temp)}°C</div>
          <div class="weather-description">${current.description}</div>
        </div>
      </div>
      <div class="weather-details mt-2">
        <div><i class="fas fa-tint"></i> ${current.humidity}%</div>
        <div><i class="fas fa-wind"></i> ${current.wind_speed} m/s</div>
      </div>
    </div>
  `;
  
  // Forecast HTML
  let forecastHtml = '';
  if (forecast.length > 0) {
    forecastHtml = '<div class="forecast mt-3"><div class="row">';
    
    // Only show next 3 days
    const displayForecast = forecast.slice(0, 3);
    
    displayForecast.forEach(day => {
      forecastHtml += `
        <div class="col">
          <div class="forecast-day text-center">
            <div class="day-name">${day.day}</div>
            <img src="${day.icon}" alt="${day.description}" class="forecast-icon">
            <div class="forecast-temp">${Math.round(day.max)}° / ${Math.round(day.min)}°</div>
          </div>
        </div>
      `;
    });
    
    forecastHtml += '</div></div>';
  }
  
  // Combine current weather and forecast
  weatherWidget.innerHTML = currentWeatherHtml + forecastHtml;
  
  // Add a dark mode class if dark mode is enabled
  if (document.body.classList.contains('dark-mode')) {
    weatherWidget.classList.add('dark-mode');
  } else {
    weatherWidget.classList.remove('dark-mode');
  }
}

function initReviewsCarousel() {
  updateReviewsCarousel();
  
  // Function to handle window resize and update the carousel
  function updateReviewsCarousel() {
    // Determine how many slides to show based on window width
    let slidesToShow = 1;
    if (window.innerWidth >= 992) {
      slidesToShow = 3; // Large devices
    } else if (window.innerWidth >= 768) {
      slidesToShow = 2; // Medium devices
    }
    
    // Initialize or update the carousel
    if ($('.reviews-carousel').hasClass('slick-initialized')) {
      $('.reviews-carousel').slick('unslick');
    }
    
    $('.reviews-carousel').slick({
      dots: true,
      infinite: true,
      speed: 500,
      slidesToShow: slidesToShow,
      slidesToScroll: 1,
      autoplay: true,
      autoplaySpeed: 4000
    });
  }
  
  // Update carousel when window is resized
  window.addEventListener('resize', debounce(updateReviewsCarousel, 200));
}

// Calculate the distance between two points in meters
function getDistanceInMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180; // Convert to radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
           Math.cos(φ1) * Math.cos(φ2) *
           Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}