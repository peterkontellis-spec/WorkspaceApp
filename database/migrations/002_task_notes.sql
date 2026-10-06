-- Additive update: existing records and revisions must remain intact.
ALTER TABLE task ADD COLUMN notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 50000);
