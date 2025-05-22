// Load nearby places based on user's location
async function loadNearbyPlaces(location, keyword = '', currentPlaceType = 'restaurant') {
  showLoading();
  clearMarkers();
  
  // Fetch weather data for this location
  fetchWeatherData(location);
  
  try {
    // Check if the "Open Now" checkbox is checked
    const openNowChecked = document.getElementById('open-now-checkbox').checked;
    
    // Check if this is a dessert search by keyword
    const isDessertSearch = keyword === 'dessert';
    
    // Build API URL with required parameters
    let apiUrl = `/api/nearby?lat=${location.lat}&lng=${location.lng}&type=${currentPlaceType}&radius=1500`;
    
    // Add keyword if provided
    if (keyword) {
      apiUrl += `&keyword=${encodeURIComponent(keyword)}`;
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
      const container = document.getElementById('places-container');
      container.innerHTML = '';
      
      // Log the places we found
      console.log(`Starting with ${data.results.length} places before filtering`);
      
      // Define unwanted business types
      const UNWANTED_TYPES = [
        "gas_station", 
        "convenience_store", 
        "car_repair", 
        "car_wash",
        "car_dealer"
      ];
      
      // Minimum rating to show (different minimum ratings based on place type)
      let MIN_RATING;
      if (currentPlaceType === 'restaurant') {
        MIN_RATING = 4.0;
      } else if (currentPlaceType === 'night_club') {
        MIN_RATING = 3.7; // Lower threshold for nightclubs
      } else if (currentPlaceType === 'supermarket') {
        MIN_RATING = 3.5; // Lower threshold for supermarkets
      } else {
        MIN_RATING = 3.8; // Default threshold for other places
      }
      
      // Define minimum reviews for statistical significance
      const MIN_REVIEWS = {
        restaurant: 20,
        lodging: 8,
        night_club: 10,
        supermarket: 5,
        default: 10
      };
      const currentMinReviews = MIN_REVIEWS[currentPlaceType] || MIN_REVIEWS.default;
      
      console.log(`Filtering with minimum rating of ${MIN_RATING} for ${currentPlaceType}s`);

      // Use our shared utility function to filter and sort places
      const filteredPlaces = filterAndSortPlaces(data.results, location, {
        radius: 1500,
        minRating: MIN_RATING,
        minReviews: currentMinReviews,
        unwantedTypes: UNWANTED_TYPES
      });
      
      let finalPlaces = filteredPlaces;
      
      // Log filtering information
      console.log(`After filtering: ${finalPlaces.length} of ${data.results.length} places remaining`);
      
      if (finalPlaces.length === 0) {
        // Show a message if no places meet the criteria
        const messageText = keyword === 'dessert' ? 
          `No dessert places found matching your criteria` : 
          `No places found matching your criteria`;
          
        container.innerHTML = `
          <div class="col-12">
            <div class="alert alert-info">
              <strong>${messageText}</strong>
              <p>No ${formatPlaceType(currentPlaceType)}${keyword === 'dessert' ? ' serving desserts' : ''} with a rating of ${MIN_RATING}+ found in this area.</p>
              <p>Try another location or category, or adjust the search radius.</p>
            </div>
          </div>
        `;
      } else {
        // Display filtered and sorted places
        finalPlaces.forEach((place, index) => {
          const card = createPlaceCard(place, index);
          container.appendChild(card);
          
          // Add a marker for this place
          addMarker(place, index);
        });
      }
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
      // No results
      document.getElementById('places-container').innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">No ${formatPlaceType(currentPlaceType)} found in this area. Try another location or category.</div>
        </div>
      `;
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