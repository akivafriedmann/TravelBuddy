// ==================== GLOBAL STATE ====================
let searchRadius = 1500; // Default search radius in meters
let currentKeyword = ''; // Track the current keyword filter

// ==================== CUISINE HIERARCHY FOR DRILL-DOWN FILTERS ====================
const cuisineHierarchy = {
  'Date Night': ['Dinner', 'Drinks', 'First Date', 'Anniversary', 'Activity', 'Speakeasy'],
  'Cheap Eats': ['Street Food', 'Food Trucks', 'Markets', 'Fast Food', 'Late Night', 'Under €15'],
  'Asian': ['Thai', 'Chinese', 'Japanese', 'Vietnamese', 'Korean', 'Indian', 'Sushi'],
  'European': ['Italian', 'French', 'Spanish', 'Greek', 'Tapas'],
  'Latin': ['Mexican', 'Tacos', 'Argentinian', 'Peruvian'],
  'American': ['Burgers', 'BBQ', 'Steakhouse', 'Diner'],
  'Healthy': ['Vegan', 'Vegetarian', 'Salad', 'Juice Bar'],
  'Brunch': ['Bottomless', 'Pancakes', 'Avocado Toast', 'Eggs Benny', 'Buffet', 'Bagels'],
  'Lunch': ['Business', 'Terrace', 'Classic', 'Fine Dining', 'Healthy']
};

const dateNightKeywords = {
  'Dinner': 'romantic restaurant candlelit',
  'Drinks': 'romantic cocktail bar intimate',
  'First Date': 'casual date night fun bar',
  'Anniversary': 'fine dining romantic view white tablecloth',
  'Activity': 'bowling minigolf arcade date activity',
  'Speakeasy': 'hidden bar speakeasy'
};

const cheapEatsKeywords = {
  'Street Food': 'best street food snacks',
  'Food Trucks': 'food truck food stand',
  'Markets': 'food market food court',
  'Fast Food': 'fast food quick bite',
  'Late Night': 'late night food cheap',
  'Under €15': 'budget restaurant good value'
};

const brunchKeywords = {
  'Bottomless': 'bottomless brunch boozy unlimited drinks mimosa',
  'Pancakes': 'best pancakes fluffy stack breakfast',
  'Avocado Toast': 'best avocado toast specialty coffee',
  'Eggs Benny': 'eggs benedict hollandaise brunch',
  'Buffet': 'brunch buffet all you can eat',
  'Bagels': 'fresh bagels cream cheese salmon lox'
};

const lunchKeywords = {
  'Business': 'business lunch quiet upscale restaurant',
  'Terrace': 'lunch restaurant terrace outdoor seating',
  'Classic': 'classic bistro lunch steak tartare club sandwich',
  'Fine Dining': 'michelin lunch tasting menu fine dining',
  'Healthy': 'upscale healthy lunch organic salad'
};

// ==================== GOOGLE ANALYTICS HELPER ====================
function trackEvent(eventName, params = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, params);
    console.log('GA Event:', eventName, params);
  }
}

// ==================== HASH ROUTING FOR SHAREABLE URLS ====================
function updateUrlHash(placeId) {
  if (placeId) {
    window.location.hash = '#/place/' + placeId;
  }
}

function clearUrlHash() {
  if (window.location.hash) {
    history.pushState('', document.title, window.location.pathname + window.location.search);
  }
}

function getPlaceIdFromHash() {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#/place/')) {
    return hash.replace('#/place/', '');
  }
  return null;
}

// Check hash on page load and open place if found
function checkHashOnLoad() {
  const placeId = getPlaceIdFromHash();
  if (placeId) {
    console.log('Opening place from URL hash:', placeId);
    // Delay slightly to ensure map is ready
    setTimeout(() => {
      showPlaceDetails(placeId);
    }, 1000);
  }
}

// Clear hash when modal is closed
document.addEventListener('DOMContentLoaded', function() {
  const placeModal = document.getElementById('place-details-modal');
  if (placeModal) {
    placeModal.addEventListener('hidden.bs.modal', function() {
      clearUrlHash();
    });
  }
  
  // Travel Essentials button handler
  const essentialsBtn = document.getElementById('travel-essentials-btn');
  if (essentialsBtn) {
    essentialsBtn.addEventListener('click', function() {
      // Update city name in modal if available
      const citySpan = document.getElementById('esim-city');
      if (citySpan && window.currentCity) {
        citySpan.textContent = window.currentCity;
      }
      
      const modal = new bootstrap.Modal(document.getElementById('travel-essentials-modal'));
      modal.show();
    });
  }


  // Concierge modal handler
  const conciergeBtn = document.getElementById('concierge-btn');
  if (conciergeBtn) {
    conciergeBtn.addEventListener('click', function () {
      trackEvent('open_concierge_modal');
      const modal = new bootstrap.Modal(document.getElementById('concierge-modal'));
      modal.show();
    });
  }

  const conciergeForm = document.getElementById('concierge-form');
  if (conciergeForm) {
    conciergeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const payload = {
        email: document.getElementById('concierge-email')?.value?.trim(),
        city: document.getElementById('concierge-city')?.value?.trim(),
        vibe: document.getElementById('concierge-vibe')?.value?.trim(),
        budget: document.getElementById('concierge-budget')?.value?.trim(),
        createdAt: new Date().toISOString()
      };
      try {
        const key = 'crave_concierge_leads';
        const leads = JSON.parse(localStorage.getItem(key) || '[]');
        leads.push(payload);
        localStorage.setItem(key, JSON.stringify(leads));
      } catch (_) {}

      trackEvent('generate_lead', { content_type: 'concierge', city: payload.city || 'unknown' });

      const subject = encodeURIComponent(`Crave Concierge Request — ${payload.city || 'City'}`);
      const body = encodeURIComponent(`Email: ${payload.email}
City: ${payload.city}
Vibe: ${payload.vibe || '-'}
Budget: ${payload.budget || '-'}
Source: craving.life concierge modal`);
      window.location.href = `mailto:hello@craving.life?subject=${subject}&body=${body}`;
      alert('Request captured. Your email app will open to send details.');
      conciergeForm.reset();
    });
  }
  
  // Track clicks on essentials links
  document.getElementById('esim-link')?.addEventListener('click', function() {
    trackEvent('generate_lead', { content_type: 'esim', item_id: 'airalo' });
  });
  
  document.getElementById('insurance-link')?.addEventListener('click', function() {
    trackEvent('generate_lead', { content_type: 'insurance', item_id: 'safetywing' });
  });
  
  // Event delegation for dynamically created Booking and TripAdvisor buttons
  document.body.addEventListener('click', function(e) {
    // Track Booking.com button clicks
    if (e.target.closest('.btn-booking-cta')) {
      trackEvent('generate_lead', { 
        content_type: 'booking', 
        item_id: 'booking_com',
        item_name: 'Check Rates & Availability'
      });
    }
    
    // Track TripAdvisor button clicks
    if (e.target.closest('.btn-tripadvisor-cta')) {
      trackEvent('generate_lead', { 
        content_type: 'tripadvisor', 
        item_id: 'tripadvisor_search',
        item_name: 'Find on TripAdvisor'
      });
    }
  });
});

// ==================== SECURITY: HTML SANITIZATION ====================
function sanitizeHTML(html) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html, { 
      USE_PROFILES: { html: true },
      ADD_ATTR: ['data-place-id', 'data-list-id', 'data-tripadvisor-id', 'data-lat', 'data-lng']
    });
  }
  return html;
}

