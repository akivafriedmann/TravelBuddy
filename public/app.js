// Global variables
let map;
let markers = [];
let currentLocation = { lat: 40.7128, lng: -74.0060 }; // Default New York
let placeModal;
let currentPlaceType = 'restaurant';

// Initialize the map
function initMap() {
  // Create map
  map = new google.maps.Map(document.getElementById('map'), {
    center: currentLocation,
    zoom: 13,
    mapId: "TRAVEL_PLANNER_MAP",
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false
  });
  
  // Initialize modal
  placeModal = new bootstrap.Modal(document.getElementById('place-modal'));
  
  // Initialize Places Service for the map with more fields
  const placesService = new google.maps.places.PlacesService(map);
  
  // Initialize InfoWindow for place clicks
  const infoWindow = new google.maps.InfoWindow();
  
  // Add click listener to the map for any POIs (points of interest)
  map.addListener('click', (event) => {
    // Check if a POI (point of interest) was clicked
    if (event.placeId) {
      // Prevent the default info window from showing
      event.stop();
      
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
  
  try {
    navigator.geolocation.getCurrentPosition(
      position => {
        // Success - we have the location
        currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        console.log("Successfully obtained user location:", currentLocation);
        
        // Update map center
        map.setCenter(currentLocation);
        
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
    
    // *** Allow the user to manually enter a location instead of forcing New York
    // Display a notification that geolocation failed
    const notification = document.createElement('div');
    notification.className = 'alert alert-warning alert-dismissible fade show';
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i> 
      ${reason}. Please enter your location manually.
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
      
      // Focus on the location input to encourage manual entry
      document.getElementById('location-input').focus();
    } catch (e) {
      console.error("Error showing notification:", e);
    }
  }
}

// Search for a location
async function searchLocation() {
  const locationInput = document.getElementById('location-input').value.trim();
  
  if (!locationInput) {
    alert('Please enter a location to search');
    return;
  }
  
  showLoading();
  
  try {
    // Use geocoding to convert address to coordinates
    const geocoder = new google.maps.Geocoder();
    
    // Create geocoding options
    const geocodingOptions = { 
      address: locationInput
    };
    
    geocoder.geocode(geocodingOptions, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        const result = results[0];
        const location = result.geometry.location;
        
        currentLocation = {
          lat: location.lat(),
          lng: location.lng()
        };
        
        // Update map center
        map.setCenter(currentLocation);
        
        // Determine if this is a specific locality/neighborhood by checking the result types
        const isSpecificArea = results[0].types.some(type => 
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
        alert('Location not found. Please try another search term.');
      }
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    hideLoading();
    alert('Error searching for location. Please try again.');
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
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Update places container
      renderPlaces(data.results);
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
  const MIN_RATING = 4.1;
  
  // Define unwanted business types
  const unwantedTypes = [
    "gas_station", 
    "convenience_store", 
    "car_repair", 
    "car_wash",
    "car_dealer"
  ];
  
  // Filter out Shell stations
  const filteredPlaces = places.filter(place => {
    // Skip this filter if not restaurant type
    if (currentPlaceType !== 'restaurant') {
      return true;
    }
    
    // Check if this is a gas station or similar
    if (place.types) {
      for (const type of unwantedTypes) {
        if (place.types.includes(type)) {
          return false;
        }
      }
    }
    
    // For restaurants only, filter by minimum rating
    if (currentPlaceType === 'restaurant' && place.rating && place.rating < MIN_RATING) {
      return false;
    }
    
    return true;
  });
  
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
    const photoUrl = `/api/photo?photoreference=${place.photos[0].photo_reference}&maxwidth=400`;
    photoHtml = `<img src="${photoUrl}" class="card-img-top place-image" alt="${place.name}">`;
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
    
    // Find the placeholder element for this place by ID first, then by class if necessary
    let taRatingElement = document.getElementById(`tripadvisor-${place.place_id}`);
    
    // If not found by ID, try finding by class
    if (!taRatingElement) {
      taRatingElement = document.querySelector(`.tripadvisor-rating-${place.place_id}`);
    }
    
    // If still not found, log the error and exit
    if (!taRatingElement) {
      console.error(`TripAdvisor rating element not found for ${place.place_id}`);
      return;
    }
    
    console.log(`Found TripAdvisor element for ${place.name}:`, taRatingElement);
    
    // Try different search approaches
    let candidates = [];
    
    if (name && vicinity) {
      console.log(`Fetching TripAdvisor data for place card: ${name} in ${vicinity}`);
      
      try {
        // Make the API call with full address
        const taResponse = await fetch(`/api/tripadvisor?place_name=${encodeURIComponent(name)}&location=${encodeURIComponent(vicinity)}`);
        const taData = await taResponse.json();
        console.log("TripAdvisor data response:", taData);
        
        if (taData.status === 'OK' && taData.result && taData.result.tripadvisor_data) {
          const tripadvisorData = taData.result.tripadvisor_data;
          
          // Check if we have meaningful TripAdvisor data (rating)
          if (tripadvisorData && tripadvisorData.rating) {
            console.log(`Got TripAdvisor rating for ${name}: ${tripadvisorData.rating}`);
            
            let taHtml = '<div class="d-flex align-items-center">';
            taHtml += '<small class="text-muted me-1">TripAdvisor:</small>';
            
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
            
            // Show rank if available
            if (tripadvisorData.rank_position && tripadvisorData.rank_total) {
              taHtml += ` <small class="text-success ms-1">#${tripadvisorData.rank_position}/${tripadvisorData.rank_total}</small>`;
            }
            
            taHtml += '</div>';
            taRatingElement.innerHTML = taHtml;
            console.log("Updated TripAdvisor rating HTML");
            return;
          }
        }
        
        // If we reach here, we either didn't get TripAdvisor data or the API call failed
        // Check if there's a specific reason for the limitation
        if (taData.result && taData.result.access_limited) {
          taRatingElement.innerHTML = '<small class="text-muted"><i class="fas fa-info-circle fa-xs"></i> TripAdvisor access limited</small>';
        } else if (taData.result && taData.result.source_error) {
          taRatingElement.innerHTML = '<small class="text-muted"><i class="fas fa-exclamation-circle fa-xs"></i> TripAdvisor connection issue</small>';
        } else if (taData.result && taData.result.parse_error) {
          taRatingElement.innerHTML = '<small class="text-muted"><i class="fas fa-exclamation-circle fa-xs"></i> TripAdvisor data format issue</small>';
        } else {
          // Generic message for other cases
          taRatingElement.innerHTML = '<small class="text-muted"><i class="fas fa-info-circle fa-xs"></i> TripAdvisor data unavailable</small>';
        }
      } catch (fetchError) {
        console.error('Error fetching TripAdvisor data:', fetchError);
        taRatingElement.innerHTML = '<small class="text-muted"><i class="fas fa-exclamation-circle fa-xs"></i> Unable to connect to TripAdvisor</small>';
      }
    } else {
      // Not enough information to fetch TripAdvisor data
      taRatingElement.innerHTML = '<small class="text-muted"><i class="fas fa-info-circle fa-xs"></i> Insufficient location details</small>';
    }
  } catch (error) {
    console.error('Error in TripAdvisor data processing:', error);
    // Find the element and update with error message
    try {
      const taRatingElement = document.querySelector(`.tripadvisor-rating-${place.place_id}`);
      if (taRatingElement) {
        taRatingElement.innerHTML = '<small class="text-muted"><i class="fas fa-exclamation-triangle fa-xs"></i> TripAdvisor retrieval error</small>';
      }
    } catch (e) {
      // If we can't even update the error message, just log it
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
        photoHtml = `
          <div class="photo-carousel">
            <div class="carousel-container">
              <div class="carousel-slide">
                <img src="/api/photo?photoreference=${place.photos[0].photo_reference}&maxwidth=800" alt="${place.name}">
              </div>
              ${place.photos.length > 1 ? `
                <div class="carousel-nav carousel-prev">
                  <i class="bi bi-chevron-left"></i>
                </div>
                <div class="carousel-nav carousel-next">
                  <i class="bi bi-chevron-right"></i>
                </div>
                <div class="carousel-counter">1 / ${place.photos.length}</div>
              ` : ''}
            </div>
            ${place.photos.length > 1 ? `
              <div class="thumbnail-container">
                ${place.photos.map((photo, index) => `
                  <img src="/api/photo?photoreference=${photo.photo_reference}&maxwidth=120" 
                       class="thumbnail ${index === 0 ? 'active' : ''}" 
                       data-index="${index}" 
                       alt="Thumbnail ${index + 1}">
                `).join('')}
              </div>
            ` : ''}
          </div>
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
    
    // Filter out unwanted businesses and apply minimum rating
    const MIN_RATING = 4.1;
    nearbyRestaurants = nearbyRestaurants.filter(restaurant => {
      // Check if this is a gas station or similar
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
          const photoUrl = `/api/photo?photoreference=${recommendation.photos[0].photo_reference}&maxwidth=200`;
          photoHtml = `<img src="${photoUrl}" class="card-img-top recommendation-image" alt="${recommendation.name}">`;
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
  // Get carousel elements
  const container = document.querySelector('.carousel-slide');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  const counter = document.querySelector('.carousel-counter');
  const thumbnails = document.querySelectorAll('.thumbnail');
  
  // Store current index
  let currentIndex = 0;
  const photos = window.currentPlacePhotos || [];
  
  if (!photos || photos.length <= 1 || !container) return;
  
  // Function to update carousel display
  function updateCarousel() {
    // Update image
    container.innerHTML = `<img src="/api/photo?photoreference=${photos[currentIndex].photo_reference}&maxwidth=800" alt="Place photo ${currentIndex + 1}">`;
    
    // Update counter
    if (counter) {
      counter.textContent = `${currentIndex + 1} / ${photos.length}`;
    }
    
    // Update thumbnails
    thumbnails.forEach((thumb, idx) => {
      if (idx === currentIndex) {
        thumb.classList.add('active');
      } else {
        thumb.classList.remove('active');
      }
    });
  }
  
  // Previous button click
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + photos.length) % photos.length;
      updateCarousel();
    });
  }
  
  // Next button click
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % photos.length;
      updateCarousel();
    });
  }
  
  // Thumbnail clicks
  thumbnails.forEach((thumb, idx) => {
    thumb.addEventListener('click', () => {
      currentIndex = idx;
      updateCarousel();
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