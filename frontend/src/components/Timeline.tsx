import React, { useEffect, useRef } from 'react';

interface TimelineProps {
  minYear: number;
  maxYear: number;
  currentYear: number;
  onChange: (year: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  disabled?: boolean;
}

export default function Timeline({
  minYear,
  maxYear,
  currentYear,
  onChange,
  isPlaying,
  onPlayToggle,
  disabled = false
}: TimelineProps) {
  // Auto-play logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !disabled) {
      interval = setInterval(() => {
        if (currentYear < maxYear) {
          onChange(currentYear + 1);
        } else {
          // Pause or loop when reaching the end
          onPlayToggle(); 
        }
      }, 300); // Advanced time every 300ms
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentYear, maxYear, onChange, onPlayToggle, disabled]);

  return (
    <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 w-[90%] md:w-[600px] z-50 transition-opacity duration-300 ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-2xl flex flex-col gap-2">
        
        <div className="flex items-center justify-between text-slate-300 text-sm font-semibold mb-1">
          <span>{minYear}</span>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            {currentYear}
          </span>
          <span>{maxYear}</span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onPlayToggle}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              // Pause Icon
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              // Play Icon
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          <input 
            type="range" 
            min={minYear} 
            max={maxYear} 
            value={currentYear} 
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}
