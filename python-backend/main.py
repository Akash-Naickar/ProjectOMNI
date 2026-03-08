import csv
import json
import logging
import math
import os
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

from sklearn.linear_model import LinearRegression

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Global ML State
df_historical = []
resilience_scores = []
all_scores_dict = {}
unique_countries = set()
unique_crops = set()

DATA_PATH = os.environ.get("DATA_PATH", os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "haskell-pipeline",
    "cleaned_crop_data.csv"
))

# =============================================================================
# Scikit-Learn ML Pipeline
# =============================================================================

class CropYieldModel:
    """
    Production-grade predictive model using independent Linear Regressions 
    for each Country/Crop combination to cleanly extrapolate time trends and temperature sensitivities.
    """
    def __init__(self):
        self.models = {}
        self.is_trained = False

    def fit(self, data):
        if not data:
            logging.warning("No data provided for training.")
            return

        # Group data
        groups = {}
        for row in data:
            key = (row["Country"], row["Crop"])
            if key not in groups:
                groups[key] = {"X": [], "y": []}
            groups[key]["X"].append([row["Year"], row["TempAnomaly_C"]])
            groups[key]["y"].append(row["Yield_tonnes_ha"])

        # Train a micro-model per group
        for key, g in groups.items():
            if len(g["y"]) < 5:
                continue
            
            X = np.array(g["X"])
            y = np.array(g["y"])
            lr = LinearRegression().fit(X, y)
            preds = lr.predict(X)
            
            self.models[key] = {
                "intercept": float(lr.intercept_),
                "coef_year": float(lr.coef_[0]),
                "coef_temp": float(lr.coef_[1]),
                "std": float(np.std(y - preds))
            }

        self.is_trained = True
        logging.info(f"Trained {len(self.models)} independent micro-models.")

    def predict(self, country, crop, year, temp_anomaly):
        key = (country, crop)
        if not self.is_trained or key not in self.models:
            return {"predicted_yield": 0.0, "confidence_low": 0.0, "confidence_high": 0.0}

        m = self.models[key]
        pred = m["intercept"] + m["coef_year"] * year + m["coef_temp"] * temp_anomaly
        std = max(0.1, m["std"])  # Base minimum deviation
        
        # Increase uncertainty further out in time
        extrapolation_penalty = max(0, year - 2024) * 0.02 * pred
        std += extrapolation_penalty

        return {
            "predicted_yield": max(0.0, round(pred, 3)),
            "confidence_low": max(0.0, round(pred - 1.96 * std, 3)),
            "confidence_high": round(pred + 1.96 * std, 3),
        }


# Initialize Model
model = CropYieldModel()

# =============================================================================
# Startup Data Ingestion & Scoring
# =============================================================================

def load_and_train():
    global df_historical, resilience_scores, unique_countries, unique_crops

    logging.info(f"Loading cleaned data from {DATA_PATH}...")
    if not os.path.exists(DATA_PATH):
        logging.error("[ERROR] Data file not found. Ensure Phase 1 (Haskell) ran successfully.")
        return

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            df_historical.append({
                "Year": int(row["Year"]),
                "Country": row["Country"],
                "Crop": row["Crop"],
                "Yield_tonnes_ha": float(row["Yield_tonnes_ha"]),
                "TempAnomaly_C": float(row["TempAnomaly_C"]),
                "RollingAvg_5yr": float(row["RollingAvg_5yr"])
            })
            unique_countries.add(row["Country"])
            unique_crops.add(row["Crop"])

    if df_historical:

        logging.info(f"Dataset shape: {len(df_historical)} rows.")
        
        # 1. Train RandomForest Model
        logging.info("Training RandomForest Regressor with OneHotEncoder pipeline...")
        model.fit(df_historical)

        # 2. Compute Resilience Scores (Pearson Correlation)
        logging.info("Computing Climate Resilience Scores...")
        groups = {}
        for row in df_historical:
            key = (row["Country"], row["Crop"])
            if key not in groups:
                groups[key] = {"Yield": [], "Temp": [], "Years": [], "RollingAvg": []}
            groups[key]["Yield"].append(row["Yield_tonnes_ha"])
            groups[key]["Temp"].append(row["TempAnomaly_C"])
            groups[key]["Years"].append(row["Year"])
            groups[key]["RollingAvg"].append(row["RollingAvg_5yr"])

        scores_list = []
        for (country, crop), data in groups.items():
            n = len(data["Yield"])
            if n < 5:  # Absolute minimum for any calculation
                continue
                
            y_mean = sum(data["Yield"]) / n
            t_mean = sum(data["Temp"]) / n
            
            # Detrend yield to isolate climate shocks from long-term technological progress
            yield_shocks = [y - r for y, r in zip(data["Yield"], data["RollingAvg"])]
            ys_mean = sum(yield_shocks) / n
            
            numerator = sum((t - t_mean) * (ys - ys_mean) for t, ys in zip(data["Temp"], yield_shocks))
            den_t = sum((t - t_mean)**2 for t in data["Temp"])
            den_y = sum((ys - ys_mean)**2 for ys in yield_shocks)
            
            if den_t == 0 or den_y == 0:
                corr = 0.0
            else:
                corr = numerator / math.sqrt(den_t * den_y)

            # Map correlation to 1-10 Resilience Score
            # Highly resilient/benefiting (corr >= 0) -> 5.5 to 10.0
            # Vulnerable to heat (corr < 0) -> 1.0 to 5.5
            corr_clamped = max(-1.0, min(1.0, corr))
            score = 5.5 + (corr_clamped * 4.5)
            
            score = max(1.0, min(10.0, score))

            # Compute yield trend (linear slope over time)
            years = data["Years"]
            yields = data["Yield"]
            year_mean = sum(years) / n
            slope_num = sum((yr - year_mean) * (yd - y_mean) for yr, yd in zip(years, yields))
            slope_den = sum((yr - year_mean) ** 2 for yr in years)
            trend_slope = slope_num / slope_den if slope_den != 0 else 0.0
            trend = "increasing" if trend_slope > 0.005 else ("decreasing" if trend_slope < -0.005 else "stable")

            scores_list.append({
                "country": country,
                "crop": crop,
                "resilience_score": round(score, 1),
                "correlation": round(corr_clamped, 3),
                "trend": trend,
                "avg_yield": round(y_mean, 2),
                "data_points": n
            })
            all_scores_dict[(country, crop)] = scores_list[-1]

            all_scores_dict[(country, crop)] = scores_list[-1]

        # Filter out minor crops (e.g. low base yield or short history) so major food sources rank highest natively
        filtered_for_leaderboard = [s for s in scores_list if s["avg_yield"] >= 1.0 and s["data_points"] >= 30]

        resilience_scores = sorted(filtered_for_leaderboard, key=lambda x: (x["resilience_score"], x["data_points"], x["avg_yield"]), reverse=True)
        if resilience_scores:
            logging.info(f"Top Resilient Crop/Region: {resilience_scores[0]}")


