-- One-time: align stored tests with proctoring removed from the product UI.
-- Run against the assessment-service database (e.g. via psql or migrate job).
UPDATE tests SET proctoring_level = 'none', proctoring_screen_share = false WHERE proctoring_level <> 'none' OR proctoring_screen_share IS TRUE;
