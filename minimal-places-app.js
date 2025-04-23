const express = require('express');
const app = express();
const PORT = 5002;

app.get('/', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Minimal Travel Planner</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    #map {
      height: 400px;
      width: 100%;
      margin-bottom: 20px;
    }
    .place-card {
      margin-bottom: 20px;
    }
    .place-image {
      height: 150px;
      object-fit: cover;
    }
  </style>
</head>
<body>
  <div class="container mt-4">
    <h1 class="mb-4 text-center">Travel Planner</h1>
    
    <div id="map"></div>
    
    <div id="places-container" class="row"></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Initialize the map
    function initMap() {
      // Create a simple map centered on New York
      const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 40.7128, lng: -74.0060 },
        zoom: 13
      });
      
      // Define location to search around
      const location = { lat: 40.7128, lng: -74.0060 };
      
      // Create places service for searching
      const service = new google.maps.places.PlacesService(map);
      
      // Search for places
      service.nearbySearch({
        location: location,
        radius: 1500,
        type: ['tourist_attraction']
      }, callback);
      
      // Process the search results
      function callback(results, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          const container = document.getElementById('places-container');
          container.innerHTML = '';
          
          // Add a marker and create a card for each place
          results.forEach(place => {
            // Create marker on the map
            const marker = new google.maps.Marker({
              map: map,
              position: place.geometry.location
            });
            
            // Create a column div
            const col = document.createElement('div');
            col.className = 'col-md-4';
            
            // Get photo if available
            let photoUrl = 'https://via.placeholder.com/300x150?text=No+Image';
            if (place.photos && place.photos.length > 0) {
              photoUrl = place.photos[0].getUrl({ maxWidth: 300, maxHeight: 150 });
            }
            
            // Format rating
            let ratingHtml = '';
            if (place.rating) {
              ratingHtml = '<p class="mb-1">';
              for (let i = 0; i < Math.floor(place.rating); i++) {
                ratingHtml += '★';
              }
              if (place.rating % 1 >= 0.5) {
                ratingHtml += '½';
              }
              ratingHtml += ' <span>' + place.rating + '/5</span>';
              if (place.user_ratings_total) {
                ratingHtml += ' <span class="text-muted">(' + place.user_ratings_total + ' reviews)</span>';
              }
              ratingHtml += '</p>';
            }
            
            // Card HTML
            col.innerHTML = \`
              <div class="card place-card">
                <img src="\${photoUrl}" class="card-img-top place-image" alt="\${place.name}">
                <div class="card-body">
                  <h5 class="card-title">\${place.name}</h5>
                  \${ratingHtml}
                  <p class="card-text">\${place.vicinity || ''}</p>
                </div>
              </div>
            \`;
            
            container.appendChild(col);
            
            // Add click listener to marker
            marker.addListener('click', () => {
              // Get more details about this place
              service.getDetails({
                placeId: place.place_id,
                fields: ['name', 'rating', 'formatted_address', 'photos', 'review']
              }, (placeDetails, detailsStatus) => {
                if (detailsStatus === google.maps.places.PlacesServiceStatus.OK) {
                  // Center map on this place
                  map.setCenter(place.geometry.location);
                  
                  // Create info window with details
                  const infoContent = \`
                    <div style="max-width:300px;padding:10px;">
                      <h5>\${placeDetails.name}</h5>
                      <p>\${placeDetails.formatted_address || place.vicinity}</p>
                      \${ratingHtml}
                    </div>
                  \`;
                  
                  const infoWindow = new google.maps.InfoWindow({
                    content: infoContent
                  });
                  
                  infoWindow.open(map, marker);
                }
              });
            });
          });
        } else {
          console.error('Places search failed:', status);
          document.getElementById('places-container').innerHTML = 
            '<div class="col-12"><div class="alert alert-warning">Could not find places near this location.</div></div>';
        }
      }
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap" defer></script>
</body>
</html>
  `;
  
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal Travel Planner running on http://0.0.0.0:${PORT}`);
});