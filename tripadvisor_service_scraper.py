#!/usr/bin/env python3
import requests
import json
import sys
import argparse
import os
import re
from bs4 import BeautifulSoup, Tag
from urllib.parse import quote_plus

# Check if we have a ScrapingBee API key in the environment
SCRAPINGBEE_API_KEY = os.environ.get('SCRAPINGBEE_API_KEY', '')

def fetch_via_service(url):
    """
    Fetch a URL using the ScrapingBee API or similar service
    """
    if SCRAPINGBEE_API_KEY:
        # Using ScrapingBee service if API key is available
        print(f"Fetching URL via ScrapingBee: {url}", file=sys.stderr)
        
        scrapingbee_url = f"https://app.scrapingbee.com/api/v1/"
        params = {
            'api_key': SCRAPINGBEE_API_KEY,
            'url': url,
            'render_js': 'false',  # Set to true if JavaScript rendering is needed
            'premium_proxy': 'true'  # Use premium proxies to avoid blocks
        }
        
        try:
            response = requests.get(scrapingbee_url, params=params, timeout=30)
            if response.status_code == 200:
                print(f"Successfully fetched {len(response.text)} bytes via ScrapingBee", file=sys.stderr)
                return response.text
            else:
                print(f"ScrapingBee returned error: {response.status_code}", file=sys.stderr)
        except Exception as e:
            print(f"Error with ScrapingBee request: {e}", file=sys.stderr)
    else:
        # If no API key, use direct request with better headers
        print(f"No ScrapingBee API key found. Attempting direct request: {url}", file=sys.stderr)
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
            "TE": "Trailers"
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                print(f"Successfully fetched {len(response.text)} bytes directly", file=sys.stderr)
                return response.text
            else:
                print(f"Direct request returned error: {response.status_code}", file=sys.stderr)
        except Exception as e:
            print(f"Error with direct request: {e}", file=sys.stderr)
    
    return None

def search_for_place(place_name, location):
    """
    Try multiple approaches to find a specific place on TripAdvisor
    """
    # Try different search strategies
    search_strategies = [
        # Strategy 1: Direct search with name and location
        f"{place_name} {location}",
        # Strategy 2: Just the place name (for very known places like Eiffel Tower)
        f"{place_name}",
        # Strategy 3: More specific with "restaurant" keyword if likely a restaurant
        f"{place_name} restaurant {location}",
        # Strategy 4: More specific with "hotel" keyword if likely a hotel
        f"{place_name} hotel {location}",
        # Strategy 5: More specific with "attraction" keyword if likely an attraction
        f"{place_name} attraction {location}"
    ]
    
    all_link_candidates = []
    
    for query in search_strategies:
        print(f"Trying search query: {query}", file=sys.stderr)
        search_url = f"https://www.tripadvisor.com/Search?q={quote_plus(query)}"
        
        html = fetch_via_service(search_url)
        if not html:
            print(f"Failed to fetch search results for {query}", file=sys.stderr)
            continue
        
        soup = BeautifulSoup(html, "html.parser")
        
        # Multiple strategies to find a relevant link within this search
        link_candidates = []
        
        # Strategy 1: Look for result title links
        title_links = soup.select('a.result-title')
        if title_links:
            for link in title_links:
                if link.get('href'):
                    # Check if link text contains place name for better relevance
                    link_text = link.get_text().lower()
                    place_name_lower = place_name.lower()
                    
                    # Calculate relevance score
                    score = 5  # Base score for title matches
                    if place_name_lower in link_text:
                        score += 3  # Bonus for name match
                    
                    # Extract type from URL to improve scoring
                    url = link['href']
                    if 'Restaurant_Review' in url:
                        link_type = 'restaurant'
                    elif 'Hotel_Review' in url:
                        link_type = 'hotel'
                    elif 'Attraction_Review' in url:
                        link_type = 'attraction'
                    else:
                        link_type = 'unknown'
                    
                    link_candidates.append({
                        'url': url,
                        'score': score,
                        'source': 'result-title',
                        'text': link_text,
                        'type': link_type
                    })
        
        # Strategy 2: Look for ALL Review links (restaurants, hotels, attractions)
        review_links = soup.select('a[href*="_Review"]')
        if review_links:
            for link in review_links:
                if link.get('href') and not any(c['url'] == link['href'] for c in link_candidates):
                    url = link['href']
                    link_text = link.get_text().lower()
                    place_name_lower = place_name.lower()
                    
                    # Calculate score based on type and text match
                    score = 3  # Base score
                    
                    # Determine type for better relevance
                    if 'Restaurant_Review' in url:
                        link_type = 'restaurant'
                        score += 1
                    elif 'Hotel_Review' in url:
                        link_type = 'hotel'
                        score += 1
                    elif 'Attraction_Review' in url:
                        link_type = 'attraction'
                        score += 1
                    else:
                        link_type = 'unknown'
                    
                    # Score bonus for name match
                    if place_name_lower in link_text:
                        score += 2
                    
                    link_candidates.append({
                        'url': url,
                        'score': score,
                        'source': f'{link_type}-review',
                        'text': link_text,
                        'type': link_type
                    })
        
        # Add these candidates to our overall list
        all_link_candidates.extend(link_candidates)
        
        # If we found good candidates (score > 6), no need to try more strategies
        if any(c['score'] > 6 for c in link_candidates):
            print(f"Found high-quality candidates. Stopping search.", file=sys.stderr)
            break
    
    # If we have candidates, use the highest-scoring one
    if all_link_candidates:
        # Sort by score in descending order
        sorted_candidates = sorted(all_link_candidates, key=lambda x: x['score'], reverse=True)
        best_candidate = sorted_candidates[0]
        print(f"Selected best candidate: {best_candidate}", file=sys.stderr)
        
        link_url = best_candidate['url']
        if not link_url.startswith('http'):
            link_url = f"https://www.tripadvisor.com{link_url}"
        
        return link_url
    
    print(f"No suitable links found for {place_name} in {location}", file=sys.stderr)
    return None

