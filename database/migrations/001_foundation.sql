-- Application identities map to the authentication provider in M2.2.
-- No credentials, sessions, customer permissions or public registration exist yet.
CREATE TABLE app_user (
  id text PRIMARY KEY,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE membership (
  workspace_id uuid NOT NULL REFERENCES workspace(id),
  user_id text NOT NULL REFERENCES app_user(id),
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE TABLE board (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE TABLE board_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  board_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  FOREIGN KEY (workspace_id, board_id) REFERENCES board(workspace_id, id),
  UNIQUE (workspace_id, board_id, id)
);
CREATE TABLE task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  board_id uuid NOT NULL,
  group_id uuid NOT NULL,
  parent_id uuid,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  status text NOT NULL DEFAULT 'To do' CHECK (status IN ('To do', 'In progress', 'Done')),
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  due_date date,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, board_id, id),
  FOREIGN KEY (workspace_id, board_id, group_id) REFERENCES board_group(workspace_id, board_id, id),
  FOREIGN KEY (workspace_id, board_id, parent_id) REFERENCES task(workspace_id, board_id, id),
  CHECK (parent_id IS DISTINCT FROM id)
);
CREATE INDEX task_board_order ON task(workspace_id, board_id, group_id, position, id);
CREATE INDEX task_parent ON task(workspace_id, board_id, parent_id);
CREATE TABLE task_assignee (
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL,
  user_id text NOT NULL,
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (workspace_id, task_id) REFERENCES task(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, user_id) REFERENCES membership(workspace_id, user_id) ON DELETE CASCADE
);
CREATE TABLE column_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  board_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('text', 'status', 'number', 'date', 'link')),
  configuration jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(configuration) = 'object'),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  FOREIGN KEY (workspace_id, board_id) REFERENCES board(workspace_id, id),
  UNIQUE (workspace_id, board_id, id)
);
CREATE TABLE task_field_value (
  workspace_id uuid NOT NULL,
  board_id uuid NOT NULL,
  task_id uuid NOT NULL,
  column_id uuid NOT NULL,
  value jsonb NOT NULL,
  PRIMARY KEY (task_id, column_id),
  FOREIGN KEY (workspace_id, board_id, task_id) REFERENCES task(workspace_id, board_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, board_id, column_id) REFERENCES column_definition(workspace_id, board_id, id)
);
CREATE TABLE checklist_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 500),
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  FOREIGN KEY (workspace_id, task_id) REFERENCES task(workspace_id, id) ON DELETE CASCADE
);
CREATE TABLE attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL,
  uploaded_by text NOT NULL REFERENCES app_user(id),
  storage_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  original_name text NOT NULL CHECK (length(btrim(original_name)) BETWEEN 1 AND 255),
  media_type text NOT NULL CHECK (length(media_type) BETWEEN 1 AND 255),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 0 AND 26214400),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, task_id) REFERENCES task(workspace_id, id)
);
