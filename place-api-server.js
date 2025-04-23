const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Helper function to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Status Code: ${res.statusCode}`));
      }
      
      const data = [];
      res.on('data', chunk => {
        data.push(chunk);
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(Buffer.concat(data).toString());
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Server-side proxy for photos
app.get('/api/photo', (req, res) => {
  try {
    const { reference, maxwidth = 400, maxheight = 300 } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
    
    if (!reference) {
      return res.status(400).json({ error: 'Photo reference is required' });
    }
    
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${reference}&maxwidth=${maxwidth}&maxheight=${maxheight}&key=${apiKey}`;
    
    https.get(photoUrl, (photoRes) => {
      res.setHeader('Content-Type', photoRes.headers['content-type']);
      photoRes.pipe(res);
    }).on('error', (error) => {
      console.error('Error fetching photo:', error);
      res.status(500).json({ error: 'Failed to fetch photo' });
    });
  } catch (error) {
    console.error('Error in photo proxy:', error);
    res.status(500).json({ error: 'Failed to process photo request' });
  }
});

// Main app route
app.get('/', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Travel Planner - Modern API</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    #map {
      height: 500px;
      width: 100%;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .place-card {
      margin-bottom: 15px;
      cursor: pointer;
      transition: transform 0.3s, box-shadow 0.3s;
      height: 100%;
    }
    .place-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    .place-image {
      height: 150px;
      object-fit: cover;
    }
    .rating-stars {
      color: #FFC107;
    }
    .price-level {
      font-weight: bold;
    }
    .loading-indicator {
      display: none;
      text-align: center;
      margin: 20px 0;
    }
    .app-header {
      background-color: #4285F4;
      color: white;
      padding: 20px 0;
      margin-bottom: 20px;
      border-radius: 0 0 8px 8px;
    }
    .tag-badge {
      font-size: 0.8rem;
      margin-right: 5px;
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <div class="app-header">
    <div class="container">
      <div class="d-flex align-items-center justify-content-center">
        <i class="fas fa-map-marked-alt me-2" style="font-size: 2rem;"></i>
        <h1>Travel Planner</h1>
      </div>
      <p class="text-center mb-0">Using the modern Places API</p>
    </div>
  </div>

  <div class="container">
    <div class="input-group mb-3">
      <span class="input-group-text"><i class="fas fa-search"></i></span>
      <input type="text" id="search-input" class="form-control" placeholder="Search for a location (e.g., New York, Paris, Tokyo)">
      <button class="btn btn-primary" id="search-button">Search</button>
    </div>
    
    <div id="map"></div>
    
    <div class="loading-indicator" id="loading-indicator">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>Loading places...</p>
    </div>
    
    <div class="row" id="places-container"></div>
    
    <!-- Modal for place details -->
    <div class="modal fade" id="place-modal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modal-title">Place Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="modal-body">
            <div class="text-center p-4">
              <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Global variables
    let map;
    let markers = [];
    let placesService;
    
    // Initialize map
    function initMap() {
      // Default location - New York City
      const defaultLocation = { lat: 40.7128, lng: -74.0060 };
      
      // Create the map
      map = new google.maps.Map(document.getElementById('map'), {
        center: defaultLocation,
        zoom: 13,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true
      });
      
      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            map.setCenter(userLocation);
            searchNearbyPlaces(userLocation);
          },
          () => {
            // Geolocation failed, use default location
            searchNearbyPlaces(defaultLocation);
          }
        );
      } else {
        // Browser doesn't support geolocation
        searchNearbyPlaces(defaultLocation);
      }
      
      // Set up search button event listener
      document.getElementById('search-button').addEventListener('click', searchLocation);
      document.getElementById('search-input').addEventListener('keypress', e => {
        if (e.key === 'Enter') searchLocation();
      });
    }
    
    // Search for a location
    function searchLocation() {
      const input = document.getElementById('search-input').value;
      if (!input) return;
      
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: input }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
          map.setCenter(results[0].geometry.location);
          searchNearbyPlaces({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        } else {
          alert('Location not found. Please try a different search term.');
        }
      });
    }
    
    // Clear all markers from the map
    function clearMarkers() {
      markers.forEach(marker => marker.setMap(null));
      markers = [];
    }
    
    // Search for places near a location using the modern Place API
    function searchNearbyPlaces(location) {
      // Show loading indicator
      document.getElementById('loading-indicator').style.display = 'block';
      document.getElementById('places-container').innerHTML = '';
      
      // Clear existing markers
      clearMarkers();
      
      // Create the Places request
      const request = {
        locationRestriction: {
          circle: {
            center: location,
            radius: 1500, // meters
          },
        },
        locationBias: {
          circle: {
            center: location,
            radius: 1500, // meters
          },
        },
        includedType: 'tourist_attraction'
      };
      
      // Use the modern Place API
      const placesService = new google.maps.places.Place(new google.maps.places.PlacesService(map));
      
      // Search for places using the searchNearby method
      // For modern Places API
      placesService.searchNearby(request)
        .then(({ places }) => {
          if (places && places.length > 0) {
            // Process each place
            places.forEach(place => {
              // Request detailed place information using the new API
              fetchPlaceDetails(place);
            });
          } else {
            document.getElementById('places-container').innerHTML = 
              '<div class="col-12"><div class="alert alert-info">No places found in this area. Try another location.</div></div>';
            document.getElementById('loading-indicator').style.display = 'none';
          }
        })
        .catch(error => {
          console.error('Error searching for places:', error);
          document.getElementById('places-container').innerHTML = 
            '<div class="col-12"><div class="alert alert-danger">Error searching for places. Please try again.</div></div>';
          document.getElementById('loading-indicator').style.display = 'none';
        });
    }
    
    // Fetch details for a place using Place API
    function fetchPlaceDetails(place) {
      // Create fields mask for the data we want
      const fields = [
        'displayName',
        'formattedAddress', 
        'location',
        'rating',
        'userRatingCount',
        'priceLevel',
        'types',
        'photos',
        'internationalPhoneNumber',
        'websiteUri',
        'regularOpeningHours',
        'reviews'
      ];
      
      // Fetch place details
      place.fetchFields({ fields: fields })
        .then(placeResult => {
          // Process the place data
          createMarker(placeResult);
          createPlaceCard(placeResult);
          
          // Check if all places are loaded
          if (document.querySelectorAll('.place-card').length >= document.querySelectorAll('.map-marker').length) {
            document.getElementById('loading-indicator').style.display = 'none';
          }
        })
        .catch(error => {
          console.error('Error fetching place details:', error);
        });
    }
    
    // Create a marker for a place
    function createMarker(place) {
      if (!place.location) return;
      
      const marker = new google.maps.Marker({
        map: map,
        position: place.location.latLng,
        title: place.displayName,
        animation: google.maps.Animation.DROP,
        className: 'map-marker'
      });
      
      markers.push(marker);
      
      // Add click listener
      marker.addListener('click', () => {
        showPlaceDetails(place);
      });
    }
    
    // Create a card for a place
    function createPlaceCard(place) {
      const container = document.getElementById('places-container');
      
      // Create column
      const col = document.createElement('div');
      col.className = 'col-md-4 col-sm-6 mb-4';
      
      // Photo URL
      let photoUrl = 'https://via.placeholder.com/300x150?text=No+Image';
      
      if (place.photos && place.photos.length > 0) {
        // Use our proxy server to fetch the photo
        const photoReference = place.photos[0].name;
        photoUrl = \`/api/photo?reference=\${photoReference}&maxwidth=300&maxheight=150\`;
      }
      
      // Rating stars
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = '<div class="rating-stars mb-2">';
        
        // Full stars
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '<i class="fas fa-star"></i> ';
        }
        
        // Half star if needed
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '<i class="fas fa-star-half-alt"></i> ';
        }
        
        ratingHtml += '<span>' + place.rating + '</span>';
        
        if (place.userRatingCount) {
          ratingHtml += ' <span class="text-muted">(' + place.userRatingCount + ')</span>';
        }
        
        ratingHtml += '</div>';
      }
      
      // Price level
      let priceHtml = '';
      if (place.priceLevel) {
        priceHtml = '<div class="price-level mb-2">';
        for (let i = 0; i < place.priceLevel; i++) {
          priceHtml += '$';
        }
        priceHtml += '</div>';
      }
      
      // Types badges
      let typesHtml = '';
      if (place.types && place.types.length > 0) {
        typesHtml = '<div class="mb-2">';
        place.types.slice(0, 3).forEach(type => {
          // Format the type by replacing underscores with spaces and capitalizing first letter
          const formattedType = type.replace(/_/g, ' ').replace(/\w\S*/g, 
            txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
          
          typesHtml += \`<span class="badge bg-secondary tag-badge">\${formattedType}</span>\`;
        });
        typesHtml += '</div>';
      }
      
      // Create card HTML
      col.innerHTML = \`
        <div class="card place-card h-100">
          <img src="\${photoUrl}" class="card-img-top place-image" alt="\${place.displayName}" 
               onerror="this.src='https://via.placeholder.com/300x150?text=No+Image'">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">\${place.displayName}</h5>
            \${ratingHtml}
            <p class="card-text text-truncate">\${place.formattedAddress || ''}</p>
            \${typesHtml}
            \${priceHtml}
            <button class="btn btn-primary mt-auto view-details">View Details</button>
          </div>
        </div>
      \`;
      
      // Add to container
      container.appendChild(col);
      
      // Add click event to view details button
      col.querySelector('.view-details').addEventListener('click', () => {
        showPlaceDetails(place);
      });
    }
    
    // Show place details in modal
    function showPlaceDetails(place) {
      const modalTitle = document.getElementById('modal-title');
      const modalBody = document.getElementById('modal-body');
      
      modalTitle.textContent = place.displayName;
      
      // Photo URL
      let photoHtml = '';
      if (place.photos && place.photos.length > 0) {
        const photoReference = place.photos[0].name;
        const photoUrl = \`/api/photo?reference=\${photoReference}&maxwidth=600&maxheight=400\`;
        
        photoHtml = \`
          <img src="\${photoUrl}" class="img-fluid rounded mb-3" alt="\${place.displayName}" 
               onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">
        \`;
      }
      
      // Rating stars
      let ratingHtml = '';
      if (place.rating) {
        ratingHtml = '<div class="rating-stars fs-4 mb-3">';
        
        // Full stars
        for (let i = 0; i < Math.floor(place.rating); i++) {
          ratingHtml += '<i class="fas fa-star"></i> ';
        }
        
        // Half star if needed
        if (place.rating % 1 >= 0.5) {
          ratingHtml += '<i class="fas fa-star-half-alt"></i> ';
        }
        
        // Empty stars
        for (let i = 0; i < (5 - Math.ceil(place.rating)); i++) {
          ratingHtml += '<i class="far fa-star"></i> ';
        }
        
        ratingHtml += '<span class="ms-2">' + place.rating + '</span>';
        
        if (place.userRatingCount) {
          ratingHtml += ' <span class="text-muted">(' + place.userRatingCount + ' reviews)</span>';
        }
        
        ratingHtml += '</div>';
      }
      
      // Build details HTML
      let detailsHtml = photoHtml + ratingHtml;
      
      // Address
      if (place.formattedAddress) {
        detailsHtml += \`
          <div class="mb-3">
            <i class="fas fa-map-marker-alt text-danger me-2"></i>
            <strong>Address:</strong> \${place.formattedAddress}
          </div>
        \`;
      }
      
      // Phone
      if (place.internationalPhoneNumber) {
        detailsHtml += \`
          <div class="mb-3">
            <i class="fas fa-phone text-success me-2"></i>
            <strong>Phone:</strong> \${place.internationalPhoneNumber}
          </div>
        \`;
      }
      
      // Website
      if (place.websiteUri) {
        detailsHtml += \`
          <div class="mb-3">
            <i class="fas fa-globe text-primary me-2"></i>
            <strong>Website:</strong> 
            <a href="\${place.websiteUri}" target="_blank">\${place.websiteUri}</a>
          </div>
        \`;
      }
      
      // Price level
      if (place.priceLevel) {
        detailsHtml += \`
          <div class="mb-3">
            <i class="fas fa-tag text-secondary me-2"></i>
            <strong>Price Level:</strong> 
            <span class="price-level">\`;
        
        for (let i = 0; i < place.priceLevel; i++) {
          detailsHtml += '$';
        }
        
        detailsHtml += '</span></div>';
      }
      
      // Opening hours
      if (place.regularOpeningHours && place.regularOpeningHours.weekdayDescriptions) {
        detailsHtml += '<div class="mb-3">';
        detailsHtml += '<i class="fas fa-clock text-info me-2"></i>';
        detailsHtml += '<strong>Opening Hours:</strong>';
        detailsHtml += '<ul class="list-group mt-2">';
        
        place.regularOpeningHours.weekdayDescriptions.forEach(day => {
          detailsHtml += \`<li class="list-group-item">\${day}</li>\`;
        });
        
        detailsHtml += '</ul></div>';
      }
      
      // Types/Categories
      if (place.types && place.types.length > 0) {
        detailsHtml += '<div class="mb-3">';
        detailsHtml += '<i class="fas fa-list text-warning me-2"></i>';
        detailsHtml += '<strong>Categories:</strong>';
        detailsHtml += '<div class="mt-2">';
        
        place.types.forEach(type => {
          // Format the type by replacing underscores with spaces and capitalizing first letter
          const formattedType = type.replace(/_/g, ' ').replace(/\w\S*/g, 
            txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
          
          detailsHtml += \`<span class="badge bg-secondary me-1 mb-1">\${formattedType}</span>\`;
        });
        
        detailsHtml += '</div></div>';
      }
      
      // Reviews
      if (place.reviews && place.reviews.length > 0) {
        detailsHtml += '<div class="mt-4 mb-3">';
        detailsHtml += '<i class="fas fa-comment text-primary me-2"></i>';
        detailsHtml += '<strong>Reviews:</strong>';
        
        place.reviews.slice(0, 3).forEach(review => {
          detailsHtml += \`
            <div class="card my-2">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h6 class="mb-0">\${review.authorAttribution.displayName}</h6>
                  <div class="rating-stars">
          \`;
          
          // Add stars for rating
          for (let i = 0; i < review.rating; i++) {
            detailsHtml += '<i class="fas fa-star"></i>';
          }
          
          detailsHtml += \`
                  </div>
                </div>
                <p class="mb-0">\${review.text.text}</p>
              </div>
            </div>
          \`;
        });
        
        detailsHtml += '</div>';
      }
      
      // Photo gallery (if more than one photo)
      if (place.photos && place.photos.length > 1) {
        detailsHtml += '<div class="mt-4 mb-3">';
        detailsHtml += '<i class="fas fa-images text-success me-2"></i>';
        detailsHtml += '<strong>Photos:</strong>';
        detailsHtml += '<div class="row mt-2">';
        
        place.photos.slice(1, 7).forEach(photo => {
          const photoUrl = \`/api/photo?reference=\${photo.name}&maxwidth=200&maxheight=150\`;
          
          detailsHtml += \`
            <div class="col-md-4 col-6 mb-2">
              <img src="\${photoUrl}" class="img-fluid rounded" alt="Place photo" 
                   style="height: 100px; width: 100%; object-fit: cover;"
                   onerror="this.src='https://via.placeholder.com/200x150?text=No+Image'">
            </div>
          \`;
        });
        
        detailsHtml += '</div></div>';
      }
      
      modalBody.innerHTML = detailsHtml;
      
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('place-modal'));
      modal.show();
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly" defer onload="initMap()"></script>
</body>
</html>
  `;
  
  res.send(html);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Modern Places API server running on http://0.0.0.0:${PORT}`);
});