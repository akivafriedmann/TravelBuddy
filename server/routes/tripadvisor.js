/**
 * TripAdvisor integration routes
 */
const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');

/**
 * Get TripAdvisor data for a place
 * GET /tripadvisor?place_name=Restaurant Name&location=Amsterdam
 */
router.get('/', async (req, res) => {
  try {
    const { place_name, location } = req.query;
    
    if (!place_name || !location) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Both place name and location must be provided'
      });
    }
    
    console.log(`TripAdvisor request for: "${place_name}" in "${location}"`);
    
    // Call the improved Python script to scrape TripAdvisor data
    const pythonPath = path.join(process.cwd(), 'improved_tripadvisor_scraper.py');
    const command = `python3 ${pythonPath} --place "${place_name}" --location "${location}"`;
    
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

module.exports = router;