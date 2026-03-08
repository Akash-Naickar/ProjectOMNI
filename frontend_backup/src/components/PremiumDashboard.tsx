"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Sprout, ThermometerSun, ShieldCheck, ChevronDown, MapPin } from "lucide-react";

// --- Placeholder Data ---
const mockTimeSeriesData = [
  { year: 2000, yield: 2.71, tempAnomaly: 0.24 },
  { year: 2005, yield: 2.92, tempAnomaly: 0.47 },
  { year: 2010, yield: 3.14, tempAnomaly: 0.63 },
  { year: 2015, yield: 3.3, tempAnomaly: 0.76 },
  { year: 2020, yield: 3.45, tempAnomaly: 1.02 },
  { year: 2025, yield: 3.7, tempAnomaly: 1.25 },
  { year: 2030, yield: 3.9, tempAnomaly: 1.5 },
];

const mockRegionalData = [
  { region: "India", score: 9.8, yieldProjected: 4.2 },
  { region: "USA", score: 8.5, yieldProjected: 11.4 },
  { region: "Brazil", score: 7.2, yieldProjected: 3.5 },
  { region: "China", score: 6.9, yieldProjected: 6.8 },
  { region: "Nigeria", score: 4.1, yieldProjected: 1.9 },
];

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

// --- Custom Tooltip for Recharts ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-xl rounded-xl p-4 text-slate-800">
        <p className="font-semibold text-lg mb-2">Year: {label}</p>
        <div className="flex flex-col gap-1">
          <p className="text-emerald-600 font-medium">
            Projected Yield: <span className="font-bold">{payload[0].value} t/ha</span>
          </p>
          <p className="text-amber-500 font-medium">
            Temp Anomaly: <span className="font-bold">+{payload[1].value}°C</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// --- Main Component ---
export default function PremiumDashboard() {
  const [selectedCrop, setSelectedCrop] = useState("Wheat");
  const [selectedRegion, setSelectedRegion] = useState("Global");

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans text-slate-900 selection:bg-emerald-200">
      
      {/* Background Ambient Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-300/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[50%] bg-cyan-300/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Floating Pill Navigation */}
      <motion.nav
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-8 py-3 bg-white/70 backdrop-blur-xl border border-white/40 shadow-lg rounded-full"
      >
        <div className="flex items-center gap-2 font-bold tracking-tight text-lg mr-4">
          <Sprout className="w-6 h-6 text-emerald-500" />
          <span>Project Omni</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-100/50 cursor-pointer transition-colors">
            <MapPin className="w-4 h-4" />
            <span>{selectedRegion}</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-100/50 cursor-pointer transition-colors">
            <Sprout className="w-4 h-4" />
            <span>{selectedCrop}</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </div>
        </div>
      </motion.nav>

      {/* Main Content Grid */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-7xl mx-auto pt-32 pb-12 px-6 grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        
        {/* Metric Card 1: Avg Yield */}
        <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="glass-card group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Projected Baseline Yield</p>
              <h3 className="text-4xl font-bold tracking-tight text-slate-800">
                3.9 <span className="text-xl font-medium text-slate-400">t/ha</span>
              </h3>
            </div>
            <div className="p-3 bg-emerald-100/50 rounded-xl group-hover:bg-emerald-100 transition-colors">
              <Sprout className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 font-medium">
            <span className="px-2 py-0.5 bg-emerald-100 rounded-full">+12%</span>
            <span>vs 2020 baseline</span>
          </div>
        </motion.div>

        {/* Metric Card 2: Temp Anomaly */}
        <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="glass-card group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Current Climate Anomaly</p>
              <h3 className="text-4xl font-bold tracking-tight text-slate-800">
                +1.5 <span className="text-xl font-medium text-slate-400">°C</span>
              </h3>
            </div>
            <div className="p-3 bg-amber-100/50 rounded-xl group-hover:bg-amber-100 transition-colors">
              <ThermometerSun className="w-6 h-6 text-amber-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-500 font-medium">
            <span className="px-2 py-0.5 bg-amber-100 rounded-full">High Variance</span>
            <span>Impact threshold approaching</span>
          </div>
        </motion.div>

        {/* Metric Card 3: Resilience Score */}
        <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="glass-card group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Global Resilience Score</p>
              <h3 className="text-4xl font-bold tracking-tight text-slate-800">
                8.2 <span className="text-xl font-medium text-slate-400">/ 10</span>
              </h3>
            </div>
            <div className="p-3 bg-cyan-100/50 rounded-xl group-hover:bg-cyan-100 transition-colors">
              <ShieldCheck className="w-6 h-6 text-cyan-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-cyan-600 font-medium">
            <span className="px-2 py-0.5 bg-cyan-100 rounded-full">Stable</span>
            <span>Strong inverse correlation</span>
          </div>
        </motion.div>


        {/* Hero Line Chart */}
        <motion.div variants={itemVariants} className="glass-card col-span-1 md:col-span-3 h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-slate-800">Yield Trajectory vs Temperature Anomaly</h2>
            <div className="flex items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400" /> <span>Yield (t/ha)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-amber-400" /> <span>Anomaly (°C)</span>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockTimeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="year" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                  dy={10} 
                />
                <YAxis 
                  yAxisId="left" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }} />
                
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="yield" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorYield)" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#059669' }}
                />
                <Area 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="tempAnomaly" 
                  stroke="#fbbf24" 
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="none" 
                  activeDot={{ r: 4, fill: '#d97706' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>


        {/* Bottom Row: Regional Breakdown (Bar Chart) */}
        <motion.div variants={itemVariants} className="glass-card col-span-1 md:col-span-2 h-[350px] flex flex-col">
          <h2 className="text-xl font-semibold tracking-tight text-slate-800 mb-6">Regional Resilience Impact</h2>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockRegionalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="region" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                  {mockRegionalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.score > 7 ? '#0ea5e9' : entry.score > 5 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Bottom Row: AI Insights Panel */}
        <motion.div variants={itemVariants} className="glass-card col-span-1 h-[350px] relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-500" />
          <h2 className="text-xl font-semibold tracking-tight text-slate-800 mb-4">Phase 2 Insights</h2>
          
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
              <h4 className="font-semibold text-emerald-800 text-sm mb-1">Strong Correlation Found</h4>
              <p className="text-emerald-700/80 text-sm leading-relaxed">
                India's Wheat yield demonstrates a 0.854 correlation score against local temperature anomalies, indicating adaptation vectors.
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
              <h4 className="font-semibold text-amber-800 text-sm mb-1">Vulnerability Alert: Nigeria</h4>
              <p className="text-amber-700/80 text-sm leading-relaxed">
                Projected +1.5°C anomaly vectors flag systemic yield degradation for Maize crops in Sub-Saharan sectors. Score: 4.1/10.
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="font-semibold text-slate-700 text-sm mb-1">Model Confidence</h4>
              <p className="text-slate-500 text-sm leading-relaxed">
                Random Forest Regressor (Python) trained on 103 Phase 1 inputs natively. Mean Absolute Error stabilized.
              </p>
            </div>
          </div>
        </motion.div>

      </motion.main>

      {/* Tailwind Utility Classes appended for standard CSS injection in conceptual setups */}
      <style dangerouslySetInnerHTML={{__html: `
        .glass-card {
           background-color: rgba(255, 255, 255, 0.7);
           backdrop-filter: blur(16px);
           -webkit-backdrop-filter: blur(16px);
           border: 1px solid rgba(255, 255, 255, 0.4);
           box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
           border-radius: 1.25rem;
           padding: 1.5rem;
           transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-card:hover {
           box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}} />
    </div>
  );
}
