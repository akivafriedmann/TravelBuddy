/**
 * Weather integration routes using OpenWeather API
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();

// OpenWeather API key
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

/**
 * Get current weather and forecast for a location
 * GET /weather?lat=52.3534336&lng=4.9053696
 */
router.get('/', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        status: 'ERROR', 
        message: 'Location parameters (lat, lng) are required' 
      });
    }
    
    if (!OPENWEATHER_API_KEY) {
      return res.status(500).json({ 
        status: 'ERROR', 
        message: 'Weather API key not configured' 
      });
    }
    
    // Fetch current weather data
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&cnt=8&appid=${OPENWEATHER_API_KEY}`;
    
    console.log(`Fetching weather data for location [${lat}, ${lng}]`);
    
    // Make parallel requests
    const [currentWeatherResponse, forecastResponse] = await Promise.all([
      axios.get(currentWeatherUrl),
      axios.get(forecastUrl)
    ]);
    
    // Format the response into a simplified structure
    const currentWeather = formatCurrentWeather(currentWeatherResponse.data);
    const forecast = formatForecast(forecastResponse.data);
    
    res.json({
      status: 'OK',
      result: {
        current: currentWeather,
        forecast: forecast
      }
    });
    
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Failed to fetch weather data',
      details: error.message 
    });
  }
});

/**
 * Format current weather data into a simplified structure
 * @param {Object} data - OpenWeather API response for current weather
 * @returns {Object} - Formatted weather data
 */
function formatCurrentWeather(data) {
  if (!data) return null;
  
  return {
    location: {
      name: data.name,
      country: data.sys?.country
    },
    temperature: {
      current: Math.round(data.main?.temp),
      feels_like: Math.round(data.main?.feels_like),
      min: Math.round(data.main?.temp_min),
      max: Math.round(data.main?.temp_max)
    },
    weather: {
      main: data.weather?.[0]?.main,
      description: data.weather?.[0]?.description,
      icon: data.weather?.[0]?.icon,
      icon_url: `https://openweathermap.org/img/wn/${data.weather?.[0]?.icon}@2x.png`
    },
    wind: {
      speed: data.wind?.speed,
      direction: data.wind?.deg
    },
    humidity: data.main?.humidity,
    pressure: data.main?.pressure,
    visibility: data.visibility,
    sunrise: data.sys?.sunrise * 1000, // Convert to milliseconds
    sunset: data.sys?.sunset * 1000,   // Convert to milliseconds
    timestamp: data.dt * 1000          // Convert to milliseconds
  };
}

/**
 * Format forecast data into a simplified structure
 * @param {Object} data - OpenWeather API response for forecast
 * @returns {Array} - Array of forecast data points
 */
function formatForecast(data) {
  if (!data || !data.list) return [];
  
  return data.list.map(item => {
    return {
      datetime: item.dt * 1000, // Convert to milliseconds
      temperature: {
        value: Math.round(item.main?.temp),
        feels_like: Math.round(item.main?.feels_like),
        min: Math.round(item.main?.temp_min),
        max: Math.round(item.main?.temp_max)
      },
      weather: {
        main: item.weather?.[0]?.main,
        description: item.weather?.[0]?.description,
        icon: item.weather?.[0]?.icon,
        icon_url: `https://openweathermap.org/img/wn/${item.weather?.[0]?.icon}@2x.png`
      },
      wind: {
        speed: item.wind?.speed,
        direction: item.wind?.deg
      },
      humidity: item.main?.humidity,
      pressure: item.main?.pressure,
      precipitation: item.pop ? Math.round(item.pop * 100) : 0 // Probability of precipitation in percent
    };
  });
}

module.exports = router;