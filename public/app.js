// ==================== GLOBAL STATE ====================
let searchRadius = 1500; // Default search radius in meters
let currentKeyword = ''; // Track the current keyword filter

// ==================== FAVORITES STORAGE ====================
const FAVORITES_KEY = 'travelplanner_favorites';

function getFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading favorites from storage:', error);
    return [];
  }
}

function saveFavorite(place) {
  const favorites = getFavorites();
  
  if (!favorites.find(f => f.place_id === place.place_id)) {
    const favoriteData = {
      place_id: place.place_id,
      name: place.name,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      vicinity: place.vicinity || place.formatted_address,
      price_level: place.price_level,
      types: place.types,
      geometry: place.geometry,
      opening_hours: place.opening_hours,
      savedAt: Date.now()
    };
    
    favorites.push(favoriteData);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return true;
  }
  return false;
}

function removeFavorite(placeId) {
  const favorites = getFavorites();
  const filtered = favorites.filter(f => f.place_id !== placeId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  return filtered;
}

function isFavorite(placeId) {
  return getFavorites().some(f => f.place_id === placeId);
}

function toggleFavorite(place) {
  if (isFavorite(place.place_id)) {
    removeFavorite(place.place_id);
    updateFavoritesBadge();
    return false;
  } else {
    saveFavorite(place);
    updateFavoritesBadge();
    return true;
  }
}

function updateFavoritesBadge() {
  const badge = document.getElementById('favorites-count');
  if (badge) {
    const count = getFavorites().length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

// ==================== RESTAURANT LISTS STORAGE ====================
const LISTS_KEY = 'travelplanner_lists';

function getLists() {
  try {
    const stored = localStorage.getItem(LISTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading lists from storage:', error);
    return [];
  }
}

function saveLists(lists) {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  updateListsBadge();
}

function createList(name) {
  const lists = getLists();
  const newList = {
    id: Date.now().toString(),
    name: name.trim(),
    restaurants: [],
    createdAt: Date.now()
  };
  lists.push(newList);
  saveLists(lists);
  return newList;
}

function deleteList(listId) {
  const lists = getLists();
  const filtered = lists.filter(l => l.id !== listId);
  saveLists(filtered);
  return filtered;
}

function renameList(listId, newName) {
  const lists = getLists();
  const list = lists.find(l => l.id === listId);
  if (list) {
    list.name = newName.trim();
    saveLists(lists);
  }
  return lists;
}

function addRestaurantToList(listId, restaurant) {
  const lists = getLists();
  const list = lists.find(l => l.id === listId);
  if (list) {
    if (!list.restaurants.find(r => r.place_id === restaurant.place_id)) {
      // Extract lat/lng as plain numbers (handle both function and property formats)
      const loc = restaurant.geometry?.location;
      const lat = typeof loc?.lat === 'function' ? loc.lat() : loc?.lat;
      const lng = typeof loc?.lng === 'function' ? loc.lng() : loc?.lng;
      
      // Build photo URL for storage (use the existing working endpoint)
      let photoUrl = '';
      if (restaurant.photos && restaurant.photos.length > 0) {
        const photo = restaurant.photos[0];
        if (photo.url) {
          photoUrl = photo.url;
        } else if (photo.photo_reference) {
          photoUrl = `/api/photo?photo_reference=${photo.photo_reference}&maxwidth=100`;
        }
      }
      
      const restaurantData = {
        place_id: restaurant.place_id,
        name: restaurant.name,
        rating: restaurant.rating,
        user_ratings_total: restaurant.user_ratings_total,
        address: restaurant.vicinity || restaurant.formatted_address,
        lat: lat,
        lng: lng,
        photoUrl: photoUrl,
        website: restaurant.website,
        price_level: restaurant.price_level,
        addedAt: Date.now()
      };
      list.restaurants.push(restaurantData);
      saveLists(lists);
      return true;
    }
  }
  return false;
}

function removeRestaurantFromList(listId, placeId) {
  const lists = getLists();
  const list = lists.find(l => l.id === listId);
  if (list) {
    list.restaurants = list.restaurants.filter(r => r.place_id !== placeId);
    saveLists(lists);
  }
  return lists;
}

function updateListsBadge() {
  const badge = document.getElementById('lists-count');
  if (badge) {
    const lists = getLists();
    const totalRestaurants = lists.reduce((sum, list) => sum + list.restaurants.length, 0);
    badge.textContent = totalRestaurants;
    badge.style.display = totalRestaurants > 0 ? 'inline-flex' : 'none';
  }
}

function renderListsModal() {
  const container = document.getElementById('lists-container');
  const lists = getLists();
  
  if (lists.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">No lists yet. Create one above!</p>';
    return;
  }
  
  container.innerHTML = lists.map(list => `
    <div class="list-item card mb-3" data-list-id="${list.id}">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="card-title mb-0">${list.name}</h5>
          <div>
            <button class="btn btn-sm btn-outline-secondary me-1 rename-list-btn" data-list-id="${list.id}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger delete-list-btn" data-list-id="${list.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <p class="text-muted small mb-2">${list.restaurants.length} restaurant${list.restaurants.length !== 1 ? 's' : ''}</p>
        <div class="list-restaurants">
          ${list.restaurants.length === 0 ? 
            '<p class="text-muted small">No restaurants in this list yet.</p>' :
            list.restaurants.map(r => renderListRestaurantItem(r, list.id)).join('')
          }
        </div>
      </div>
    </div>
  `).join('');
  
  container.querySelectorAll('.delete-list-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const listId = this.dataset.listId;
      if (confirm('Are you sure you want to delete this list?')) {
        deleteList(listId);
        renderListsModal();
      }
    });
  });
  
  container.querySelectorAll('.rename-list-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const listId = this.dataset.listId;
      const list = getLists().find(l => l.id === listId);
      const newName = prompt('Enter new name for this list:', list.name);
      if (newName && newName.trim()) {
        renameList(listId, newName);
        renderListsModal();
      }
    });
  });
  
  container.querySelectorAll('.remove-from-list-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const listId = this.dataset.listId;
      const placeId = this.dataset.placeId;
      removeRestaurantFromList(listId, placeId);
      renderListsModal();
    });
  });
}

