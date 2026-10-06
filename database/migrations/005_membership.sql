CREATE TABLE workspace_invitation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(id),
  email text NOT NULL CHECK (email=lower(email) AND length(email) BETWEEN 3 AND 254),
  role text NOT NULL CHECK (role IN ('owner','editor','viewer')),
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash)=64),
  created_by text NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
  accepted_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX workspace_invitation_pending ON workspace_invitation(workspace_id,email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE invitation_rate_limit (
  bucket text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1
);