def extract_tripadvisor_data(detail_url):
    """
    Extract TripAdvisor data from a specific URL
    """
    html = fetch_via_service(detail_url)
    if not html:
        print(f"Failed to fetch details from {detail_url}", file=sys.stderr)
        return {}
    
    soup = BeautifulSoup(html, "html.parser")
    data = {"url": detail_url}
    
    try:
        # Extract rating: Look for bubble ratings (e.g., "bubble_45" = 4.5 stars)
        rating_elem = soup.find("span", class_=re.compile(r"ui_bubble_rating bubble_\d+"))
        if rating_elem and hasattr(rating_elem, 'get'):  # Make sure it's a Tag-like object
            class_list = rating_elem.get("class", []) or []  # Handle None return
            bubble_classes = [c for c in class_list if c and c.startswith("bubble_")]
            if bubble_classes:
                cls = bubble_classes[0]
                score = int(cls.split("_")[1]) / 10.0
                data["rating"] = score
                print(f"Found rating: {score}", file=sys.stderr)
        
        # Extract review count
        review_count_elem = soup.find("span", class_="reviewCount")
        if review_count_elem:
            count_text = review_count_elem.get_text()
            count_match = re.search(r"(\d[\d,]*)", count_text)
            if count_match:
                review_count = int(count_match.group(1).replace(",", ""))
                data["review_count"] = review_count
                print(f"Found review count: {review_count}", file=sys.stderr)
        
        # Extract ranking position
        ranking_elems = soup.find_all(text=re.compile(r"#\d+ of [\d,]+ (?:restaurants|hotels|places|attractions)"))
        if ranking_elems:
            for rank_text in ranking_elems:
                rank_match = re.search(r"#(\d+) of ([\d,]+)", rank_text)
                if rank_match:
                    rank_position = int(rank_match.group(1))
                    rank_total = int(rank_match.group(2).replace(",", ""))
                    data["rank_position"] = rank_position
                    data["rank_total"] = rank_total
                    print(f"Found ranking: #{rank_position} of {rank_total}", file=sys.stderr)
                    break
        
        # Extract detailed ratings (excellent, very good, etc.)
        detailed_ratings = {}
        rating_rows = soup.select(".ratingFilter .row_label, .ratingFilter .row_count")
        if len(rating_rows) >= 2:
            labels = rating_rows[::2]  # Even indices are labels
            counts = rating_rows[1::2]  # Odd indices are counts
            
            for label, count in zip(labels, counts):
                label_text = label.get_text().strip().lower()
                count_text = count.get_text().strip()
                
                count_match = re.search(r"(\d[\d,]*)", count_text)
                if count_match:
                    count_value = int(count_match.group(1).replace(",", ""))
                    
                    if "excellent" in label_text:
                        detailed_ratings["excellent"] = count_value
                    elif "very good" in label_text:
                        detailed_ratings["very_good"] = count_value
                    elif "average" in label_text:
                        detailed_ratings["average"] = count_value
                    elif "poor" in label_text:
                        detailed_ratings["poor"] = count_value
                    elif "terrible" in label_text:
                        detailed_ratings["terrible"] = count_value
        
        if detailed_ratings:
            data["detailed_ratings"] = detailed_ratings
            print(f"Found detailed ratings: {detailed_ratings}", file=sys.stderr)
        
        # Try to extract name if available
        name_elem = soup.select_one("h1.ui_header")
        if name_elem:
            data["name"] = name_elem.get_text().strip()
            print(f"Found name: {data['name']}", file=sys.stderr)
            
        return data
    
    except Exception as e:
        print(f"Error parsing TripAdvisor data: {e}", file=sys.stderr)
        return data

def get_tripadvisor_data(place_name, location):
    """
    Main function to get TripAdvisor data for a place
    """
    try:
        print(f"Searching TripAdvisor for: {place_name} in {location}", file=sys.stderr)
        
        # First try to find the place page
        detail_url = search_for_place(place_name, location)
        
        if not detail_url:
            return {
                "name": place_name,
                "location": location,
                "tripadvisor_data": {}
            }
        
        # Extract data from the page
        print(f"Extracting data from: {detail_url}", file=sys.stderr)
        tripadvisor_data = extract_tripadvisor_data(detail_url)
        
        if tripadvisor_data:
            return {
                "name": place_name,
                "location": location,
                "tripadvisor_data": tripadvisor_data
            }
        else:
            return {
                "name": place_name,
                "location": location,
                "tripadvisor_data": {}
            }
    
    except Exception as e:
        print(f"Error in TripAdvisor service scraper: {e}", file=sys.stderr)
        return {
            "name": place_name,
            "location": location,
            "tripadvisor_data": {}
        }

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Scrape TripAdvisor for restaurant/place data using a scraping service')
    parser.add_argument('--place', required=True, help='Name of the place to search for')
    parser.add_argument('--location', required=True, help='Location (city, area) of the place')
    
    # If no arguments are passed, print help and exit
    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)
        
    args = parser.parse_args()
    
    # Search for the place on TripAdvisor
    result = get_tripadvisor_data(args.place, args.location)
    
    # Print JSON result to stdout (will be captured by Node.js)
    print(json.dumps(result))