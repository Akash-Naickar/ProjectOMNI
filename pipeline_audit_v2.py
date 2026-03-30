import csv
import pycountry
import os
import json

# Mirroring main.py's alias list for consistency in audit
FAO_ALIASES = {
    "Türkiye": "TUR",
    "Viet Nam": "VNM",
    "United Kingdom of Great Britain and Northern Ireland": "GBR",
    "Russian Federation": "RUS",
    "Iran (Islamic Republic of)": "IRN",
    "Democratic People's Republic of Korea": "PRK",
    "Republic of Korea": "KOR",
    "Syrian Arab Republic": "SYR",
    "Venezuela (Bolivarian Republic of)": "VEN",
    "Bolivia (Plurinational State of)": "BOL",
    "Lao People's Democratic Republic": "LAO",
    "Republic of Moldova": "MDA",
    "Congo": "COG",
    "United Republic of Tanzania": "TZA",
    "United States of America": "USA",
    "China, Taiwan Province of": "TWN",
    "China, Hong Kong SAR": "HKG",
    "China, Macao SAR": "MAC",
    "China, mainland": "CHN",
    "Czechoslovakia": "CSK",
    "Democratic Republic of the Congo": "COD",
    "Ethiopia PDR": "ETH",
    "Micronesia (Federated States of)": "FSM",
    "Netherlands (Kingdom of the)": "NLD",
    "Palestine": "PSE",
    "Sudan (former)": "SDN",
    "USSR": "SUN",
    "Yugoslav SFR": "YUG",
}

def get_iso3(country_name):
    if not country_name: return None
    # 1. Alias check
    if country_name in FAO_ALIASES:
        return FAO_ALIASES[country_name]
    # 2. Check if already alpha-3
    try:
        if len(country_name) == 3:
            res = pycountry.countries.get(alpha_3=country_name.upper())
            if res: return res.alpha_3
    except: pass
    # 3. Standard lookup
    try:
        return pycountry.countries.lookup(country_name).alpha_3
    except LookupError:
        try:
            return pycountry.historic_countries.lookup(country_name).alpha_3
        except LookupError:
            return None

def audit_v2():
    raw_file = "my_fao_data.csv"
    cleaned_file = "python-backend/data/cleaned_crop_data.csv"
    
    results = {}

    print("Audit V2 Started...")

    # Stage 1: Raw
    raw_tuples = set()
    try:
        with open(raw_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_tuples.add((row["Area"], row["Item"]))
        results['stage1_raw'] = len(raw_tuples)
    except Exception as e:
        print(f"Error Stage 1: {e}")

    # Stage 2: Cleaned
    cleaned_tuples = set()
    cleaned_list = []
    try:
        with open(cleaned_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cleaned_tuples.add((row["Country"], row["Crop"]))
                cleaned_list.append(row)
        results['stage2_cleaned'] = len(cleaned_tuples)
    except Exception as e:
        print(f"Error Stage 2: {e}")

    # Stage 3: ISO Normalized
    iso_tuples = set()
    iso_mapped_countries = {}
    for row in cleaned_list:
        iso = get_iso3(row["Country"])
        if iso:
            iso_tuples.add((iso, row["Crop"]))
            iso_mapped_countries[row["Country"]] = iso
    results['stage3_iso_tuples'] = len(iso_tuples)
    results['stage3_unique_isos'] = len(set(iso_mapped_countries.values()))

    # Stage 4: Model Eligible (n>=5)
    counts = {}
    for row in cleaned_list:
        key = (row["Country"], row["Crop"])
        counts[key] = counts.get(key, 0) + 1
    
    eligible_tuples = set()
    for key, count in counts.items():
        if count >= 5:
            eligible_tuples.add(key)
    results['stage4_eligible_tuples'] = len(eligible_tuples)

    # Stage 5: De-duplicated by ISO (for rendering)
    unique_iso_crop_pairs = set()
    for country, crop in eligible_tuples:
        iso = iso_mapped_countries.get(country)
        if iso:
            unique_iso_crop_pairs.add((iso, crop))
    results['stage5_rendered_tuples'] = len(unique_iso_crop_pairs)

    # Output to file
    with open("audit_results_v2.txt", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=4)
    print("Audit V2 Results saved to audit_results_v2.txt")

if __name__ == "__main__":
    audit_v2()
