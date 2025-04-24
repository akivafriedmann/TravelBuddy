import trafilatura
import argparse

def test_tripadvisor_fetch(query):
    """Test fetching data from TripAdvisor"""
    from urllib.parse import quote
    encoded_query = quote(query)
    url = f"https://www.tripadvisor.com/Search?q={encoded_query}"
    
    print(f"Fetching URL: {url}")
    downloaded = trafilatura.fetch_url(url)
    
    if downloaded:
        print(f"Downloaded {len(downloaded)} bytes")
        
        # Save raw HTML to a file
        with open("tripadvisor_raw.html", "wb") as f:
            f.write(downloaded)
        print("Raw HTML saved to tripadvisor_raw.html")
        
        # Extract main content
        content = trafilatura.extract(downloaded, include_links=True, include_formatting=True, include_comments=True)
        if content:
            print(f"Extracted content length: {len(content)}")
            print("\nFirst 500 characters of extracted content:")
            print(content[:500])
            
            with open("tripadvisor_content.txt", "w", encoding="utf-8") as f:
                f.write(content)
            print("Extracted content saved to tripadvisor_content.txt")
        else:
            print("No content could be extracted")
    else:
        print("Failed to download content")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("query", help="Search query for TripAdvisor")
    args = parser.parse_args()
    
    test_tripadvisor_fetch(args.query)