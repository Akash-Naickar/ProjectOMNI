/**
 * api.ts
 * 
 * Centralised utility for fetching data from the Python ML API Backend.
 * Uses native `fetch` and structured TypeScript interfaces for type safety.
 */

const API_BASE_URL = "http://localhost:8000/api";

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
}

export interface PredictionResult {
  country: string;
  crop: string;
  year: number;
  temp_increase_c: number;
  predicted_yield_tonnes_ha: number;
}

// --- Helper Functions ---

/**
 * Generic fetch wrapper to handle JSON parsing and HTTP error throwing.
 */
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
      // Try to parse the backend error message if available
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

/**
 * Fetches the entire historical cleaned dataset (Phase 1 output).
 */
export async function fetchHistoricalData(): Promise<CropData[]> {
  return apiFetch<CropData[]>("/data");
}

/**
 * Fetches the top climate-resilient crops.
 * @param limit How many top results to return (default 5).
 */
export async function fetchResilienceScores(limit: number = 5): Promise<ResilienceScore[]> {
  const data = await apiFetch<{ top_resilient: ResilienceScore[] }>(`/resilience?limit=${limit}`);
  return data.top_resilient;
}

/**
 * Fetches a yield prediction based on the user's scenario.
 * 
 * @param country         The encoded Country name (e.g., "India")
 * @param crop            The encoded Crop name (e.g., "Wheat")
 * @param year            The future year to predict (e.g., 2030)
 * @param tempIncrease    The projected temperature anomaly in °C (e.g., 1.5)
 */
export async function fetchPrediction(
  country: string,
  crop: string,
  year: number,
  tempIncrease: number
): Promise<PredictionResult> {
  // Use URLSearchParams to safely encode query parameters
  const params = new URLSearchParams({
    country,
    crop,
    year: year.toString(),
    temp_increase: tempIncrease.toString(),
  });

  return apiFetch<PredictionResult>(`/predict?${params.toString()}`);
}
