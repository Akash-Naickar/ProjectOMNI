"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Map, { Source, Layer, Popup } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSON as GeoJSONType } from "geojson";
import { fetchResilienceScores, type ResilienceScore, type PredictionResult, fetchPrediction, type TimeseriesData } from "../api";
import { Globe, Map as MapIcon } from "lucide-react";

function scoreToColor(score: number): string {
  if (score >= 8) return "#10b981";     // emerald-500
  if (score >= 6) return "#22d3ee";     // cyan-400
  if (score >= 4) return "#fbbf24";     // amber-400
  return "#ef4444";                      // red-500
}

function scoreToFill(score: number): string {
  if (score >= 8) return "rgba(16, 185, 129, 0.35)";
  if (score >= 6) return "rgba(34, 211, 238, 0.3)";
  if (score >= 4) return "rgba(251, 191, 36, 0.3)";
  return "rgba(239, 68, 68, 0.3)";
}

// Map GeoJSON names to Backend API (FAO) names
const COUNTRY_MAPPING: Record<string, string> = {
  // GeoJSON Name -> FAO Name
  "Iran": "Iran (Islamic Republic of)",
  "Russia": "Russian Federation",
  "United Kingdom": "United Kingdom of Great Britain and Northern Ireland",
  "Turkey": "Türkiye",
  "Vietnam": "Viet Nam",
  "South Korea": "Republic of Korea",
  "North Korea": "Democratic People's Republic of Korea",
  "Syria": "Syrian Arab Republic",
  "Venezuela": "Venezuela (Bolivarian Republic of)",
  "Bolivia": "Bolivia (Plurinational State of)",
  "Laos": "Lao People's Democratic Republic",
  "Moldova": "Republic of Moldova",
  "Brunei": "Brunei Darussalam",
  "Ivory Coast": "Côte d'Ivoire",
  "Czech Republic": "Czechoslovakia",
  "Czechia": "Czechoslovakia",
  "Taiwan": "China, Taiwan Province of",
  "Netherlands": "Netherlands (Kingdom of the)",
  "Republic of the Congo": "Congo",
  "Democratic Republic of the Congo": "Congo",
  "Republic of Serbia": "Serbia",
  "East Timor": "Timor-Leste",
  "eSwatini": "Eswatini",
  "Hong Kong S.A.R.": "China, Hong Kong SAR",
  "Macao S.A.R": "China, Macao SAR",
  "The Bahamas": "Bahamas",
  "São Tomé and Principe": "Sao Tome and Principe",
  "Federated States of Micronesia": "Micronesia (Federated States of)",
  "Sudan": "Sudan (former)",
  "South Sudan": "Sudan (former)",
  "United Republic of Tanzania": "United Republic of Tanzania",
  "Ethiopia": "Ethiopia PDR",
  "Tanzania": "United Republic of Tanzania",
  "United States of America": "United States of America",
  "Philippines": "Philippines",
  "Egypt": "Egypt"
};

interface GlobeViewProps {
  onPrediction?: (result: PredictionResult) => void;
  showSatellite?: boolean;
  selectedCrop?: string;
  currentYear?: number;
  timeseriesData?: TimeseriesData | null;
}