function renderListRestaurantItem(restaurant, listId) {
  // Use stored photoUrl or fallback to placeholder
  const photoUrl = restaurant.photoUrl || 'https://via.placeholder.com/100x100?text=No+Image';
  
  // Use stored lat/lng values directly
  const lat = restaurant.lat;
  const lng = restaurant.lng;
  const mapsLink = lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : '#';
  
  // Build a view details link using place_id for getting website
  const detailsOnClick = `onclick="showPlaceDetails('${restaurant.place_id}')"`;
  
  return `
    <div class="restaurant-list-item d-flex align-items-start mb-3 p-2 border rounded">
      <img src="${photoUrl}" alt="${restaurant.name}" class="rounded me-3" style="width: 80px; height: 80px; object-fit: cover;" onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'">
      <div class="flex-grow-1">
        <h6 class="mb-1" style="cursor: pointer;" ${detailsOnClick}>${restaurant.name}</h6>
        <p class="text-muted small mb-1">
          <i class="fas fa-map-marker-alt"></i> ${restaurant.address || 'Address not available'}
        </p>
        <div class="d-flex gap-2 flex-wrap">
          <a href="${mapsLink}" target="_blank" class="btn btn-sm btn-outline-primary" ${!lat || !lng ? 'style="display:none;"' : ''}>
            <i class="fas fa-map"></i> Map
          </a>
          <button class="btn btn-sm btn-outline-info" ${detailsOnClick}>
            <i class="fas fa-info-circle"></i> Details
          </button>
          <button class="btn btn-sm btn-outline-danger remove-from-list-btn" data-list-id="${listId}" data-place-id="${restaurant.place_id}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function showAddToListModal(place) {
  const lists = getLists();
  const modal = new bootstrap.Modal(document.getElementById('add-to-list-modal'));
  
  document.getElementById('add-to-list-place-name').textContent = place.name;
  
  const optionsContainer = document.getElementById('add-to-list-options');
  
  if (lists.length === 0) {
    optionsContainer.innerHTML = '<p class="text-muted">No lists yet. Create one below!</p>';
  } else {
    optionsContainer.innerHTML = lists.map(list => {
      const alreadyInList = list.restaurants.some(r => r.place_id === place.place_id);
      return `
        <button class="btn ${alreadyInList ? 'btn-success' : 'btn-outline-primary'} w-100 mb-2 add-to-specific-list" 
                data-list-id="${list.id}" ${alreadyInList ? 'disabled' : ''}>
          <i class="fas ${alreadyInList ? 'fa-check' : 'fa-plus'}"></i> 
          ${list.name} ${alreadyInList ? '(Already added)' : ''}
        </button>
      `;
    }).join('');
    
    optionsContainer.querySelectorAll('.add-to-specific-list:not([disabled])').forEach(btn => {
      btn.addEventListener('click', function() {
        const listId = this.dataset.listId;
        if (addRestaurantToList(listId, place)) {
          showToast(`Added "${place.name}" to your list!`);
          modal.hide();
        }
      });
    });
  }
  
  const quickCreateInput = document.getElementById('quick-create-list-name');
  const quickCreateBtn = document.getElementById('quick-create-list-btn');
  
  quickCreateInput.value = '';
  
  const newQuickCreateBtn = quickCreateBtn.cloneNode(true);
  quickCreateBtn.parentNode.replaceChild(newQuickCreateBtn, quickCreateBtn);
  
  newQuickCreateBtn.addEventListener('click', function() {
    const name = quickCreateInput.value.trim();
    if (name) {
      const newList = createList(name);
      addRestaurantToList(newList.id, place);
      showToast(`Created list "${name}" and added "${place.name}"!`);
      modal.hide();
    }
  });
  
  window.currentPlaceForList = place;
  modal.show();
}

function showToast(message) {
  const existingToast = document.querySelector('.custom-toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = 'custom-toast';
  toast.innerHTML = `<i class="fas fa-check-circle me-2"></i>${message}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #28a745;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 9999;
    animation: fadeInUp 0.3s ease;
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== TRIPADVISOR INTEGRATION ====================
const tripAdvisorCache = new Map();

async function fetchTripAdvisorRating(place) {
  const cacheKey = place.place_id;
  
  if (tripAdvisorCache.has(cacheKey)) {
    return tripAdvisorCache.get(cacheKey);
  }
  
  try {
    const lat = place.geometry?.location?.lat;
    const lng = place.geometry?.location?.lng;
    const category = document.getElementById('place-type-select')?.value || 'restaurant';
    
    const url = `/api/tripadvisor?place_name=${encodeURIComponent(place.name)}&lat=${lat}&lng=${lng}&category=${category}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result?.tripadvisor_data) {
      tripAdvisorCache.set(cacheKey, data.result.tripadvisor_data);
      return data.result.tripadvisor_data;
    }
    
    tripAdvisorCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.warn('TripAdvisor fetch error:', error.message);
    return null;
  }
}

function updateCardWithTripAdvisor(placeId, tripAdvisorData) {
  const badge = document.querySelector(`[data-tripadvisor-id="${placeId}"]`);
  if (!badge) return;
  
  if (tripAdvisorData && tripAdvisorData.rating) {
    badge.innerHTML = `
      <span class="badge bg-success" title="TripAdvisor: ${tripAdvisorData.num_reviews || 0} reviews">
        <i class="fab fa-tripadvisor"></i> ${tripAdvisorData.rating.toFixed(1)}
      </span>
    `;
  } else {
    badge.innerHTML = '';
  }
}

async function loadTripAdvisorForPlaces(places) {
  for (const place of places.slice(0, 10)) {
    const data = await fetchTripAdvisorRating(place);
    updateCardWithTripAdvisor(place.place_id, data);
    await new Promise(r => setTimeout(r, 200));
  }
}

// ==================== URL SHARING ====================
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

// Handle browser Back/Forward button navigation
window.addEventListener('popstate', function(event) {
  const params = getURLParams();
  if (params && params.location && window.map) {
    window.map.setCenter(params.location);
    
    const typeSelect = document.getElementById('place-type-select');
    if (typeSelect) typeSelect.value = params.type;
    
    loadNearbyPlaces(params.location, '', searchRadius);
  }
});

// Share button functionality
function initShareButton() {
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function() {
      const currentUrl = window.location.href;
      navigator.clipboard.writeText(currentUrl).then(() => {
        showToast('Link copied to clipboard!', 'success');
      }).catch(() => {
        showToast('Failed to copy link', 'error');
      });
    });
  }
}

function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.share-toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = `share-toast share-toast-${type}`;
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Share a specific place (from modal)
function sharePlace(placeName, placeId) {
  const url = new URL(window.location.href);
  url.searchParams.set('place', placeId);
  const shareUrl = url.toString();
  
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast(`Link to "${placeName}" copied!`, 'success');
  }).catch(() => {
    showToast('Failed to copy link', 'error');
  });
}

// ==================== SKELETON LOADING ====================
function createSkeletonCards(count = 6) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card h-100 skeleton-card">
          <div class="card-body">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
            <div class="d-flex gap-1 mt-3">
              <div class="skeleton skeleton-badge"></div>
              <div class="skeleton skeleton-badge"></div>
            </div>
            <div class="d-flex gap-1 mt-3">
              <div class="skeleton skeleton-button"></div>
              <div class="skeleton skeleton-button small"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  return html;
}

// ==================== MARKER CLUSTERING ====================
window.clusterInstance = null;

function createCustomClusterRenderer() {
  return {
    render: function({ count, position }, stats) {
      const color = count > 10 ? '#e74c3c' : count > 5 ? '#f39c12' : '#3498db';
      const size = count > 10 ? 60 : count > 5 ? 50 : 40;
      
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
          <circle cx="50" cy="50" r="45" fill="${color}" stroke="white" stroke-width="3" opacity="0.9"/>
          <text x="50" y="42" text-anchor="middle" fill="white" font-size="18" font-weight="bold">${count}</text>
          <text x="50" y="60" text-anchor="middle" fill="white" font-size="10">places</text>
        </svg>
      `;
      
      const marker = new google.maps.Marker({
        position,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2)
        },
        zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
        title: `${count} places in this area - click to see them`
      });
      
      return marker;
    }
  };
}

