import json
import urllib.request
import pycountry

def audit_geojson():
    url = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
    try:
        response = urllib.request.urlopen(url)
        data = json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching GeoJSON: {e}")
        return

    features = data.get("features", [])
    print(f"Total GeoJSON Features: {len(features)}")
    
    unique_prop_keys = set()
    iso_a3_count = 0
    adm0_a3_count = 0
    minus_99_count = 0
    empty_count = 0
    
    for f in features:
        props = f.get("properties", {})
        unique_prop_keys.update(props.keys())
        
        iso_a3 = props.get("ISO_A3")
        adm0_a3 = props.get("ADM0_A3")
        
        if iso_a3: iso_a3_count += 1
        if adm0_a3: adm0_a3_count += 1
        
        if iso_a3 == "-99" or adm0_a3 == "-99":
            minus_99_count += 1
        if not iso_a3 and not adm0_a3:
            empty_count += 1

    print(f"Property Keys found: {sorted(list(unique_prop_keys))}")
    print(f"Features with ISO_A3: {iso_a3_count}")
    print(f"Features with ADM0_A3: {adm0_a3_count}")
    print(f"Features with '-99': {minus_99_count}")
    print(f"Features with NO A3 keys: {empty_count}")
    
    # Check a few specific examples from GeoJSON
    for f in features[:5]:
        p = f['properties']
        print(f"  Name: {p.get('ADMIN') or p.get('name')}, ISO_A3: {p.get('ISO_A3')}, ADM0_A3: {p.get('ADM0_A3')}")

def test_normalization():
    print("\n--- Testing get_iso3 Hardening ---")
    test_cases = ["USA", "TUR", "USSR", "Yugoslavia", "Democratic Republic of the Congo", "Viet Nam"]
    
    # Simulate updated get_iso3
    for name in test_cases:
        iso = None
        # 1. Exact alpha_3 match
        try:
            res = pycountry.countries.get(alpha_3=name)
            if res: iso = res.alpha_3
        except: pass
        
        if not iso:
            try:
                res = pycountry.countries.lookup(name)
                iso = res.alpha_3
            except LookupError:
                try:
                    res = pycountry.historic_countries.lookup(name)
                    iso = res.alpha_3
                except LookupError:
                    pass
        print(f"  '{name}' -> {iso}")

if __name__ == "__main__":
    audit_geojson()
    test_normalization()