function escapeHTML(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
  
  container.innerHTML = sanitizeHTML(lists.map(list => `
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
  `).join(''));
  
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
  
  // Build view details using data attributes for event delegation
  return `
    <div class="restaurant-list-item d-flex align-items-start mb-3 p-2 border rounded">
      <img src="${photoUrl}" alt="${escapeHTML(restaurant.name)}" class="rounded me-3" style="width: 80px; height: 80px; object-fit: cover;" onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'">
      <div class="flex-grow-1">
        <h6 class="mb-1 clickable-place" style="cursor: pointer;" data-place-id="${restaurant.place_id}">${escapeHTML(restaurant.name)}</h6>
        <p class="text-muted small mb-1">
          <i class="fas fa-map-marker-alt"></i> ${escapeHTML(restaurant.address || 'Address not available')}
        </p>
        <div class="d-flex gap-2 flex-wrap">
          <a href="${mapsLink}" target="_blank" class="btn btn-sm btn-outline-primary" ${!lat || !lng ? 'style="display:none;"' : ''}>
            <i class="fas fa-map"></i> Map
          </a>
          <button class="btn btn-sm btn-outline-info clickable-place" data-place-id="${restaurant.place_id}">
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
    optionsContainer.innerHTML = sanitizeHTML(lists.map(list => {
      const alreadyInList = list.restaurants.some(r => r.place_id === place.place_id);
      return `
        <button class="btn ${alreadyInList ? 'btn-success' : 'btn-outline-primary'} w-100 mb-2 add-to-specific-list" 
                data-list-id="${list.id}" ${alreadyInList ? 'disabled' : ''}>
          <i class="fas ${alreadyInList ? 'fa-check' : 'fa-plus'}"></i> 
          ${list.name} ${alreadyInList ? '(Already added)' : ''}
        </button>
      `;
    }).join(''));
    
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
    
    if (!response.ok) {
      tripAdvisorCache.set(cacheKey, null);
      return null;
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      tripAdvisorCache.set(cacheKey, null);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.result?.tripadvisor_data) {
      tripAdvisorCache.set(cacheKey, data.result.tripadvisor_data);
      return data.result.tripadvisor_data;
    }
    
    tripAdvisorCache.set(cacheKey, null);
    return null;
  } catch (error) {
    tripAdvisorCache.set(cacheKey, null);
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
window.currentCategoryMode = 'restaurant'; // Track current category for exclusive toggle

function getClusterColor() {
  // Purple for hotels, Green for everything else
  return window.currentCategoryMode === 'lodging' ? '#8E44AD' : '#0E2F23';
}

function createCustomClusterRenderer() {
  const clusterColor = getClusterColor();
  return {
    render: function({ count, position }, stats) {
      // Dynamic cluster color based on category
      const marker = new google.maps.Marker({
        position,
        zIndex: 1000 + count,
        title: `${count} places in this area - click to see them`,
        label: {
          text: String(count),
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: '12px'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 18,
          fillColor: clusterColor,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
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
            <button type="button" class="btn" id="zoom-to-cluster" style="background-color: #1B4D3E; color: white; border: none;">
              <i class="fas fa-search-plus me-1"></i>Zoom to Area
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  const listContainer = document.getElementById('cluster-places-list');
  listContainer.innerHTML = sanitizeHTML(places.map((place, i) => `
    <div class="cluster-place-item d-flex align-items-center p-2 border-bottom clickable-place cluster-modal-place" 
         style="cursor: pointer" data-place-id="${place.place_id}">
      <div class="flex-grow-1">
        <strong>${escapeHTML(place.name)}</strong>
        <div class="small text-muted">
          <span class="text-warning">${'★'.repeat(Math.round(place.rating || 0))}</span>
          ${place.rating || 'N/A'} (${place.user_ratings_total || 0} reviews)
        </div>
      </div>
      <i class="fas fa-chevron-right text-muted"></i>
    </div>
  `).join(''));
  
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
  
  // Always clear and reinitialize to pick up current category color
  if (window.clusterInstance) {
    window.clusterInstance.clearMarkers();
    window.clusterInstance.setMap(null);
    window.clusterInstance = null;
  }
  
  // Create fresh clusterer with current category color
  if (MarkerClustererClass && window.markers && window.markers.length > 0) {
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
  
  // Track search keyword for smart snippets
  window.lastSearchKeyword = query;
  
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
  
  // Prioritize name matches: boost places with matching names to the top
  const queryLower = searchQuery.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  // Score each place based on name match quality
  places.forEach(place => {
    const nameLower = place.name.toLowerCase();
    let matchScore = 0;
    
    // Exact match gets highest score
    if (nameLower === queryLower) {
      matchScore = 1000;
    }
    // Name contains full query
    else if (nameLower.includes(queryLower)) {
      matchScore = 500;
    }
    // Query contains full name (user typed more than name)
    else if (queryLower.includes(nameLower)) {
      matchScore = 400;
    }
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) {
      matchScore = 300;
    }
    // Check word matches
    else {
      queryWords.forEach(word => {
        if (nameLower.includes(word)) {
          matchScore += 50;
        }
      });
    }
    
    place._nameMatchScore = matchScore;
  });
  
  // Sort: first by name match score (highest first), then by rating
  places.sort((a, b) => {
    const scoreA = a._nameMatchScore || 0;
    const scoreB = b._nameMatchScore || 0;
    
    // If both have name match scores, sort by score first
    if (scoreA > 0 || scoreB > 0) {
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
    }
    
    // Then fall back to rating
    return (b.rating || 0) - (a.rating || 0);
  });
  
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
  
  // TripAdvisor ratings now loaded on-demand via external link to save API credits
}

// ==================== DRAWER STATE ====================
let currentExpandedListId = null;

// Initialize Guidebook Drawer
function initListsModal() {
  const listsButton = document.getElementById('my-lists-button');
  const drawer = document.getElementById('lists-drawer');
  const overlay = document.getElementById('lists-drawer-overlay');
  const closeBtn = document.getElementById('drawer-close-btn');
  const createListBtn = document.getElementById('create-list-btn');
  const newListInput = document.getElementById('new-list-name');
  
  if (listsButton) {
    listsButton.addEventListener('click', function() {
      openDrawer();
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDrawer);
  }
  
  if (overlay) {
    overlay.addEventListener('click', closeDrawer);
  }
  
  if (createListBtn && newListInput) {
    createListBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const name = newListInput.value.trim();
      if (name) {
        createList(name);
        newListInput.value = '';
        renderDrawerContent();
        showToast(`"${name}" created!`);
      }
    });
    
    newListInput.addEventListener('keyup', function(event) {
      if (event.key === 'Enter') {
        createListBtn.click();
      }
    });
  }
  
  // Close popup when clicking outside
  document.addEventListener('click', function(e) {
    const popup = document.getElementById('save-to-list-popup');
    if (popup && popup.style.display !== 'none') {
      if (!popup.contains(e.target) && !e.target.closest('.btn-save-to-list')) {
        popup.style.display = 'none';
      }
    }
  });
  
  // Popup close button
  document.getElementById('popup-close-btn')?.addEventListener('click', function() {
    document.getElementById('save-to-list-popup').style.display = 'none';
  });
  
  // Quick create in popup
  const quickCreateBtn = document.getElementById('quick-create-list-btn');
  const quickCreateInput = document.getElementById('quick-create-list-name');
  if (quickCreateBtn && quickCreateInput) {
    quickCreateBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const name = quickCreateInput.value.trim();
      if (name && window.currentSavePlace) {
        const newList = createList(name);
        addRestaurantToList(newList.id, window.currentSavePlace);
        quickCreateInput.value = '';
        document.getElementById('save-to-list-popup').style.display = 'none';
        showToast(`Saved to "${name}"!`);
        updateSaveButtonState(window.currentSavePlace.place_id);
      }
    });
    
    quickCreateInput.addEventListener('keyup', function(e) {
      if (e.key === 'Enter') quickCreateBtn.click();
    });
  }
}

function openDrawer() {
  const drawer = document.getElementById('lists-drawer');
  const overlay = document.getElementById('lists-drawer-overlay');
  
  if (!drawer || !overlay) {
    console.error('Drawer elements not found. Please refresh the page.');
    showToast('Please refresh your browser to use Guidebooks', 'error');
    return;
  }
  
  currentExpandedListId = null;
  renderDrawerContent();
  drawer.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  const drawer = document.getElementById('lists-drawer');
  const overlay = document.getElementById('lists-drawer-overlay');
  
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function renderDrawerContent() {
  const container = document.getElementById('lists-container');
  if (!container) return;
  
  const lists = getLists();
  
  if (currentExpandedListId) {
    const list = lists.find(l => l.id === currentExpandedListId);
    if (list) {
      renderExpandedList(container, list);
      return;
    }
  }
  
  if (lists.length === 0) {
    container.innerHTML = `
      <div class="lists-empty-state">
        <i class="fas fa-book-open"></i>
        <h4>Start Your Guidebook</h4>
        <p>Save your favorite spots and create travel guides</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = sanitizeHTML(lists.map(list => {
    const bgImage = getListCoverImage(list);
    return `
      <div class="guidebook-card" data-list-id="${list.id}">
        <div class="guidebook-card-bg" style="background-image: url('${bgImage}')"></div>
        <div class="guidebook-card-overlay"></div>
        <div class="guidebook-card-content">
          <div class="guidebook-card-title">${escapeHTML(list.name)}</div>
          <div class="guidebook-card-count">${list.restaurants.length} place${list.restaurants.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="guidebook-card-actions">
          <button class="guidebook-action-btn share-btn" data-list-id="${list.id}" title="Share">
            <i class="fas fa-share-alt"></i>
          </button>
          <button class="guidebook-action-btn delete-btn" data-list-id="${list.id}" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join(''));
  
  // Card click to expand
  container.querySelectorAll('.guidebook-card').forEach(card => {
    card.addEventListener('click', function(e) {
      if (!e.target.closest('.guidebook-action-btn')) {
        currentExpandedListId = this.dataset.listId;
        renderDrawerContent();
      }
    });
  });
  
  // Share button
  container.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      shareList(this.dataset.listId);
    });
  });
  
  // Delete button
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const listId = this.dataset.listId;
      const list = getLists().find(l => l.id === listId);
      if (confirm(`Delete "${list.name}"?`)) {
        deleteList(listId);
        renderDrawerContent();
        showToast('List deleted');
      }
    });
  });
}

function renderExpandedList(container, list) {
  const placesHtml = list.restaurants.length === 0 
    ? '<p class="text-muted text-center" style="padding: 24px;">No places saved yet</p>'
    : list.restaurants.map(r => `
        <div class="guidebook-place-item" data-place-id="${r.place_id}">
          <img src="${r.photoUrl || 'https://via.placeholder.com/64x64?text=No+Image'}" 
               class="guidebook-place-image" 
               onerror="this.src='https://via.placeholder.com/64x64?text=No+Image'">
          <div class="guidebook-place-info">
            <div class="guidebook-place-name">${escapeHTML(r.name)}</div>
            <div class="guidebook-place-address">${escapeHTML(r.address || 'Address not available')}</div>
          </div>
          <button class="guidebook-place-remove" data-place-id="${r.place_id}" title="Remove">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join('');
  
  container.innerHTML = sanitizeHTML(`
    <div class="guidebook-expanded">
      <button class="guidebook-back-btn">
        <i class="fas fa-arrow-left"></i>
        <span>All Guidebooks</span>
      </button>
      <div class="guidebook-expanded-header">
        <h3 class="guidebook-expanded-title">${escapeHTML(list.name)}</h3>
        <p class="guidebook-expanded-count">${list.restaurants.length} place${list.restaurants.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="guidebook-places-list">
        ${placesHtml}
      </div>
    </div>
  `);
  
  // Back button
  container.querySelector('.guidebook-back-btn')?.addEventListener('click', function() {
    currentExpandedListId = null;
    renderDrawerContent();
  });
  
  // Click place to view details
  container.querySelectorAll('.guidebook-place-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (!e.target.closest('.guidebook-place-remove')) {
        closeDrawer();
        showPlaceDetails(this.dataset.placeId);
      }
    });
  });
  
  // Remove from list
  container.querySelectorAll('.guidebook-place-remove').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      removeRestaurantFromList(list.id, this.dataset.placeId);
      renderDrawerContent();
    });
  });
}

