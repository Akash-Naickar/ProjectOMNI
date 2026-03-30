import csv
import pycountry

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
}

def check():
    unique_countries = set()
    try:
        with open("data/cleaned_crop_data.csv", "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                unique_countries.add(row["Country"])
    except FileNotFoundError:
        print("Data file not found")
        return

    failed = []
    for c in unique_countries:
        iso = FAO_ALIASES.get(c)
        if not iso:
            try:
                res = pycountry.countries.lookup(c)
                iso = res.alpha_3
            except LookupError:
                try:
                    res = pycountry.historic_countries.lookup(c)
                    iso = res.alpha_3
                except LookupError:
                    failed.append(c)
    
    with open("failed_match.txt", "w") as f:
        f.write(f"Failed to match {len(failed)} countries:\n")
        for c in sorted(failed):
            f.write(f'    "{c}": "",\n')

if __name__ == "__main__":
    check()
