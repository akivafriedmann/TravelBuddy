import trafilatura
import requests
import sys

def test_trafilatura_fetch(url):
    """Test fetching with trafilatura"""
    print(f"Testing trafilatura fetch for: {url}")
    downloaded = trafilatura.fetch_url(url)
    if downloaded:
        print(f"Success! Downloaded {len(downloaded)} bytes")
        return True
    else:
        print(f"Trafilatura fetch failed for {url}")
        return False

def test_requests_fetch(url):
    """Test fetching with requests library for comparison"""
    print(f"Testing requests fetch for: {url}")
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        print(f"Response status code: {response.status_code}")
        if response.status_code == 200:
            print(f"Success! Downloaded {len(response.content)} bytes")
            # Save the content to a file
            with open("request_response.html", "wb") as f:
                f.write(response.content)
            print("Response saved to request_response.html")
            return True
        else:
            print(f"Request failed with status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"Request raised exception: {e}")
        return False

if __name__ == "__main__":
    # Test a few different URLs
    urls = [
        "https://www.google.com",
        "https://www.tripadvisor.com",
        "https://www.tripadvisor.com/Search?q=KYU%20NYC"
    ]
    
    if len(sys.argv) > 1:
        # Use the URL provided in command line
        urls = [sys.argv[1]]
    
    for url in urls:
        print("\n" + "="*60)
        trafilatura_result = test_trafilatura_fetch(url)
        requests_result = test_requests_fetch(url)
        
        print("\nSummary:")
        print(f"Trafilatura: {'Success' if trafilatura_result else 'Failed'}")
        print(f"Requests: {'Success' if requests_result else 'Failed'}")
        print("="*60)