import { isFavorite } from '../services/storage.js';

export function formatPlaceType(type) {
  if (!type) return '';
  
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
  
  return specialCases[type] || type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function createPlaceCard(place, index, callbacks = {}) {
  const card = document.createElement('div');
  card.className = 'col-md-6 col-lg-4 mb-4';
  card.setAttribute('data-place-id', place.place_id);
  
  const cardInner = document.createElement('div');
  cardInner.className = 'card h-100';
  
  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';
  
  const titleContainer = document.createElement('h5');
  titleContainer.className = 'card-title';
  
  const titleText = document.createElement('span');
  titleText.textContent = `${index + 1}. ${place.name}`;
  titleContainer.appendChild(titleText);
  
  if (place.opening_hours) {
    const openBadge = document.createElement('span');
    openBadge.className = `badge ms-2 ${place.opening_hours.open_now ? 'bg-success' : 'bg-danger'}`;
    openBadge.textContent = place.opening_hours.open_now ? 'Open Now' : 'Closed';
    titleContainer.appendChild(openBadge);
  }
  
  cardBody.appendChild(titleContainer);
  
  const address = document.createElement('p');
  address.className = 'card-text';
  const addressSmall = document.createElement('small');
  addressSmall.className = 'text-muted';
  addressSmall.textContent = place.vicinity || place.formatted_address || '';
  address.appendChild(addressSmall);
  cardBody.appendChild(address);
  
  const infoRow = document.createElement('div');
  infoRow.className = 'd-flex justify-content-between align-items-center mb-2';
  
  const ratingDiv = document.createElement('div');
  ratingDiv.className = 'rating';
  
  if (place.rating) {
    const fullStars = Math.floor(place.rating);
    for (let i = 0; i < fullStars; i++) {
      const star = document.createElement('i');
      star.className = 'fas fa-star text-warning';
      ratingDiv.appendChild(star);
    }
    if (place.rating % 1 >= 0.5) {
      const halfStar = document.createElement('i');
      halfStar.className = 'fas fa-star-half-alt text-warning';
      ratingDiv.appendChild(halfStar);
    }
    const emptyStars = 5 - Math.ceil(place.rating);
    for (let i = 0; i < emptyStars; i++) {
      const emptyStar = document.createElement('i');
      emptyStar.className = 'far fa-star text-warning';
      ratingDiv.appendChild(emptyStar);
    }
    
    const ratingText = document.createElement('span');
    ratingText.className = 'ms-1';
    ratingText.textContent = place.rating;
    ratingDiv.appendChild(ratingText);
    
    const reviewCount = document.createElement('small');
    reviewCount.className = 'text-muted ms-1';
    reviewCount.textContent = `(${place.user_ratings_total})`;
    ratingDiv.appendChild(reviewCount);
  }
  
  infoRow.appendChild(ratingDiv);
  
  const priceDiv = document.createElement('div');
  priceDiv.className = 'price';
  const priceStrong = document.createElement('strong');
  priceStrong.textContent = place.price_level ? '$'.repeat(place.price_level) : '';
  priceDiv.appendChild(priceStrong);
  infoRow.appendChild(priceDiv);
  
  cardBody.appendChild(infoRow);
  
  const typesDiv = document.createElement('div');
  typesDiv.className = 'mb-3';
  
  if (place.types && place.types.length > 0) {
    const displayTypes = place.types
      .filter(type => !['point_of_interest', 'establishment'].includes(type))
      .slice(0, 3);
    
    displayTypes.forEach(type => {
      const badge = document.createElement('span');
      badge.className = 'badge bg-secondary me-1';
      badge.textContent = formatPlaceType(type);
      typesDiv.appendChild(badge);
    });
  }
  
  cardBody.appendChild(typesDiv);
  
  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'd-flex flex-wrap gap-1';
  
  const viewDetailsBtn = document.createElement('button');
  viewDetailsBtn.className = 'btn btn-primary btn-sm';
  viewDetailsBtn.textContent = 'View Details';
  viewDetailsBtn.addEventListener('click', () => {
    if (callbacks.onViewDetails) callbacks.onViewDetails(place.place_id);
  });
  buttonsDiv.appendChild(viewDetailsBtn);
  
  const directionsLink = document.createElement('a');
  directionsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${place.geometry.location.lat},${place.geometry.location.lng}`;
  directionsLink.target = '_blank';
  directionsLink.className = 'btn btn-outline-success btn-sm';
  directionsLink.title = 'Get Directions';
  const directionsIcon = document.createElement('i');
  directionsIcon.className = 'fas fa-directions';
  directionsLink.appendChild(directionsIcon);
  buttonsDiv.appendChild(directionsLink);
  
  const locateBtn = document.createElement('button');
  locateBtn.className = 'btn btn-outline-secondary btn-sm';
  locateBtn.title = 'Show on Map';
  const locateIcon = document.createElement('i');
  locateIcon.className = 'fas fa-map-marker-alt';
  locateBtn.appendChild(locateIcon);
  locateBtn.addEventListener('mouseenter', () => {
    if (callbacks.onHover) {
      callbacks.onHover({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
    }
  });
  buttonsDiv.appendChild(locateBtn);
  
  const favoriteBtn = document.createElement('button');
  const isFav = isFavorite(place.place_id);
  favoriteBtn.className = `btn btn-sm ${isFav ? 'btn-danger' : 'btn-outline-danger'}`;
  favoriteBtn.title = isFav ? 'Remove from Favorites' : 'Add to Favorites';
  const heartIcon = document.createElement('i');
  heartIcon.className = isFav ? 'fas fa-heart' : 'far fa-heart';
  favoriteBtn.appendChild(heartIcon);
  favoriteBtn.addEventListener('click', () => {
    if (callbacks.onToggleFavorite) {
      const nowFavorite = callbacks.onToggleFavorite(place);
      favoriteBtn.className = `btn btn-sm ${nowFavorite ? 'btn-danger' : 'btn-outline-danger'}`;
      heartIcon.className = nowFavorite ? 'fas fa-heart' : 'far fa-heart';
      favoriteBtn.title = nowFavorite ? 'Remove from Favorites' : 'Add to Favorites';
    }
  });
  buttonsDiv.appendChild(favoriteBtn);
  
  cardBody.appendChild(buttonsDiv);
  cardInner.appendChild(cardBody);
  card.appendChild(cardInner);
  
  return card;
}

export function createSkeletonCards(count = 6) {
  const fragment = document.createDocumentFragment();
  
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'col-md-6 col-lg-4 mb-4';
    card.innerHTML = `
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
    `;
    fragment.appendChild(card);
  }
  
  return fragment;
}

export function createNoResultsMessage(placeType, minRating, isDessert = false) {
  const container = document.createElement('div');
  container.className = 'col-12';
  
  const alert = document.createElement('div');
  alert.className = 'alert alert-info';
  
  const title = document.createElement('strong');
  title.textContent = isDessert ? 'No dessert places found matching your criteria' : 'No places found matching your criteria';
  alert.appendChild(title);
  
  const p1 = document.createElement('p');
  p1.textContent = `No ${formatPlaceType(placeType)}${isDessert ? ' serving desserts' : ''} with a rating of ${minRating}+ found in this area.`;
  alert.appendChild(p1);
  
  const p2 = document.createElement('p');
  p2.textContent = 'Try another location or category, or adjust the search radius.';
  alert.appendChild(p2);
  
  container.appendChild(alert);
  return container;
}

export function createErrorMessage(message) {
  const container = document.createElement('div');
  container.className = 'col-12';
  
  const alert = document.createElement('div');
  alert.className = 'alert alert-danger';
  alert.textContent = message;
  
  container.appendChild(alert);
  return container;
}

export function createPhotoCarousel(photos, placeId, placeName) {
  const carouselId = 'photoCarousel-' + placeId.replace(/[^a-zA-Z0-9]/g, '');
  
  const container = document.createElement('div');
  container.innerHTML = `
    <h5 class="mt-3">Photos</h5>
    <div id="${carouselId}" class="carousel slide mb-3" data-bs-ride="false">
      <div class="carousel-indicators">
        ${photos.map((_, i) => `
          <button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${i}" 
            ${i === 0 ? 'class="active" aria-current="true"' : ''} aria-label="Slide ${i + 1}"></button>
        `).join('')}
      </div>
      <div class="carousel-inner rounded">
        ${photos.map((photo, index) => {
          let photoUrl;
          if (photo.url) {
            photoUrl = photo.url;
          } else if (photo.photo_reference) {
            photoUrl = `/api/photo?photo_reference=${photo.photo_reference}&maxwidth=600`;
          } else {
            photoUrl = 'https://via.placeholder.com/600x400?text=No+Image';
          }
          return `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
              <img src="${photoUrl}" class="d-block w-100" alt="${placeName}" style="height: 300px; object-fit: cover;">
            </div>
          `;
        }).join('')}
      </div>
      <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Previous</span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Next</span>
      </button>
    </div>
    <div class="text-center text-muted small mb-2">
      <i class="fas fa-arrow-left me-2"></i> Swipe or use arrows to browse photos <i class="fas fa-arrow-right ms-2"></i>
    </div>
  `;
  
  return container;
}

export function displayWeatherData(data, containerId = 'weather-container') {
  const weatherContainer = document.getElementById(containerId);
  if (!weatherContainer) return;
  
  if (!data || !data.main) {
    weatherContainer.style.display = 'none';
    return;
  }
  
  const temp = Math.round(data.main.temp);
  const humidity = data.main.humidity;
  const windSpeed = data.wind ? data.wind.speed : 0;
  const description = data.weather && data.weather[0] ? data.weather[0].description : '';
  const iconCode = data.weather && data.weather[0] ? data.weather[0].icon : '01d';
  const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  const cityName = data.name || '';
  
  weatherContainer.innerHTML = `
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
  
  weatherContainer.style.display = 'flex';
  
  if (document.body.classList.contains('dark-mode')) {
    weatherContainer.classList.add('dark-mode');
  } else {
    weatherContainer.classList.remove('dark-mode');
  }
}

export function showLoading() {
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "flex";
  }
}

export function hideLoading() {
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "none";
  }
}

export function updateFavoritesBadge(count) {
  const badge = document.getElementById('favorites-count');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}
