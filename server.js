require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const { spawn } = require('child_process');

// Import routes
const tripadvisorRoutes = require('./server/routes/tripadvisor');

const app = express();
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

// Serve static front-end
app.use(express.static(path.join(__dirname, 'public')));

// Mount the TripAdvisor routes
app.use('/api/tripadvisor', tripadvisorRoutes);

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

// 6) Weather Forecast API (OpenWeather)
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