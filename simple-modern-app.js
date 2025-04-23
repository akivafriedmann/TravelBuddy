const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Simple Travel Planner</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    #map {
      height: 400px;
      width: 100%;
      margin-bottom: 20px;
    }
    .place-card {
      margin-bottom: 20px;
      transition: transform 0.2s;
      cursor: pointer;
    }
    .place-card:hover {
      transform: translateY(-5px);
    }
    .place-image {
      height: 180px;
      object-fit: cover;
      width: 100%;
    }
    .star-rating {
      color: #FFC107;
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
    }
  </style>
</head>
<body>
  <div class="container mt-4">
    <h1 class="mb-3 text-center">Travel Planner</h1>
    <p class="text-center text-muted mb-4">Find interesting places to visit on your trip</p>
    
    <div id="map"></div>
    
    <div id="places-container" class="row mt-3">
      <!-- Places will be added here -->
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    let map;
    let markers = [];
    
    // Initialize the map and app
    function initMap() {
      // Create a map centered on New York by default
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 40.7128, lng: -74.0060 },
        zoom: 13
      });
      
      // Use the places library for searching
      const service = new google.maps.places.PlacesService(map);
      
      // Define the search request
      const request = {
        location: { lat: 40.7128, lng: -74.0060 },
        radius: 1500,
        type: ['tourist_attraction']
      };
      
      // Perform the search
      service.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          const container = document.getElementById('places-container');
          container.innerHTML = '';
          
          // Add places to the map and create cards
          results.forEach(place => {
            // Add marker
            const marker = new google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name
            });
            
            markers.push(marker);
            
            // Create place card
            createPlaceCard(place, container);
            
            // Add marker click event
            marker.addListener('click', () => {
              // Get more details
              service.getDetails(
                { placeId: place.place_id, fields: ['photos', 'rating', 'formatted_address'] },
                (details, detailsStatus) => {
                  if (detailsStatus === google.maps.places.PlacesServiceStatus.OK) {
                    // Center map on this place
                    map.setCenter(place.geometry.location);
                    
                    // Create info window
                    const infoContent = createInfoContent(place, details);
                    
                    const infoWindow = new google.maps.InfoWindow({
                      content: infoContent
                    });
                    
                    infoWindow.open(map, marker);
                  }
                }
              );
            });
          });
        } else {
          document.getElementById('places-container').innerHTML = 
            '<div class="col-12"><div class="alert alert-warning">Could not find places.</div></div>';
        }
      });
      
      // Create place card
      function createPlaceCard(place, container) {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4';
        
        // Get photo URL if available
        let photoHtml = '<div class="bg-light text-center py-5">No Image Available</div>';
        
        if (place.photos && place.photos.length > 0) {
          try {
            const photoUrl = place.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 });
            photoHtml = '<img src="' + photoUrl + '" class="card-img-top place-image" alt="' + 
                       place.name + '">';
          } catch (error) {
            console.error('Error getting photo URL:', error);
          }
        }
        
        // Format rating
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
          
          ratingHtml += ' <span class="ms-1">' + place.rating + '</span>';
          
          if (place.user_ratings_total) {
            ratingHtml += ' <span class="text-muted">(' + place.user_ratings_total + ')</span>';
          }
          
          ratingHtml += '</div>';
        }
        
        // Card HTML
        const cardHtml = 
          '<div class="card place-card h-100">' +
          photoHtml +
          '<div class="card-body">' +
          '<h5 class="card-title">' + place.name + '</h5>' +
          ratingHtml +
          '<p class="card-text">' + (place.vicinity || '') + '</p>' +
          '</div></div>';
        
        col.innerHTML = cardHtml;
        container.appendChild(col);
      }
      
      // Create info window content
      function createInfoContent(place, details) {
        // Get rating stars
        let ratingHtml = '';
        if (place.rating) {
          ratingHtml = '<div>';
          // Full stars
          for (let i = 0; i < Math.floor(place.rating); i++) {
            ratingHtml += '★';
          }
          // Half star
          if (place.rating % 1 >= 0.5) {
            ratingHtml += '½';
          }
          ratingHtml += ' <span>' + place.rating + '</span>';
          if (place.user_ratings_total) {
            ratingHtml += ' <span>(' + place.user_ratings_total + ')</span>';
          }
          ratingHtml += '</div>';
        }
        
        return '<div style="max-width:300px;padding:10px;">' +
               '<h5>' + place.name + '</h5>' +
               '<p>' + (details.formatted_address || place.vicinity || '') + '</p>' +
               ratingHtml +
               '</div>';
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
  console.log(`Simple Travel Planner running on http://0.0.0.0:${PORT}`);
});