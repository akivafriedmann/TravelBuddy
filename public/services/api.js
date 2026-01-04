const API_BASE = '';

export async function fetchNearbyPlaces(location, options = {}) {
  const { type = 'restaurant', keyword = '', radius = 1500, openNow = false } = options;
  
  let apiUrl = `${API_BASE}/api/nearby?lat=${location.lat}&lng=${location.lng}&type=${type}&radius=${radius}`;
  
  if (keyword) {
    apiUrl += `&keyword=${encodeURIComponent(keyword)}`;
  }
  
  if (openNow) {
    apiUrl += '&opennow=true';
  }
  
  const response = await fetch(apiUrl);
  return response.json();
}

export async function fetchDessertPlaces(location, options = {}) {
  const { radius = 1500, openNow = false } = options;
  
  const baseParams = `lat=${location.lat}&lng=${location.lng}&radius=${radius}${openNow ? '&opennow=true' : ''}`;
  
  const [dessertData, cafeData, bakeryData] = await Promise.all([
    fetch(`${API_BASE}/api/nearby?${baseParams}&type=restaurant&keyword=dessert`).then(r => r.json()),
    fetch(`${API_BASE}/api/nearby?${baseParams}&type=cafe`).then(r => r.json()),
    fetch(`${API_BASE}/api/nearby?${baseParams}&type=bakery`).then(r => r.json())
  ]);
  
  const placesMap = new Map();
  
  [dessertData, cafeData, bakeryData].forEach(data => {
    if (data.status === 'OK' && data.results) {
      data.results.forEach(place => placesMap.set(place.place_id, place));
    }
  });
  
  return {
    status: 'OK',
    results: Array.from(placesMap.values())
  };
}

export async function fetchPlaceDetails(placeId) {
  const response = await fetch(`${API_BASE}/api/details?place_id=${placeId}`);
  const data = await response.json();
  
  if (data.status === 'OK' && data.result) {
    data.result.place_id = placeId;
  }
  
  return data;
}

export async function geocodeAddress(address) {
  const response = await fetch(`${API_BASE}/api/geocoding?address=${encodeURIComponent(address)}`);
  return response.json();
}

export async function searchPlaces(query) {
  const response = await fetch(`${API_BASE}/api/search?query=${encodeURIComponent(query)}`);
  return response.json();
}

export async function fetchWeather(location) {
  const response = await fetch(`${API_BASE}/api/weather?lat=${location.lat}&lng=${location.lng}`);
  return response.json();
}

export async function fetchTripAdvisorData(placeName, placeLocation) {
  const response = await fetch(
    `${API_BASE}/api/tripadvisor?place_name=${encodeURIComponent(placeName)}&location=${encodeURIComponent(placeLocation)}`
  );
  return response.json();
}
