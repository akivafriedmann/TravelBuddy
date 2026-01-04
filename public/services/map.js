const DARK_MODE_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

let map = null;
let markers = [];
let hoverMarker = null;
let transitLayer = null;
let transitLayerVisible = false;
let markerClusterer = null;
let lastSearchedCenter = null;

export function initMap(elementId, defaultCenter, options = {}) {
  const mapElement = document.getElementById(elementId);
  if (!mapElement) {
    console.error("Map element not found!");
    return null;
  }
  
  map = new google.maps.Map(mapElement, {
    zoom: options.zoom || 13,
    center: defaultCenter,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    gestureHandling: 'greedy',
    zoomControl: true,
    mapTypeControl: true,
    scaleControl: true,
    streetViewControl: true,
    rotateControl: true,
    fullscreenControl: true
  });
  
  setTimeout(() => {
    google.maps.event.trigger(map, 'resize');
    map.setCenter(defaultCenter);
  }, 100);
  
  transitLayer = new google.maps.TransitLayer();
  lastSearchedCenter = defaultCenter;
  
  console.log("Map created successfully!");
  return map;
}

export function getMap() {
  return map;
}

export function getLastSearchedCenter() {
  return lastSearchedCenter;
}

export function setLastSearchedCenter(center) {
  lastSearchedCenter = center;
}

export function addMarker(place, index, onClick) {
  if (!place.geometry || !place.geometry.location) return null;
  
  const position = {
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng
  };
  
  const marker = new google.maps.Marker({
    position: position,
    map: map,
    title: place.name,
    label: {
      text: (index + 1).toString(),
      color: 'white'
    },
    animation: google.maps.Animation.DROP
  });
  
  if (onClick) {
    marker.addListener("click", () => {
      map.setCenter(position);
      map.setZoom(16);
      onClick(place);
    });
  }
  
  markers.push(marker);
  return marker;
}

export function addUserLocationMarker(location) {
  return new google.maps.Marker({
    position: location,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#4285F4",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2
    },
    title: "Your Location"
  });
}

export function clearMarkers() {
  markers.forEach(marker => marker.setMap(null));
  markers = [];
  
  if (hoverMarker) {
    hoverMarker.setMap(null);
    hoverMarker = null;
  }
  
  if (markerClusterer) {
    markerClusterer.clearMarkers();
  }
}

export function getMarkers() {
  return markers;
}

export function updateHoverMarker(location) {
  if (hoverMarker) {
    hoverMarker.setMap(null);
  }
  
  hoverMarker = new google.maps.Marker({
    position: location,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#FF4081",
      fillOpacity: 0.8,
      strokeColor: "#FFFFFF",
      strokeWeight: 2
    },
    zIndex: 999
  });
  
  hoverMarker.setAnimation(google.maps.Animation.BOUNCE);
  
  setTimeout(() => {
    if (hoverMarker) {
      hoverMarker.setAnimation(null);
    }
  }, 1500);
}

export function toggleTransitLayer() {
  if (transitLayerVisible) {
    transitLayer.setMap(null);
    transitLayerVisible = false;
  } else {
    transitLayer.setMap(map);
    transitLayerVisible = true;
  }
  return transitLayerVisible;
}

export function isTransitLayerVisible() {
  return transitLayerVisible;
}

export function setDarkMode(enabled) {
  if (!map) return;
  map.setOptions({ styles: enabled ? DARK_MODE_STYLES : [] });
}

export function setMapCenter(location) {
  if (map) map.setCenter(location);
}

export function setMapZoom(zoom) {
  if (map) map.setZoom(zoom);
}

export function fitBounds(bounds) {
  if (map) map.fitBounds(bounds);
}

export function addMapClickListener(callback) {
  if (!map) return;
  google.maps.event.addListener(map, "click", (event) => {
    callback({
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    });
  });
}

export function addMapDragEndListener(callback) {
  if (!map) return;
  google.maps.event.addListener(map, "dragend", () => {
    const center = map.getCenter();
    callback({
      lat: center.lat(),
      lng: center.lng()
    });
  });
}

export function initMarkerClusterer(MarkerClusterer) {
  if (markerClusterer) {
    markerClusterer.clearMarkers();
  }
  
  markerClusterer = new MarkerClusterer({
    map: map,
    markers: markers
  });
  
  return markerClusterer;
}

export function updateClusterer() {
  if (markerClusterer) {
    markerClusterer.clearMarkers();
    markerClusterer.addMarkers(markers);
  }
}

export function getDistanceInMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
           Math.cos(φ1) * Math.cos(φ2) *
           Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
