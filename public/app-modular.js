import * as api from './services/api.js';
import * as mapService from './services/map.js';
import * as storage from './services/storage.js';
import * as renderer from './ui/renderer.js';

const DEFAULT_CENTER = { lat: 52.3676, lng: 4.9041 };

const MIN_REVIEWS = {
  restaurant: 20,
  lodging: 8,
  night_club: 10,
  supermarket: 5,
  default: 10
};

const UNWANTED_TYPES = [
  "gas_station", 
  "convenience_store", 
  "car_repair", 
  "car_wash",
  "car_dealer"
];

let showingFavorites = false;

function getMinRating(placeType, isDessert = false) {
  if (isDessert) return 3.7;
  if (placeType === 'restaurant') return 4.0;
  if (placeType === 'night_club') return 3.7;
  if (placeType === 'supermarket') return 3.5;
  return 3.8;
}

function filterAndSortPlaces(places, origin, options = {}) {
  const {
    radius = 1500,
    minRating = 4.0,
    minReviews = 20,
    unwantedTypes = []
  } = options;

  const filteredPlaces = places.filter(place => {
    if (!place.geometry || !place.geometry.location) return false;
    
    if (unwantedTypes.length > 0 && place.types) {
      for (const unwantedType of unwantedTypes) {
        if (place.types.includes(unwantedType)) {
          return false;
        }
      }
    }
    
    if (place.user_ratings_total < minReviews) return false;
    if (place.rating < minRating) return false;
    
    const placeLocation = place.geometry.location;
    const distance = mapService.getDistanceInMeters(
      origin.lat, 
      origin.lng, 
      placeLocation.lat || placeLocation.latitude, 
      placeLocation.lng || placeLocation.longitude
    );
    
    if (distance > radius) return false;
    
    return true;
  });
  
  return filteredPlaces.sort((a, b) => {
    const locationA = a.geometry.location;
    const locationB = b.geometry.location;
    
    const distanceA = mapService.getDistanceInMeters(
      origin.lat, origin.lng, 
      locationA.lat || locationA.latitude, 
      locationA.lng || locationA.longitude
    );
    
    const distanceB = mapService.getDistanceInMeters(
      origin.lat, origin.lng, 
      locationB.lat || locationB.latitude, 
      locationB.lng || locationB.longitude
    );
    
    const ratingDiff = (b.rating - a.rating) * 10;
    const distanceFactor = (distanceA - distanceB) / 100;
    
    return ratingDiff + distanceFactor;
  });
}

function toggleDarkMode(enabled) {
  const body = document.body;
  
  if (enabled) {
    body.classList.add('dark-mode');
    mapService.setDarkMode(true);
  } else {
    body.classList.remove('dark-mode');
    mapService.setDarkMode(false);
  }
  
  const weatherWidget = document.getElementById('weather-widget');
  if (weatherWidget) {
    weatherWidget.classList.toggle('dark-mode', enabled);
  }
}

function updateURL(location, type) {
  const params = new URLSearchParams();
  params.set('lat', location.lat.toFixed(6));
  params.set('lng', location.lng.toFixed(6));
  params.set('type', type);
  
  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newURL);
}

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get('lat'));
  const lng = parseFloat(params.get('lng'));
  const type = params.get('type');
  
  if (!isNaN(lat) && !isNaN(lng)) {
    return { location: { lat, lng }, type: type || 'restaurant' };
  }
  
  return null;
}

function toggleFavorite(place) {
  if (storage.isFavorite(place.place_id)) {
    storage.removeFavorite(place.place_id);
    renderer.updateFavoritesBadge(storage.getFavoriteCount());
    return false;
  } else {
    storage.saveFavorite(place);
    renderer.updateFavoritesBadge(storage.getFavoriteCount());
    return true;
  }
}

function showFavorites() {
  const container = document.getElementById('places-container');
  container.innerHTML = '';
  
  const favorites = storage.getFavorites();
  
  if (favorites.length === 0) {
    container.appendChild(renderer.createErrorMessage('No favorites saved yet. Click the heart icon on any place to add it to your favorites.'));
    return;
  }
  
  favorites.forEach((place, index) => {
    const card = renderer.createPlaceCard(place, index, {
      onViewDetails: showPlaceDetails,
      onHover: mapService.updateHoverMarker,
      onToggleFavorite: (p) => {
        const result = toggleFavorite(p);
        if (!result && showingFavorites) {
          setTimeout(showFavorites, 100);
        }
        return result;
      }
    });
    container.appendChild(card);
  });
}

