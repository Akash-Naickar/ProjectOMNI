# 🌍 Project Omni: Climate Resilience Analytics

> **Empowering global food security through recursive analytics and sustainable crop yield projections.**

Project Omni is an end-to-end data intelligence platform designed to analyze, predict, and visualize the impact of climate change on global agriculture. By correlating decades of FAOSTAT crop yield data with temperature anomalies, Omni provides actionable insights into regional resilience.

---

## ✨ Key Features

- **🌐 Interactive Global Heatmap:** A high-performance Leaflet-based globe visualizing crop resilience scores across every continent.
- **📈 Micro-Linear Forecasting:** Leveraging over 17,000 independent linear regression models to provide high-precision, crop-specific yield extrapolations up to 2050.
- **⚡ Recursive Data Pipeline:** A robust Haskell-powered ingestion engine capable of cleaning and formatting nearly 1 million rows of raw FAOSTAT data in seconds.
- **🛡️ Resilience Scoring:** Advanced detrending algorithms that isolate climate shocks from technological progress to provide a "True Resilience" score (/10).
- **✨ Premium Dashboard:** A modern, glassmorphic UI built with Next.js, Framer Motion, and Tailwind CSS.

---

## 🛠️ Tech Stack

### **Data Engineering (Haskell)**
The pipeline handles raw CSV ingestion, data cleaning, rolling average calculations, and standardization to prepare the dataset for machine learning.

### **Intelligence Layer (Python)**
A FastAPI-driven backend utilizing `scikit-learn`.
- **Architecture:** Per-country, per-crop micro-regressions.
- **Math:** Yield Shock Correlation Analysis (Pearson Correlation on detrended series).

### **Visualization Layer (Next.js & React)**
A premium frontend experience:
- **UI:** Tailwind CSS & Framer Motion for smooth, high-fidelity interactions.
- **Charts:** Recharts for optimized time-series visualization.
- **Maps:** Leaflet.js with custom-themed dark layers for global analysis.

---

## 🚀 Getting Started

### **The Docker Way (Recommended)**
The easiest way to run the full stack is via Docker Compose:

```bash
docker-compose up --build
```
*Access the dashboard at `http://localhost:3000`*

### **Manual Setup**
1. **Pipeline:** Run `haskell-pipeline/Main.hs` to generate the cleaned dataset.
2. **Backend:** Start the Python server in `python-backend/main.py`.
3. **Frontend:** Run `npm run dev` in the `frontend/` directory.

---

## 📋 Deployment
For detailed hosting instructions, including AWS, Vercel, and Railway configurations, refer to the [Deployment Guide](./deployment_guide.md).

---

