const FAVORITES_KEY = 'travelplanner_favorites';

export function getFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading favorites from storage:', error);
    return [];
  }
}

export function saveFavorite(place) {
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

export function removeFavorite(placeId) {
  const favorites = getFavorites();
  const filtered = favorites.filter(f => f.place_id !== placeId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  return filtered;
}

export function isFavorite(placeId) {
  const favorites = getFavorites();
  return favorites.some(f => f.place_id === placeId);
}

export function clearFavorites() {
  localStorage.removeItem(FAVORITES_KEY);
}

export function getFavoriteCount() {
  return getFavorites().length;
}
