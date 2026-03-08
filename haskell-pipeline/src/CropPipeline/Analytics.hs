{- |
Module      : CropPipeline.Analytics
Description : Recursive rolling-average computation and grouping utilities.

= Functional Concepts Demonstrated

1. __Structural Recursion__: 'rollingAvgRecursive' is structurally recursive
   on the yield list.  Each recursive call processes the head and recurses
   on the tail, guaranteeing termination (the list gets strictly shorter).

2. __Accumulator Pattern__: The @prevYields@ parameter acts as an immutable
   accumulator—similar to a loop variable, but without mutation.

3. __Higher-Order Functions__: 'foldl'', 'sortBy', 'Map.map', 'zipWith'
   all accept functions as arguments—a hallmark of functional programming.

4. __Strict Left Fold__: 'foldl'' from @Data.List@ is the strict variant
   of @foldl@.  It evaluates the accumulator at each step, preventing
   thunk build-up on large datasets.
-}

module CropPipeline.Analytics
    ( computeRollingAverage
    , groupByCropKey
    ) where

import           Data.List       (foldl', sortBy)
import           Data.Ord        (comparing)
import qualified Data.Map.Strict as Map
import           Data.Map.Strict (Map)

import           CropPipeline.Types

-- ============================================================================
-- Grouping (Higher-Order Fold)
-- ============================================================================

-- | Group a flat list of records into a 'Map' keyed by @(Country, Crop)@.
--
--   Implementation uses a strict left fold ('foldl''), which is O(n log n)
--   overall (n inserts into a balanced tree map).
--
--   'Map.insertWith' is itself a higher-order function: its first argument
--   is a combining function applied when the key already exists.
groupByCropKey :: [CropRecord] -> Map CropKey [CropRecord]
groupByCropKey = foldl' insert' Map.empty
  where
    insert' :: Map CropKey [CropRecord] -> CropRecord -> Map CropKey [CropRecord]
    insert' acc r =
        let key = (crCountry r, crCrop r)
        in  Map.insertWith (++) key [r] acc

-- ============================================================================
-- Recursive Rolling Average
-- ============================================================================

-- | Compute a rolling average of yield over a window of @n@ years for a
--   single (Country, Crop) group.
--
--   Steps (all pure, no mutation):
--   1. Sort records by year using 'sortBy' (returns a new list).
--   2. Extract the yield column.
--   3. Feed the yields into the recursive engine.
--   4. Zip the computed averages back onto the sorted records.
computeRollingAverage :: Int -> [CropRecord] -> [EnrichedRecord]
computeRollingAverage windowSize records =
    let sorted   = sortBy (comparing crYear) records
        yields   = map crYield sorted
        averages = rollingAvgRecursive windowSize [] yields
    in  zipWith EnrichedRecord sorted averages

-- | The recursive core of the rolling-average calculation.
--
--   == Type Signature
--
--   @
--   rollingAvgRecursive
--       :: Int        -- ^ windowSize  (e.g. 5)
--       -> [Double]   -- ^ prevYields  (accumulator, most-recent first)
--       -> [Double]   -- ^ remaining   (yields still to process)
--       -> [Double]   -- ^ result      (one average per input yield)
--   @
--
--   == Recursion Structure
--
--   * __Base case__: empty remaining list → return @[]@.
--   * __Recursive case__:
--       1. Prepend the current yield to the accumulator.
--       2. Trim the accumulator to at most @windowSize@ elements.
--       3. Compute the mean of the trimmed window.
--       4. Cons the mean onto the result of recursing on the tail.
--
--   The function is /structurally recursive/ on @remaining@: the list
--   shrinks by exactly one element per call, so termination is guaranteed.
rollingAvgRecursive
    :: Int        -- ^ Window size (maximum number of years to average)
    -> [Double]   -- ^ Accumulator: recent yields (most recent first)
    -> [Double]   -- ^ Remaining yields to process
    -> [Double]   -- ^ One rolling average per input element
-- Base case: nothing left to process.
rollingAvgRecursive _ _ [] = []
-- Recursive case: process head, recurse on tail.
rollingAvgRecursive windowSize prevYields (currentYield : restYields) =
    let -- Build the sliding window: prepend current, keep at most windowSize.
        -- 'take' is safe—if the list is shorter than windowSize it returns
        -- whatever is available (handles the ramp-up period gracefully).
        newWindow = take windowSize (currentYield : prevYields)

        -- Compute the arithmetic mean of the window.
        -- 'fromIntegral' converts the Int length to Double for division.
        windowLen = length newWindow
        windowAvg = sum newWindow / fromIntegral windowLen

    -- Cons the current average and recurse with the updated accumulator.
    in  windowAvg : rollingAvgRecursive windowSize newWindow restYields
