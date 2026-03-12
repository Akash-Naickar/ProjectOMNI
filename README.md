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

### **Data Engineering: The Haskell Functional Pipeline**

The core of Project Omni's data integrity lies in its **Pure Functional Pipeline** implemented in Haskell. This layer isn't just a "loader"; it is a mathematically rigorous data transformation engine that ensures the Python ML layer receives high-fidelity signals.

#### **Key Technical Implementation Details:**

-   **Algebraic Data Types (ADTs) for Domain Modeling:** We use sum and product types (e.g., `data CropRecord = CropRecord { ... }`) to represent the FAOSTAT schema. This provides compile-time guarantees that the data transformation logic accounts for every possible state of a record, virtually eliminating runtime `null` or `undefined` errors.
-   **Safe Monadic Parsing:** The ingestion engine utilizes monadic interfaces to parse nearly 1 million rows. Unlike imperative scripts that might crash on a single malformed line, our Haskell engine treats parsing as a transition between `Maybe` or `Either` types, allowing for graceful error accumulation and data sanitization.
-   **Lazy Evaluation & Memory Efficiency:** Leveraging Haskell's lazy evaluation, the pipeline processes the massive 940k+ row dataset using constant space. It streams transformations through a series of "Pure Pipes" (Filtering -> Grouping -> Aggregation), preventing the memory overflows common in Python-based data frames for similar scales.
-   **Pure Transformation Kernels:** All statistical calculations—including the 5-year rolling average and yield shock detrending—are implemented as **Pure Functions**. This ensures "Referential Transparency," meaning the same input always produces the exact same cleaned data, making the system highly testable and verifiable for academic assignments.

---

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

1. **Pipeline:** Run `haskell-pipeline/Main.hs` to generate the cleaned dataset (`cleaned_crop_data.csv`).
2. **Backend:** Navigate to `python-backend/` and run `python main.py`.
3. **Frontend:** Navigate to `frontend/` and run `npm run dev`.

*Access the dashboard at `http://localhost:3000`*

---

## ⚖️ License

MIT License. Created for the Advanced Agentic Coding Hackathon.

