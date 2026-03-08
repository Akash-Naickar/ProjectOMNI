{- |
Module      : CropPipeline.Types
Description : Algebraic Data Types and CSV instances for the crop yield pipeline.

= Functional Concepts Demonstrated

1. __Algebraic Data Types (ADTs)__: We model the domain with precise types.
   @RawCropRow@ uses @Maybe@ for every field (data might be missing).
   @CropRecord@ uses strict fields—once validated, all data is guaranteed present.
   This follows the principle of "making illegal states unrepresentable."

2. __Type Classes__: @cassava@'s @FromRecord@ / @ToRecord@ provide ad-hoc
   polymorphism—any type with an instance can be automatically (de)serialised.

3. __Strict Fields__: The bang patterns (@!@) on @CropRecord@ prevent thunk
   build-up (space leaks) when processing millions of rows.
-}

{-# LANGUAGE DeriveGeneric     #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE RecordWildCards   #-}

module CropPipeline.Types
    ( -- * Raw (unvalidated) row
      RawCropRow(..)
      -- * Validated record
    , CropRecord(..)
      -- * Enriched record (with rolling average)
    , EnrichedRecord(..)
      -- * Grouping key
    , CropKey
      -- * Error type
    , ValidationError(..)
    ) where

import           Data.Char   (isSpace)
import           GHC.Generics (Generic)
import           Text.Read   (readMaybe)
import qualified Data.Csv    as Csv
import           Data.Csv    ((.!))
import qualified Data.Vector as V

-- ============================================================================
-- Domain Types
-- ============================================================================

-- | A raw row straight from the CSV.  Every field is wrapped in 'Maybe'
--   because any column could be blank or malformed.
--
--   This mirrors real-world data ingestion: we accept *anything* the file
--   contains and defer judgement to the validation layer.
data RawCropRow = RawCropRow
    { rawYear        :: !(Maybe Int)
    , rawCountry     :: !(Maybe String)
    , rawCrop        :: !(Maybe String)
    , rawYield       :: !(Maybe Double)
    , rawTempAnomaly :: !(Maybe Double)
    } deriving (Show, Generic)

-- | A validated, clean crop-data record.
--   All fields are guaranteed present and within acceptable domain ranges.
--
--   The strict @!@ annotations mean each field is evaluated to WHNF when
--   the constructor is applied, preventing accumulation of unevaluated
--   thunks during a long fold over millions of rows.
data CropRecord = CropRecord
    { crYear        :: !Int       -- ^ Year of observation
    , crCountry     :: !String    -- ^ Country name
    , crCrop        :: !String    -- ^ Crop type (Wheat, Rice, …)
    , crYield       :: !Double    -- ^ Yield in tonnes / hectare
    , crTempAnomaly :: !Double    -- ^ Temperature anomaly in °C
    } deriving (Show, Eq, Ord, Generic)

-- | A 'CropRecord' enriched with analytics (rolling average).
data EnrichedRecord = EnrichedRecord
    { erRecord          :: !CropRecord
    , erRollingAvgYield :: !Double    -- ^ 5-year rolling average yield
    } deriving (Show, Generic)

-- | Composite key for grouping: @(Country, Crop)@.
type CropKey = (String, String)

-- | Sum type enumerating every possible validation failure.
--   Using a dedicated error ADT (rather than raw strings) makes
--   error handling exhaustive and compiler-checkable.
data ValidationError
    = MissingYear
    | MissingCountry
    | MissingCrop
    | MissingYield
    | MissingTempAnomaly
    | InvalidYearRange  !Int      -- ^ Year fell outside [1960, 2030]
    | NegativeYield     !Double   -- ^ Yield was negative
    deriving (Show)

-- ============================================================================
-- CSV / cassava Instances
-- ============================================================================

-- | Parse a positional CSV row into 'RawCropRow'.
--
--   Strategy: extract every field as a raw 'String', then attempt
--   to convert numeric columns with 'readMaybe'.  This ensures the
--   parser *never* throws—malformed numbers simply become 'Nothing'.
instance Csv.FromRecord RawCropRow where
    parseRecord v
        | V.length v >= 5 = do
            yearStr  <- v .! 0
            country  <- v .! 1
            crop     <- v .! 2
            yieldStr <- v .! 3
            tempStr  <- v .! 4
            pure $ RawCropRow
                { rawYear        = readMaybe (strip yearStr)
                , rawCountry     = nonEmpty  (strip country)
                , rawCrop        = nonEmpty  (strip crop)
                , rawYield       = readMaybe (strip yieldStr)
                , rawTempAnomaly = readMaybe (strip tempStr)
                }
        | otherwise = fail "Row has fewer than 5 columns"
      where
        -- Helper: treat empty / whitespace-only strings as Nothing.
        nonEmpty :: String -> Maybe String
        nonEmpty s = if null s then Nothing else Just s

        -- Helper: trim leading and trailing whitespace.
        strip :: String -> String
        strip = reverse . dropWhile isSpace . reverse . dropWhile isSpace

-- | Serialise an 'EnrichedRecord' back to a CSV row.
--   Column order: Year, Country, Crop, Yield, TempAnomaly, RollingAvg.
instance Csv.ToRecord EnrichedRecord where
    toRecord (EnrichedRecord CropRecord{..} avgYield) = Csv.record
        [ Csv.toField crYear
        , Csv.toField crCountry
        , Csv.toField crCrop
        , Csv.toField crYield
        , Csv.toField crTempAnomaly
        , Csv.toField avgYield
        ]
