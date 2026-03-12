/**
 * api.ts
 * 
 * Centralised utility for fetching data from the Python ML API Backend.
 * Uses native `fetch` and structured TypeScript interfaces for type safety.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// --- Types ---

export interface CropData {
  Year: number;
  Country: string;
  Crop: string;
  Yield_tonnes_ha: number;
  TempAnomaly_C: number;
  RollingAvg_5yr: number;
}

export interface ResilienceScore {
  country: string;
  crop: string;
  resilience_score: number;
  correlation: number;
  trend: string;
  avg_yield: number;
  data_points: number;
}

export interface PredictionResult {
  country: string;
  crop: string;
  year: number;
  temp_increase_c: number;
  predicted_yield_tonnes_ha: number;
  confidence_low: number;
  confidence_high: number;
  model_type: string;
  weights?: Record<string, number>;
}

export interface MarketSimulationResult {
  Adaptation_Strategy: string;
  Market_Disruption_Level: string;
  Economic_Impact: string;
}

export interface MetadataResponse {
  countries: string[];
  crops: string[];
  year_range: [number, number];
  total_records: number;
  available_models: string[];
  model_trained: boolean;
}

// --- Helper Functions ---

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.detail || errorMessage;
      } catch (e) {
        // Ignore JSON parse errors on non-200 responses
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}

// --- API Methods ---

export async function fetchHistoricalData(): Promise<CropData[]> {
  return apiFetch<CropData[]>("/data");
}

export async function fetchResilienceScores(limit: number = 10, crop?: string): Promise<ResilienceScore[]> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (crop) params.append("crop", crop);
  const data = await apiFetch<{ top_resilient: ResilienceScore[] }>(`/resilience?${params.toString()}`);
  return data.top_resilient;
}

export async function fetchSpecificScore(country: string, crop: string): Promise<ResilienceScore | null> {
  const data = await apiFetch<{ specific_score?: ResilienceScore }>(
    `/resilience?country=${encodeURIComponent(country)}&crop=${encodeURIComponent(crop)}&limit=0`
  );
  return data.specific_score || null;
}

export type TimeseriesData = Record<string, Record<string, number>>;

export async function fetchTimeseriesMap(crop: string): Promise<TimeseriesData> {
  if (!crop) return {};
  const data = await apiFetch<{ yields: TimeseriesData }>(`/timeseries-map?crop=${encodeURIComponent(crop)}`);
  return data.yields;
}

export async function fetchMetadata(): Promise<MetadataResponse> {
  return apiFetch<MetadataResponse>("/metadata");
}

export async function fetchPrediction(
  country: string,
  crop: string,
  year: number,
  tempIncrease: number,
  modelType: string = "ols"
): Promise<PredictionResult> {
  const params = new URLSearchParams({
    country,
    crop,
    year: year.toString(),
    temp_increase: tempIncrease.toString(),
    model_type: modelType,
  });

  return apiFetch<PredictionResult>(`/predict?${params.toString()}`);
}

export async function fetchComparativePredictions(
  country: string,
  crop: string,
  year: number,
  tempIncrease: number,
  models: string[]
): Promise<Record<string, PredictionResult>> {
  const results: Record<string, PredictionResult> = {};
  await Promise.all(models.map(async (modelType) => {
    try {
      results[modelType] = await fetchPrediction(country, crop, year, tempIncrease, modelType);
    } catch (e) {
      console.error(`Failed to fetch prediction for model ${modelType}`, e);
    }
  }));
  return results;
}

export async function fetchMarketSimulation(
  country: string,
  crop: string,
  temperatureAnomaly: number,
  predictions: Record<string, PredictionResult>
): Promise<MarketSimulationResult> {
  const payload = {
    country,
    crop,
    temperature_anomaly: temperatureAnomaly,
    predictions
  };

  return apiFetch<MarketSimulationResult>("/simulate_market", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
