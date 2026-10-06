-- Immutable task history and private recipient read state. Existing tasks begin
-- recording on their next change; no invented historical events are backfilled.
CREATE TABLE task_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  event text NOT NULL CHECK (event IN ('created','updated')),
  actor_id text NOT NULL REFERENCES app_user(id),
  actor_name text NOT NULL CHECK (length(actor_name) BETWEEN 1 AND 120),
  summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 1500),
  changed_fields text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id,revision,event),
  UNIQUE (workspace_id,id),
  FOREIGN KEY (workspace_id,task_id) REFERENCES task(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX task_activity_page ON task_activity(workspace_id,task_id,id DESC);
CREATE TABLE task_notification (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  activity_id bigint NOT NULL,
  recipient_id text NOT NULL,
  summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 1500),
  read_at timestamptz,
  UNIQUE (activity_id,recipient_id),
  FOREIGN KEY (workspace_id,activity_id) REFERENCES task_activity(workspace_id,id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id,recipient_id) REFERENCES membership(workspace_id,user_id) ON DELETE CASCADE
);
CREATE INDEX task_notification_page ON task_notification(workspace_id,recipient_id,id DESC);
CREATE INDEX task_notification_unread ON task_notification(workspace_id,recipient_id) WHERE read_at IS NULL;
