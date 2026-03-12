{-
Module      : Main
Description : Entry point for the Haskell crop-yield data pipeline.

This is the executable entry point.  All logic lives in the library
modules under "CropPipeline.*"; this file simply wires them together.
-}

module Main (main) where

import CropPipeline.Pipeline (runPipeline)

-- | Configuration ---------------------------------------------------------

inputFile :: FilePath
inputFile = "data/raw_crop_data.csv"

outputFile :: FilePath
outputFile = "cleaned_crop_data.csv"

-- | 5-year rolling window for the recursive average.
rollingWindow :: Int
rollingWindow = 5

-- | Entry point ------------------------------------------------------------

main :: IO ()
main = runPipeline inputFile outputFile rollingWindow
