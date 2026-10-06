-- Reversible archive only: rows, task history, assignments and file bytes remain.
ALTER TABLE board ADD COLUMN archived_at timestamptz;
ALTER TABLE board ADD COLUMN archived_by text REFERENCES app_user(id);
ALTER TABLE board ADD CONSTRAINT board_archive_complete CHECK ((archived_at IS NULL) = (archived_by IS NULL));
ALTER TABLE task ADD COLUMN archived_at timestamptz;
ALTER TABLE task ADD COLUMN archived_by text REFERENCES app_user(id);
ALTER TABLE task ADD COLUMN archive_batch_id uuid;
ALTER TABLE task ADD CONSTRAINT task_archive_complete CHECK (
  (archived_at IS NULL) = (archived_by IS NULL) AND
  (archived_at IS NULL) = (archive_batch_id IS NULL)
);
CREATE INDEX task_archive_batch ON task(workspace_id,archive_batch_id) WHERE archive_batch_id IS NOT NULL;
CREATE TABLE board_archive_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  board_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  event text NOT NULL CHECK (event IN ('archived','restored')),
  actor_id text NOT NULL REFERENCES app_user(id),
  actor_name text NOT NULL CHECK (length(actor_name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id,revision),
  FOREIGN KEY (workspace_id,board_id) REFERENCES board(workspace_id,id)
);
