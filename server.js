require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Serve static front-end
app.use(express.static(path.join(__dirname, 'public')));

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

// 5) TripAdvisor API (uses Python script for web scraping)
app.get('/api/tripadvisor', (req, res) => {
  try {
    const { place_name, location } = req.query;
    
    if (!place_name || !location) {
      return res.status(400).json({ 
        status: 'ERROR', 
        error: 'Missing required parameters: place_name and location'
      });
    }
    
    console.log(`Fetching TripAdvisor data for ${place_name} in ${location}`);
    
    // Spawn a Python process to run the scraper
    const pythonProcess = spawn('python', [
      'tripadvisor_scraper.py',
      '--place', place_name,
      '--location', location
    ]);
    
    let dataString = '';
    let errorString = '';
    
    // Collect data from stdout
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    // Collect any errors from stderr
    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });
    
    // Send the response when the process exits
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`TripAdvisor scraper error (${code}): ${errorString}`);
        return res.status(500).json({ 
          status: 'ERROR', 
          error: 'Failed to retrieve TripAdvisor data',
          details: errorString
        });
      }
      
      try {
        const result = JSON.parse(dataString);
        res.json({
          status: 'OK',
          result
        });
      } catch (parseError) {
        console.error('Error parsing TripAdvisor data:', parseError);
        res.status(500).json({ 
          status: 'ERROR', 
          error: 'Failed to parse TripAdvisor data'
        });
      }
    });
  } catch (error) {
    console.error('Error with TripAdvisor API:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Failed to process TripAdvisor request'
    });
  }
});

// Listen on the port Replit provides
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on port ${PORT}`));