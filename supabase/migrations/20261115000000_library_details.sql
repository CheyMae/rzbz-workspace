-- Library: extra details from the "Figma Projects" sheet.
-- version  = the sheet's "Version / Section" (e.g. "[1.0] RCBC Pulz App", "Revamp")
-- category = the feature area (e.g. "CASA", "Security", "Design System")
-- password = the Figma file's password, shown to signed-in members only (RLS: members read)
-- notes    = free text
alter table library_items add column if not exists version  text;
alter table library_items add column if not exists category text;
alter table library_items add column if not exists password text;
alter table library_items add column if not exists notes    text;
