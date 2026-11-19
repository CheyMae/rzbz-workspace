-- "About this project" uses the same block editor as task notes.
-- about_doc holds the editor's document; about keeps a plain-text copy for search and previews.
alter table projects add column if not exists about_doc jsonb;
