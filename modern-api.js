const express = require('express');
const app = express();
const PORT = 5001;

app.get('/', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Travel Planner - Modern API</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    #map {
      height: 500px;
      width: 100%;
      margin-bottom: 20px;
    }
    .place-card {
      margin-bottom: 15px;
    }
    .rating {
      color: #FFC107;
    }
  </style>
</head>
<body>
  <div class="container mt-3">
    <h1 class="text-center mb-4">Travel Planner</h1>
    
    <div class="row mb-3">
      <div class="col">
        <div class="input-group">
          <input type="text" id="search-input" class="form-control" placeholder="Enter a location">
          <button class="btn btn-primary" id="search-button">Search</button>
        </div>
      </div>
    </div>
    
    <div id="map"></div>
    
    <div id="places-container" class="row"></div>
    
    <!-- Place Details Modal -->
    <div class="modal fade" id="place-modal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Place Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="place-details"></div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    let map;
    let markers = [];
    
    // Initialize Google Maps
    async function initMap() {
      const { Map } = await google.maps.importLibrary("maps");
      const { Place } = await google.maps.importLibrary("places");
      
      // Default to New York
      const center = { lat: 40.7128, lng: -74.0060 };
      
      // Create map
      map = new Map(document.getElementById("map"), {
        center: center,
        zoom: 13,
        mapId: "DEMO_MAP_ID"
      });
      
      // Try to get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            map.setCenter(userLocation);
            searchPlaces(userLocation);
          },
          error => {
            console.log("Geolocation error:", error);
            searchPlaces(center);
          }
        );
      } else {
        searchPlaces(center);
      }
      
      // Set up search button
      document.getElementById("search-button").addEventListener("click", handleSearch);
      document.getElementById("search-input").addEventListener("keydown", event => {
        if (event.key === "Enter") handleSearch();
      });
      
      // Handle search
      async function handleSearch() {
        const input = document.getElementById("search-input").value;
        if (!input) return;
        
        try {
          const { Geocoder } = await google.maps.importLibrary("geocoding");
          const geocoder = new Geocoder();
          
          const result = await geocoder.geocode({ address: input });
          
          if (result.results.length > 0) {
            const location = result.results[0].geometry.location;
            map.setCenter(location);
            searchPlaces(location);
          } else {
            alert("Location not found");
          }
        } catch (error) {
          console.error("Geocoding error:", error);
        }
      }
      
      // Search for places
      async function searchPlaces(location) {
        clearMarkers();
        document.getElementById("places-container").innerHTML = "";
        
        try {
          // Create search request for the new Place API
          const request = {
            locationRestriction: {
              circle: {
                center: location,
                radius: 1500, // meters
              },
            },
            includedType: "tourist_attraction"
          };
          
          // Use Place.searchByText for the modern API
          const placesService = new Place();
          const response = await placesService.searchNearby(request);
          
          if (response.places && response.places.length > 0) {
            response.places.forEach(place => {
              getPlaceDetails(place);
            });
          } else {
            document.getElementById("places-container").innerHTML = 
              '<div class="col-12"><p class="alert alert-info">No places found in this area</p></div>';
          }
        } catch (error) {
          console.error("Places search error:", error);
          document.getElementById("places-container").innerHTML = 
            '<div class="col-12"><p class="alert alert-danger">Error searching for places</p></div>';
        }
      }
      
      // Get detailed place information
      async function getPlaceDetails(place) {
        try {
          // Request specific fields with the new API
          const fields = [
            'displayName', 
            'formattedAddress', 
            'location',
            'rating',
            'userRatingCount',
            'photos',
            'priceLevel',
            'websiteUri',
            'internationalPhoneNumber',
            'types'
          ];
          
          // Fetch place details with the modern API
          const placeDetails = await place.fetchFields({ fields: fields });
          
          // Create marker for the place
          createMarker(placeDetails);
          
          // Create place card
          createPlaceCard(placeDetails);
        } catch (error) {
          console.error("Error fetching place details:", error);
        }
      }
      
      // Create marker for a place
      function createMarker(place) {
        if (!place.location) return;
        
        const marker = new google.maps.Marker({
          position: place.location.latLng,
          map: map,
          title: place.displayName
        });
        
        markers.push(marker);
        
        marker.addListener("click", () => {
          showPlaceDetails(place);
        });
      }
      
      // Clear all markers
      function clearMarkers() {
        markers.forEach(marker => marker.setMap(null));
        markers = [];
      }
      
      // Create card for a place
      function createPlaceCard(place) {
        const container = document.getElementById("places-container");
        const placeCol = document.createElement("div");
        placeCol.className = "col-md-4 mb-3";
        
        // Get photo if available
        let photoHtml = '<div class="bg-light text-center py-5">No Image</div>';
        if (place.photos && place.photos.length > 0) {
          try {
            // Get photo URL using the modern API
            photoHtml = \`<img src="\${place.photos[0].getUrl({maxWidth: 300, maxHeight: 200})}" 
                           class="card-img-top" alt="\${place.displayName}" style="height: 150px; object-fit: cover;">\`;
          } catch (error) {
            console.error("Error getting photo URL:", error);
          }
        }
        
        // Format rating
        let ratingHtml = '';
        if (place.rating) {
          ratingHtml = \`<div class="mb-2 rating">
                         \${place.rating.toFixed(1)} ★ 
                         \${place.userRatingCount ? \`(\${place.userRatingCount} reviews)\` : ''}
                         </div>\`;
        }
        
        // Create card HTML
        placeCol.innerHTML = \`
          <div class="card place-card h-100">
            \${photoHtml}
            <div class="card-body">
              <h5 class="card-title">\${place.displayName}</h5>
              \${ratingHtml}
              <p class="card-text small">\${place.formattedAddress || ''}</p>
              <button class="btn btn-primary btn-sm view-details">View Details</button>
            </div>
          </div>
        \`;
        
        // Add to container
        container.appendChild(placeCol);
        
        // Add event listener
        placeCol.querySelector(".view-details").addEventListener("click", () => {
          showPlaceDetails(place);
        });
      }
      
      // Show place details in modal
      function showPlaceDetails(place) {
        const modal = new bootstrap.Modal(document.getElementById("place-modal"));
        const detailsContainer = document.getElementById("place-details");
        
        // Get photo if available
        let photoHtml = '';
        if (place.photos && place.photos.length > 0) {
          try {
            photoHtml = \`<img src="\${place.photos[0].getUrl({maxWidth: 600, maxHeight: 400})}" 
                         class="img-fluid rounded mb-3" alt="\${place.displayName}">\`;
          } catch (error) {
            console.error("Error getting photo URL for modal:", error);
          }
        }
        
        // Format rating
        let ratingHtml = '';
        if (place.rating) {
          ratingHtml = \`<p><strong>Rating:</strong> <span class="rating">\${place.rating.toFixed(1)} ★</span> 
                         \${place.userRatingCount ? \`(\${place.userRatingCount} reviews)\` : ''}</p>\`;
        }
        
        // Create details HTML
        let detailsHtml = \`
          \${photoHtml}
          <h3>\${place.displayName}</h3>
          \${ratingHtml}
          <p><strong>Address:</strong> \${place.formattedAddress || 'Not available'}</p>
        \`;
        
        if (place.internationalPhoneNumber) {
          detailsHtml += \`<p><strong>Phone:</strong> \${place.internationalPhoneNumber}</p>\`;
        }
        
        if (place.websiteUri) {
          detailsHtml += \`<p><strong>Website:</strong> <a href="\${place.websiteUri}" target="_blank">\${place.websiteUri}</a></p>\`;
        }
        
        if (place.priceLevel) {
          detailsHtml += \`<p><strong>Price Level:</strong> \`;
          for (let i = 0; i < place.priceLevel; i++) {
            detailsHtml += '$';
          }
          detailsHtml += \`</p>\`;
        }
        
        if (place.types && place.types.length > 0) {
          detailsHtml += '<p><strong>Categories:</strong> ';
          place.types.forEach((type, index) => {
            // Format the type string
            const formattedType = type.replace(/_/g, ' ').replace(/\w\S*/g, 
              txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
            
            detailsHtml += formattedType;
            if (index < place.types.length - 1) {
              detailsHtml += ', ';
            }
          });
          detailsHtml += '</p>';
        }
        
        // Additional photos
        if (place.photos && place.photos.length > 1) {
          detailsHtml += '<h5 class="mt-4">Photos</h5>';
          detailsHtml += '<div class="row">';
          
          // Show up to 6 additional photos
          for (let i = 1; i < Math.min(place.photos.length, 7); i++) {
            try {
              detailsHtml += \`
                <div class="col-md-4 col-6 mb-2">
                  <img src="\${place.photos[i].getUrl({maxWidth: 200, maxHeight: 150})}" 
                       class="img-fluid rounded" alt="Place photo" style="height: 100px; object-fit: cover;">
                </div>
              \`;
            } catch (error) {
              console.error("Error getting additional photo URL:", error);
            }
          }
          
          detailsHtml += '</div>';
        }
        
        detailsContainer.innerHTML = detailsHtml;
        modal.show();
      }
    }
  </script>
  <script async 
          src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap&v=beta">
  </script>
</body>
</html>
  `;
  
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Modern Google Places API running on http://0.0.0.0:${PORT}`);
});