function getListCoverImage(list) {
  if (list.restaurants.length > 0 && list.restaurants[0].photoUrl) {
    return list.restaurants[0].photoUrl;
  }
  return 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80';
}

function shareList(listId) {
  const list = getLists().find(l => l.id === listId);
  if (!list) return;
  
  const placeNames = list.restaurants.slice(0, 5).map(r => r.name).join(', ');
  const moreCount = list.restaurants.length > 5 ? ` +${list.restaurants.length - 5} more` : '';
  const text = `Check out my "${list.name}" guidebook on Crave: ${placeNames}${moreCount}`;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
    });
  } else {
    showToast('Share: ' + text);
  }
}

// Show Save to List popup
function showSaveToListPopup(place, buttonElement) {
  window.currentSavePlace = place;
  const popup = document.getElementById('save-to-list-popup');
  const optionsContainer = document.getElementById('save-to-list-options');
  const lists = getLists();
  
  if (lists.length === 0) {
    optionsContainer.innerHTML = '<p class="text-muted small">No guidebooks yet. Create one below!</p>';
  } else {
    optionsContainer.innerHTML = sanitizeHTML(lists.map(list => {
      const isInList = list.restaurants.some(r => r.place_id === place.place_id);
      return `
        <button class="save-list-option ${isInList ? 'saved' : ''}" data-list-id="${list.id}">
          <i class="fas ${isInList ? 'fa-check' : 'fa-book-open'}"></i>
          <span class="save-list-option-name">${escapeHTML(list.name)}</span>
        </button>
      `;
    }).join(''));
    
    optionsContainer.querySelectorAll('.save-list-option').forEach(opt => {
      opt.addEventListener('click', function() {
        const listId = this.dataset.listId;
        const list = getLists().find(l => l.id === listId);
        const isInList = list.restaurants.some(r => r.place_id === place.place_id);
        
        if (isInList) {
          removeRestaurantFromList(listId, place.place_id);
          showToast(`Removed from "${list.name}"`);
        } else {
          addRestaurantToList(listId, place);
          showToast(`Saved to "${list.name}"!`);
        }
        popup.style.display = 'none';
        updateSaveButtonState(place.place_id);
      });
    });
  }
  
  // Position popup near the button
  const rect = buttonElement.getBoundingClientRect();
  popup.style.display = 'block';
  
  // Center on screen for mobile, position near button for desktop
  if (window.innerWidth < 768) {
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  } else {
    popup.style.top = Math.min(rect.bottom + 8, window.innerHeight - 350) + 'px';
    popup.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';
    popup.style.transform = 'none';
  }
}

// Check if place is saved in any list
function isPlaceSaved(placeId) {
  return getLists().some(list => list.restaurants.some(r => r.place_id === placeId));
}

// Update save button state
function updateSaveButtonState(placeId) {
  const isSaved = isPlaceSaved(placeId);
  document.querySelectorAll(`.btn-save-to-list[data-place-id="${placeId}"]`).forEach(btn => {
    if (isSaved) {
      btn.classList.add('saved');
      btn.innerHTML = '<i class="fas fa-bookmark"></i> Saved';
    } else {
      btn.classList.remove('saved');
      btn.innerHTML = '<i class="far fa-bookmark"></i> Save';
    }
  });
}

// Legacy render function (kept for compatibility)
function renderListsModal() {
  renderDrawerContent();
}

