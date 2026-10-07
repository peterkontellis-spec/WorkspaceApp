-- Immutable, versioned snapshots. Archive changes availability, never source work.
CREATE TABLE work_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('task','board')),
  snapshot_version integer NOT NULL DEFAULT 1 CHECK (snapshot_version=1),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  created_by text NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by text REFERENCES app_user(id),
  CHECK ((archived_at IS NULL)=(archived_by IS NULL)),
  UNIQUE (workspace_id,id)
);
CREATE INDEX work_template_workspace ON work_template(workspace_id,created_at,id);
-- Stable request fingerprints make uncertain creation retries safe without replaying.
CREATE TABLE template_operation (
  workspace_id uuid NOT NULL REFERENCES workspace(id),
  creation_id uuid NOT NULL,
  actor_id text NOT NULL REFERENCES app_user(id),
  fingerprint text NOT NULL CHECK (length(fingerprint)=64),
  result jsonb NOT NULL CHECK (jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,creation_id)
);
