#!/bin/bash

# Check if the application is running
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000)

if [ "$RESPONSE" == "200" ]; then
  echo "Application is running successfully (HTTP 200)"
  echo "Fetching some content from the homepage..."
  curl -s http://localhost:5000 | grep -A 3 "<title>"
  echo ""
  echo "Checking API endpoint..."
  curl -s "http://localhost:5000/api/nearby?lat=40.7128&lng=-74.006&type=restaurant&radius=1500" | head -50
else
  echo "Application is not responding properly. HTTP code: $RESPONSE"
fi