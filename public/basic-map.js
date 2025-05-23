// Initialize the map when the page loads
function initMap() {
  // Default center location (Amsterdam)
  const defaultCenter = { lat: 52.3676, lng: 4.9041 };
  
  // Create the map
  window.map = new google.maps.Map(document.getElementById("map"), {
    zoom: 14,
    center: defaultCenter,
    mapTypeControl: true,
    fullscreenControl: true,
    streetViewControl: true,
    mapTypeId: "roadmap",
    gestureHandling: "greedy",
  });
  
  // Add a marker at the center location
  new google.maps.Marker({
    position: defaultCenter,
    map: window.map,
    title: "Amsterdam",
  });
  
  console.log("Map initialized successfully!");
}