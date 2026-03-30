"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Map, { Source, Layer, Popup } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSON as GeoJSONType } from "geojson";
import { fetchResilienceScores, type ResilienceScore, type PredictionResult, fetchPrediction, type TimeseriesData } from "../api";
import { Globe, Map as MapIcon, Activity } from "lucide-react";

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

// Standardised isoA3 lookups replace COUNTRY_MAPPING

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
      if (!s.iso_a3) return; // Need an ISO code to map
      if (selectedCrop && s.crop !== selectedCrop) return;
      
      // Keep best resilience score per country (or exact match if filtered by crop)
      if (!m[s.iso_a3] || s.resilience_score > m[s.iso_a3].resilience_score) {
        m[s.iso_a3] = s;
      }
    });
    return m;
  }, [scores, selectedCrop]);

  // --- 🌟 MapLibre Performance Optimization 🌟 ---
  
  // Create an index of FAO Names -> ISO Codes to allow timeseries joins even without scores
  const nameToIsoMap = useMemo(() => {
    const m: Record<string, string> = {};
    // Extract from scores first
    scores.forEach(s => { if (s.iso_a3) m[s.country] = s.iso_a3; });
    // Supplement from common registry known codes if possible
    return m;
  }, [scores]);

  // STATIC base geography (runs ONCE when world geojson loads)
  const baseGeoData = useMemo(() => {
    if (!worldGeoJson) return null;
    let featureIdCounter = 1;

    const features = (worldGeoJson as any).features.map((f: any) => {
      const props = f.properties || {};
      const geoName = props.ADMIN || props.name || "";
      
      // EXHAUSTIVE ISO SEARCH (per Implementation Plan)
      let isoA3 = props["ISO3166-1-Alpha-3"] || props.ISO_A3 || props.ADM0_A3 || props.gu_a3 || "";
      
      // Fallback for missing ISOs in natural earth dataset
      if (isoA3 === "-99" || !isoA3) {
          if (geoName === "France") isoA3 = "FRA";
          else if (geoName === "Norway") isoA3 = "NOR";
          else if (geoName === "Somaliland") isoA3 = "SOM";
          else if (geoName === "Kosovo") isoA3 = "XKX";
      }

      // Ensure every feature has a unique numeric ID for feature-state targeting
      const numericId = featureIdCounter++;
      
      return {
        ...f,
        id: numericId,
        properties: {
          ...f.properties,
          mappedName: geoName,
          isoA3: isoA3 === "-99" ? "" : isoA3
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
      const isoA3 = feature.properties.isoA3;
      const scoreInfo = isoA3 ? scoreMap[isoA3] : undefined;
      
      // DECOUPLED JOIN: Try to find FAO name for timeseries even if score is missing
      let faoName = scoreInfo?.country;
      if (!faoName && isoA3) {
         // Search reverse map
         faoName = Object.keys(nameToIsoMap).find(k => nameToIsoMap[k] === isoA3);
      }

      let fillColor = "rgba(100, 116, 139, 0.1)"; // Default: No Data
      let strokeColor = "#475569";
      let displayYield = 0;
      let isHistorical = false;

      // Path A: Score-based coloring (if no year selected or default view)
      if (scoreInfo) {
          fillColor = scoreToFill(scoreInfo.resilience_score);
          strokeColor = scoreToColor(scoreInfo.resilience_score);
          displayYield = scoreInfo.avg_yield;
      }

      // Path B: Temporal overlay (if year selected)
      if (faoName && currentYear && timeseriesData && Object.keys(timeseriesData).length > 0) {
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

  const handleCountryClick = useCallback(async (isoA3: string, latlng: [number, number]) => {
    const scoreInfo = scoreMap[isoA3];
    if (!scoreInfo) return;
    
    const crop = scoreInfo.crop;
    const countryName = scoreInfo.country; // Output from backend, correctly matching timeseries etc.
    
    setSelectedCountry(isoA3); // Storing isoA3 instead of just countryName helps linking popup
    setFlyTarget(latlng);
    setLoading(true);
    setPrediction(null);

    // Make maplibre fly there
    mapRef.current?.flyTo({ center: { lng: latlng[1], lat: latlng[0] }, zoom: 4, duration: 1500 });

    try {
      const result = await fetchPrediction(
        countryName, // Send FAO name back to API
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
    if (feature && feature.properties.hasData && feature.properties.isoA3) {
      handleCountryClick(feature.properties.isoA3, [event.lngLat.lat, event.lngLat.lng]);
    }
  }, [handleCountryClick]);

  const stats = useMemo(() => {
    const geoCount = baseGeoData?.features.length || 0;
    const apiCount = scores.length;
    const mappedCount = Object.keys(scoreMap).length;
    return { geoCount, apiCount, mappedCount };
  }, [baseGeoData, scores, scoreMap]);

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
      {/* Debug Overlay */}
      <div className="absolute top-4 left-4 z-[2000] bg-slate-900/80 backdrop-blur-md p-3 rounded-lg border border-slate-700 text-[10px] text-slate-300 font-mono pointer-events-none">
        <div className="flex items-center gap-2 mb-1 pb-1 border-b border-white/10 text-white font-bold text-[8px]">
           <Activity className="w-3 h-3 text-emerald-400" /> DATA CONTRACT ACTIVE
        </div>
        <div>GEO FEATURES: {stats.geoCount}</div>
        <div>API ROWS: {stats.apiCount}</div>
        <div>JOINED ISO: {stats.mappedCount}</div>
      </div>
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
        {selectedCountry && flyTarget && scoreMap[selectedCountry] && (() => {
          const scoreInfo = scoreMap[selectedCountry];
          const faoName = scoreInfo.country;
          const displayYearYield = (currentYear && timeseriesData && timeseriesData[faoName] && timeseriesData[faoName][currentYear.toString()] !== undefined) 
            ? timeseriesData[faoName][currentYear.toString()] 
            : undefined;
          
          return (
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
                  <h3 className="text-base font-bold text-slate-800">{faoName}</h3>
                  <button onClick={() => setSelectedCountry(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">×</button>
                </div>

                {/* Dynamic Metric Display based on Timeline vs Overall */}
                {displayYearYield !== undefined && timeseriesData ? (
                  <div className="mb-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">{currentYear} Yield Output</p>
                    <p className="text-xl font-bold text-slate-800">
                      {displayYearYield.toFixed(2)} <span className="text-xs font-medium text-slate-500">t/ha</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Historical Mean: {(Object.values(timeseriesData[faoName]).reduce((a, b) => a + b, 0) / Object.values(timeseriesData[faoName]).length).toFixed(2)} t/ha
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                        style={{ backgroundColor: scoreToColor(scoreInfo.resilience_score) }}
                      >
                        r = {scoreInfo.correlation.toFixed(3)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                        {scoreInfo.crop}
                      </span>
                    </div>
                    <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border inline-block w-fit ${scoreInfo.trend === 'increasing' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : scoreInfo.trend === 'decreasing' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                      Trend: {scoreInfo.trend}
                    </div>
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
          );
        })()}
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
          {currentYear ? "Yield vs Historical Mean" : "Pearson Correlation ($r$)"}
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
          { label: "r > 0.5 (Strong)", color: "#10b981" },
          { label: "r > 0.1 (Moderate)", color: "#22d3ee" },
          { label: "r > -0.3 (Baseline)", color: "#fbbf24" },
          { label: "r < -0.3 (Inverse)", color: "#ef4444" },
          { label: "No Tracking", color: "#64748b" },
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
