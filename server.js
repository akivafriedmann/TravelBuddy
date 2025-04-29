require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const { spawn } = require('child_process');

// We'll set up TripAdvisor routes directly instead of importing
// to avoid path resolution issues with the Python script
// const tripadvisorRoutes = require('./server/routes/tripadvisor');

const app = express();
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

// Serve static front-end
const publicPath = path.join(__dirname, 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Direct implementation of TripAdvisor route with correct path for this server
const { exec } = require('child_process');

app.get('/api/tripadvisor', async (req, res) => {
  try {
    const { place_name, location } = req.query;
    
    if (!place_name || !location) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Both place name and location must be provided'
      });
    }
    
    console.log(`TripAdvisor request for: "${place_name}" in "${location}"`);
    
    // Use the absolute path to the Python script
    // The ProxyServer runs from a different directory than the Server
    const pythonPath = '/home/runner/workspace/tripadvisor_service_scraper.py';
    const command = `python3 ${pythonPath} --place "${place_name}" --location "${location}"`;
    console.log(`Executing Python script: ${pythonPath}`);
    
    exec(command, (error, stdout, stderr) => {
      // We'll continue gracefully even if there are errors with the scraper
      if (error) {
        console.error(`Error executing TripAdvisor scraper: ${error.message}`);
        // Instead of returning a 500 error, we'll return a graceful "no data" response
        return res.json({
          status: 'OK',
          result: {
            name: place_name,
            location: location,
            tripadvisor_data: null,
            source_error: error.message
          }
        });
      }
      
      if (stderr) {
        console.error(`TripAdvisor scraper warning: ${stderr}`);
      }
      
      try {
        // Parse the JSON output from the Python script
        console.log(`TripAdvisor raw output: ${stdout}`);
        const data = JSON.parse(stdout);
        
        // Check if we have meaningful TripAdvisor data
        if (data && data.tripadvisor_data && 
            (data.tripadvisor_data.rating || 
             data.tripadvisor_data.url || 
             data.tripadvisor_data.rank_position)) {
          console.log(`Found TripAdvisor data for "${place_name}":`, data.tripadvisor_data);
          
          // Return the TripAdvisor data
          return res.json({
            status: 'OK',
            result: data
          });
        } else {
          console.log(`No meaningful TripAdvisor data found for "${place_name}"`);
          // We have data but no meaningful TripAdvisor info
          return res.json({
            status: 'OK',
            result: {
              name: place_name,
              location: location,
              tripadvisor_data: null,
              access_limited: true  // Flag indicating access is limited
            }
          });
        }
      } catch (parseError) {
        console.error(`Error parsing TripAdvisor data: ${parseError.message}`);
        console.error(`Raw output was: ${stdout}`);
        // Instead of returning a 500 error, we'll return a graceful "no data" response
        return res.json({
          status: 'OK',
          result: {
            name: place_name,
            location: location,
            tripadvisor_data: null,
            parse_error: parseError.message
          }
        });
      }
    });
  } catch (error) {
    console.error('Error in TripAdvisor route:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Internal server error',
      error: error.message
    });
  }
});

// 1) Geocode address → lat/lng
app.get('/api/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing address parameter' });
    }
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json`
              + `?address=${encodeURIComponent(address)}`
              + `&key=${API_KEY}`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    res.json(result);
  } catch (error) {
    console.error('Error with geocoding:', error);
    res.status(500).json({ status: 'ERROR', error: 'Failed to geocode address' });
  }
});

// 2) Nearby Search with enhanced parameters
app.get('/api/nearby', async (req, res) => {
  try {
    const { lat, lng, type = 'restaurant', radius = 1500, keyword } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing required location parameters' });
    }
    
    // Build URL with optional parameters
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    const params = {
      location: `${lat},${lng}`,
      radius,
      type,
      key: API_KEY
    };
    
    // Add keyword if provided
    if (keyword) {
      params.keyword = keyword;
    }
    
    url.search = new URLSearchParams(params);
    
    console.log(`Fetching nearby places: ${url.toString().replace(API_KEY, 'API_KEY')}`);
    
    const response = await fetch(url);
    const result = await response.json();
    
    console.log(`Nearby places response: status=${result.status}, results=${result.results ? result.results.length : 0}`);
    
    // Filter out hotels from restaurant or bar searches
    if (type === 'restaurant' || type === 'bar') {
      if (result.results && Array.isArray(result.results)) {
        result.results = result.results.filter(place => {
          // Filter out places that have 'lodging' in their types
          return !place.types || !place.types.includes('lodging');
        });
        console.log(`Filtered out hotels, remaining places: ${result.results.length}`);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    res.status(500).json({ status: 'ERROR', error: 'Failed to fetch nearby places' });
  }
});

// 3) Place Details with comprehensive fields
app.get('/api/details', async (req, res) => {
  try {
    const { place_id } = req.query;
    
    if (!place_id) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing place_id parameter' });
    }
    
    const fields = [
      'name', 'rating', 'formatted_address', 'photos',
      'formatted_phone_number', 'website', 'price_level',
      'types', 'reviews', 'user_ratings_total', 'vicinity',
      'geometry', 'opening_hours'
    ].join(',');
    
    const url = `https://maps.googleapis.com/maps/api/place/details/json`
              + `?place_id=${place_id}`
              + `&fields=${fields}`
              + `&key=${API_KEY}`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ status: 'ERROR', error: 'Failed to fetch place details' });
  }
});