function initMarkerClusterer() {
  // Retry if MarkerClusterer library isn't loaded yet
  if (!window.markerClusterer) {
    console.warn("MarkerClusterer lib not ready, retrying in 500ms...");
    setTimeout(initMarkerClusterer, 500);
    return;
  }
  
  const MarkerClustererClass = window.markerClusterer.MarkerClusterer;
  
  if (window.clusterInstance) {
    window.clusterInstance.clearMarkers();
  }
  
  if (MarkerClustererClass && window.markers && window.markers.length > 0) {
    window.clusterInstance = new MarkerClustererClass({
      map: window.map,
      markers: window.markers,
      renderer: createCustomClusterRenderer(),
      onClusterClick: handleClusterClick
    });
  }
}

function handleClusterClick(event, cluster, map) {
  const markers = cluster.markers;
  const places = markers.map(marker => marker.placeData).filter(p => p);
  
  if (places.length > 0) {
    showClusterPlacesModal(places, cluster.position);
  } else {
    map.fitBounds(cluster.bounds);
  }
}

function showClusterPlacesModal(places, position) {
  let modal = document.getElementById('cluster-places-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cluster-places-modal';
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="fas fa-map-marker-alt me-2"></i>Places in this area</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="cluster-places-list"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" id="zoom-to-cluster">
              <i class="fas fa-search-plus me-1"></i>Zoom to Area
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  const listContainer = document.getElementById('cluster-places-list');
  listContainer.innerHTML = places.map((place, i) => `
    <div class="cluster-place-item d-flex align-items-center p-2 border-bottom" style="cursor: pointer" 
         onclick="showPlaceDetails('${place.place_id}'); bootstrap.Modal.getInstance(document.getElementById('cluster-places-modal')).hide();">
      <div class="flex-grow-1">
        <strong>${place.name}</strong>
        <div class="small text-muted">
          <span class="text-warning">${'★'.repeat(Math.round(place.rating || 0))}</span>
          ${place.rating || 'N/A'} (${place.user_ratings_total || 0} reviews)
        </div>
      </div>
      <i class="fas fa-chevron-right text-muted"></i>
    </div>
  `).join('');
  
  const zoomBtn = document.getElementById('zoom-to-cluster');
  zoomBtn.onclick = function() {
    window.map.setCenter(position);
    window.map.setZoom(window.map.getZoom() + 2);
    bootstrap.Modal.getInstance(modal).hide();
  };
  
  new bootstrap.Modal(modal).show();
}

function updateMarkerClusterer() {
  const MarkerClustererClass = window.markerClusterer?.MarkerClusterer;
  
  if (window.clusterInstance) {
    window.clusterInstance.clearMarkers();
    if (window.markers && window.markers.length > 0) {
      window.clusterInstance.addMarkers(window.markers);
    }
  } else if (MarkerClustererClass && window.markers && window.markers.length > 0) {
    initMarkerClusterer();
  }
  
  // Show first-time helper tooltip if clusters exist
  if (window.markers && window.markers.length > 3) {
    showClusterHelperTooltip();
  }
}

// ==================== CLUSTER HELPER TOOLTIP ====================
function showClusterHelperTooltip() {
  const hasSeenHelper = localStorage.getItem('clusterHelperDismissed');
  if (hasSeenHelper) return;
  
  // Wait a bit for clusters to render first
  setTimeout(() => {
    const tooltip = document.createElement('div');
    tooltip.className = 'cluster-helper-tooltip';
    tooltip.innerHTML = `
      <div class="helper-icon"><i class="fas fa-layer-group"></i></div>
      <div class="helper-text">
        <strong>Multiple places nearby</strong>
        <small>Tap the numbered circles on the map to see all places in that area</small>
      </div>
      <button class="helper-dismiss" aria-label="Dismiss">&times;</button>
    `;
    
    document.body.appendChild(tooltip);
    
    const dismissBtn = tooltip.querySelector('.helper-dismiss');
    dismissBtn.addEventListener('click', () => {
      tooltip.remove();
      localStorage.setItem('clusterHelperDismissed', 'true');
    });
    
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.remove();
        localStorage.setItem('clusterHelperDismissed', 'true');
      }
    }, 8000);
  }, 2000);
}

// ==================== FAVORITES VIEW ====================
window.showingFavorites = false;

