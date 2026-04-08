import React, { useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';

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
  const currentYearRef = useRef(currentYear);
  useEffect(() => {
    currentYearRef.current = currentYear;
  }, [currentYear]);

  // Auto-play logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !disabled) {
      interval = setInterval(() => {
        if (currentYearRef.current < maxYear) {
          onChange(currentYearRef.current + 1);
        } else {
          // Pause or loop when reaching the end
          onPlayToggle(); 
        }
      }, 300); // Advanced time every 300ms
    }
    return () => clearInterval(interval);
  }, [isPlaying, maxYear, onChange, onPlayToggle, disabled]);

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
          <motion.button 
            onClick={onPlayToggle}
            whileHover={{ scale: 1.1, boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)" }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 ml-1 fill-current" />
            )}
          </motion.button>
          
          <input 
            type="range" 
            min={minYear} 
            max={maxYear} 
            value={currentYear} 
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="flex-grow h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-emerald-500 premium-slider"
          />
        </div>
      </div>
    </div>
  );
}
