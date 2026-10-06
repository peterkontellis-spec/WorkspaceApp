-- Seed/demo identities deliberately have no authenticated subject.
ALTER TABLE app_user ADD COLUMN auth_user_id text UNIQUE REFERENCES auth_user(id);
ALTER TABLE app_user ADD COLUMN disabled_at timestamptz;
