-- Task notes as a rich document (the Notion-style editor: headings, lists, to-dos, tables, toggles, callouts).
-- notes_doc = the editor's document (JSON). notes stays as a plain-text copy for search and previews.
-- Old plain notes are converted the first time someone edits them.
alter table tasks add column if not exists notes_doc jsonb;
