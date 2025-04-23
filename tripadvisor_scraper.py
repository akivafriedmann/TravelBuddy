import re
import trafilatura
import json
import argparse
import sys
import time
from urllib.parse import quote

def search_tripadvisor(place_name, location):
    """Search TripAdvisor for a specific place in a location"""
    try:
        print(f"Searching TripAdvisor for: {place_name} in {location}", file=sys.stderr)
        
        # Format the search query for TripAdvisor
        search_query = f"{place_name} {location}"
        encoded_query = quote(search_query)
        
        # The TripAdvisor search URL
        url = f"https://www.tripadvisor.com/Search?q={encoded_query}"
        print(f"TripAdvisor search URL: {url}", file=sys.stderr)
        
        # Fetch the HTML content with retries
        downloaded = None
        retries = 3
        for attempt in range(retries):
            downloaded = trafilatura.fetch_url(url)
            if downloaded:
                break
            print(f"Retry {attempt+1}/{retries} fetching TripAdvisor data", file=sys.stderr)
            time.sleep(1)  # Short delay between retries
        
        if not downloaded:
            print("Failed to download TripAdvisor search results", file=sys.stderr)
            return {
                "name": place_name,
                "location": location,
                "tripadvisor_data": {}
            }
            
        content = trafilatura.extract(downloaded, include_links=True, include_formatting=True)
        if not content:
            print("Failed to extract content from TripAdvisor page", file=sys.stderr)
            return {
                "name": place_name,
                "location": location,
                "tripadvisor_data": {}
            }
        
        print(f"TripAdvisor content length: {len(content)}", file=sys.stderr)
        
        # Look for patterns that indicate TripAdvisor ratings
        # This is a simplified approach - actual implementation may need adjustment
        rating_pattern = r"(\d+\.?\d*) of 5 bubbles, (\d+[\,\d]*) reviews"
        ranking_pattern = r"#(\d+) of (\d+[\,\d]*) (?:restaurants|hotels|attractions) in"
        
        rating_match = re.search(rating_pattern, content)
        ranking_match = re.search(ranking_pattern, content)
        
        # Find the most likely URL for the place - make the match more flexible
        # Try different patterns to increase chances of finding a match
        link_patterns = [
            r'<a href="(/[^"]+)">[^<]*' + re.escape(place_name),  # Exact match
            r'<a href="(/[^"]+)">[^<]*' + re.escape(place_name.split(' ')[0]),  # First word match
            r'<a href="(/Restaurant_Review[^"]+)"'  # Any restaurant review link
        ]
        
        link_match = None
        for pattern in link_patterns:
            link_match = re.search(pattern, content, re.IGNORECASE)
            if link_match:
                break
        
        # Prepare the result
        result = {
            "name": place_name,
            "location": location,
            "tripadvisor_data": {}
        }
        
        if rating_match:
            print(f"Found rating: {rating_match.group(1)}", file=sys.stderr)
            result["tripadvisor_data"]["rating"] = float(rating_match.group(1))
            result["tripadvisor_data"]["review_count"] = rating_match.group(2).replace(",", "")
        
        if ranking_match:
            print(f"Found ranking: #{ranking_match.group(1)} of {ranking_match.group(2)}", file=sys.stderr)
            result["tripadvisor_data"]["rank_position"] = int(ranking_match.group(1))
            result["tripadvisor_data"]["rank_total"] = ranking_match.group(2).replace(",", "")
        
        if link_match:
            print(f"Found TripAdvisor URL: {link_match.group(1)}", file=sys.stderr)
            result["tripadvisor_data"]["url"] = f"https://www.tripadvisor.com{link_match.group(1)}"
        
        # For testing - generate mock data if nothing was found (debug only)
        if not result["tripadvisor_data"]:
            print("No TripAdvisor data found for this place", file=sys.stderr)
            
        return result
    except Exception as e:
        print(f"Error searching TripAdvisor: {e}", file=sys.stderr)
        return {
            "name": place_name,
            "location": location,
            "tripadvisor_data": {}
        }

def get_detailed_ratings(tripadvisor_url):
    """Get more detailed ratings from a specific TripAdvisor page"""
    try:
        # Fetch the HTML content of the specific page
        downloaded = trafilatura.fetch_url(tripadvisor_url)
        if not downloaded:
            return None
            
        content = trafilatura.extract(downloaded, include_links=True, include_formatting=True)
        
        # Extract more detailed data (these patterns may need adjustment)
        excellent_pattern = r"Excellent(\d+[\,\d]*)"
        very_good_pattern = r"Very good(\d+[\,\d]*)"
        average_pattern = r"Average(\d+[\,\d]*)"
        poor_pattern = r"Poor(\d+[\,\d]*)"
        terrible_pattern = r"Terrible(\d+[\,\d]*)"
        
        details = {}
        
        excellent_match = re.search(excellent_pattern, content)
        if excellent_match:
            details["excellent"] = excellent_match.group(1).replace(",", "")
            
        very_good_match = re.search(very_good_pattern, content)
        if very_good_match:
            details["very_good"] = very_good_match.group(1).replace(",", "")
            
        average_match = re.search(average_pattern, content)
        if average_match:
            details["average"] = average_match.group(1).replace(",", "")
            
        poor_match = re.search(poor_pattern, content)
        if poor_match:
            details["poor"] = poor_match.group(1).replace(",", "")
            
        terrible_match = re.search(terrible_pattern, content)
        if terrible_match:
            details["terrible"] = terrible_match.group(1).replace(",", "")
            
        return details
    except Exception as e:
        print(f"Error getting detailed ratings: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    import sys
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Scrape TripAdvisor for restaurant/place data')
    parser.add_argument('--place', required=True, help='Name of the place to search for')
    parser.add_argument('--location', required=True, help='Location (city, area) of the place')
    
    # If no arguments are passed, print help and exit
    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)
        
    args = parser.parse_args()
    
    # Search for the place on TripAdvisor
    result = search_tripadvisor(args.place, args.location)
    
    # If we found a TripAdvisor URL, get detailed ratings
    if result and "tripadvisor_data" in result and "url" in result["tripadvisor_data"]:
        details = get_detailed_ratings(result["tripadvisor_data"]["url"])
        if details:
            result["tripadvisor_data"]["detailed_ratings"] = details
    
    # Print JSON result to stdout (will be captured by Node.js)
    print(json.dumps(result))