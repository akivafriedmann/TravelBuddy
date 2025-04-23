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
  
  // Initialize Places Service for the map
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
      
      // Get details for the clicked place
      placesService.getDetails({
        placeId: event.placeId,
        fields: ['name', 'place_id', 'rating', 'user_ratings_total']
      }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          // Create a view details button that calls our showPlaceDetails function
          const viewDetailsButton = document.createElement('button');
          viewDetailsButton.className = 'btn btn-primary btn-sm mt-2';
          viewDetailsButton.textContent = 'View Details';
          viewDetailsButton.onclick = () => {
            showPlaceDetails(place.place_id);
            infoWindow.close();
          };
          
          // Create info window content
          const content = document.createElement('div');
          content.className = 'p-2';
          content.innerHTML = `
            <strong>${place.name}</strong><br>
            ${place.rating ? `Rating: ${place.rating}/5 (${place.user_ratings_total || 0} reviews)<br>` : ''}
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
  
  // Set up category buttons
  const categoryButtons = document.querySelectorAll('.category-btn');
  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Update active state
      categoryButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update current place type and search again
      currentPlaceType = button.dataset.type;
      loadNearbyPlaces(currentLocation);
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
        
        // Load nearby places
        loadNearbyPlaces(currentLocation);
      },
      error => {
        console.log('Geolocation error or permission denied:', error);
        // Use default location
        loadNearbyPlaces(currentLocation);
      }
    );
  } else {
    // Browser doesn't support geolocation
    console.log('Geolocation not supported');
    loadNearbyPlaces(currentLocation);
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
    
    geocoder.geocode({ address: locationInput }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        const location = results[0].geometry.location;
        
        currentLocation = {
          lat: location.lat(),
          lng: location.lng()
        };
        
        // Update map center
        map.setCenter(currentLocation);
        
        // Load nearby places
        loadNearbyPlaces(currentLocation);
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
async function loadNearbyPlaces(location) {
  showLoading();
  
  // Clear existing markers
  clearMarkers();
  
  try {
    // Call our backend API to get nearby places
    const response = await fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&type=${currentPlaceType}`);
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
  const MIN_REVIEWS = 20;
  
  // Sort places by rating but only consider places with at least MIN_REVIEWS
  const sortedPlaces = [...places].sort((a, b) => {
    const aSignificant = a.user_ratings_total >= MIN_REVIEWS;
    const bSignificant = b.user_ratings_total >= MIN_REVIEWS;
    
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
  
  sortedPlaces.forEach((place, index) => {
    // Create a card for each place
    const card = createPlaceCard(place);
    container.appendChild(card);
    
    // Add a marker for this place
    addMarker(place, index);
  });
}

// Create a card for a place
function createPlaceCard(place) {
  const col = document.createElement('div');
  col.className = 'col-md-4 mb-4';
  
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
    
    // Empty stars
    for (let i = 0; i < (5 - Math.ceil(place.rating)); i++) {
      ratingHtml += '<i class="far fa-star"></i>';
    }
    
    ratingHtml += ` <span class="ms-1">${place.rating}</span>`;
    
    // Add a more prominent display for the number of reviews
    if (place.user_ratings_total) {
      // Add badge indicating statistically significant ratings (at least 20 reviews)
      const MIN_REVIEWS = 20;
      
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
    
    ratingHtml += '</div>';
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
  
  col.innerHTML = `
    <div class="card place-card h-100">
      ${photoHtml}
      <div class="card-body">
        <h5 class="card-title">${place.name}</h5>
        ${ratingHtml}
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
  
  return col;
}

// Add a marker to the map
function addMarker(place, index) {
  if (!place.geometry || !place.geometry.location) return;
  
  const position = {
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng
  };
  
  const marker = new google.maps.Marker({
    position: position,
    map: map,
    title: place.name,
    animation: google.maps.Animation.DROP
    // Removed the numbered labels for a cleaner interface
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
    
    if (data.status === 'OK' && data.result) {
      const place = data.result;
      
      // Prepare photo HTML
      let photoHtml = '';
      if (place.photos && place.photos.length > 0) {
        const photoUrl = `/api/photo?photoreference=${place.photos[0].photo_reference}&maxwidth=600`;
        photoHtml = `<img src="${photoUrl}" class="modal-img" alt="${place.name}">`;
      }
      
      // Format rating stars
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = '<div class="star-rating mb-3 fs-5">';
        
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
          // Add badge indicating statistically significant ratings (at least 20 reviews)
          const MIN_REVIEWS = 20;
          
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
        
        ratingHtml += '</div>';
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
      
      // Format reviews
      let reviewsHtml = '';
      
      if (place.reviews && place.reviews.length > 0) {
        reviewsHtml = '<div class="mt-4 mb-3">';
        reviewsHtml += '<h5><i class="fas fa-comment-alt text-primary me-2"></i>Top Reviews</h5>';
        
        // Show up to 3 reviews
        const reviewsToShow = place.reviews.slice(0, 3);
        
        reviewsToShow.forEach(review => {
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
          `;
        });
        
        reviewsHtml += '</div>';
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
      
      // Put it all together
      document.getElementById('place-details').innerHTML = `
        ${photoHtml}
        <h3>${place.name}</h3>
        ${ratingHtml}
        <div class="mb-3">
          <i class="fas fa-map-marker-alt text-danger me-2"></i>
          <strong>Address:</strong> ${place.formatted_address || 'Not available'}
        </div>
        ${priceHtml}
        ${contactHtml}
        ${typesHtml}
        ${reviewsHtml}
        ${photosHtml}
        ${nearbyRecommendationsHtml}
      `;
      
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
    
    // Define restaurant-related types for better categorization
    const restaurantTypes = [
      'restaurant', 'food', 'bakery', 'bar', 'cafe', 'meal_delivery', 
      'meal_takeaway', 'night_club', 'ice_cream', 'coffee'
    ];
    
    // More specific categorization of place types
    const isRestaurant = place.types && place.types.some(type => restaurantTypes.includes(type));
    const isLodging = place.types && place.types.includes('lodging');
    const isAttraction = place.types && (
      place.types.includes('tourist_attraction') || 
      place.types.includes('museum') ||
      place.types.includes('amusement_park') ||
      place.types.includes('aquarium') ||
      place.types.includes('zoo') ||
      place.types.includes('art_gallery')
    );
    
    // Determine recommended place types based on the current place's type
    let recommendedTypes = [];
    
    if (isRestaurant) {
      // If this is a restaurant, recommend attractions and lodging
      recommendedTypes = ['tourist_attraction', 'lodging'];
    } else if (isLodging) {
      // If this is a hotel, recommend restaurants and attractions
      recommendedTypes = ['restaurant', 'tourist_attraction'];
    } else if (isAttraction) {
      // If this is an attraction, recommend restaurants and lodging
      recommendedTypes = ['restaurant', 'lodging'];
    } else {
      // Default to recommending restaurants
      recommendedTypes = ['restaurant'];
    }
    
    // Create an empty array to store all nearby places
    let allNearbyPlaces = [];
    
    // Fetch nearby places for each recommended type
    for (const type of recommendedTypes) {
      const response = await fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&type=${type}&radius=500`);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        // Add type information to each place for display purposes
        const placesWithType = data.results.map(place => ({
          ...place,
          recommendationType: type
        }));
        
        // Add places to the combined array
        allNearbyPlaces = [...allNearbyPlaces, ...placesWithType];
      }
    }
    
    // Remove the current place from recommendations if it's included
    allNearbyPlaces = allNearbyPlaces.filter(nearbyPlace => 
      nearbyPlace.place_id !== place.place_id
    );
    
    // Generate a more accurate display type for each place
    allNearbyPlaces = allNearbyPlaces.map(place => {
      let displayType = place.recommendationType;
      
      // Check if this is a real restaurant or a more specific food-related place
      if (displayType === 'restaurant' && place.types) {
        // Check for more specific food types
        if (place.types.includes('cafe')) {
          displayType = 'cafe';
        } else if (place.types.includes('bar')) {
          displayType = 'bar';
        } else if (place.types.includes('bakery')) {
          displayType = 'bakery';
        } else if (place.types.includes('meal_takeaway')) {
          displayType = 'meal_takeaway';
        }
      }
      
      // For attractions, check for more specific types
      if (displayType === 'tourist_attraction' && place.types) {
        if (place.types.includes('museum')) {
          displayType = 'museum';
        } else if (place.types.includes('amusement_park')) {
          displayType = 'amusement_park';
        } else if (place.types.includes('zoo')) {
          displayType = 'zoo';
        } else if (place.types.includes('art_gallery')) {
          displayType = 'art_gallery';
        }
      }
      
      return {
        ...place,
        displayType: displayType
      };
    });
    
    // Sort by rating and limit to 6 places
    allNearbyPlaces.sort((a, b) => b.rating - a.rating);
    const topRecommendations = allNearbyPlaces.slice(0, 6);
    
    if (topRecommendations.length > 0) {
      // Create HTML for recommendations
      let recommendationsHtml = '<div class="row">';
      
      topRecommendations.forEach(recommendation => {
        // Use the more specific display type for more accurate icons and labels
        const type = recommendation.displayType;
        
        // Choose appropriate icon based on more specific place type
        let typeIcon = 'fa-map-marker-alt';
        if (type === 'restaurant') typeIcon = 'fa-utensils';
        else if (type === 'cafe') typeIcon = 'fa-coffee';
        else if (type === 'bar') typeIcon = 'fa-glass-cheers';
        else if (type === 'bakery') typeIcon = 'fa-cookie';
        else if (type === 'lodging') typeIcon = 'fa-bed';
        else if (type === 'museum') typeIcon = 'fa-landmark-alt';
        else if (type === 'zoo') typeIcon = 'fa-paw';
        else if (type === 'art_gallery') typeIcon = 'fa-paint-brush';
        else if (type === 'amusement_park') typeIcon = 'fa-ticket-alt';
        else if (type === 'tourist_attraction') typeIcon = 'fa-landmark';

        const typeLabel = formatPlaceType(type);
        
        // Prepare photo HTML
        let photoHtml = '<div class="bg-light text-center py-2">No Image</div>';
        if (recommendation.photos && recommendation.photos.length > 0) {
          const photoUrl = `/api/photo?photoreference=${recommendation.photos[0].photo_reference}&maxwidth=200`;
          photoHtml = `<img src="${photoUrl}" class="card-img-top recommendation-image" alt="${recommendation.name}">`;
        }
        
        recommendationsHtml += `
          <div class="col-md-4 col-6 mb-3">
            <div class="card recommendation-card h-100" data-place-id="${recommendation.place_id}">
              ${photoHtml}
              <div class="card-body p-2">
                <h6 class="card-title mb-1">${recommendation.name}</h6>
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