function toggleDarkMode(enabled) {
  const body = document.body;
  
  if (enabled) {
    body.classList.add('dark-mode');
    // Apply dark mode map style if map is initialized - with POI/transit hidden
    if (window.map) {
      window.map.setOptions({
        styles: [
          { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
          { featureType: "all", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
          { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }, { visibility: "on" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
          { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
          { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
          { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
          { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
          { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] }
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
    // Reset to Minimalist "Architectural" style - clean luxury feel with visible contrast
    if (window.map) {
      window.map.setOptions({
        styles: [
          { featureType: "all", elementType: "geometry", stylers: [{ color: "#f0f0f0" }] },
          { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
          { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
          { featureType: "all", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
          { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#b8e6b8" }, { visibility: "on" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
          { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
          { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#a8d4e6" }] },
          { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5c8a9e" }] }
        ]
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
  
  // Minimalist "Architectural" style - clean luxury feel with visible contrast
  const silverMapStyle = [
    { featureType: "all", elementType: "geometry", stylers: [{ color: "#f0f0f0" }] },
    { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "all", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#b8e6b8" }, { visibility: "on" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#a8d4e6" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5c8a9e" }] }
  ];

  // Premium dark mode map style - with POI/transit icons hidden
  const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "all", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }, { visibility: "on" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] }
  ];
  
  // Default to light mode
  const isDarkModePreferred = false;
  
  // Create the map with explicit configuration
  // Note: Without mapId, we use regular markers and can apply custom styles
  window.map = new google.maps.Map(mapElement, {
    zoom: 13,
    center: initialCenter,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    gestureHandling: 'cooperative',
    disableDefaultUI: true,
    styles: isDarkModePreferred ? darkMapStyle : silverMapStyle
  });
  
  // Force map to resize after creation
  setTimeout(() => {
    google.maps.event.trigger(window.map, 'resize');
    window.map.setCenter(initialCenter);
  }, 100);
  
  // Add a marker at the center using AdvancedMarkerElement
  createAdvancedMarker({
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
  
  // Check URL hash for shareable links (defer to ensure map and data are ready)
  setTimeout(() => {
    checkHashOnLoad();
  }, 2000);
  
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
  
  // Track the last searched location and zoom level
  window.lastSearchedCenter = defaultCenter;
  window.lastSearchedZoom = window.map.getZoom();
  window.mapUserInteracting = false;
  
  // Detect when user starts interacting with the map
  google.maps.event.addListener(window.map, "dragstart", function() {
    window.mapUserInteracting = true;
  });
  
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
    window.mapUserInteracting = false;
  });
  
  // Show "Search This Area" button when map is zoomed by user
  google.maps.event.addListener(window.map, "zoom_changed", function() {
    // Only show if user has interacted AND zoom actually changed from last search
    const currentZoom = window.map.getZoom();
    if (window.mapUserInteracting || currentZoom !== window.lastSearchedZoom) {
      // Delay slightly to distinguish from programmatic zooms
      setTimeout(function() {
        if (currentZoom !== window.lastSearchedZoom) {
          document.getElementById('search-this-area-btn').style.display = 'block';
        }
      }, 100);
    }
  });
  
  // "Search This Area" button click handler
  document.getElementById('search-this-area-btn').addEventListener('click', function() {
    const newCenter = window.map.getCenter();
    const location = {
      lat: newCenter.lat(),
      lng: newCenter.lng()
    };
    
    // Update last searched center and zoom
    window.lastSearchedCenter = location;
    window.lastSearchedZoom = window.map.getZoom();
    
    // Hide the button
    this.style.display = 'none';
    
    // Load places at new location with current keyword and radius
    loadNearbyPlaces(location, currentKeyword, searchRadius);
  });
  
  // Transit layer toggle
  window.transitLayer = new google.maps.TransitLayer();
  window.transitLayerVisible = false;
  
  // Legal modal link
  document.getElementById('legal-link').addEventListener('click', function(e) {
    e.preventDefault();
    const legalModal = new bootstrap.Modal(document.getElementById('legalModal'));
    legalModal.show();
  });
  
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
  
  // Default to light mode
  const prefersDarkMode = false;
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
    trackEvent('select_content', { content_type: 'filter', item_id: 'restaurant', item_name: 'Restaurants' });
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  document.getElementById("hotels-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "lodging";
    trackEvent('select_content', { content_type: 'filter', item_id: 'lodging', item_name: 'Hotels' });
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  document.getElementById("attractions-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "tourist_attraction";
    trackEvent('select_content', { content_type: 'filter', item_id: 'tourist_attraction', item_name: 'Attractions' });
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  document.getElementById("coffee-button").addEventListener("click", function() {
    document.getElementById("place-type-select").value = "cafe";
    trackEvent('select_content', { content_type: 'filter', item_id: 'cafe', item_name: 'Coffee' });
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  document.getElementById("dessert-button").addEventListener("click", function() {
    trackEvent('select_content', { content_type: 'filter', item_id: 'dessert', item_name: 'Dessert' });
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
    trackEvent('select_content', { content_type: 'filter', item_id: 'night_club', item_name: 'Nightlife' });
    const currentLocation = window.map.getCenter();
    const location = {
      lat: currentLocation.lat(),
      lng: currentLocation.lng()
    };
    loadNearbyPlaces(location, '', searchRadius);
  });
  
  // Generic handler for all category buttons without specific IDs
  // Implements EXCLUSIVE TOGGLE: Only one category at a time, clear map before switching
  document.querySelectorAll('.category-btn').forEach(button => {
    button.addEventListener('click', function() {
      const type = this.getAttribute('data-type');
      const keyword = this.getAttribute('data-keyword');
      const barTypes = this.getAttribute('data-bar-types');
      const isDateDrinks = this.classList.contains('date-drinks-btn');
      const cuisineParent = this.getAttribute('data-cuisine-parent');
      
      // Update the select dropdown
      if (type) {
        document.getElementById("place-type-select").value = type;
      }
      
      // Track current category mode for cluster colors
      window.currentCategoryMode = type || 'restaurant';
      
      // Track if we're in date drinks mode for special filtering
      window.isDateDrinksMode = isDateDrinks;
      window.dateBarTypes = barTypes ? barTypes.split(',') : null;
      
      // Remove active class and hotel-active from all category buttons
      document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active', 'hotel-active');
      });
      
      // Add active class (and hotel-active for lodging)
      this.classList.add('active');
      if (type === 'lodging') {
        this.classList.add('hotel-active');
      }
      
      // Track filter selection in Google Analytics
      trackEvent('select_content', { 
        content_type: 'filter', 
        item_id: keyword || type || 'category',
        item_name: this.textContent.trim()
      });
      
      // Handle sub-filter display for cuisine parent categories
      const subFilterContainer = document.getElementById('sub-filter-container');
      if (cuisineParent && cuisineHierarchy[cuisineParent]) {
        // Show sub-filters for this cuisine category
        renderSubFilters(cuisineParent);
        subFilterContainer.classList.add('visible');
      } else {
        // Hide sub-filters for non-cuisine categories and reset state
        subFilterContainer.classList.remove('visible');
        subFilterContainer.innerHTML = '';
        window.activeCuisineParent = null;
        window.activeCuisineParentKeyword = null;
      }
      
      // EXCLUSIVE TOGGLE: Clear existing markers/clusters before loading new category
      clearMarkers();
      if (window.clusterInstance) {
        window.clusterInstance.clearMarkers();
        window.clusterInstance = null;
      }
      
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
  
  // Track current active cuisine parent for sub-filter scoping
  window.activeCuisineParent = null;
  window.activeCuisineParentKeyword = null;
  
  // Function to render sub-filter pills for cuisine drill-down
  function renderSubFilters(parentCategory) {
    const container = document.getElementById('sub-filter-container');
    if (!container || !cuisineHierarchy[parentCategory]) return;
    
    // Store parent info for scoped sub-filter handling
    window.activeCuisineParent = parentCategory;
    const parentButton = document.querySelector(`[data-cuisine-parent="${parentCategory}"]`);
    window.activeCuisineParentKeyword = parentButton?.getAttribute('data-keyword') || '';
    
    const subCategories = cuisineHierarchy[parentCategory];
    container.innerHTML = subCategories.map(sub => 
      `<button class="sub-filter-pill" data-sub-cuisine="${sub}" data-parent="${parentCategory}">${sub}</button>`
    ).join('');
    
    // Add click handlers for sub-filter pills (scoped to parent)
    container.querySelectorAll('.sub-filter-pill').forEach(pill => {
      pill.addEventListener('click', function() {
        const subCuisine = this.getAttribute('data-sub-cuisine');
        const pillParent = this.getAttribute('data-parent');
        
        // Guard: Only respond if this pill's parent is still the active cuisine
        if (window.activeCuisineParent !== pillParent) {
          return;
        }
        
        // Toggle active state
        const wasActive = this.classList.contains('active');
        container.querySelectorAll('.sub-filter-pill').forEach(p => p.classList.remove('active'));
        
        if (!wasActive) {
          this.classList.add('active');
        }
        
        // Track sub-filter selection
        trackEvent('select_content', { 
          content_type: 'sub_filter', 
          item_id: subCuisine.toLowerCase(),
          item_name: subCuisine
        });
        
        // Search for the specific sub-cuisine
        const currentLocation = window.map.getCenter();
        const location = {
          lat: currentLocation.lat(),
          lng: currentLocation.lng()
        };
        
        // Clear markers before new search
        clearMarkers();
        if (window.clusterInstance) {
          window.clusterInstance.clearMarkers();
          window.clusterInstance = null;
        }
        
        // If deactivating, search for parent category (using stored keyword); otherwise search for sub-cuisine
        if (wasActive) {
          loadNearbyPlaces(location, window.activeCuisineParentKeyword, searchRadius);
        } else {
          // Check if this is a Date Night, Cheap Eats, or Brunch sub-category with custom keywords
          if (pillParent === 'Date Night' && dateNightKeywords[subCuisine]) {
            loadNearbyPlaces(location, dateNightKeywords[subCuisine], searchRadius);
          } else if (pillParent === 'Cheap Eats' && cheapEatsKeywords[subCuisine]) {
            loadNearbyPlaces(location, cheapEatsKeywords[subCuisine], searchRadius);
          } else if (pillParent === 'Brunch' && brunchKeywords[subCuisine]) {
            loadNearbyPlaces(location, brunchKeywords[subCuisine], searchRadius);
          } else if (pillParent === 'Lunch' && lunchKeywords[subCuisine]) {
            loadNearbyPlaces(location, lunchKeywords[subCuisine], searchRadius);
          } else {
            loadNearbyPlaces(location, subCuisine.toLowerCase() + ' restaurant', searchRadius);
          }
        }
      });
    });
  }
  
  // Price filter pills handler
  window.activePriceFilter = null; // Track active price filter (1, 2, 3, or 4)
  
  document.querySelectorAll('.price-pill').forEach(pill => {
    pill.addEventListener('click', function() {
      const priceLevel = parseInt(this.getAttribute('data-price'));
      
      // Toggle behavior: click again to deactivate
      if (window.activePriceFilter === priceLevel) {
        // Deactivate filter
        window.activePriceFilter = null;
        this.classList.remove('active');
      } else {
        // Activate this filter, deactivate others
        document.querySelectorAll('.price-pill').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        window.activePriceFilter = priceLevel;
      }
      
      // Re-render with the price filter applied
      if (window.lastPlacesData && window.lastOrigin) {
        renderPlaces(window.lastPlacesData, window.lastOrigin, window.currentPlaceType || 'restaurant', false);
      }
    });
  });
  
  // Mouse wheel horizontal scrolling for category filters
  const categorySelect = document.querySelector('.category-select');
  if (categorySelect) {
    categorySelect.addEventListener('wheel', function(e) {
      if (e.deltaY !== 0) {
        e.preventDefault();
        this.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }
  
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
  
  // Event delegation for clickable place elements (cards, buttons)
  // This replaces inline onclick handlers which are stripped by DOMPurify for security
  document.addEventListener('click', function(e) {
    // Ignore clicks on action buttons that have their own handlers
    if (e.target.closest('.action-btn, .ta-show-rating-btn, .favorite-btn, .add-to-list-btn')) {
      return;
    }
    
    const clickablePlace = e.target.closest('.clickable-place');
    if (clickablePlace) {
      const placeId = clickablePlace.dataset.placeId;
      if (placeId) {
        e.stopPropagation();
        
        // If clicking from cluster modal, close the modal first
        if (clickablePlace.classList.contains('cluster-modal-place')) {
          const clusterModal = document.getElementById('cluster-places-modal');
          if (clusterModal) {
            const modalInstance = bootstrap.Modal.getInstance(clusterModal);
            if (modalInstance) modalInstance.hide();
          }
        }
        
        showPlaceDetails(placeId);
      }
    }
  });
  
  // Event delegation for map hover buttons
  document.addEventListener('mouseover', function(e) {
    const mapHoverBtn = e.target.closest('.map-hover-btn');
    if (mapHoverBtn) {
      const lat = parseFloat(mapHoverBtn.dataset.lat);
      const lng = parseFloat(mapHoverBtn.dataset.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        updateHoverMarker({ lat, lng });
      }
    }
  });
}

// Use the user's current location with high-precision GPS
function useMyLocation() {
  const btn = document.getElementById('use-location-button');
  const originalContent = btn.innerHTML;
  
  // Show loading spinner on button
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
  btn.disabled = true;
  
  if (navigator.geolocation) {
    // High-precision GPS options for mobile
    const options = {
      enableHighAccuracy: true,  // Force GPS (critical for mobile)
      timeout: 10000,            // Wait up to 10s before failing
      maximumAge: 0              // Do not use cached/old location
    };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        // Remove old user marker if exists
        if (window.userMarker) {
          window.userMarker.setMap(null);
        }
        
        // Create new "Blue Dot" marker (You Are Here)
        window.userMarker = new google.maps.Marker({
          position: userLocation,
          map: window.map,
          title: "You are here",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#4285F4",  // Google Blue
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: 3
          },
          zIndex: 1000  // Keep on top
        });
        
        // Smart zoom: Pan to location and set walking distance zoom
        window.map.panTo(userLocation);
        window.map.setZoom(15);  // Walking distance level
        
        // Restore button
        btn.innerHTML = originalContent;
        btn.disabled = false;
        
        // Load nearby places (use current radius, clear keyword for new location)
        loadNearbyPlaces(userLocation, '', searchRadius);
      },
      (error) => {
        console.error("Error getting user location:", error);
        btn.innerHTML = originalContent;
        btn.disabled = false;
        
        // Mobile-friendly error messages
        let errorMsg = "Please enable Location Services in your browser settings to find spots near you.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Location access denied. Please enable Location Services in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "Location unavailable. Please check your device's GPS settings.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Location request timed out. Please try again.";
        }
        
        useDefaultLocation(errorMsg);
      },
      options
    );
  } else {
    btn.innerHTML = originalContent;
    btn.disabled = false;
    useDefaultLocation("Geolocation is not supported by your browser");
  }
  
  function useDefaultLocation(reason) {
    console.warn(reason);
    alert(reason + " Using default location (Amsterdam).");
    
    // Default location (Amsterdam)
    const defaultLocation = { lat: 52.3676, lng: 4.9041 };
    
    // Center the map on the default location
    window.map.setCenter(defaultLocation);
    window.map.setZoom(15);
    
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
    // Location search only does geocoding (cities, addresses, regions)
    // For restaurants/attractions, use the restaurant search bar instead
    const response = await fetch(`/api/geocoding?address=${encodeURIComponent(searchInput)}`);
    const data = await response.json();
    
    if (data.status === "OK" && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      
      // Extract city name for TripAdvisor links
      const addressComponents = data.results[0].address_components || [];
      const cityComponent = addressComponents.find(c => c.types.includes('locality') || c.types.includes('administrative_area_level_1'));
      window.currentCity = cityComponent ? cityComponent.long_name : searchInput;
      
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
  
  // Track search keyword for smart snippets
  window.lastSearchKeyword = keyword;
  
  // Reset Date Drinks mode unless we're specifically in bar search mode
  // This prevents the mode from persisting when user clicks other categories
  if (!keyword.includes('cocktail bar') && !keyword.includes('speakeasy')) {
    window.isDateDrinksMode = false;
    window.dateBarTypes = null;
  }
  
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
    
    // Check if this is an attractions search
    const placeTypeSelect = document.getElementById('place-type-select');
    const currentPlaceType = placeTypeSelect ? placeTypeSelect.value : 'restaurant';
    const isAttractionsSearch = currentPlaceType === 'tourist_attraction';
    
    // Double the radius for attractions - tourists walk further for landmarks
    const effectiveRadius = isAttractionsSearch ? Math.min(radius * 2, 5000) : radius;
    
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
    } else if (isAttractionsSearch) {
      // Expanded attractions search - search multiple attraction types in parallel
      console.log("Performing expanded attractions multi-query search with Promise.all");
      console.log(`Using expanded radius: ${effectiveRadius}m (original: ${radius}m)`);
      
      const baseParams = `lat=${location.lat}&lng=${location.lng}&radius=${effectiveRadius}${openNowChecked ? '&opennow=true' : ''}`;
      
      // Search for multiple attraction types in parallel
      // Mega list of attraction types for comprehensive results
      const attractionTypes = [
        'tourist_attraction', 'museum', 'art_gallery', 'park', 'amusement_park', 
        'aquarium', 'zoo', 'casino', 'bowling_alley', 'church', 'place_of_worship', 
        'synagogue', 'stadium', 'night_club', 'movie_theater', 'city_hall', 
        'town_square', 'natural_feature', 'shopping_mall'
      ];
      
      console.log(`Searching ${attractionTypes.length} attraction types in parallel...`);
      
      // Create promises for all attraction types
      const attractionPromises = attractionTypes.map(type => 
        fetch(`/api/nearby?${baseParams}&type=${type}`).then(r => r.json()).catch(err => {
          console.error(`Error fetching ${type}:`, err);
          return { status: 'ERROR', results: [] };
        })
      );
      
      // Also add a "point of interest" keyword search as fallback for miscategorized places
      const poiPromise = fetch(`/api/nearby?${baseParams}&type=establishment&keyword=point%20of%20interest`)
        .then(r => r.json())
        .catch(err => {
          console.error('Error fetching POI fallback:', err);
          return { status: 'ERROR', results: [] };
        });
      
      // Execute all searches in parallel
      const [attractionResults, poiResult] = await Promise.all([
        Promise.all(attractionPromises),
        poiPromise
      ]);
      
      // Log results for each type
      let totalBeforeDedup = 0;
      attractionTypes.forEach((type, i) => {
        const count = attractionResults[i].results?.length || 0;
        totalBeforeDedup += count;
        if (count > 0) console.log(`${type}: ${count} results`);
      });
      const poiCount = poiResult.results?.length || 0;
      if (poiCount > 0) console.log(`point_of_interest fallback: ${poiCount} results`);
      totalBeforeDedup += poiCount;
      console.log(`Total results before deduplication: ${totalBeforeDedup}`);
      
      // Combine all results, deduplicating by place_id
      attractionResults.forEach(data => {
        if (data.status === 'OK' && data.results) {
          data.results.forEach(place => placesMap.set(place.place_id, place));
        }
      });
      
      // Add POI fallback results
      if (poiResult.status === 'OK' && poiResult.results) {
        poiResult.results.forEach(place => placesMap.set(place.place_id, place));
      }
      
      places = Array.from(placesMap.values());
      console.log(`Combined ${places.length} unique attraction places`);
      
      if (places.length > 0) {
        // Store for re-sorting
        window.lastPlacesData = places;
        window.lastOrigin = location;
        window.currentPlaceType = 'tourist_attraction';
        window.isDessertSearch = false;
        
        renderPlaces(places, location, 'tourist_attraction');
      } else {
        // No results - clear markers and show message
        clearMarkers();
        const radiusText = effectiveRadius >= 1000 ? `${effectiveRadius / 1000}km` : `${effectiveRadius}m`;
        
        const resultsCount = document.getElementById('results-count');
        if (resultsCount) {
          resultsCount.style.display = 'none';
        }
        
        document.getElementById('places-container').innerHTML = `
          <div class="col-12">
            <div class="alert alert-info">
              <strong>No attractions found</strong>
              <p>No results within ${radiusText} of this location.</p>
              <p>Try moving the map to a more touristy area, or choose a different category.</p>
            </div>
          </div>
        `;
      }
    } else {
      // Regular search for other place types (restaurants, hotels, etc.)
      console.log(`Searching for places of type: ${currentPlaceType}`);
      
      // Build API URL with required parameters
      let apiUrl = `/api/nearby?lat=${location.lat}&lng=${location.lng}&type=${currentPlaceType}&radius=${radius}`;
      
      // Add keyword if provided and it's not the dessert keyword (handled separately above)
      if (keyword && !isDessertSearch) {
        // For restaurant searches, append "restaurant" to keyword for better API results
        // This helps Google Maps return actual restaurants instead of shops/museums
        let searchKeyword = keyword;
        if (currentPlaceType === 'restaurant' && !keyword.toLowerCase().includes('restaurant')) {
          searchKeyword = keyword + ' restaurant';
        }
        apiUrl += `&keyword=${encodeURIComponent(searchKeyword)}`;
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
        // No results - clear any ghost markers first, then show message
        clearMarkers();
        
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
  // Use stricter threshold for category browsing, lower for specific/dessert searches
  const isSmallResultSet = places.length <= 10; // Likely a name search
  const MIN_REVIEWS = {
    restaurant: (isDessertSearch || isSmallResultSet) ? 5 : 20,
    lodging: 10,
    night_club: 10,
    supermarket: 5,
    default: 10
  };
  const currentMinReviews = MIN_REVIEWS[currentPlaceType] || MIN_REVIEWS.default;
  
  // Minimum rating to show (lower thresholds to show more results)
  let MIN_RATING;
  if (currentPlaceType === 'restaurant') {
    MIN_RATING = 3.5;
  } else if (currentPlaceType === 'night_club') {
    MIN_RATING = 3.0; // Lower threshold for nightclubs
  } else if (currentPlaceType === 'supermarket') {
    MIN_RATING = 3.0; // Lower threshold for supermarkets
  } else {
    MIN_RATING = 3.0; // Default threshold for other places
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
  let filteredPlaces = filterAndSortPlaces(places, origin, {
    radius: filterRadius,
    minRating: MIN_RATING,
    minReviews: currentMinReviews,
    unwantedTypes: UNWANTED_TYPES
  });
  
  // POST-PROCESS: For restaurant searches, ensure only proper restaurants are shown
  // This filters out cafes, bars, and other food-adjacent places that aren't primarily restaurants
  if (currentPlaceType === 'restaurant') {
    const RESTAURANT_TYPES = ['restaurant', 'food', 'meal_delivery', 'meal_takeaway'];
    const EXCLUDED_PRIMARY_TYPES = ['bar', 'cafe', 'bakery', 'night_club'];
    const beforeCount = filteredPlaces.length;
    filteredPlaces = filteredPlaces.filter(place => {
      if (!place.types || place.types.length === 0) return false;
      
      // Get the primary type (first in the array)
      const primaryType = place.types[0];
      
      // Exclude if primary type is bar, cafe, bakery, or nightclub
      if (EXCLUDED_PRIMARY_TYPES.includes(primaryType)) {
        console.log(`Filtering out ${place.name} - primary type is ${primaryType}`);
        return false;
      }
      
      // Must have at least one restaurant-related type
      return place.types.some(t => RESTAURANT_TYPES.includes(t));
    });
    console.log(`Restaurant type validation: ${filteredPlaces.length} of ${beforeCount} places are proper restaurants`);
  }
  
  // Date Drinks mode: Filter to only include bar types and exclude restaurants
  if (window.isDateDrinksMode && window.dateBarTypes) {
    const barTypes = window.dateBarTypes;
    filteredPlaces = filteredPlaces.filter(place => {
      if (!place.types) return false;
      // Check if place has at least one bar type
      const hasBarType = barTypes.some(barType => place.types.includes(barType));
      // Exclude if it's primarily a restaurant (unless it's also a bar)
      const isPrimaryRestaurant = place.types[0] === 'restaurant' && !hasBarType;
      return hasBarType && !isPrimaryRestaurant;
    });
    
    // Boost speakeasy-related places to the top
    filteredPlaces.sort((a, b) => {
      const aHasSpeakeasy = (a.name && a.name.toLowerCase().includes('speakeasy')) ||
        (a.types && a.types.some(t => t.includes('speakeasy')));
      const bHasSpeakeasy = (b.name && b.name.toLowerCase().includes('speakeasy')) ||
        (b.types && b.types.some(t => t.includes('speakeasy')));
      if (aHasSpeakeasy && !bHasSpeakeasy) return -1;
      if (!aHasSpeakeasy && bHasSpeakeasy) return 1;
      return 0;
    });
    
    console.log(`Date Drinks mode: ${filteredPlaces.length} bars found after filtering`);
  }
  
  // Price filter: Filter by price level if a price filter is active
  if (window.activePriceFilter) {
    const priceFilter = window.activePriceFilter;
    const beforeCount = filteredPlaces.length;
    
    // Google API price levels: 0 = free, 1 = inexpensive, 2 = moderate, 3 = expensive, 4 = very expensive
    // Our mapping: $ = 1, $$ = 2, $$$ = 3, $$$$ = 4
    // For $ (cheap), we accept price_level 0 or 1
    // For $$, $$$, $$$$ we match exactly
    if (priceFilter === 1) {
      // Cheap: accept price_level 0 or 1
      filteredPlaces = filteredPlaces.filter(place => 
        place.price_level !== undefined && place.price_level !== null && place.price_level <= 1
      );
    } else {
      // Exact match for $$, $$$, $$$$
      filteredPlaces = filteredPlaces.filter(place => 
        place.price_level === priceFilter
      );
    }
    
    console.log(`Price filter (${priceFilter}): ${filteredPlaces.length} of ${beforeCount} places match`);
  }
  
  console.log(`After filtering: ${filteredPlaces.length} of ${places.length} places remaining`);
  
  // Clear markers before adding new ones
  clearMarkers();
  
  if (filteredPlaces.length === 0) {
    // Hide results count when no results
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
      resultsCount.style.display = 'none';
    }
    
    // Build filter info for message
    const priceInfo = window.activePriceFilter ? ` in the ${'$'.repeat(window.activePriceFilter)} price range` : '';
    const filterHint = window.activePriceFilter ? 
      '<p>Try removing the price filter or expanding your search.</p>' : 
      '<p>Try another location or category, or adjust the search radius.</p>';
    
    // Show a message if no places meet the criteria
    const messageText = isDessertSearch ? 
      `No dessert places found matching your criteria` : 
      `No places found matching your criteria`;
      
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">
          <strong>${messageText}</strong>
          <p>No ${formatPlaceType(currentPlaceType)}${isDessertSearch ? ' serving desserts' : ''}${priceInfo} with a rating of ${MIN_RATING}+ found in this area.</p>
          ${filterHint}
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
  
  // TripAdvisor ratings now loaded on-demand via external link to save API credits
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
  
  // Get thumbnail photo URL and attribution
  let thumbnailUrl = '';
  let photoAttribution = '';
  if (place.photos && place.photos.length > 0) {
    const photo = place.photos[0];
    if (photo.url) {
      thumbnailUrl = photo.url;
    } else if (photo.photo_reference) {
      thumbnailUrl = `/api/photo?photo_reference=${photo.photo_reference}&maxwidth=400`;
    }
    // Get photo attribution if available
    if (photo.html_attributions && photo.html_attributions.length > 0) {
      photoAttribution = photo.html_attributions[0];
    }
  }
  
  // Check for smart snippet - editorial summary or review excerpt
  let smartSnippet = '';
  const searchKeyword = window.lastSearchKeyword || '';
  
  // Date bar keywords for special prioritization
  const dateBarKeywords = ['intimate', 'cozy', 'speakeasy', 'dim lighting', 'great for couples', 'romantic', 'hidden', 'secret'];
  
  // Check for editorial summary first
  if (place.editorial_summary && place.editorial_summary.overview) {
    smartSnippet = place.editorial_summary.overview;
  } 
  // For Date Drinks mode, prioritize date bar keywords in reviews
  else if (window.isDateDrinksMode && place.reviews) {
    for (const keyword of dateBarKeywords) {
      const matchingReview = place.reviews.find(review => 
        review.text && review.text.toLowerCase().includes(keyword)
      );
      if (matchingReview) {
        const text = matchingReview.text;
        const keywordIndex = text.toLowerCase().indexOf(keyword);
        const start = Math.max(0, keywordIndex - 20);
        const end = Math.min(text.length, keywordIndex + 90);
        smartSnippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
        break;
      }
    }
  }
  // Check reviews for matching search keyword
  else if (place.reviews && searchKeyword && searchKeyword.length > 2) {
    const keywordLower = searchKeyword.toLowerCase();
    const matchingReview = place.reviews.find(review => 
      review.text && review.text.toLowerCase().includes(keywordLower)
    );
    if (matchingReview) {
      // Extract a snippet around the keyword
      const text = matchingReview.text;
      const keywordIndex = text.toLowerCase().indexOf(keywordLower);
      const start = Math.max(0, keywordIndex - 30);
      const end = Math.min(text.length, keywordIndex + 80);
      smartSnippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
    }
  }
  
  // Full address with postcode
  const fullAddress = place.vicinity || place.formatted_address || '';
  
  // Get cuisine/category from types (first non-generic type)
  const cuisineType = place.types?.find(t => 
    !['point_of_interest', 'establishment', 'food', 'restaurant'].includes(t)
  );
  const cuisineLabel = cuisineType ? formatPlaceType(cuisineType) : '';
  
  // Build compact meta line: $$ • Italian • 1.2km
  const metaParts = [];
  if (priceLevel) metaParts.push(priceLevel);
  if (cuisineLabel) metaParts.push(cuisineLabel);
  const metaLine = metaParts.length > 0 ? `<p class="card-meta">${metaParts.join(' • ')}</p>` : '';
  
  // Format snippet display - use smart snippet if available, otherwise full address
  const snippetHTML = smartSnippet 
    ? `<p class="card-text smart-snippet"><i class="fas fa-quote-left"></i> ${escapeHTML(smartSnippet)}</p>`
    : `<p class="card-text card-address">${escapeHTML(fullAddress)}</p>`;
  
  // Check for Premium Date Spot badge ($$$ or $$$$ bars in Date Drinks mode)
  let premiumDateBadge = '';
  if (window.isDateDrinksMode && place.price_level >= 3) {
    premiumDateBadge = '<span class="badge premium-date-badge ms-2"><i class="fas fa-gem"></i> Premium Date Spot</span>';
  }
  
  // Create the modern card HTML with thumbnail
  const cardNumber = index + 1; // 1-based numbering to match map pins
  card.innerHTML = sanitizeHTML(`
    <div class="card h-100 place-card">
      <!-- Card Number Badge (matches map marker) -->
      <span class="card-number-badge">${cardNumber}</span>
      
      <!-- Floating Favorite Button -->
      <button class="favorite-btn ${favoriteClass}" 
        data-place-id="${place.place_id}"
        title="${favoriteTitle}">
        <i class="${favoriteIcon}"></i>
      </button>
      
      ${thumbnailUrl ? `
        <div class="card-img-wrapper clickable-place" data-place-id="${place.place_id}">
          <img src="${thumbnailUrl}" class="card-img-top" alt="${escapeHTML(place.name)}" loading="lazy">
          ${photoAttribution ? `<span class="photo-attribution">${photoAttribution}</span>` : ''}
        </div>
      ` : `
        <div class="card-img-placeholder clickable-place" data-place-id="${place.place_id}">
          <i class="fas fa-utensils"></i>
        </div>
      `}
      
      <div class="card-body clickable-place" data-place-id="${place.place_id}">
        <h5 class="card-title">${escapeHTML(place.name)}${openBadge}${premiumDateBadge}</h5>
        ${metaLine}
        ${snippetHTML}
        
        <div class="rating">
          <span class="rating-stars">${ratingStars}</span>
          <span class="rating-value">${place.rating}</span>
          <span class="rating-count">(${place.user_ratings_total})</span>
          ${priceLevel ? `<span class="price-level ms-2">${priceLevel}</span>` : ''}
        </div>
        
        <div class="type-badges">${typesBadges}</div>
        
        <div class="card-actions">
          <button class="action-btn add-to-list-btn" 
            data-place-id="${place.place_id}"
            title="Add to List">
            <i class="fas fa-plus"></i>
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${place.geometry.location.lat},${place.geometry.location.lng}" 
            target="_blank" class="action-btn" title="Get Directions">
            <i class="fas fa-directions"></i>
          </a>
          <button class="action-btn map-hover-btn" 
            data-lat="${place.geometry.location.lat}"
            data-lng="${place.geometry.location.lng}"
            title="Show on map">
            <i class="fas fa-map-marker-alt"></i>
          </button>
        </div>
      </div>
    </div>
  `);
  
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
  
  // Add click handler for TripAdvisor "Show Rating" button
  const taShowRatingBtn = card.querySelector('.ta-show-rating-btn');
  if (taShowRatingBtn) {
    taShowRatingBtn.addEventListener('click', async function(e) {
      e.stopPropagation();
      const container = this.closest('.ta-rating-container');
      const placeName = container.dataset.placeName;
      const placeAddress = container.dataset.placeAddress;
      
      // Show loading state
      this.innerHTML = '<span class="ta-loading-spinner"></span> Loading...';
      this.disabled = true;
      
      try {
        // Fetch TripAdvisor data
        const response = await fetch(`/api/tripadvisor?place_name=${encodeURIComponent(placeName)}&location=${encodeURIComponent(placeAddress)}`);
        const data = await response.json();
        
        if (data.status === 'OK' && data.result?.tripadvisor_data) {
          const taData = data.result.tripadvisor_data;
          
          // Build the rating display HTML
          let ratingHtml = '';
          if (taData.rating_image_url) {
            ratingHtml = `
              <a href="${taData.web_url || 'https://www.google.com/search?q=site:tripadvisor.com+' + encodeURIComponent(placeName + ' ' + placeAddress)}" 
                 target="_blank" class="ta-rating-display" title="View on TripAdvisor">
                <img src="${taData.rating_image_url}" alt="${taData.rating} rating" class="ta-bubbles-img">
                <span class="ta-review-count">${taData.num_reviews || 0} reviews</span>
                <span class="ta-attribution">TripAdvisor</span>
              </a>
            `;
          } else if (taData.rating) {
            // Fallback if no image URL - show text rating with proper branding
            ratingHtml = `
              <a href="${taData.web_url || 'https://www.google.com/search?q=site:tripadvisor.com+' + encodeURIComponent(placeName + ' ' + placeAddress)}" 
                 target="_blank" class="ta-rating-display" title="View on TripAdvisor">
                <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_logomark_solid_green.svg" alt="TripAdvisor" class="ta-owl-icon">
                <span class="ta-rating-text">${taData.rating}</span>
                <span class="ta-review-count">(${taData.num_reviews || 0})</span>
              </a>
            `;
          } else {
            // No rating data - show link to TripAdvisor via Google search
            ratingHtml = `
              <a href="https://www.google.com/search?q=site:tripadvisor.com+${encodeURIComponent(placeName + ' ' + placeAddress)}" 
                 target="_blank" class="ta-rating-display ta-no-data" title="Find on TripAdvisor">
                <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_logomark_solid_green.svg" alt="TripAdvisor" class="ta-owl-icon">
                <span>Find on TripAdvisor</span>
              </a>
            `;
          }
          
          container.innerHTML = sanitizeHTML(ratingHtml);
        } else {
          // API error or no data - show fallback link via Google search
          container.innerHTML = sanitizeHTML(`
            <a href="https://www.google.com/search?q=site:tripadvisor.com+${encodeURIComponent(placeName + ' ' + placeAddress)}" 
               target="_blank" class="ta-rating-display ta-no-data" title="Find on TripAdvisor">
              <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_logomark_solid_green.svg" alt="TripAdvisor" class="ta-owl-icon">
              <span>Find on TripAdvisor</span>
            </a>
          `);
        }
      } catch (error) {
        console.error('Error fetching TripAdvisor rating:', error);
        // Show fallback link on error via Google search
        container.innerHTML = sanitizeHTML(`
          <a href="https://www.google.com/search?q=site:tripadvisor.com+${encodeURIComponent(placeName + ' ' + placeAddress)}" 
             target="_blank" class="ta-rating-display ta-no-data" title="Find on TripAdvisor">
            <img src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_logomark_solid_green.svg" alt="TripAdvisor" class="ta-owl-icon">
            <span>Find on TripAdvisor</span>
          </a>
        `);
      }
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
    
    if (!response.ok) {
      return null;
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.status === 'OK' && data.result?.tripadvisor_data) {
      return data.result.tripadvisor_data;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Global array to keep track of markers
window.markers = [];

// Helper function to create a regular Marker (no mapId required)
function createAdvancedMarker(options) {
  // Deep emerald green for luxury branding, matching Crave theme
  const { position, map, title, label, color = '#1B4D3E', isUserLocation = false, onClick } = options;
  
  let markerOptions = {
    position,
    map,
    title
  };
  
  if (isUserLocation) {
    // User location marker - distinctive blue circle icon (keeps original blue for visibility)
    markerOptions.icon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#4285F4',
      fillOpacity: 1,
      strokeColor: 'white',
      strokeWeight: 3
    };
  } else if (label) {
    // Numbered marker for places
    markerOptions.label = {
      text: label,
      color: 'white',
      fontWeight: 'bold',
      fontSize: '12px'
    };
    markerOptions.icon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: 'white',
      strokeWeight: 2
    };
  }
  
  // Create the regular Marker
  const marker = new google.maps.Marker(markerOptions);
  
  // Add click listener if provided
  if (onClick) {
    marker.addListener('click', onClick);
  }
  
  return marker;
}

// Add a marker for a place using AdvancedMarkerElement
function addMarker(place, index) {
  if (!place.geometry || !place.geometry.location) return;
  
  const position = {
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng
  };
  
  // Determine marker color based on place type
  // Hotels get purple, everything else gets deep forest green
  const isHotel = place.types && (place.types.includes('lodging') || place.types.includes('hotel'));
  const markerColor = isHotel ? '#5B3B8C' : '#0E2F23'; // Purple for hotels, forest green for others
  
  // Create marker with label using AdvancedMarkerElement
  const marker = createAdvancedMarker({
    position: position,
    map: window.map,
    title: place.name,
    label: (index + 1).toString(),
    color: markerColor,
    onClick: () => {
      window.map.setCenter(position);
      window.map.setZoom(16);
      showPlaceDetails(place.place_id);
    }
  });
  
  // Store place data on marker for cluster access
  marker.placeData = place;
  
  // Store marker in global array
  window.markers.push(marker);
}

// Clear all markers from the map
function clearMarkers() {
  if (window.markers) {
    for (let marker of window.markers) {
      // Regular Marker uses setMap(null)
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
  
  // Update URL hash for shareable links
  updateUrlHash(placeId);
  
  try {
    const response = await fetch(`/api/details?place_id=${placeId}`);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      const place = data.result;
      // Add place_id to the place object since it's not returned by the details API
      place.place_id = placeId;
      console.log("Place details:", place);
      
      // TripAdvisor search URL - use Google search with site:tripadvisor.com for better results
      const tripAdvisorSearchUrl = `https://www.google.com/search?q=site:tripadvisor.com+${encodeURIComponent(place.name + ' ' + (place.vicinity || ''))}`;
      
      // Get TripAdvisor data from API
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
      
      // Format reviews with truncation and "Read more"
      let reviewsHtml = '';
      if (place.reviews && place.reviews.length > 0) {
        reviewsHtml = '<h5 class="mt-3">Reviews</h5><div class="reviews-carousel mb-3">';
        place.reviews.forEach((review, index) => {
          const reviewDate = new Date(review.time * 1000).toLocaleDateString();
          const reviewId = `review-text-${index}`;
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
              <p class="review-text" id="${reviewId}">${review.text}</p>
              <span class="review-read-more" data-target="${reviewId}" style="display: none;">Read more</span>
            </div>
          `;
        });
        reviewsHtml += '</div>';
      }
      
      // Format photos as Hero carousel (edge-to-edge at top)
      let heroCarouselHtml = '';
      const carouselId = 'photoCarousel-' + place.place_id.replace(/[^a-zA-Z0-9]/g, '');
      
      if (place.photos && place.photos.length > 0) {
        // Include +1 for the "View All" slide in indicators
        const totalSlides = place.photos.length + 1;
        heroCarouselHtml = `
          <div id="${carouselId}" class="carousel slide hero-carousel" data-bs-ride="false">
            <div class="carousel-indicators">
              ${place.photos.map((_, i) => `
                <button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${i}" 
                  ${i === 0 ? 'class="active" aria-current="true"' : ''} aria-label="Slide ${i + 1}"></button>
              `).join('')}
              <button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${place.photos.length}" aria-label="View All"></button>
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
          
          // Get photo attribution if available
          let photoAttr = '';
          if (photo.html_attributions && photo.html_attributions.length > 0) {
            photoAttr = photo.html_attributions[0];
          }
          
          heroCarouselHtml += `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
              <img src="${photoUrl}" class="d-block w-100 hero-img" alt="${place.name}">
              ${photoAttr ? `<span class="carousel-photo-attribution">${photoAttr}</span>` : ''}
            </div>
          `;
        });
        
        // Add "View All Photos" slide at the end - use place.url or query_place_id for exact pin
        const googleMapsUrl = place.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`;
        heroCarouselHtml += `
          <div class="carousel-item view-all-slide">
            <div class="view-all-content">
              <i class="fas fa-images"></i>
              <h5>See All Photos</h5>
              <p>View the complete gallery on Google Maps</p>
              <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="view-all-btn">
                <i class="fab fa-google me-2"></i>Open in Google Maps
              </a>
            </div>
          </div>
        `;
        
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
            <div class="photo-count-badge">${place.photos.length}+ photos</div>
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
      
      // TripAdvisor section - show API data if available, fallback to external link
      let tripAdvisorHtml = '';
      if (tripAdvisorData) {
        tripAdvisorHtml = `
          <div class="tripadvisor-section mt-3">
            <div class="tripadvisor-data-card mb-3">
              ${tripAdvisorData.rating ? `
                <div class="d-flex align-items-center mb-2">
                  <span class="rating-inline">
                    <i class="fab fa-tripadvisor" style="color: #00AA6C;"></i> ${tripAdvisorData.rating}
                    <span class="review-count">(${tripAdvisorData.num_reviews || tripAdvisorData.review_count || 0})</span>
                  </span>
                  ${tripAdvisorData.price_range ? `<span class="meta-separator">•</span><span class="price-inline">${tripAdvisorData.price_range}</span>` : ''}
                  ${tripAdvisorData.cuisine ? `<span class="meta-separator">•</span><span class="text-muted">${tripAdvisorData.cuisine}</span>` : ''}
                </div>
              ` : ''}
              <a href="${tripAdvisorSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-tripadvisor-cta">
                <i class="fab fa-tripadvisor"></i>
                Find on TripAdvisor
              </a>
            </div>
          </div>
        `;
      } else {
        tripAdvisorHtml = `
          <div class="tripadvisor-section mt-3">
            <a href="${tripAdvisorSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-tripadvisor-cta">
              <i class="fab fa-tripadvisor"></i>
              Find on TripAdvisor
            </a>
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
      
      // Check if this is a hotel/lodging
      const isHotel = place.types && (place.types.includes('lodging') || place.types.includes('hotel'));
      
      // Booking button for hotels - use Name + formatted_address for reliable search
      let hotelBookingHtml = '';
      if (isHotel) {
        const bookingSearchQuery = place.name + ' ' + (place.formatted_address || place.vicinity || '');
        const bookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(bookingSearchQuery.trim())}`;
        hotelBookingHtml = `
          <div class="hotel-booking-section mt-4">
            <a href="${bookingUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-booking-cta w-100">
              <i class="fas fa-calendar-check me-2"></i>Check Rates & Availability
            </a>
            <p class="affiliate-disclosure">We may earn a commission if you book.</p>
          </div>
        `;
      }
      
      // Build compact icon pill action buttons row
      const actionButtonsHtml = `
        <div class="action-buttons-row">
          ${place.formatted_phone_number ? `
            <a href="tel:${place.formatted_phone_number}" class="action-pill" title="Call">
              <i class="fas fa-phone"></i>
              <span>Call</span>
            </a>
          ` : `
            <span class="action-pill disabled" title="No phone available">
              <i class="fas fa-phone"></i>
              <span>Call</span>
            </span>
          `}
          ${place.website ? `
            <a href="${place.website}" target="_blank" rel="noopener noreferrer" class="action-pill website-link" title="Website">
              <i class="fas fa-globe"></i>
              <span>Website</span>
            </a>
          ` : `
            <span class="action-pill disabled" title="No website available">
              <i class="fas fa-globe"></i>
              <span>Website</span>
            </span>
          `}
          ${place.url ? `
            <a href="${place.url}" target="_blank" rel="noopener noreferrer" class="action-pill" title="Directions">
              <i class="fas fa-directions"></i>
              <span>Directions</span>
            </a>
          ` : `
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}" target="_blank" rel="noopener noreferrer" class="action-pill" title="Directions">
              <i class="fas fa-directions"></i>
              <span>Directions</span>
            </a>
          `}
          <button class="action-pill share-place-btn" data-place-name="${encodeURIComponent(place.name)}" data-place-id="${place.place_id}" title="Share">
            <i class="fas fa-share-alt"></i>
            <span>Share</span>
          </button>
          <button class="btn-save-to-list ${isPlaceSaved(place.place_id) ? 'saved' : ''}" 
                  data-place-id="${place.place_id}" 
                  title="Save to Guidebook">
            <i class="${isPlaceSaved(place.place_id) ? 'fas' : 'far'} fa-bookmark"></i>
            ${isPlaceSaved(place.place_id) ? 'Saved' : 'Save'}
          </button>
        </div>
      `;
      
      // Format price level
      const priceDisplay = place.price_level ? '$'.repeat(place.price_level) : '';
      
      // Format open/closed status for metadata row
      const isOpenNow = place.opening_hours?.open_now;
      const statusDisplay = place.opening_hours ? 
        (isOpenNow ? '<span class="status-inline open">Open</span>' : '<span class="status-inline closed">Closed</span>') : '';
      
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
              
              <!-- Clean Title Section - Magazine Editorial Style -->
              <div class="modal-body">
                <div class="title-section">
                  <h4 class="place-title">${place.name}</h4>
                  <div class="place-meta">
                    ${place.rating ? `
                      <span class="rating-inline">
                        <i class="fas fa-star"></i> ${place.rating}
                        <span class="review-count">(${place.user_ratings_total || 0})</span>
                      </span>
                    ` : ''}
                    ${priceDisplay ? `${place.rating ? '<span class="meta-separator">•</span>' : ''}<span class="price-inline">${priceDisplay}</span>` : ''}
                    ${statusDisplay ? `${place.rating || priceDisplay ? '<span class="meta-separator">•</span>' : ''}${statusDisplay}` : ''}
                  </div>
                  <p class="place-address">${place.vicinity || place.formatted_address || ''}</p>
                </div>
                
                <!-- Action Buttons Row -->
                ${actionButtonsHtml}
                
                <!-- Hotel Booking CTA (only for hotels) -->
                ${hotelBookingHtml}
                
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
      document.body.insertAdjacentHTML('beforeend', sanitizeHTML(modalHtml));
      
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
        
        // Attach save to list button listener
        const saveBtn = document.querySelector('.btn-save-to-list');
        if (saveBtn) {
          saveBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showSaveToListPopup(place, this);
          });
        }
        
        // Setup "Read more" for reviews
        document.querySelectorAll('.review-text').forEach(reviewEl => {
          // Check if text is actually truncated (3+ lines)
          if (reviewEl.scrollHeight > reviewEl.clientHeight) {
            const readMoreBtn = reviewEl.nextElementSibling;
            if (readMoreBtn && readMoreBtn.classList.contains('review-read-more')) {
              readMoreBtn.style.display = 'inline-block';
              readMoreBtn.addEventListener('click', function() {
                reviewEl.classList.toggle('expanded');
                this.textContent = reviewEl.classList.contains('expanded') ? 'Show less' : 'Read more';
              });
            }
          }
        });
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
    
    if (!recommendationsContainer) {
      console.log('Recommendations container not found, skipping update');
      return;
    }
    
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
          
          card.innerHTML = sanitizeHTML(`
            <div class="card h-100 recommendation-card clickable-place" data-place-id="${recommendation.place_id}" style="cursor: pointer;">
              <div class="card-body">
                <h6 class="card-title mb-1">${escapeHTML(recommendation.name)}</h6>
                <small class="text-muted d-block mb-2">${escapeHTML(recommendation.vicinity || '')}</small>
                <div class="d-flex align-items-center gap-2">
                  <span>${ratingStars}</span>
                  <small class="text-muted">${recommendation.rating || 'No rating'}</small>
                  ${priceLevel ? `<strong class="text-success ms-auto">${priceLevel}</strong>` : ''}
                </div>
              </div>
            </div>
          `);
          
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
    const container = document.getElementById('recommendations-container');
    if (container) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-danger">Error loading recommendations. Please try again later.</div>
        </div>
      `;
    }
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
  
  // Create a new hover marker using regular Marker
  window.hoverMarker = new google.maps.Marker({
    position: location,
    map: window.map,
    zIndex: 999,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#FF4081',
      fillOpacity: 1,
      strokeColor: 'white',
      strokeWeight: 3
    },
    animation: google.maps.Animation.BOUNCE
  });
  
  // Stop bouncing after 1.5 seconds
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
      arrows: true,
      infinite: true,
      speed: 500,
      slidesToShow: slidesToShow,
      slidesToScroll: 1,
      autoplay: false,
      prevArrow: '<button type="button" class="slick-prev"><i class="fas fa-chevron-left"></i></button>',
      nextArrow: '<button type="button" class="slick-next"><i class="fas fa-chevron-right"></i></button>'
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