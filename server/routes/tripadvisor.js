/**
 * TripAdvisor integration routes
 */
const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');

/**
 * Get TripAdvisor data for a place
 * GET /tripadvisor?place=Restaurant Name&location=Amsterdam
 */
router.get('/', async (req, res) => {
  try {
    const { place, location } = req.query;
    
    if (!place || !location) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Both place name and location must be provided'
      });
    }
    
    // Call the Python script to scrape TripAdvisor data
    const pythonPath = path.join(process.cwd(), 'tripadvisor_scraper.py');
    const command = `python ${pythonPath} --place "${place}" --location "${location}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing TripAdvisor scraper: ${error.message}`);
        return res.status(500).json({
          status: 'ERROR',
          message: 'Failed to retrieve TripAdvisor data',
          error: error.message
        });
      }
      
      if (stderr) {
        console.error(`TripAdvisor scraper warning: ${stderr}`);
      }
      
      try {
        // Parse the JSON output from the Python script
        const data = JSON.parse(stdout);
        
        // Return the TripAdvisor data
        return res.json({
          status: 'OK',
          result: data
        });
      } catch (parseError) {
        console.error(`Error parsing TripAdvisor data: ${parseError.message}`);
        return res.status(500).json({
          status: 'ERROR',
          message: 'Failed to parse TripAdvisor data',
          error: parseError.message
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