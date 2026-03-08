{- |
Module      : CropPipeline.Validation
Description : Monadic error handling for crop-data validation.

= Functional Concepts Demonstrated

1. __Either Monad__: The 'Either' type is Haskell's primary mechanism for
   pure, composable error handling—no exceptions, no null pointers.
   @Left@ carries the error; @Right@ carries the success value.

2. __do-Notation__: Each @<-@ line can short-circuit the entire block if it
   returns @Left@.  This is monadic sequencing: the bind operator @(>>=)@
   threads the "happy path" automatically.

3. __Pattern: Lift Maybe into Either__: The helper @toEither@ converts
   @Maybe a@ into @Either e a@ by attaching a descriptive error tag.
-}

module CropPipeline.Validation
    ( validateRecord
    ) where

import           Control.Monad        (when)
import           CropPipeline.Types

-- | Validate a 'RawCropRow', producing either a 'ValidationError' or a
--   clean 'CropRecord'.
--
--   Uses the 'Either' monad: each step can fail independently, and the
--   computation short-circuits on the *first* error encountered.
--
--   Example:
--
--   >>> validateRecord (RawCropRow (Just 2020) (Just "India") (Just "Wheat") (Just 3.5) (Just 0.8))
--   Right (CropRecord 2020 "India" "Wheat" 3.5 0.8)
--
--   >>> validateRecord (RawCropRow Nothing (Just "India") (Just "Wheat") (Just 3.5) (Just 0.8))
--   Left MissingYear
validateRecord :: RawCropRow -> Either ValidationError CropRecord
validateRecord raw = do
    -- Step 1: Ensure every required field is present.
    --         Each 'toEither' converts Maybe → Either, attaching an
    --         error tag on Nothing.  The do-block short-circuits on
    --         the first Left.
    year    <- toEither MissingYear        (rawYear        raw)
    country <- toEither MissingCountry     (rawCountry     raw)
    crop    <- toEither MissingCrop        (rawCrop        raw)
    yld     <- toEither MissingYield       (rawYield       raw)
    temp    <- toEither MissingTempAnomaly (rawTempAnomaly raw)

    -- Step 2: Domain-specific business rules.
    --         'when' is a monadic conditional: it executes the action
    --         (here, returning Left) only if the predicate is True.
    when (year < 1960 || year > 2030) $ Left (InvalidYearRange year)
    when (yld  < 0)                   $ Left (NegativeYield yld)

    -- Step 3: All checks passed—construct the validated record.
    Right $ CropRecord year country crop yld temp

-- ──────────────────────────────────────────────────────────────────────
-- Helpers
-- ──────────────────────────────────────────────────────────────────────

-- | Lift a 'Maybe' into 'Either' by tagging 'Nothing' with a specific
--   error value.
--
--   This is a very common Haskell pattern:
--     @toEither err Nothing  = Left err@
--     @toEither _   (Just a) = Right a@
toEither :: e -> Maybe a -> Either e a
toEither err = maybe (Left err) Right
