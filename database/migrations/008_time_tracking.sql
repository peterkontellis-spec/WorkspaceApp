-- Time is shared workspace history. Corrections and voids retain original rows.
CREATE TABLE time_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL,
  user_id text NOT NULL REFERENCES app_user(id),
  creation_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('manual','timer')),
  work_date date,
  duration_seconds integer CHECK (duration_seconds BETWEEN 1 AND 86400),
  started_at timestamptz,
  ended_at timestamptz,
  adjusted_seconds integer CHECK (adjusted_seconds BETWEEN 1 AND 86400),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  voided_at timestamptz,
  stop_reason text CHECK (stop_reason IN ('task_archived','board_archived','membership_removed','read_only','account_disabled')),
  created_at timestamptz NOT NULL DEFAULT date_trunc('second',clock_timestamp()),
  updated_at timestamptz NOT NULL DEFAULT date_trunc('second',clock_timestamp()),
  UNIQUE (workspace_id,user_id,creation_id),
  FOREIGN KEY (workspace_id,task_id) REFERENCES task(workspace_id,id),
  CHECK ((kind='manual' AND work_date IS NOT NULL AND duration_seconds IS NOT NULL AND started_at IS NULL AND ended_at IS NULL AND adjusted_seconds IS NULL)
    OR (kind='timer' AND started_at IS NOT NULL AND duration_seconds IS NULL AND (ended_at IS NULL OR ended_at>=started_at)
      AND ((adjusted_seconds IS NULL AND work_date IS NULL) OR (adjusted_seconds IS NOT NULL AND work_date IS NOT NULL AND ended_at IS NOT NULL)))),
  CHECK (voided_at IS NULL OR kind='manual' OR ended_at IS NOT NULL)
);
CREATE UNIQUE INDEX time_one_running_per_user ON time_entry(user_id) WHERE kind='timer' AND ended_at IS NULL;
CREATE INDEX time_workspace_history ON time_entry(workspace_id,created_at DESC,id DESC);
CREATE INDEX time_task_history ON time_entry(workspace_id,task_id);
CREATE TABLE time_entry_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES time_entry(id),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT date_trunc('second',clock_timestamp())
);
CREATE FUNCTION record_time_entry_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO time_entry_audit(entry_id,before_state,after_state) VALUES(NEW.id,to_jsonb(OLD),to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER time_entry_changes AFTER UPDATE ON time_entry FOR EACH ROW EXECUTE FUNCTION record_time_entry_change();

-- These triggers run in the same transaction as archive/access changes, even
-- when initiated by another app worker or the local account operator.
CREATE FUNCTION close_ineligible_time_entries() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reason text;
BEGIN
  IF TG_TABLE_NAME='task' THEN
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
      UPDATE time_entry SET ended_at=greatest(started_at,date_trunc('second',clock_timestamp())),stop_reason='task_archived',revision=revision+1,updated_at=date_trunc('second',clock_timestamp())
      WHERE task_id=NEW.id AND kind='timer' AND ended_at IS NULL;
    END IF;
  ELSIF TG_TABLE_NAME='board' THEN
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
      UPDATE time_entry e SET ended_at=greatest(e.started_at,date_trunc('second',clock_timestamp())),stop_reason='board_archived',revision=e.revision+1,updated_at=date_trunc('second',clock_timestamp())
      FROM task t WHERE e.task_id=t.id AND t.board_id=NEW.id AND e.kind='timer' AND e.ended_at IS NULL;
    END IF;
  ELSIF TG_TABLE_NAME='membership' THEN
    IF TG_OP='DELETE' THEN reason:='membership_removed';
    ELSIF NEW.role='viewer' AND OLD.role<>'viewer' THEN reason:='read_only'; END IF;
    IF reason IS NOT NULL THEN
      UPDATE time_entry SET ended_at=greatest(started_at,date_trunc('second',clock_timestamp())),stop_reason=reason,revision=revision+1,updated_at=date_trunc('second',clock_timestamp())
      WHERE workspace_id=OLD.workspace_id AND user_id=OLD.user_id AND kind='timer' AND ended_at IS NULL;
    END IF;
  ELSIF TG_TABLE_NAME='app_user' THEN
    IF OLD.disabled_at IS NULL AND NEW.disabled_at IS NOT NULL THEN
      UPDATE time_entry SET ended_at=greatest(started_at,date_trunc('second',clock_timestamp())),stop_reason='account_disabled',revision=revision+1,updated_at=date_trunc('second',clock_timestamp())
      WHERE user_id=NEW.id AND kind='timer' AND ended_at IS NULL;
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER time_task_archive AFTER UPDATE OF archived_at ON task FOR EACH ROW EXECUTE FUNCTION close_ineligible_time_entries();
CREATE TRIGGER time_board_archive AFTER UPDATE OF archived_at ON board FOR EACH ROW EXECUTE FUNCTION close_ineligible_time_entries();
CREATE TRIGGER time_membership_access AFTER UPDATE OF role OR DELETE ON membership FOR EACH ROW EXECUTE FUNCTION close_ineligible_time_entries();
CREATE TRIGGER time_account_access AFTER UPDATE OF disabled_at ON app_user FOR EACH ROW EXECUTE FUNCTION close_ineligible_time_entries();