async function loadNearbyPlaces(location, keyword = '', radius = 1500) {
  showingFavorites = false;
  renderer.showLoading();
  
  const container = document.getElementById('places-container');
  container.innerHTML = '';
  container.appendChild(renderer.createSkeletonCards(6));
  
  api.fetchWeather(location).then(data => {
    renderer.displayWeatherData(data);
  }).catch(console.error);
  
  mapService.clearMarkers();
  
  try {
    const openNowChecked = document.getElementById('open-now-checkbox')?.checked || false;
    const isDessertSearch = keyword === 'dessert';
    
    const placeTypeSelect = document.getElementById('place-type-select');
    const currentPlaceType = placeTypeSelect ? placeTypeSelect.value : 'restaurant';
    
    let data;
    
    if (isDessertSearch) {
      data = await api.fetchDessertPlaces(location, { radius, openNow: openNowChecked });
    } else {
      data = await api.fetchNearbyPlaces(location, {
        type: currentPlaceType,
        keyword: keyword,
        radius: radius,
        openNow: openNowChecked
      });
    }
    
    updateURL(location, isDessertSearch ? 'dessert' : currentPlaceType);
    
    container.innerHTML = '';
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      renderPlaces(data.results, location, currentPlaceType, isDessertSearch);
    } else if (data.status === 'REQUEST_DENIED') {
      container.appendChild(renderer.createErrorMessage(`API Request Denied: ${data.error_message || 'Unknown error'}`));
    } else {
      container.appendChild(renderer.createNoResultsMessage(currentPlaceType, getMinRating(currentPlaceType), isDessertSearch));
    }
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    container.innerHTML = '';
    container.appendChild(renderer.createErrorMessage('Error fetching places. Please try again later.'));
  } finally {
    renderer.hideLoading();
  }
}

function renderPlaces(places, origin, currentPlaceType, isDessertSearch = false) {
  const container = document.getElementById('places-container');
  container.innerHTML = '';
  
  const currentMinReviews = MIN_REVIEWS[currentPlaceType] || MIN_REVIEWS.default;
  const minRating = getMinRating(currentPlaceType, isDessertSearch);
  
  const filteredPlaces = filterAndSortPlaces(places, origin, {
    radius: 1500,
    minRating: minRating,
    minReviews: currentMinReviews,
    unwantedTypes: UNWANTED_TYPES
  });
  
  console.log(`After filtering: ${filteredPlaces.length} of ${places.length} places remaining`);
  
  mapService.clearMarkers();
  
  if (filteredPlaces.length === 0) {
    container.appendChild(renderer.createNoResultsMessage(currentPlaceType, minRating, isDessertSearch));
    return;
  }
  
  filteredPlaces.forEach((place, index) => {
    const card = renderer.createPlaceCard(place, index, {
      onViewDetails: showPlaceDetails,
      onHover: mapService.updateHoverMarker,
      onToggleFavorite: toggleFavorite
    });
    container.appendChild(card);
    
    mapService.addMarker(place, index, (p) => showPlaceDetails(p.place_id));
  });
  
  mapService.updateClusterer();
}

async function showPlaceDetails(placeId) {
  renderer.showLoading();
  
  try {
    const data = await api.fetchPlaceDetails(placeId);
    
    if (data.status === 'OK' && data.result) {
      const place = data.result;
      
      let tripAdvisorData = null;
      try {
        const taResponse = await api.fetchTripAdvisorData(place.name, place.vicinity || '');
        if (taResponse && taResponse.status === 'success' && taResponse.data) {
          tripAdvisorData = taResponse.data;
        }
      } catch (e) {
        console.error("Error fetching TripAdvisor data:", e);
      }
      
      renderPlaceDetailsModal(place, tripAdvisorData);
    } else {
      alert("Could not load place details. Please try again.");
    }
  } catch (error) {
    console.error("Error fetching place details:", error);
    alert("Error loading place details. Please try again later.");
  } finally {
    renderer.hideLoading();
  }
}

