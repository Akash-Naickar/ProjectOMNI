import csv
import json
import pycountry
import os

def load_registry(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def audit_v3():
    country_reg = load_registry("python-backend/data/country_registry.json")
    crop_reg = load_registry("python-backend/data/crop_registry.json")
    cleaned_file = "python-backend/data/cleaned_crop_data.csv"
    
    # 1. Survival Check
    cleaned_tuples = set()
    rows = []
    try:
        with open(cleaned_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cleaned_tuples.add((row["Country"], row["Crop"]))
                rows.append(row)
    except Exception as e:
        print(f"Error: {e}")
        return

    print(f"Total Unique (Country, Crop) in Cleaned: {len(cleaned_tuples)}")

    # 2. ISO Mapping (using Registry)
    iso_mapped = set()
    unmapped_countries = set()
    collapses = {} # iso -> set(raw_names)
    
    for row in rows:
        country = row["Country"]
        iso = None
        if country in country_reg:
            iso = country_reg[country]["iso3"]
        
        if iso:
            iso_mapped.add((iso, row["Crop"]))
            if iso not in collapses: collapses[iso] = set()
            collapses[iso].add(country)
        else:
            unmapped_countries.add(country)

    print(f"Unique (ISO, Crop) pairs: {len(iso_mapped)}")
    print(f"Countries mapped: {len(set(row['Country'] for row in rows if row['Country'] in country_reg))}")
    
    # 3. Many-to-One Diagnostics
    multi_mappings = {k: v for k, v in collapses.items() if len(v) > 1}
    if multi_mappings:
        print(f"Many-to-One ISO Collapses: {len(multi_mappings)}")
        # print first 5
        for iso, names in list(multi_mappings.items())[:5]:
            print(f"  {iso} <- {names}")

    # 4. Specific Key Checks
    print("\n--- Specific Checks ---")
    for test in ["United States of America", "USSR", "Türkiye", "Viet Nam"]:
        reg_entry = country_reg.get(test)
        print(f"  {test:25} -> {reg_entry}")

    # 5. Crop Check
    wheat_mapped = [pair for pair in iso_mapped if pair[1] == "Wheat"]
    print(f"\nUnique ISOs with 'Wheat' data: {len(wheat_mapped)}")

if __name__ == "__main__":
    audit_v3()