function showFavoritesView() {
  const container = document.getElementById('places-container');
  container.innerHTML = '';
  
  const favorites = getFavorites();
  
  if (favorites.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">
          <strong>No favorites saved yet</strong>
          <p>Click the <i class="fas fa-heart"></i> heart icon on any place to add it to your favorites.</p>
        </div>
      </div>
    `;
    return;
  }
  
  favorites.forEach((place, index) => {
    const card = createPlaceCard(place, index);
    container.appendChild(card);
  });
}

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

// Sort places in place based on user selection
function sortPlaces(places, sortBy, origin) {
  places.sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        // Sort by rating (highest first), then by review count
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
        
      case 'reviews':
        // Sort by number of reviews (most first)
        return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
        
      case 'distance':
        // Sort by distance (closest first)
        const locA = a.geometry.location;
        const locB = b.geometry.location;
        const distA = getDistanceInMeters(origin.lat, origin.lng, locA.lat || locA.latitude, locA.lng || locA.longitude);
        const distB = getDistanceInMeters(origin.lat, origin.lng, locB.lat || locB.latitude, locB.lng || locB.longitude);
        return distA - distB;
        
      case 'name':
        // Sort alphabetically by name
        return a.name.localeCompare(b.name);
        
      default:
        return 0;
    }
  });
}

// Initialize sort dropdown event listener
function initSortDropdown() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      // Don't re-render if showing favorites or other special views
      if (window.showingFavorites) {
        return;
      }
      // Re-render with new sort order
      if (window.lastPlacesData && window.lastOrigin) {
        renderPlaces(window.lastPlacesData, window.lastOrigin, window.currentPlaceType || 'restaurant', window.isDessertSearch || false);
      }
    });
  }
}

// Initialize restaurant search functionality
function initRestaurantSearch() {
  const searchInput = document.getElementById('restaurant-search-input');
  
  // Bind Enter key listener for restaurant search input
  if (searchInput) {
    searchInput.addEventListener('keyup', function(event) {
      if (event.key === 'Enter') {
        // If restaurant name is provided, search for restaurant
        if (searchInput.value.trim()) {
          searchForRestaurantByName();
        } else {
          // Otherwise, trigger location search
          searchLocation();
        }
      }
    });
  }
}

// Search for a specific restaurant by name
async function searchForRestaurantByName() {
  const searchInput = document.getElementById('restaurant-search-input');
  const query = searchInput.value.trim();
  
  if (!query) {
    alert('Please enter a restaurant name to search');
    return;
  }
  
  showLoading();
  
  try {
    // Get current map center for location bias
    const center = window.map.getCenter();
    const location = {
      lat: center.lat(),
      lng: center.lng()
    };
    
    // Search using keyword as the restaurant name
    const apiUrl = `/api/nearby?lat=${location.lat}&lng=${location.lng}&type=restaurant&radius=${searchRadius}&keyword=${encodeURIComponent(query)}`;
    
    console.log('Searching for restaurant:', query);
    console.log('Fetching URL:', apiUrl);
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log('Restaurant search response:', data);
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Store for re-sorting
      window.lastPlacesData = data.results;
      window.lastOrigin = location;
      window.currentPlaceType = 'restaurant';
      window.isDessertSearch = false;
      
      // Render the results without strict filtering for specific searches
      renderSearchResults(data.results, location, query);
    } else {
      // No results found
      hideLoading();
      const radiusText = searchRadius >= 1000 ? `${searchRadius / 1000}km` : `${searchRadius}m`;
      document.getElementById('places-container').innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">
            <strong>No restaurants matching "${query}" found</strong>
            <p>No results within ${radiusText} of this location.</p>
            <p>Try expanding your search radius or modifying your search term.</p>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error searching for restaurant:', error);
    hideLoading();
    alert('Error searching for restaurant. Please try again.');
  }
}

// Render search results with less strict filtering (for specific restaurant searches)
function renderSearchResults(places, origin, searchQuery) {
  const container = document.getElementById('places-container');
  container.innerHTML = '';
  
  // Clear existing markers
  clearMarkers();
  
  hideLoading();
  
  if (places.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">
          <strong>No restaurants matching "${searchQuery}" found</strong>
          <p>Try a different search term or expand your search radius.</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Update URL for shareable links
  updateURL(origin, 'restaurant');
  
  // Apply user-selected sorting
  const sortSelect = document.getElementById('sort-select');
  const sortBy = sortSelect ? sortSelect.value : 'rating';
  
  sortPlaces(places, sortBy, origin);
  
  // Show results count
  const resultsCount = document.getElementById('results-count');
  const countNumber = document.getElementById('count-number');
  if (resultsCount && countNumber) {
    countNumber.textContent = places.length;
    resultsCount.style.display = 'block';
  }
  
  // Display places
  places.forEach((place, index) => {
    const card = createPlaceCard(place, index);
    container.appendChild(card);
    addMarker(place, index);
  });
  
  // Initialize/update marker clustering
  updateMarkerClusterer();
  
  // Load TripAdvisor ratings for displayed places
  loadTripAdvisorForPlaces(places);
}

// Initialize My Lists modal
function initListsModal() {
  const listsButton = document.getElementById('my-lists-button');
  const createListBtn = document.getElementById('create-list-btn');
  const newListInput = document.getElementById('new-list-name');
  
  if (listsButton) {
    listsButton.addEventListener('click', function() {
      renderListsModal();
      const modal = new bootstrap.Modal(document.getElementById('lists-modal'));
      modal.show();
    });
  }
  
  if (createListBtn && newListInput) {
    createListBtn.addEventListener('click', function() {
      const name = newListInput.value.trim();
      if (name) {
        createList(name);
        newListInput.value = '';
        renderListsModal();
        showToast(`List "${name}" created!`);
      } else {
        alert('Please enter a list name');
      }
    });
    
    newListInput.addEventListener('keyup', function(event) {
      if (event.key === 'Enter') {
        createListBtn.click();
      }
    });
  }
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
  
  // Check for URL parameters (shareable URLs)
  const urlParams = getURLParams();
  const initialCenter = urlParams?.location || defaultCenter;
  const initialType = urlParams?.type || 'restaurant';
  
  // Set the initial type from URL if present
  if (urlParams?.type) {
    const typeSelect = document.getElementById('place-type-select');
    if (typeSelect) typeSelect.value = initialType;
  }
  
  // Find the map element and make sure it exists
  const mapElement = document.getElementById("map");
  if (!mapElement) {
    console.error("Map element not found!");
    return;
  }
  
  // Premium silver/desaturated map style
  const silverMapStyle = [
    {
      "elementType": "geometry",
      "stylers": [{ "color": "#f5f5f5" }]
    },
    {
      "elementType": "labels.icon",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#616161" }]
    },
    {
      "elementType": "labels.text.stroke",
      "stylers": [{ "color": "#f5f5f5" }]
    },
    {
      "featureType": "administrative.land_parcel",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#bdbdbd" }]
    },
    {
      "featureType": "poi",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "poi.park",
      "elementType": "geometry",
      "stylers": [{ "color": "#e5e5e5" }]
    },
    {
      "featureType": "road",
      "elementType": "geometry",
      "stylers": [{ "color": "#ffffff" }]
    },
    {
      "featureType": "road.arterial",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#757575" }]
    },
    {
      "featureType": "road.highway",
      "elementType": "geometry",
      "stylers": [{ "color": "#dadada" }]
    },
    {
      "featureType": "road.highway",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#616161" }]
    },
    {
      "featureType": "transit",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "water",
      "elementType": "geometry",
      "stylers": [{ "color": "#c9c9c9" }]
    },
    {
      "featureType": "water",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#9e9e9e" }]
    }
  ];

  // Create the map with explicit configuration to ensure it displays
  window.map = new google.maps.Map(mapElement, {
    zoom: 13,
    center: initialCenter,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    styles: silverMapStyle,
    gestureHandling: 'greedy',
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: true,
    rotateControl: true,
    fullscreenControl: true
  });
  
  // Force map to resize after creation
  setTimeout(() => {
    google.maps.event.trigger(window.map, 'resize');
    window.map.setCenter(initialCenter);
  }, 100);
  
  // Add a marker at the center
  new google.maps.Marker({
    position: initialCenter,
    map: window.map,
    title: urlParams ? "Shared Location" : "Amsterdam"
  });
  
  console.log("Map created successfully!");
  
  // Initialize favorites badge and lists badge
  updateFavoritesBadge();
  updateListsBadge();
  initShareButton();
  initSortDropdown();
  initRestaurantSearch();
  initListsModal();
  
  // Load places for the initial location (use default radius, no keyword)
  loadNearbyPlaces(initialCenter, '', searchRadius);
  
  // Add click event to the map
  google.maps.event.addListener(window.map, "click", function(event) {
    const clickedLocation = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    
    // Center the map on the clicked location
    window.map.setCenter(clickedLocation);
    
    // Load nearby places for this location (use current radius, clear keyword)
    loadNearbyPlaces(clickedLocation, '', searchRadius);
    
    // Hide the "Search This Area" button since we're already searching
    document.getElementById('search-this-area-btn').style.display = 'none';
  });
  
  // Track the last searched location
  window.lastSearchedCenter = defaultCenter;
  
  // Show "Search This Area" button when map is dragged
  google.maps.event.addListener(window.map, "dragend", function() {
    const newCenter = window.map.getCenter();
    const lastCenter = window.lastSearchedCenter;
    
    // Calculate distance from last search (function expects 4 numeric args)
    const distance = getDistanceInMeters(
      lastCenter.lat,
      lastCenter.lng,
      newCenter.lat(),
      newCenter.lng()
    );
    
    // Show button if moved more than 200 meters
    if (distance > 200) {
      document.getElementById('search-this-area-btn').style.display = 'block';
    }
  });
  
  // "Search This Area" button click handler
  document.getElementById('search-this-area-btn').addEventListener('click', function() {
    const newCenter = window.map.getCenter();
    const location = {
      lat: newCenter.lat(),
      lng: newCenter.lng()
    };
    
    // Update last searched center
    window.lastSearchedCenter = location;
    
    // Hide the button
    this.style.display = 'none';
    
    // Load places at new location with current keyword and radius
    loadNearbyPlaces(location, currentKeyword, searchRadius);
  });
  
  // Transit layer toggle
  window.transitLayer = new google.maps.TransitLayer();
  window.transitLayerVisible = false;
  
  document.getElementById('transit-layer-btn').addEventListener('click', function() {
    if (window.transitLayerVisible) {
      window.transitLayer.setMap(null);
      this.classList.remove('active');
      window.transitLayerVisible = false;
    } else {
      window.transitLayer.setMap(window.map);
      this.classList.add('active');
      window.transitLayerVisible = true;
    }
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
  
  // Main search button - handles both location and restaurant search
  document.getElementById("search-button").addEventListener("click", function() {
    const restaurantInput = document.getElementById('restaurant-search-input');
    const restaurantName = restaurantInput ? restaurantInput.value.trim() : '';
    
    if (restaurantName) {
      // If restaurant name provided, search for that restaurant
      searchForRestaurantByName();
    } else {
      // Otherwise do location search
      searchLocation();
    }
  });
  
  document.getElementById("location-input").addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
      const restaurantInput = document.getElementById('restaurant-search-input');
      const restaurantName = restaurantInput ? restaurantInput.value.trim() : '';
      
      if (restaurantName) {
        searchForRestaurantByName();
      } else {
        searchLocation();
      }
    }
  });
  
  // Filters toggle functionality
  const filtersToggle = document.getElementById('filters-toggle');
  const filtersPanel = document.getElementById('filters-panel');
  if (filtersToggle && filtersPanel) {
    filtersToggle.addEventListener('click', function() {
      if (filtersPanel.style.display === 'none') {
        filtersPanel.style.display = 'block';
        filtersToggle.classList.add('active');
      } else {
        filtersPanel.style.display = 'none';
        filtersToggle.classList.remove('active');
      }
    });
  }
  
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
      loadNearbyPlaces(location, searchInput, searchRadius);
    } else {
      loadNearbyPlaces(location, '', searchRadius);
    }
  });
  
  // Set up the open now checkbox event
  document.getElementById("open-now-checkbox").addEventListener("change", function() {
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    
    // Use current keyword, or fall back to search input value
    const searchInput = document.getElementById("search-input").value.trim();
    const keyword = currentKeyword || searchInput;
    loadNearbyPlaces(location, keyword, searchRadius);
  });
  
  // Set up event listeners for category buttons
  document.getElementById("restaurants-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "restaurant";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  document.getElementById("hotels-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "lodging";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  document.getElementById("attractions-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "tourist_attraction";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  document.getElementById("coffee-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "cafe";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  document.getElementById("dessert-button").addEventListener("click", function() {
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    // Pass 'dessert' as the keyword to trigger special dessert search behavior
    loadNearbyPlaces(location, 'dessert', searchRadius);
  });
  
  document.getElementById("nightlife-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "night_club";
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  // Generic handler for all category buttons without specific IDs
  document.querySelectorAll('.category-btn').forEach(button => {
    button.addEventListener('click', function() {
      const type = this.getAttribute('data-type');
      const keyword = this.getAttribute('data-keyword');
      
      // Update the select dropdown
      if (type) {
        document.getElementById("place-type-select").value = type;
      }
      
      // Remove active class from all category buttons and add to this one
      document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      // Get current location from map
      const currentLocation = window.map.getCenter();
      const location = {
        lat: currentLocation.lat(),
        lng: currentLocation.lng()
      };
      
      // Load places with keyword if present, using current radius
      if (keyword) {
        loadNearbyPlaces(location, keyword, searchRadius);
      } else {
        loadNearbyPlaces(location, '', searchRadius);
      }
    });
  });
  
  // Radius slider handler
  const radiusSlider = document.getElementById('radius-slider');
  if (radiusSlider) {
    radiusSlider.addEventListener('input', function() {
      searchRadius = parseInt(this.value);
      // Update display label if exists
      const label = document.querySelector('.search-radius-value');
      if (label) {
        label.textContent = searchRadius >= 1000 ? (searchRadius / 1000) + ' km' : searchRadius + 'm';
      }
    });
    
    // Also trigger search when slider is released
    radiusSlider.addEventListener('change', function() {
      const currentLocation = window.map.getCenter();
      loadNearbyPlaces({
        lat: currentLocation.lat(),
        lng: currentLocation.lng()
      }, currentKeyword, searchRadius);
    });
  }
  
  // Favorites button handler
  const favoritesBtn = document.getElementById('favorites-button');
  if (favoritesBtn) {
    favoritesBtn.addEventListener('click', function() {
      window.showingFavorites = !window.showingFavorites;
      this.classList.toggle('active', window.showingFavorites);
      
      if (window.showingFavorites) {
        showFavoritesView();
      } else {
        const currentLocation = window.map.getCenter();
        loadNearbyPlaces({
          lat: currentLocation.lat(),
          lng: currentLocation.lng()
        }, currentKeyword, searchRadius);
      }
    });
  }
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
        
        // Load nearby places (use current radius, clear keyword for new location)
        loadNearbyPlaces(userLocation, '', searchRadius);
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
    loadNearbyPlaces(defaultLocation, '', searchRadius);
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
      loadNearbyPlaces(placeLocation, '', searchRadius);
      
      // Show this place's details
      if (specificPlaceResult.place_id) {
        showPlaceDetails(specificPlaceResult.place_id);
      }
      
      return;
    }
    
    // If no specific place found, try geocoding the search term as an address/location
    const response = await fetch(`/api/geocoding?address=${encodeURIComponent(searchInput)}`);
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
      loadNearbyPlaces(location, '', searchRadius);
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
  window.showingFavorites = false;
  
  // Track current keyword for re-searching when radius changes
  currentKeyword = keyword;
  
  // Show skeleton loading cards
  const container = document.getElementById('places-container');
  container.innerHTML = createSkeletonCards(6);
  
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
      console.log("Performing specialized dessert multi-query search with Promise.all");
      
      // Build URLs for parallel fetching
      const baseParams = `lat=${location.lat}&lng=${location.lng}&radius=${radius}${openNowChecked ? '&opennow=true' : ''}`;
      
      // Use Promise.all for parallel fetching
      const [dessertData, cafeData, bakeryData] = await Promise.all([
        fetch(`/api/nearby?${baseParams}&type=restaurant&keyword=dessert`).then(r => r.json()),
        fetch(`/api/nearby?${baseParams}&type=cafe`).then(r => r.json()),
        fetch(`/api/nearby?${baseParams}&type=bakery`).then(r => r.json())
      ]);
      
      console.log("Dessert API response:", dessertData);
      console.log("Cafe API response for desserts:", cafeData);
      console.log("Bakery API response for desserts:", bakeryData);
      
      // Add all results to our collection
      [dessertData, cafeData, bakeryData].forEach(data => {
        if (data.status === 'OK' && data.results) {
          data.results.forEach(place => placesMap.set(place.place_id, place));
        }
      });
      
      // Convert our Map back to an array
      places = Array.from(placesMap.values());
      console.log(`Combined ${places.length} unique dessert places`);
      
      // For dessert places, we would normally use a lower minimum rating threshold
      // But this is handled in the renderPlaces function
      
      // Store for re-sorting
      window.lastPlacesData = places;
      window.lastOrigin = location;
      window.currentPlaceType = "restaurant";
      window.isDessertSearch = true;
      
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
        // Store for re-sorting
        window.lastPlacesData = data.results;
        window.lastOrigin = location;
        window.currentPlaceType = currentPlaceType;
        window.isDessertSearch = false;
        
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
        // No results - show message with keyword if used
        const keywordText = keyword ? ` matching "${keyword}"` : '';
        const radiusText = radius >= 1000 ? `${radius / 1000}km` : `${radius}m`;
        
        // Hide results count when no results
        const resultsCount = document.getElementById('results-count');
        if (resultsCount) {
          resultsCount.style.display = 'none';
        }
        
        document.getElementById('places-container').innerHTML = `
          <div class="col-12">
            <div class="alert alert-info">
              <strong>No ${formatPlaceType(currentPlaceType)}${keywordText} found</strong>
              <p>No results within ${radiusText} of this location.</p>
              <p>Try expanding your search radius, moving the map, or choosing a different category.</p>
            </div>
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
function renderPlaces(places, origin, currentPlaceType, isDessertSearch = false, filterRadius = searchRadius) {
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
    radius: filterRadius,
    minRating: MIN_RATING,
    minReviews: currentMinReviews,
    unwantedTypes: UNWANTED_TYPES
  });
  
  console.log(`After filtering: ${filteredPlaces.length} of ${places.length} places remaining`);
  
  // Clear markers before adding new ones
  clearMarkers();
  
  if (filteredPlaces.length === 0) {
    // Hide results count when no results
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
      resultsCount.style.display = 'none';
    }
    
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
  
  // Update URL for shareable links
  updateURL(origin, isDessertSearch ? 'dessert' : currentPlaceType);
  
  // Apply user-selected sorting
  const sortSelect = document.getElementById('sort-select');
  const sortBy = sortSelect ? sortSelect.value : 'rating';
  
  sortPlaces(filteredPlaces, sortBy, origin);
  
  // Show results count
  const resultsCount = document.getElementById('results-count');
  const countNumber = document.getElementById('count-number');
  if (resultsCount && countNumber) {
    countNumber.textContent = filteredPlaces.length;
    resultsCount.style.display = 'block';
  }
  
  // Display filtered and sorted places
  filteredPlaces.forEach((place, index) => {
    const card = createPlaceCard(place, index);
    container.appendChild(card);
    
    // Add a marker for this place
    addMarker(place, index);
  });
  
  // Initialize/update marker clustering
  updateMarkerClusterer();
  
  // Load TripAdvisor ratings for displayed places
  loadTripAdvisorForPlaces(filteredPlaces);
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
      .slice(0, 2);
    
    displayTypes.forEach(type => {
      typesBadges += `<span class="type-badge">${formatPlaceType(type)}</span>`;
    });
  }
  
  // Check if this place is a favorite
  const isPlaceFavorite = isFavorite(place.place_id);
  const favoriteClass = isPlaceFavorite ? 'btn-danger' : '';
  const favoriteIcon = isPlaceFavorite ? 'fas fa-heart' : 'far fa-heart';
  const favoriteTitle = isPlaceFavorite ? 'Remove from Favorites' : 'Add to Favorites';
  
  // Format open now badge
  let openBadge = '';
  if (place.opening_hours) {
    if (place.opening_hours.open_now) {
      openBadge = '<span class="badge badge-open ms-2">Open</span>';
    } else if (place.opening_hours.open_now === false) {
      openBadge = '<span class="badge badge-closed ms-2">Closed</span>';
    }
  }
  
  // Get thumbnail photo URL
  let thumbnailUrl = '';
  if (place.photos && place.photos.length > 0) {
    const photo = place.photos[0];
    if (photo.url) {
      thumbnailUrl = photo.url;
    } else if (photo.photo_reference) {
      thumbnailUrl = `/api/photo?photo_reference=${photo.photo_reference}&maxwidth=400`;
    }
  }
  
  // Create the modern card HTML with thumbnail
  card.innerHTML = `
    <div class="card h-100 place-card">
      <!-- Floating Favorite Button -->
      <button class="favorite-btn ${favoriteClass}" 
        data-place-id="${place.place_id}"
        title="${favoriteTitle}">
        <i class="${favoriteIcon}"></i>
      </button>
      
      ${thumbnailUrl ? `
        <div class="card-img-wrapper" onclick="showPlaceDetails('${place.place_id}')">
          <img src="${thumbnailUrl}" class="card-img-top" alt="${place.name}" loading="lazy">
        </div>
      ` : `
        <div class="card-img-placeholder" onclick="showPlaceDetails('${place.place_id}')">
          <i class="fas fa-utensils"></i>
        </div>
      `}
      
      <div class="card-body" onclick="showPlaceDetails('${place.place_id}')">
        <h5 class="card-title">${place.name}${openBadge}</h5>
        <p class="card-text">${place.vicinity || place.formatted_address || ''}</p>
        
        <div class="rating">
          <span class="rating-stars">${ratingStars}</span>
          <span class="rating-value">${place.rating}</span>
          <span class="rating-count">(${place.user_ratings_total})</span>
          <span class="tripadvisor-badge" data-tripadvisor-id="${place.place_id}"></span>
          ${priceLevel ? `<span class="price-level ms-2">${priceLevel}</span>` : ''}
        </div>
        
        <div class="type-badges">${typesBadges}</div>
        
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="view-details-btn" onclick="showPlaceDetails('${place.place_id}')">
            View Details
          </button>
          <button class="action-btn add-to-list-btn" 
            data-place-id="${place.place_id}"
            title="Add to List">
            <i class="fas fa-plus"></i>
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${place.geometry.location.lat},${place.geometry.location.lng}" 
            target="_blank" class="action-btn" title="Get Directions">
            <i class="fas fa-directions"></i>
          </a>
          <button class="action-btn" 
            onmouseover="updateHoverMarker({lat: ${place.geometry.location.lat}, lng: ${place.geometry.location.lng}})"
            title="Show on map">
            <i class="fas fa-map-marker-alt"></i>
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add click handler for favorite button
  const favoriteBtn = card.querySelector('.favorite-btn');
  favoriteBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const nowFavorite = toggleFavorite(place);
    this.className = `favorite-btn ${nowFavorite ? 'btn-danger' : ''}`;
    this.querySelector('i').className = nowFavorite ? 'fas fa-heart' : 'far fa-heart';
    this.title = nowFavorite ? 'Remove from Favorites' : 'Add to Favorites';
    
    // If showing favorites and we unfavorited, refresh the view
    if (window.showingFavorites && !nowFavorite) {
      setTimeout(showFavoritesView, 100);
    }
  });
  
  // Add click handler for add to list button
  const addToListBtn = card.querySelector('.add-to-list-btn');
  if (addToListBtn) {
    addToListBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      showAddToListModal(place);
    });
  }
  
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
  
  // Store place data on marker for cluster access
  marker.placeData = place;
  
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
      // Add place_id to the place object since it's not returned by the details API
      place.place_id = placeId;
      console.log("Place details:", place);
      
      // Get TripAdvisor data if available
      let tripAdvisorData = null;
      try {
        tripAdvisorData = await fetchTripAdvisorData(place);
        console.log("TripAdvisor data:", tripAdvisorData);
      } catch (tripadvisorError) {
        console.error("Error fetching TripAdvisor data:", tripadvisorError);
      }
      
      // Format opening hours with collapsible accordion
      let hoursHtml = '';
      if (place.opening_hours && place.opening_hours.weekday_text) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayIndex = new Date().getDay();
        const todayName = days[todayIndex];
        
        // Find today's hours from the weekday_text array
        let todayHours = place.opening_hours.weekday_text.find(text => text.startsWith(todayName));
        if (!todayHours) {
          // Fallback - try matching partial day name
          todayHours = place.opening_hours.weekday_text[todayIndex === 0 ? 6 : todayIndex - 1];
        }
        
        const isOpenNow = place.opening_hours.open_now;
        const statusClass = isOpenNow ? 'text-success' : 'text-danger';
        const statusIcon = isOpenNow ? '🟢' : '🔴';
        const statusText = isOpenNow ? 'Open' : 'Closed';
        
        // Extract just the hours part (after the day name and colon)
        let hoursText = todayHours ? todayHours.replace(/^[A-Za-z]+:\s*/, '') : 'Hours not available';
        
        const accordionId = 'hoursAccordion-' + place.place_id.replace(/[^a-zA-Z0-9]/g, '');
        
        hoursHtml = `
          <div class="hours-section mt-4">
            <div class="hours-summary d-flex justify-content-between align-items-center" 
                 data-bs-toggle="collapse" data-bs-target="#${accordionId}" 
                 aria-expanded="false" style="cursor: pointer;">
              <div>
                <span class="${statusClass} fw-semibold">${statusIcon} ${statusText}</span>
                <span class="text-muted ms-2">• ${hoursText}</span>
              </div>
              <i class="fas fa-chevron-down text-muted hours-chevron"></i>
            </div>
            <div class="collapse mt-3" id="${accordionId}">
              <div class="hours-list">
                ${place.opening_hours.weekday_text.map((day, i) => {
                  const isToday = day.startsWith(todayName);
                  return `<div class="hours-row d-flex justify-content-between py-2 ${isToday ? 'fw-bold' : ''}">
                    <span>${day.split(':')[0]}</span>
                    <span class="text-muted">${day.split(':').slice(1).join(':').trim()}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>
        `;
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
      
      // Format photos as Hero carousel (edge-to-edge at top)
      let heroCarouselHtml = '';
      const carouselId = 'photoCarousel-' + place.place_id.replace(/[^a-zA-Z0-9]/g, '');
      
      if (place.photos && place.photos.length > 0) {
        heroCarouselHtml = `
          <div id="${carouselId}" class="carousel slide hero-carousel" data-bs-ride="false">
            <div class="carousel-indicators">
              ${place.photos.map((_, i) => `
                <button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${i}" 
                  ${i === 0 ? 'class="active" aria-current="true"' : ''} aria-label="Slide ${i + 1}"></button>
              `).join('')}
            </div>
            <div class="carousel-inner">
        `;
        
        place.photos.forEach((photo, index) => {
          let photoUrl;
          if (photo.url) {
            photoUrl = photo.url;
          } else if (photo.photo_reference) {
            photoUrl = `/api/photo?photo_reference=${photo.photo_reference}&maxwidth=800`;
          } else {
            photoUrl = 'https://via.placeholder.com/800x400?text=No+Image';
          }
          
          heroCarouselHtml += `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
              <img src="${photoUrl}" class="d-block w-100 hero-img" alt="${place.name}">
            </div>
          `;
        });
        
        heroCarouselHtml += `
            </div>
            <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
              <span class="carousel-control-prev-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
              <span class="carousel-control-next-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Next</span>
            </button>
            <div class="photo-count-badge">${place.photos.length} photos</div>
          </div>
        `;
      } else {
        // Fallback placeholder hero
        heroCarouselHtml = `
          <div class="hero-placeholder">
            <i class="fas fa-image fa-3x text-muted"></i>
            <p class="text-muted mt-2 mb-0">No photos available</p>
          </div>
        `;
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
      
      // Build action buttons row
      const actionButtonsHtml = `
        <div class="action-buttons-row">
          ${place.formatted_phone_number ? `
            <a href="tel:${place.formatted_phone_number}" class="action-btn" title="Call">
              <div class="action-btn-icon"><i class="fas fa-phone"></i></div>
              <span class="action-btn-label">Call</span>
            </a>
          ` : `
            <div class="action-btn disabled" title="No phone available">
              <div class="action-btn-icon"><i class="fas fa-phone"></i></div>
              <span class="action-btn-label">Call</span>
            </div>
          `}
          ${place.website ? `
            <a href="${place.website}" target="_blank" class="action-btn" title="Website">
              <div class="action-btn-icon"><i class="fas fa-globe"></i></div>
              <span class="action-btn-label">Website</span>
            </a>
          ` : `
            <div class="action-btn disabled" title="No website available">
              <div class="action-btn-icon"><i class="fas fa-globe"></i></div>
              <span class="action-btn-label">Website</span>
            </div>
          `}
          ${place.url ? `
            <a href="${place.url}" target="_blank" class="action-btn" title="Directions">
              <div class="action-btn-icon"><i class="fas fa-directions"></i></div>
              <span class="action-btn-label">Directions</span>
            </a>
          ` : `
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + (place.vicinity || ''))}" target="_blank" class="action-btn" title="Directions">
              <div class="action-btn-icon"><i class="fas fa-directions"></i></div>
              <span class="action-btn-label">Directions</span>
            </a>
          `}
          <button class="action-btn share-place-btn" data-place-name="${encodeURIComponent(place.name)}" data-place-id="${place.place_id}" title="Share">
            <div class="action-btn-icon"><i class="fas fa-share-alt"></i></div>
            <span class="action-btn-label">Share</span>
          </button>
        </div>
      `;
      
      // Format price level
      const priceDisplay = place.price_level ? '$'.repeat(place.price_level) : '';
      
      // Create modal content with modern hero layout
      const modalHtml = `
        <div class="modal fade" id="placeDetailsModal" tabindex="-1" aria-labelledby="placeDetailsModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content modern-modal">
              <!-- Hero Image Section with Overlay Close Button -->
              <div class="hero-section">
                ${heroCarouselHtml}
                <button type="button" class="btn-close-overlay" data-bs-dismiss="modal" aria-label="Close">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              
              <!-- Clean Title Section -->
              <div class="modal-body">
                <div class="title-section">
                  <h4 class="place-title">${place.name}</h4>
                  <div class="place-meta">
                    ${place.rating ? `
                      <span class="rating-badge">
                        <i class="fas fa-star"></i> ${place.rating}
                      </span>
                      <span class="review-count">(${place.user_ratings_total || 0})</span>
                    ` : ''}
                    ${priceDisplay ? `<span class="price-badge">${priceDisplay}</span>` : ''}
                  </div>
                  <p class="place-address">${place.vicinity || place.formatted_address || ''}</p>
                </div>
                
                <!-- Action Buttons Row -->
                ${actionButtonsHtml}
                
                <!-- Opening Hours (Collapsible) -->
                ${hoursHtml}
                
                <!-- TripAdvisor Section -->
                ${tripAdvisorHtml}
                
                <!-- Reviews Section -->
                ${reviewsHtml}
                
                <!-- Nearby Recommendations -->
                ${recommendationsHtml}
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
      
      // Initialize when the modal is shown
      document.getElementById('placeDetailsModal').addEventListener('shown.bs.modal', function () {
        // Load nearby recommendations
        if (place.geometry && place.geometry.location) {
          loadNearbyRecommendations(place);
        }
        
        // Attach share button event listener (safe from XSS)
        const shareBtn = document.querySelector('.share-place-btn');
        if (shareBtn) {
          shareBtn.addEventListener('click', function() {
            const placeName = decodeURIComponent(this.dataset.placeName);
            const placeId = this.dataset.placeId;
            sharePlace(placeName, placeId);
          });
        }
      });
      
      // Clean up modal when hidden
      document.getElementById('placeDetailsModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
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
      loadNearbyPlaces(location, '', searchRadius);
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
    
    // OpenWeather API returns weather data directly (check for main.temp)
    if (data && data.main && data.main.temp !== undefined) {
      displayWeatherData(data);
    } else if (data && data.status === 'ERROR') {
      console.error("Weather API error:", data.message || "Unknown error");
    }
  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
}

/**
 * Display weather data in the UI
 * @param {Object} data - Weather data from OpenWeather API
 */
function displayWeatherData(data) {
  const weatherContainer = document.getElementById('weather-container');
  const weatherPill = document.getElementById('weather-pill');
  
  if (!data || !data.main) {
    if (weatherContainer) weatherContainer.style.display = 'none';
    if (weatherPill) weatherPill.style.display = 'none';
    return;
  }
  
  // Extract data from OpenWeather API format
  const temp = Math.round(data.main.temp);
  const humidity = data.main.humidity;
  const windSpeed = data.wind ? data.wind.speed : 0;
  const description = data.weather && data.weather[0] ? data.weather[0].description : '';
  const iconCode = data.weather && data.weather[0] ? data.weather[0].icon : '01d';
  const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  
  // Update the weather pill (glassmorphism style on map)
  if (weatherPill) {
    const iconMini = document.getElementById('weather-icon-mini');
    const tempMini = document.getElementById('weather-temp-mini');
    const descMini = document.getElementById('weather-desc-mini');
    
    if (iconMini) iconMini.innerHTML = `<img src="${iconUrl}" alt="${description}">`;
    if (tempMini) tempMini.textContent = `${temp}°`;
    if (descMini) descMini.textContent = description.charAt(0).toUpperCase() + description.slice(1);
    
    weatherPill.style.display = 'flex';
  }
  const cityName = data.name || '';
  
  // Current weather HTML
  const weatherHtml = `
    <div class="col-12">
      <div class="card">
        <div class="card-body">
          <div class="d-flex align-items-center">
            <img src="${iconUrl}" alt="${description}" class="weather-icon" style="width: 50px; height: 50px;">
            <div class="ms-3">
              <div class="h4 mb-0">${temp}°C</div>
              <div class="text-capitalize">${description}</div>
              ${cityName ? `<small class="text-muted">${cityName}</small>` : ''}
            </div>
            <div class="ms-auto text-end">
              <div><i class="fas fa-tint"></i> ${humidity}%</div>
              <div><i class="fas fa-wind"></i> ${windSpeed} m/s</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  weatherContainer.innerHTML = weatherHtml;
  weatherContainer.style.display = 'flex';
  
  // Add a dark mode class if dark mode is enabled
  if (document.body.classList.contains('dark-mode')) {
    weatherContainer.classList.add('dark-mode');
  } else {
    weatherContainer.classList.remove('dark-mode');
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