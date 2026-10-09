CREATE TABLE task_recurrence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  source_task_id uuid NOT NULL UNIQUE,
  mode text NOT NULL CHECK (mode IN ('calendar','completion')),
  unit text NOT NULL CHECK (unit IN ('day','week','month')),
  interval_count integer NOT NULL CHECK(interval_count BETWEEN 1 AND 365),
  time_zone text NOT NULL,
  anchor_date date NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  recipe jsonb NOT NULL CHECK(jsonb_typeof(recipe)='object'),
  recipe_version integer NOT NULL DEFAULT 1,
  next_index integer NOT NULL DEFAULT 1 CHECK(next_index>=0),
  next_date date,
  latest_task_id uuid NOT NULL,
  pending_predecessor_id uuid,
  pending_completion_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,source_task_id) REFERENCES task(workspace_id,id),
  FOREIGN KEY(workspace_id,latest_task_id) REFERENCES task(workspace_id,id),
  FOREIGN KEY(workspace_id,pending_predecessor_id) REFERENCES task(workspace_id,id),
  CHECK((pending_predecessor_id IS NULL)=(pending_completion_at IS NULL))
);
CREATE TABLE task_recurrence_occurrence (
  workspace_id uuid NOT NULL,
  series_id uuid NOT NULL,
  task_id uuid NOT NULL UNIQUE,
  scheduled_date date NOT NULL,
  occurrence_key text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(series_id,occurrence_key),
  FOREIGN KEY(workspace_id,series_id) REFERENCES task_recurrence(workspace_id,id),
  FOREIGN KEY(workspace_id,task_id) REFERENCES task(workspace_id,id)
);
CREATE INDEX task_recurrence_dates ON task_recurrence_occurrence(series_id,scheduled_date);
CREATE INDEX task_recurrence_ready ON task_recurrence(workspace_id,next_attempt_at) WHERE enabled AND attempts<5;
ALTER TABLE task_activity ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE task_activity DROP CONSTRAINT task_activity_event_check;
ALTER TABLE task_activity ADD CONSTRAINT task_activity_event_check CHECK(event IN ('created','updated','recurrence_created'));
ALTER TABLE task_activity ADD CONSTRAINT task_activity_actor_origin CHECK(
  (event='recurrence_created' AND actor_id IS NULL AND actor_name='Recurrence') OR
  (event IN ('created','updated') AND actor_id IS NOT NULL)
);