function renderPlaceDetailsModal(place, tripAdvisorData) {
  let hoursHtml = '';
  if (place.opening_hours && place.opening_hours.weekday_text) {
    hoursHtml = '<h5 class="mt-3">Opening Hours</h5><ul class="list-group mb-3">';
    place.opening_hours.weekday_text.forEach(day => {
      hoursHtml += `<li class="list-group-item">${day}</li>`;
    });
    hoursHtml += '</ul>';
  }
  
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
  
  let photosHtml = '';
  if (place.photos && place.photos.length > 0) {
    const photoCarousel = renderer.createPhotoCarousel(place.photos, place.place_id, place.name);
    photosHtml = photoCarousel.innerHTML;
  }
  
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
            ${tripAdvisorData.price_range ? `<div class="mb-2">Price Range: <strong>${tripAdvisorData.price_range}</strong></div>` : ''}
            ${tripAdvisorData.cuisine ? `<div class="mb-2">Cuisine: <strong>${tripAdvisorData.cuisine}</strong></div>` : ''}
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
                ${place.price_level ? `<div class="price mb-2"><strong>${'$'.repeat(place.price_level)}</strong></div>` : ''}
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
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" id="modal-show-on-map">
              <i class="fas fa-map-marker-alt me-1"></i> Show on Map
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const existingModal = document.getElementById('placeDetailsModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  document.getElementById('modal-show-on-map').addEventListener('click', () => {
    mapService.setMapCenter({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
  });
  
  const modal = new bootstrap.Modal(document.getElementById('placeDetailsModal'));
  modal.show();
}

async function useMyLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser. Using default location.");
    loadNearbyPlaces(DEFAULT_CENTER);
    return;
  }
  
  renderer.showLoading();
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      mapService.setMapCenter(userLocation);
      mapService.addUserLocationMarker(userLocation);
      mapService.setLastSearchedCenter(userLocation);
      loadNearbyPlaces(userLocation);
    },
    (error) => {
      console.error("Error getting user location:", error);
      alert("Couldn't get your location: " + error.message + ". Using default location.");
      loadNearbyPlaces(DEFAULT_CENTER);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

async function searchLocation() {
  const searchInput = document.getElementById("location-input").value.trim();
  
  if (!searchInput) {
    alert("Please enter a location to search");
    return;
  }
  
  renderer.showLoading();
  
  try {
    const specificPlaceResult = await searchForSpecificPlace(searchInput);
    
    if (specificPlaceResult && specificPlaceResult.geometry) {
      const placeLocation = {
        lat: specificPlaceResult.geometry.location.lat,
        lng: specificPlaceResult.geometry.location.lng
      };
      
      mapService.setMapCenter(placeLocation);
      mapService.setMapZoom(16);
      mapService.setLastSearchedCenter(placeLocation);
      
      loadNearbyPlaces(placeLocation);
      
      if (specificPlaceResult.place_id) {
        showPlaceDetails(specificPlaceResult.place_id);
      }
      
      return;
    }
    
    const data = await api.geocodeAddress(searchInput);
    
    if (data.status === "OK" && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      
      mapService.setMapCenter(location);
      mapService.setLastSearchedCenter(location);
      
      if (data.results[0].geometry.viewport) {
        mapService.fitBounds({
          east: data.results[0].geometry.viewport.northeast.lng,
          north: data.results[0].geometry.viewport.northeast.lat,
          west: data.results[0].geometry.viewport.southwest.lng,
          south: data.results[0].geometry.viewport.southwest.lat
        });
      } else {
        mapService.setMapZoom(14);
      }
      
      loadNearbyPlaces(location);
    } else {
      alert("Location not found. Please try a different search term.");
      renderer.hideLoading();
    }
  } catch (error) {
    console.error("Error searching for location:", error);
    alert('Error searching for location. Please try again or click directly on the map.');
    renderer.hideLoading();
  }
}

async function searchForSpecificPlace(placeName) {
  try {
    const data = await api.searchPlaces(placeName);
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error searching for specific place:', error);
    return null;
  }
}

function initMap() {
  console.log("Initializing map...");
  
  const urlParams = getURLParams();
  const initialCenter = urlParams?.location || DEFAULT_CENTER;
  const initialType = urlParams?.type || 'restaurant';
  
  if (urlParams?.type) {
    const typeSelect = document.getElementById('place-type-select');
    if (typeSelect) typeSelect.value = initialType;
  }
  
  mapService.initMap("map", initialCenter);
  
  mapService.addMarker({ 
    geometry: { location: initialCenter },
    name: urlParams ? 'Shared Location' : 'Amsterdam'
  }, -1);
  
  loadNearbyPlaces(initialCenter);
  
  mapService.addMapClickListener((location) => {
    mapService.setMapCenter(location);
    mapService.setLastSearchedCenter(location);
    loadNearbyPlaces(location);
    document.getElementById('search-this-area-btn').style.display = 'none';
  });
  
  mapService.addMapDragEndListener((newCenter) => {
    const lastCenter = mapService.getLastSearchedCenter();
    const distance = mapService.getDistanceInMeters(
      lastCenter.lat,
      lastCenter.lng,
      newCenter.lat,
      newCenter.lng
    );
    
    if (distance > 200) {
      document.getElementById('search-this-area-btn').style.display = 'block';
    }
  });
  
  document.getElementById('search-this-area-btn').addEventListener('click', function() {
    const map = mapService.getMap();
    const center = map.getCenter();
    const location = { lat: center.lat(), lng: center.lng() };
    
    mapService.setLastSearchedCenter(location);
    this.style.display = 'none';
    loadNearbyPlaces(location);
  });
  
  document.getElementById('transit-layer-btn').addEventListener('click', function() {
    const isVisible = mapService.toggleTransitLayer();
    this.classList.toggle('active', isVisible);
  });
  
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.getElementById('dark-mode-toggle').checked = prefersDarkMode;
  toggleDarkMode(prefersDarkMode);
  
  document.getElementById('dark-mode-toggle').addEventListener('change', function(e) {
    toggleDarkMode(e.target.checked);
  });
  
  document.getElementById("use-location-button").addEventListener("click", useMyLocation);
  document.getElementById("search-button").addEventListener("click", searchLocation);
  document.getElementById("location-input").addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
      searchLocation();
    }
  });
  
  document.getElementById("place-type-select").addEventListener("change", function() {
    const map = mapService.getMap();
    const center = map.getCenter();
    const location = { lat: center.lat(), lng: center.lng() };
    const searchInput = document.getElementById("search-input")?.value.trim();
    loadNearbyPlaces(location, searchInput || '');
  });
  
  document.getElementById("open-now-checkbox").addEventListener("change", function() {
    const map = mapService.getMap();
    const center = map.getCenter();
    const location = { lat: center.lat(), lng: center.lng() };
    const searchInput = document.getElementById("search-input")?.value.trim();
    loadNearbyPlaces(location, searchInput || '');
  });
  
  const categoryButtons = {
    "restaurants-button": { type: "restaurant" },
    "hotels-button": { type: "lodging" },
    "attractions-button": { type: "tourist_attraction" },
    "coffee-button": { type: "cafe" },
    "dessert-button": { keyword: "dessert" },
    "nightlife-button": { type: "night_club" }
  };
  
  Object.entries(categoryButtons).forEach(([id, config]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener("click", function() {
        if (config.type) {
          document.getElementById("place-type-select").value = config.type;
        }
        
        const map = mapService.getMap();
        const center = map.getCenter();
        const location = { lat: center.lat(), lng: center.lng() };
        
        loadNearbyPlaces(location, config.keyword || '');
      });
    }
  });
  
  document.querySelectorAll('.category-btn').forEach(button => {
    button.addEventListener('click', function() {
      const type = this.getAttribute('data-type');
      const keyword = this.getAttribute('data-keyword');
      
      if (type) {
        document.getElementById("place-type-select").value = type;
      }
      
      document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      const map = mapService.getMap();
      const center = map.getCenter();
      const location = { lat: center.lat(), lng: center.lng() };
      
      loadNearbyPlaces(location, keyword || '');
    });
  });
  
  const favoritesBtn = document.getElementById('favorites-button');
  if (favoritesBtn) {
    favoritesBtn.addEventListener('click', function() {
      showingFavorites = !showingFavorites;
      this.classList.toggle('active', showingFavorites);
      
      if (showingFavorites) {
        showFavorites();
      } else {
        const map = mapService.getMap();
        const center = map.getCenter();
        loadNearbyPlaces({ lat: center.lat(), lng: center.lng() });
      }
    });
  }
  
  renderer.updateFavoritesBadge(storage.getFavoriteCount());
}

window.initMap = initMap;
window.showPlaceDetails = showPlaceDetails;
window.updateHoverMarker = mapService.updateHoverMarker;
