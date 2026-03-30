import urllib.request
import json

def final_check():
    try:
        # Check 1: Coverage
        resp1 = json.loads(urllib.request.urlopen("http://localhost:8000/api/debug/coverage").read().decode())
        print(f"ISO Mapped: {resp1['iso_mapped']}")
        print(f"Unmapped (first 5): {resp1['unmapped'][:5]}")
        
        # Check 2: Resilience Count for Wheat
        resp2 = json.loads(urllib.request.urlopen("http://localhost:8000/api/resilience?crop=Wheat").read().decode())
        count = len(resp2['top_resilient'])
        print(f"Wheat Resilience Count: {count}")
        
        # Check 3: Metadata check
        resp3 = json.loads(urllib.request.urlopen("http://localhost:8000/api/metadata").read().decode())
        print(f"Crops in Metadata: {len(resp3['crops'])}")

        if count > 100:
            print("SUCCESS: Map density restored (count > 100)")
        else:
            print(f"FAILURE: Map density low ({count})")

    except Exception as e:
        print(f"Check failed: {e}")

if __name__ == "__main__":
    final_check()