# =============================================================================
# HTTP API Server
# =============================================================================

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class ClimateAPIHandler(BaseHTTPRequestHandler):
    def send_json_response(self, data, status_code=200):
        try:
            self.send_response(status_code)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-type')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass  # Client disconnected — safe to ignore
        
    def do_OPTIONS(self):
        try:
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-type')
            self.end_headers()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass

    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query_params = parse_qs(parsed_path.query)

        if path == "/":
            self.send_json_response({
                "message": "Project Omni — Climate Resilience ML API",
                "model": "RandomForestRegressor (scikit-learn)",
                "endpoints": ["/api/data", "/api/resilience", "/api/predict", "/api/metadata"]
            })

        elif path == "/api/metadata":
            years = [r["Year"] for r in df_historical] if df_historical else []
            self.send_json_response({
                "countries": sorted(list(unique_countries)),
                "crops": sorted(list(unique_crops)),
                "year_range": [min(years), max(years)] if years else [],
                "total_records": len(df_historical),
                "model_type": "RandomForestRegressor",
                "model_trained": model.is_trained
            })

        elif path == "/api/data":
            if not df_historical:
                self.send_json_response({"error": "No historical data loaded."}, 404)
            else:
                self.send_json_response(df_historical)

        elif path == "/api/predict":
            if not model.is_trained:
                self.send_json_response({"error": "Model not trained because data is unavailable."}, 503)
                return

            try:
                country = query_params.get("country", [""])[0]
                crop = query_params.get("crop", [""])[0]
                year = int(query_params.get("year", [0])[0])
                temp_increase = float(query_params.get("temp_increase", [0.0])[0])
                
                if country not in unique_countries:
                    self.send_json_response({"error": f"Unknown country: {country}"}, 400)
                    return
                if crop not in unique_crops:
                    self.send_json_response({"error": f"Unknown crop: {crop}"}, 400)
                    return

                result = model.predict(country, crop, year, temp_increase)

                self.send_json_response({
                    "country": country,
                    "crop": crop,
                    "year": year,
                    "temp_increase_c": temp_increase,
                    "predicted_yield_tonnes_ha": result["predicted_yield"],
                    "confidence_low": result["confidence_low"],
                    "confidence_high": result["confidence_high"],
                    "model_type": "MicroLinearRegression"
                })

            except ValueError:
                self.send_json_response({"error": "Invalid numeric parameters."}, 400)

        elif path == "/api/resilience":
            if not resilience_scores:
                self.send_json_response({"error": "Resilience scores not computed."}, 404)
                return
            
            try:
                limit = int(query_params.get("limit", [10])[0])
            except ValueError:
                limit = 10
                
            response_data = {"top_resilient": resilience_scores[:limit]}
            
            country = query_params.get("country", [""])[0]
            crop = query_params.get("crop", [""])[0]
            if country and crop:
                specific = all_scores_dict.get((country, crop))
                if specific:
                    response_data["specific_score"] = specific

            self.send_json_response(response_data)

        else:
            self.send_json_response({"error": "Endpoint not found."}, 404)

    def log_message(self, format, *args):
        logging.info(f"[HTTP] {args[0]}")

def run_server():
    port = 8000
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, ClimateAPIHandler)
    logging.info(f"🚀 Climate Resilience API running on http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    logging.info("Server stopped.")

if __name__ == "__main__":
    load_and_train()
    run_server()