export default function GlobeView({ onPrediction, showSatellite = false, selectedCrop, currentYear, timeseriesData }: GlobeViewProps) {
  const mapRef = useRef<MapRef>(null);

  const [scores, setScores] = useState<ResilienceScore[]>([]);
  const [worldGeoJson, setWorldGeoJson] = useState<GeoJSONType | null>(null);
  
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredCountryId, setHoveredCountryId] = useState<string | number | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null); // [Lat, Lng]
  const [isGlobe, setIsGlobe] = useState(true);

  useEffect(() => {
    // If we have a selected crop, fetch specifically for it to ensure all countries show up
    // even if they aren't in the global "top" list.
    fetchResilienceScores(1000, selectedCrop)
      .then(setScores)
      .catch(() => {});
  }, [selectedCrop]);

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson")
      .then(res => res.json())
      .then(data => setWorldGeoJson(data))
      .catch(console.error);
  }, []);

  const scoreMap = useMemo(() => {
    const m: Record<string, ResilienceScore> = {};
    scores.forEach((s) => {
      // If a selectedCrop is provided, only keep scores for that crop
      if (selectedCrop && s.crop !== selectedCrop) {
        return;
      }
      // Keep best resilience score per country (or exact match if filtered by crop)
      if (!m[s.country] || s.resilience_score > m[s.country].resilience_score) {
        m[s.country] = s;
      }
    });
    return m;
  }, [scores, selectedCrop]);

  // --- 🌟 MapLibre Performance Optimization 🌟 ---
  // STATIC base geography (runs ONCE when world geojson loads)
  const baseGeoData = useMemo(() => {
    if (!worldGeoJson) return null;
    let featureIdCounter = 1;

    const features = (worldGeoJson as any).features.map((f: any) => {
      const props = f.properties || {};
      const geoName = props.ADMIN || props.name || "";
      const isoA3 = props.ISO_A3 || props.ADM0_A3 || "";
      
      let faoName = COUNTRY_MAPPING[geoName];
      if (!faoName && isoA3) {
        const isoMapping: Record<string, string> = {
          "USA": "United States of America", "TZA": "United Republic of Tanzania",
          "COD": "Congo", "COG": "Congo", "KOR": "Republic of Korea",
          "PRK": "Democratic People's Republic of Korea", "VNM": "Viet Nam",
          "LAO": "Lao People's Democratic Republic", "SYR": "Syrian Arab Republic",
          "IRN": "Iran (Islamic Republic)", "RUS": "Russian Federation",
          "GBR": "United Kingdom of Great Britain and Northern Ireland", "TUR": "Türkiye",
          "VEN": "Venezuela (Bolivarian Republic of)", "BOL": "Bolivia (Plurinational State of)",
          "MDA": "Republic of Moldova", "CIV": "Côte d'Ivoire", "PHL": "Philippines",
          "EGY": "Egypt", "BRA": "Brazil", "IND": "India", "CHN": "China",
        };
        faoName = isoMapping[isoA3];
      }
      if (!faoName) faoName = geoName;

      // Ensure every feature has a unique numeric ID for feature-state targeting
      const numericId = featureIdCounter++;
      
      return {
        ...f,
        id: numericId, // CRITICAL: Maplibre requires a top-level numeric ID for feature-state
        properties: {
          ...f.properties,
          mappedName: faoName
        }
      };
    });
    return { ...worldGeoJson, features };
  }, [worldGeoJson]);

  // Hook to push highly efficient data updates directly to WebGL Engine, bypassing React JSX Re-renders
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !baseGeoData) return;

    // We must wait for the source to actually exist in MapLibre's internal state
    if (!map.getSource('countries')) return;

    baseGeoData.features.forEach((feature: any) => {
      const faoName = feature.properties.mappedName;
      const scoreInfo = scoreMap[faoName];

      let fillColor = scoreInfo ? scoreToFill(scoreInfo.resilience_score) : "rgba(100, 116, 139, 0.1)";
      let strokeColor = scoreInfo ? scoreToColor(scoreInfo.resilience_score) : "#475569";
      let displayYield = scoreInfo?.avg_yield || 0;
      let isHistorical = false;

      if (currentYear && timeseriesData && Object.keys(timeseriesData).length > 0) {
        const countryTData = timeseriesData[faoName];
        if (countryTData && countryTData[currentYear.toString()] !== undefined) {
          const yieldVal = countryTData[currentYear.toString()];
          displayYield = yieldVal;
          isHistorical = true;
          
          const values = Object.values(countryTData) as number[];
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const percentDiff = mean > 0 ? ((yieldVal - mean) / mean) * 100 : 0;
          
          if (percentDiff > 10) {
            fillColor = "rgba(16, 185, 129, 0.6)"; 
            strokeColor = "#10b981";
          } else if (percentDiff < -30) {
            fillColor = "rgba(239, 68, 68, 0.6)"; 
            strokeColor = "#ef4444";
          } else if (percentDiff < -10) {
            fillColor = "rgba(245, 158, 11, 0.6)"; 
            strokeColor = "#f59e0b";
          } else {
            fillColor = "rgba(148, 163, 184, 0.4)"; 
            strokeColor = "#94a3b8";
          }
        } else {
          fillColor = "rgba(100, 116, 139, 0.1)";
          strokeColor = "#475569";
        }
      }

      // Directly push state down to the WebGL GPU layer
      map.setFeatureState(
        { source: 'countries', id: feature.id },
        {
          fillColor,
          strokeColor,
          hasData: !!scoreInfo,
          hover: hoveredCountryId === feature.id
        }
      );
    });
  }, [baseGeoData, scoreMap, currentYear, timeseriesData, hoveredCountryId, isGlobe]);

  const handleCountryClick = useCallback(async (countryName: string, latlng: [number, number]) => {
    const crop = scoreMap[countryName]?.crop;
    if (!crop) return;
    
    setSelectedCountry(countryName);
    setFlyTarget(latlng);
    setLoading(true);
    setPrediction(null);

    // Make maplibre fly there
    mapRef.current?.flyTo({ center: { lng: latlng[1], lat: latlng[0] }, zoom: 4, duration: 1500 });

    try {
      const result = await fetchPrediction(
        countryName,
        crop,
        2030,
        1.5
      );
      setPrediction(result);
      if (onPrediction) onPrediction(result);
    } catch (e) {
      console.error("Prediction failed:", e);
    } finally {
      setLoading(false);
    }
  }, [scoreMap, onPrediction]);

  const onClick = useCallback((event: any) => {
    const feature = event.features && event.features[0];
    if (feature && feature.properties.hasData) {
      handleCountryClick(feature.properties.mappedName, [event.lngLat.lat, event.lngLat.lng]);
    }
  }, [handleCountryClick]);

  const onHover = useCallback((event: any) => {
    const feature = event.features && event.features[0];
    if (feature && feature.properties.hasData) {
      setHoveredCountryId(feature.id);
      event.target.getCanvas().style.cursor = 'pointer';
    } else {
      setHoveredCountryId(null);
      event.target.getCanvas().style.cursor = '';
    }
  }, []);

  const onMouseLeave = useCallback((event: any) => {
    setHoveredCountryId(null);
    event.target.getCanvas().style.cursor = '';
  }, []);

  const onMapLoad = useCallback((event: any) => {
    const map = event.target;
    if (map.setProjection) {
      try {
        map.setProjection({ type: isGlobe ? 'globe' : 'mercator' });
      } catch (err) {
        console.warn('MapLibre: Globe projection not supported in this version.', err);
      }
    }
    
    // Slight delay to ensure source is bound and feature-state can be applied immediately on load
    setTimeout(() => {
      setHoveredCountryId((prev) => prev ? prev : null); 
    }, 150);
  }, [isGlobe]);

  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      if (map && map.setProjection) {
        try {
          map.setProjection({ type: isGlobe ? 'globe' : 'mercator' });
          // Changing projection destroys the WebGL feature-state context
          // We must instruct the feature-state effect to re-run after the projection settles
          setTimeout(() => {
            setHoveredCountryId((prev) => prev ? prev : null);
          }, 150);
        } catch (e) {
          console.warn('MapLibre: Projection change not supported.', e);
        }
      }
    }
  }, [isGlobe]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <Map
        ref={mapRef}
        // @ts-expect-error - preserveDrawingBuffer is required for html2canvas PDF export of the WebGL context
        preserveDrawingBuffer={true}
        initialViewState={{
          longitude: 20,
          latitude: 20,
          zoom: 2
        }}
        mapStyle="https://tiles.openfreemap.org/styles/dark"
        interactiveLayerIds={['country-fills']}
        onClick={onClick}
        onMouseMove={onHover}
        onMouseLeave={onMouseLeave}
        onLoad={onMapLoad}
        style={{ width: "100%", height: "100%", background: "#0f172a" }}
      >
        {/* NASA GIBS True Color Layer (Blue Marble Next Generation) */}
        {showSatellite && (
          <Source
            id="satellite-source"
            type="raster"
            tiles={["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg"]}
            tileSize={256}
            maxzoom={8}
            attribution='Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (ESDIS) with funding provided by NASA/HQ.'
          >
            <Layer
              id="satellite-layer"
              type="raster"
              paint={{ 'raster-opacity': 0.8 }}
            />
          </Source>
        )}

        {baseGeoData && (
          <Source id="countries" type="geojson" data={baseGeoData}>
            <Layer
              id="country-fills"
              type="fill"
              paint={{
                'fill-color': ['coalesce', ['feature-state', 'fillColor'], 'rgba(100, 116, 139, 0.1)'],
                'fill-opacity': showSatellite ? 0.2 : 0.5
              }}
            />
            <Layer
              id="country-borders"
              type="line"
              paint={{
                'line-color': ['coalesce', ['feature-state', 'strokeColor'], '#475569'],
                'line-width': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false], 3,
                  ['boolean', ['feature-state', 'hasData'], false], 2,
                  1
                ]
              }}
            />
          </Source>
        )}

        {/* Show popup for selected country */}
        {selectedCountry && flyTarget && scoreMap[selectedCountry] && (
          <Popup
            longitude={flyTarget[1]}
            latitude={flyTarget[0]}
            closeButton={false}
            closeOnClick={false}
            onClose={() => setSelectedCountry(null)}
            anchor="bottom"
            className="z-50"
            style={{ zIndex: 50 }}
          >
            <div className="min-w-[200px] p-2 bg-white rounded-lg">
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-base font-bold text-slate-800">{selectedCountry}</h3>
                <button onClick={() => setSelectedCountry(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">×</button>
              </div>

              {/* Dynamic Metric Display based on Timeline vs Overall */}
              {currentYear && timeseriesData && timeseriesData[selectedCountry] && timeseriesData[selectedCountry][currentYear.toString()] !== undefined ? (
                <div className="mb-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">{currentYear} Yield Output</p>
                  <p className="text-xl font-bold text-slate-800">
                    {timeseriesData[selectedCountry][currentYear.toString()].toFixed(2)} <span className="text-xs font-medium text-slate-500">t/ha</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Historical Mean: {(Object.values(timeseriesData[selectedCountry]).reduce((a, b) => a + b, 0) / Object.values(timeseriesData[selectedCountry]).length).toFixed(2)} t/ha
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: scoreToColor(scoreMap[selectedCountry].resilience_score) }}
                  >
                    {scoreMap[selectedCountry].resilience_score}/10
                  </span>
                  <span className="text-xs text-slate-500">
                    {scoreMap[selectedCountry].crop} • {scoreMap[selectedCountry].trend}
                  </span>
                </div>
              )}
              
              {loading && <p className="text-xs text-slate-400 animate-pulse">Running prediction...</p>}
              {prediction && !loading && (
                <div className="text-xs space-y-1 border-t pt-2 mt-1 border-slate-200">
                  <p className="font-medium text-slate-700">
                    2030 Forecast (+1.5°C):
                  </p>
                  <p className="text-lg font-bold text-emerald-600">
                    {prediction.predicted_yield_tonnes_ha} t/ha
                  </p>
                  <p className="text-slate-400">
                    CI: [{prediction.confidence_low} — {prediction.confidence_high}]
                  </p>
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Projection Toggle UI */}
      <div className="absolute top-4 left-4 z-[1000] flex bg-slate-800/80 backdrop-blur-md rounded-xl p-1 border border-slate-700/50 shadow-lg pointer-events-auto">
        <button
          onClick={() => setIsGlobe(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isGlobe ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          Globe
        </button>
        <button
          onClick={() => setIsGlobe(false)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !isGlobe ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          Map
        </button>
      </div>

      {/* Floating Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-white/80 backdrop-blur-md border border-white/40 rounded-xl px-4 py-3 shadow-lg pointer-events-none mb-16 md:mb-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          {currentYear ? "Yield vs Historical Mean" : "Resilience Score"}
        </p>
        <div className="flex flex-col gap-1.5">
          {currentYear ? [
            { label: "> +10% (Boom)", color: "#10b981" },
            { label: "Average Tracking", color: "#94a3b8" },
            { label: "< -10% (Stress)", color: "#f59e0b" },
            { label: "< -30% (Shock)", color: "#ef4444" },
            { label: "No Data", color: "#475569" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 font-medium">{item.label}</span>
            </div>
          )) : [
            { label: "8-10 Strong", color: "#10b981" },
            { label: "6-8 Moderate", color: "#22d3ee" },
            { label: "4-6 At Risk", color: "#fbbf24" },
            { label: "1-4 Critical", color: "#ef4444" },
            { label: "No Data", color: "#64748b" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
