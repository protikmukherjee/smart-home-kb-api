import pandas as pd
import requests
import time
import os

# --- CONFIGURATION ---
INPUT_CSV = 'data-entry/iotkb_smart_only.csv'
OUTPUT_CSV = 'data-entry/iotkb_priced.csv'

# YOUR ACCESS TOKEN (Valid for ~24 hours from creation)
ACCESS_TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjA5NzI5QTkyRDU0RDlERjIyRDQzMENBMjNDNkI4QjJFIiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjQ2NjUyOTMsImV4cCI6MTc2NDc1MTY5MywiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS5uZXhhci5jb20iLCJjbGllbnRfaWQiOiI0MGI5ODlmOC1mZTUwLTRlNWItYjViYS04OTU1MGE5ZTlhMTciLCJzdWIiOiIwOUI3QUMxNC1BMTc4LTQ2MDEtQjQ1MS1DMzdGN0I1NkUwRDgiLCJhdXRoX3RpbWUiOjE3NjQ2NjQ3NTQsImlkcCI6ImxvY2FsIiwicHJpdmF0ZV9jbGFpbXNfaWQiOiI1OTRlMGY5Zi0yMWNmLTRlNTMtYjU0Mi0yNTlkYzkyMmNkMDAiLCJwcml2YXRlX2NsYWltc19zZWNyZXQiOiJtNE4wM1V6bm54NEdoWWdWemlGWS9iS0U5MHlJVFc5Rk00eW5vcHJWSllNPSIsImp0aSI6IjAzQ0FGQjA5NTkzRjM3OEVDMTIyM0JENDNERTQ1OTgwIiwic2lkIjoiMzMwQUU4MzQ3NkY5NDc0NjhFODJGQjYwQUVBMjFERjIiLCJpYXQiOjE3NjQ2NjUyOTMsInNjb3BlIjpbIm9wZW5pZCIsInVzZXIuYWNjZXNzIiwicHJvZmlsZSIsImVtYWlsIiwidXNlci5kZXRhaWxzIiwic3VwcGx5LmRvbWFpbiIsImRlc2lnbi5kb21haW4iXSwiYW1yIjpbInB3ZCJdfQ.UKuz3SVr1SPW3VWmeYDlNdeUkca-cbW92DMUJxOb3OIi8ReTf4c_cZOWLvhnV8wrUHJPocKsa_zye9nS6XG-Vc5pc3hvPuekBwRx1jgKIChAcLa2CAcSGAUOY12I2fHfKdBP5kg2iH4E7as8b8aq2OAM0wTuQ9e_BUbGgscet63I8scUU860tgbEY7P-Tr6qiqOk3jFMHt1mYcQbkandTAB-HRd06t-SPXgUZuAjgr0cVFc7LEHHq4cbOP2qbIZT9Aqvtn9LKFURuuvBap0fcXRqfmUgorF5fiHlTP58U5eKkRCjygwO_-SIxbJbYK-iU8ZVOagG2KKgwet1RdfQ-w"

# Nexar GraphQL URL
API_URL = "https://api.nexar.com/graphql"

def fetch_price(mpn):
    """Queries Nexar for the best price for a given MPN."""
    query = """
    query Search($mpn: String!) {
      supSearchMpn(q: $mpn, limit: 1) {
        results {
          part {
            mpn
            shortDescription
            sellers {
              company {
                name
              }
              offers {
                prices {
                  price
                  currency
                  quantity
                }
              }
            }
          }
        }
      }
    }
    """
    headers = {
        'Authorization': f'Bearer {ACCESS_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.post(API_URL, json={'query': query, 'variables': {'mpn': mpn}}, headers=headers)
        
        if response.status_code != 200:
            print(f"Error {response.status_code}: {response.text}")
            return None, None

        data = response.json()
        results = data.get('data', {}).get('supSearchMpn', {}).get('results', [])
        
        if not results:
            return None, None
            
        # Get first part found
        part = results[0]['part']
        
        # Look for the best price for Quantity 1
        best_price = float('inf')
        currency = "USD"
        found = False

        for seller in part.get('sellers', []):
            for offer in seller.get('offers', []):
                for price_point in offer.get('prices', []):
                    # We want quantity 1 (or close to it)
                    if price_point['quantity'] <= 1:
                        p = float(price_point['price'])
                        if p < best_price and p > 0:
                            best_price = p
                            currency = price_point['currency']
                            found = True
        
        if found:
            return best_price, currency
            
    except Exception as e:
        print(f"Exception: {e}")
        return None, None
        
    return None, None

def main():
    if not os.path.exists(INPUT_CSV):
        print(f"Error: {INPUT_CSV} not found.")
        return

    print(f"Reading {INPUT_CSV}...")
    df = pd.read_csv(INPUT_CSV)
    
    # Ensure columns exist
    if 'offer_price' not in df.columns: df['offer_price'] = None
    if 'currency' not in df.columns: df['currency'] = None

    updates = 0
    print("Fetching prices using provided Access Token...")
    
    # We will try to fetch prices for the first 10 valid MPNs to test the token
    # Remove the counter check to run for ALL parts
    
    for index, row in df.iterrows():
        mpn = str(row['mpn'])
        
        # Skip invalid MPNs or Generic parts (Generic usually has no specific MPN price)
        if mpn == 'nan' or mpn == '' or str(row['manufacturer']).lower() == 'generic':
            continue
            
        # Skip if already priced (optional)
        if pd.notna(row['offer_price']):
            continue

        print(f"Querying: {mpn}...", end=" ", flush=True)
        
        price, currency = fetch_price(mpn)
        
        if price:
            df.at[index, 'offer_price'] = price
            df.at[index, 'currency'] = currency
            print(f"Found: {price} {currency}")
            updates += 1
        else:
            print("Not found.")
            
        # Be gentle with the API rate limit
        time.sleep(0.2)

    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nDone! Updated prices for {updates} parts.")
    print(f"Saved to {OUTPUT_CSV}")

if __name__ == "__main__":
    main()