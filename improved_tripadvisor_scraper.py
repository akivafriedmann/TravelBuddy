#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
import re
import json
import time
import sys
import argparse

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/100.0.4896.127 Safari/537.36"
}

def fetch_html(url):
    """Fetch HTML from URL with retries and proper headers"""
    print(f"Fetching URL: {url}", file=sys.stderr)
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            if r.status_code == 200 and "captcha" not in r.text.lower():
                print(f"Successfully fetched {len(r.text)} bytes", file=sys.stderr)
                return r.text
            print(f"Attempt {attempt+1}/3 failed with status {r.status_code}", file=sys.stderr)
        except Exception as e:
            print(f"Attempt {attempt+1}/3 failed with error: {e}", file=sys.stderr)
        time.sleep(1)
    return None

def search_tripadvisor(place_name, location):
    """Search TripAdvisor for a specific place in a location"""
    try:
        print(f"Searching TripAdvisor for: {place_name} in {location}", file=sys.stderr)
        
        # Extract city name for more focused search
        city = location.split(',')[-1].strip() if ',' in location else location
        
        # Try different search approaches
        from urllib.parse import quote_plus
        
        # First try direct restaurant search
        url = f"https://www.tripadvisor.com/Restaurants-g60763-{quote_plus(city)}.html"
        print(f"Trying direct restaurant list URL: {url}", file=sys.stderr)
        
        html = fetch_html(url)
        if not html:
            print(f"Could not fetch search results for {city}", file=sys.stderr)
            return {"name": place_name, "location": location, "tripadvisor_data": {}}
        
        soup = BeautifulSoup(html, "html.parser")
        
        # Try to find the first result's link
        restaurant_link = None
        
        # First try to find a result title
        result = soup.select_one('a.result-title')
        if result and result.get("href"):
            restaurant_link = result["href"]
            print(f"Found result via result-title: {restaurant_link}", file=sys.stderr)
        
        # If that fails, try to find a restaurant review link
        if not restaurant_link:
            result = soup.select_one('a[href^="/Restaurant_Review"]')
            if result and result.get("href"):
                restaurant_link = result["href"]
                print(f"Found result via Restaurant_Review: {restaurant_link}", file=sys.stderr)
        
        # Try looking for specific selectors from the current TripAdvisor UI
        if not restaurant_link:
            links = soup.select("div.result-title a")
            if links and links[0].get("href"):
                restaurant_link = links[0]["href"]
                print(f"Found result via div.result-title: {restaurant_link}", file=sys.stderr)
                
        # Look for any cards with links
        if not restaurant_link:
            links = soup.select(".location-meta-block a, .ui_card a, .search-result a")
            for link in links:
                if link.get("href") and ("Review" in link["href"] or "Attraction" in link["href"] or "Hotel" in link["href"]):
                    restaurant_link = link["href"]
                    print(f"Found result via generalized link search: {restaurant_link}", file=sys.stderr)
                    break
        
        # Try to find any review link as fallback
        if not restaurant_link:
            # Look for any review link that might match our place
            try:
                first_word = place_name.split()[0].lower()
                review_links = soup.select(f'a[href*="Review"][href*="{first_word}"]')
                if review_links:
                    restaurant_link = review_links[0]["href"]
                    print(f"Found result via generic review link: {restaurant_link}", file=sys.stderr)
            except Exception as e:
                print(f"Error in finding generic review link: {e}", file=sys.stderr)
        
        if not restaurant_link:
            print(f"No search results found for {place_name} in {city}", file=sys.stderr)
            return {"name": place_name, "location": location, "tripadvisor_data": {}}
        
        # Add domain if needed
        if not restaurant_link.startswith('http'):
            detail_url = "https://www.tripadvisor.com" + restaurant_link
        else:
            detail_url = restaurant_link
        
        # Now fetch the detail page
        detail_html = fetch_html(detail_url)
        if not detail_html:
            print(f"Could not fetch details from {detail_url}", file=sys.stderr)
            return {"name": place_name, "location": location, "tripadvisor_data": {}}
        
        detail_soup = BeautifulSoup(detail_html, "html.parser")
        
        # Initialize data with URL
        data = {"url": detail_url}
        
        # Rating is encoded in a span like <span class="ui_bubble_rating bubble_45"></span>
        rating_span = detail_soup.find("span", class_=re.compile(r"ui_bubble_rating bubble_\d+"))
        if rating_span:
            class_list = rating_span.get("class", [])
            bubble_classes = [c for c in class_list if c.startswith("bubble_")]
            if bubble_classes:
                cls = bubble_classes[0]
                try:
                    score = int(cls.split("_")[1]) / 10.0
                    data["rating"] = score
                    print(f"Found rating: {score}", file=sys.stderr)
                except (IndexError, ValueError) as e:
                    print(f"Error parsing rating: {e}", file=sys.stderr)
        
        # Review count in a span like <span class="reviewCount">@ 123 reviews</span>
        count_span = detail_soup.find("span", class_="reviewCount")
        if count_span:
            count_text = count_span.get_text()
            m = re.search(r"(\d[\d,]*)", count_text)
            if m:
                try:
                    review_count = int(m.group(1).replace(",", ""))
                    data["review_count"] = review_count
                    print(f"Found review count: {review_count}", file=sys.stderr)
                except ValueError:
                    pass
        
        # Ranking appears in text e.g. "#5 of 200 restaurants in Amsterdam"
        rank_elements = detail_soup.find_all(text=re.compile(r"#\d+ of [\d,]+ (?:restaurants|hotels|places|attractions)"))
        if rank_elements:
            for rank_text in rank_elements:
                m = re.search(r"#(\d+) of ([\d,]+)", rank_text)
                if m:
                    try:
                        data["rank_position"] = int(m.group(1))
                        data["rank_total"] = int(m.group(2).replace(",", ""))
                        print(f"Found ranking: #{data['rank_position']} of {data['rank_total']}", file=sys.stderr)
                        break
                    except ValueError:
                        pass
        
        # Extract detailed ratings if available
        detailed_ratings = {}
        
        # Look for excellent, very good, average, poor, terrible ratings
        rating_rows = detail_soup.select(".ratingFilter .row_label, .ratingFilter .row_count")
        if len(rating_rows) >= 2:
            labels = rating_rows[::2]  # Even indices are labels
            counts = rating_rows[1::2]  # Odd indices are counts
            
            for label, count in zip(labels, counts):
                label_text = label.get_text().strip().lower()
                count_text = count.get_text().strip()
                
                # Extract numeric count
                count_match = re.search(r"(\d[\d,]*)", count_text)
                if count_match:
                    try:
                        count_value = int(count_match.group(1).replace(",", ""))
                        
                        # Map label to our detailed rating keys
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
                    except ValueError:
                        pass
        
        if detailed_ratings:
            data["detailed_ratings"] = detailed_ratings
            print(f"Found detailed ratings: {detailed_ratings}", file=sys.stderr)
        
        # Return the complete result
        return {
            "name": place_name,
            "location": location,
            "tripadvisor_data": data
        }
    
    except Exception as e:
        print(f"Error in TripAdvisor scraper: {e}", file=sys.stderr)
        return {
            "name": place_name,
            "location": location,
            "tripadvisor_data": {}
        }

if __name__ == "__main__":
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
    
    # Print JSON result to stdout (will be captured by Node.js)
    print(json.dumps(result))