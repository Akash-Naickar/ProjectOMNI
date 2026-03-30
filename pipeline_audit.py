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
    if country_name in FAO_ALIASES:
        return FAO_ALIASES[country_name]
    try:
        return pycountry.countries.lookup(country_name).alpha_3
    except LookupError:
        return None

def audit():
    raw_file = "my_fao_data.csv"
    cleaned_file = "python-backend/data/cleaned_crop_data.csv"
    
    raw_tuples = set()
    try:
        with open(raw_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_tuples.add((row["Area"], row["Item"]))
    except Exception as e:
        print(f"Error reading raw: {e}")

    cleaned_tuples = set()
    cleaned_countries = set()
    try:
        with open(cleaned_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cleaned_tuples.add((row["Country"], row["Crop"]))
                cleaned_countries.add(row["Country"])
    except Exception as e:
        print(f"Error reading cleaned: {e}")

    unmapped = []
    mapped_count = 0
    for c in cleaned_countries:
        iso = get_iso3(c)
        if iso:
            mapped_count += 1
        else:
            unmapped.append(c)
    
    groups = {}
    eligible_count = 0
    try:
        with open(cleaned_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = (row["Country"], row["Crop"])
                if key not in groups:
                    groups[key] = 0
                groups[key] += 1
        
        for key, count in groups.items():
            if count >= 5:
                eligible_count += 1
    except Exception as e:
        print(f"Error checking eligibility: {e}")

    # Output results to a file for stable viewing
    with open("audit_results_final.txt", "w", encoding="utf-8") as out:
        def log(msg):
            print(msg)
            out.write(msg + "\n")

        log("--- Stage 1: Raw FAO Ingestion ---")
        log(f"Total Unique (Area, Item) in Raw: {len(raw_tuples)}")

        log("\n--- Stage 2: Post-Cleaning (Haskell) ---")
        log(f"Total Unique (Country, Crop) in Cleaned: {len(cleaned_tuples)}")
        log(f"Total Unique Countries: {len(cleaned_countries)}")

        log("\n--- Stage 3: Normalization & ISO Coverage ---")
        log(f"Countries Mapped to ISO3: {mapped_count}/{len(cleaned_countries)}")
        if unmapped:
            log(f"First 10 Unmapped: {unmapped[:10]}")

        log("\n--- Stage 4: Model Training Eligibility (min_rows=5) ---")
        log(f"Tuples eligible for model training (n>=5): {eligible_count}/{len(cleaned_tuples)}")

        log("\n--- Stage 5: Trace Specific Examples ---")
        examples = [
            ("Afghanistan", "Wheat"),
            ("United States of America", "Wheat"),
            ("Türkiye", "Wheat"),
            ("Africa", "Wheat"), # Region, should fail
        ]
        for country, crop in examples:
            has_raw = (country, crop) in raw_tuples
            has_cleaned = (country, crop) in cleaned_tuples
            iso = get_iso3(country)
            rows = groups.get((country, crop), 0)
            eligible = rows >= 5
            log(f"[{country} | {crop}]: Raw={has_raw}, Cleaned={has_cleaned}, ISO={iso}, Rows={rows}, Eligible={eligible}")

if __name__ == "__main__":
    audit()