// 4) Photo Proxy (redirect to Google's photo endpoint)
app.get('/api/photo', (req, res) => {
  try {
    const { photoreference, maxwidth = 400 } = req.query;
    
    if (!photoreference) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing photoreference parameter' });
    }
    
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo`
                   + `?photoreference=${photoreference}`
                   + `&maxwidth=${maxwidth}`
                   + `&key=${API_KEY}`;
    
    res.redirect(photoUrl);
  } catch (error) {
    console.error('Error with photo proxy:', error);
    res.status(500).json({ status: 'ERROR', error: 'Failed to proxy photo request' });
  }
});

// 5) TripAdvisor API (now handled by server/routes/tripadvisor.js)

// 6) Google Maps API key loader (for frontend)
app.get('/api/maps-loader', (req, res) => {
  // Use the API key from environment variables
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  // Return a script that loads the Google Maps API with the server's API key
  res.set('Content-Type', 'application/javascript');
  res.send(`
    // Load the Google Maps API with the key from the server
    (function() {
      const script = document.createElement('script');
      script.src = "https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap";
      script.defer = true;
      script.async = true;
      document.head.appendChild(script);
      console.log("Google Maps API loading with server-provided key");
    })();
  `);
});

// 7) Weather Forecast API (OpenWeather)
app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        status: 'ERROR', 
        error: 'Missing required parameters: lat and lng'
      });
    }
    
    // Call OpenWeather API for 5-day forecast with 3-hour intervals
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${WEATHER_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.cod !== '200') {
      return res.status(500).json({
        status: 'ERROR',
        error: `Weather API error: ${data.message || 'Unknown error'}`
      });
    }
    
    // Process and structure the data for the next 3 days (today, tomorrow, day after)
    const forecasts = [];
    const now = new Date();
    const today = now.getDate();
    const uniqueDays = new Set();
    
    // Group forecast by day (we want 3 days)
    data.list.forEach(item => {
      const forecastDate = new Date(item.dt * 1000);
      const forecastDay = forecastDate.getDate();
      
      // Skip if it's not within next 3 days or if we already have this day
      if (forecastDay < today || forecastDay > today + 2) {
        return;
      }
      
      // For each day, find the forecast for midday (around 12-15pm) which is most representative
      const hours = forecastDate.getHours();
      if (hours >= 12 && hours <= 15 && !uniqueDays.has(forecastDay)) {
        uniqueDays.add(forecastDay);
        
        // Get day name
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[forecastDate.getDay()];
        
        forecasts.push({
          date: forecastDate.toISOString().split('T')[0],
          day: dayName,
          temp: Math.round(item.main.temp),
          feels_like: Math.round(item.main.feels_like),
          description: item.weather[0].description,
          icon: item.weather[0].icon,
          wind_speed: item.wind.speed,
          humidity: item.main.humidity
        });
      }
    });
    
    // If we don't have exactly 3 days (due to API data structure), we need to fill in
    if (forecasts.length < 3) {
      // Just get the first 3 items from the list (not ideal but will work)
      const used = new Set(forecasts.map(f => f.date));
      
      for (const item of data.list) {
        const forecastDate = new Date(item.dt * 1000);
        const dateStr = forecastDate.toISOString().split('T')[0];
        
        if (!used.has(dateStr) && forecasts.length < 3) {
          used.add(dateStr);
          
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayName = dayNames[forecastDate.getDay()];
          
          forecasts.push({
            date: dateStr,
            day: dayName,
            temp: Math.round(item.main.temp),
            feels_like: Math.round(item.main.feels_like),
            description: item.weather[0].description,
            icon: item.weather[0].icon,
            wind_speed: item.wind.speed,
            humidity: item.main.humidity
          });
        }
      }
    }
    
    // Sort by date
    forecasts.sort((a, b) => a.date.localeCompare(b.date));
    
    // Return only the necessary data
    res.json({
      status: 'OK',
      city: data.city.name,
      country: data.city.country,
      forecasts: forecasts.slice(0, 3) // Limit to 3 days
    });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Failed to fetch weather forecast'
    });
  }
});

// Listen on the port Replit provides
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on port ${PORT}`));