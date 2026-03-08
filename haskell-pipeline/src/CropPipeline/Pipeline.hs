{- |
Module      : CropPipeline.Pipeline
Description : Conduit-based streaming pipeline for CSV ingestion and output.

= Functional Concepts Demonstrated

1. __Conduit Streaming__: The @conduit@ library provides composable,
   resource-safe streaming.  The @(.|)@ operator connects stages:
   @source .| transform .| sink@.  Data flows one chunk at a time,
   so even multi-gigabyte files use constant memory for the I/O layer.

2. __ResourceT__: Wraps 'IO' to guarantee that file handles are closed
   even if an exception occurs—similar to Python's @with@ statement
   but enforced by the type system.

3. __Separation of Concerns__: The pipeline orchestrates I/O; all
   business logic (validation, analytics) is in pure modules.
-}

{-# LANGUAGE OverloadedStrings #-}

module CropPipeline.Pipeline
    ( runPipeline
    ) where

import           Control.Monad          (unless, when, forM_)
import           Data.Either            (partitionEithers)
import           GHC.IO.Encoding        (setLocaleEncoding, utf8)
import           System.Exit            (die)
import           System.IO              (hFlush, stdout, stderr,
                                         hSetEncoding)
import           Text.Printf            (printf)

-- Conduit streaming
import           Conduit                (MonadIO, liftIO, runConduitRes,
                                         awaitForever, yield, (.|))
import           Data.Conduit           (ConduitT)
import qualified Data.Conduit.Binary    as CB
import qualified Data.Conduit.List      as CL

-- CSV
import qualified Data.Csv               as Csv

-- ByteString
import qualified Data.ByteString        as BS
import qualified Data.ByteString.Lazy   as BL
import qualified Data.ByteString.Char8  as BC

-- Containers
import qualified Data.Map.Strict        as Map
import qualified Data.Vector            as V

-- Internal modules
import           CropPipeline.Types
import           CropPipeline.Validation (validateRecord)
import           CropPipeline.Analytics  (groupByCropKey, computeRollingAverage)

-- ============================================================================
-- Conduit Components
-- ============================================================================

-- | A 'Conduit' stage that receives raw 'ByteString' lines and yields
--   parsed 'RawCropRow' values.
--
--   * Header lines (starting with "Year" or "year") are silently skipped.
--   * Empty lines are skipped.
--   * Lines that fail CSV decoding are logged to stdout and discarded.
--
--   The @MonadIO m@ constraint allows us to perform logging inside the
--   conduit without breaking the streaming abstraction.
parseCSVLineC :: MonadIO m => ConduitT BS.ByteString RawCropRow m ()
parseCSVLineC = awaitForever $ \line ->
    -- Skip blank lines and header rows (safe, no crash).
    unless (BS.null line || isHeader line) $
        -- 'Csv.decode NoHeader' treats the single line as a 1-row CSV.
        -- It returns either a parse error or a Vector of decoded rows.
        case Csv.decode Csv.NoHeader (BL.fromStrict line) of
            Left _err ->
                liftIO $ putStrLn $ "  [WARN] Skipping malformed row: "
                                     ++ take 80 (BC.unpack line)
            Right records ->
                -- Yield every successfully decoded record downstream.
                V.mapM_ yield records
  where
    isHeader :: BS.ByteString -> Bool
    isHeader bs = BC.isPrefixOf "Year" bs || BC.isPrefixOf "year" bs

-- ============================================================================
-- Pipeline Orchestration
-- ============================================================================

-- | Run the complete four-stage pipeline.
--
--   Stage 1 – __Stream & Parse__: Conduit streams raw bytes from the input
--   file, splits into lines, and decodes each line via @cassava@.
--
--   Stage 2 – __Validate__: Pure 'Either'-based validation partitions
--   records into errors and successes.
--
--   Stage 3 – __Group & Analyse__: Records are grouped by @(Country, Crop)@
--   and the recursive 5-year rolling average is computed per group.
--
--   Stage 4 – __Write__: The enriched records are encoded to CSV and
--   written to the output file.
runPipeline :: FilePath -> FilePath -> Int -> IO ()
runPipeline inputPath outputPath windowSize = do
    -- Fix Windows console encoding so Unicode box-drawing characters
    -- and em-dashes render correctly instead of crashing.
    hSetEncoding stdout utf8
    hSetEncoding stderr utf8
    setLocaleEncoding utf8

    putStrLn "╔══════════════════════════════════════════════════════════════╗"
    putStrLn "║  Haskell Data Pipeline: Crop Yield Recursive Analytics      ║"
    putStrLn "║  Phase 1 -- Data Ingestion & Scrubbing Engine               ║"
    putStrLn "╚══════════════════════════════════════════════════════════════╝"
    putStrLn ""

    -- ── Stage 1: Stream & Parse ─────────────────────────────────────────
    putStrLn "► Stage 1: Streaming CSV data with Conduit..."
    hFlush stdout

    -- The conduit pipeline:
    --   sourceFile  → streams raw bytes (constant memory)
    --   CB.lines    → splits on newlines (streaming)
    --   parseCSVLineC → decodes each line with cassava
    --   CL.consume  → collects decoded records into a list
    --
    -- 'runConduitRes' runs inside ResourceT, ensuring the file handle
    -- is closed even if an exception is thrown mid-stream.
    rawRecords <- runConduitRes
        $  CB.sourceFile inputPath
        .| CB.lines
        .| parseCSVLineC
        .| CL.consume

    printf "  Parsed %d raw records from '%s'\n" (length rawRecords) inputPath

    -- ── Stage 2: Validate with Either Monad ─────────────────────────────
    putStrLn "\n► Stage 2: Validating records (Either monad)..."

    -- 'partitionEithers' cleanly separates Lefts (errors) from Rights
    -- (successes).  The validation itself is a pure function—no IO.
    let (errors, validRecords) = partitionEithers $ map validateRecord rawRecords

    printf "  ✓ Valid records  : %d\n" (length validRecords)
    printf "  ✗ Invalid records: %d\n" (length errors)

    unless (null errors) $ do
        putStrLn "  Sample validation errors:"
        forM_ (take 5 errors) $ \err ->
            putStrLn $ "    • " ++ show err

    when (null validRecords) $
        die "FATAL: No valid records survived validation.  Check input data."

    -- ── Stage 3: Group & Recursive Rolling Average ──────────────────────
    printf "\n► Stage 3: Computing %d-year rolling averages (recursive)...\n" windowSize

    -- groupByCropKey uses a strict fold (foldl') into a Map.
    let grouped = groupByCropKey validRecords
    printf "  Found %d unique (Country, Crop) groups\n" (Map.size grouped)

    -- Map.map applies the recursive rolling average to every group.
    let enrichedGroups = Map.map (computeRollingAverage windowSize) grouped

    -- Flatten all groups back to a single list.
    let allEnriched = concatMap snd $ Map.toAscList enrichedGroups
    printf "  Computed rolling averages for %d records\n" (length allEnriched)

    -- ── Stage 4: Write Cleaned Output ───────────────────────────────────
    putStrLn "\n► Stage 4: Writing cleaned data..."

    let header  = BC.pack "Year,Country,Crop,Yield_tonnes_ha,TempAnomaly_C,RollingAvg_5yr\n"
    let csvBody = Csv.encode allEnriched
    BL.writeFile outputPath (BL.append (BL.fromStrict header) csvBody)

    printf "  ✓ Wrote %d enriched records to '%s'\n" (length allEnriched) outputPath

    -- ── Summary ─────────────────────────────────────────────────────────
    putStrLn "\n╔══════════════════════════════════════════════════════════════╗"
    putStrLn "║  Pipeline Complete — Ready for Python ML Phase              ║"
    putStrLn "╚══════════════════════════════════════════════════════════════╝"
    putStrLn $ "  Output file: " ++ outputPath
