-- =============================================================================
-- 00_schemas.sql
-- Membuat 3 schema sesuai arsitektur medallion (lihat specs/design.md §1).
--   raw   : salinan data sumber apa adanya (semua TEXT)
--   clean : data bersih, bertipe benar, ber-PK/FK
--   mart  : tabel ringkasan (agregasi) untuk analis
-- Aman dijalankan berulang kali (IF NOT EXISTS).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS clean;
CREATE SCHEMA IF NOT EXISTS mart;
