-- Existing overdue dates are deliberately dormant until explicitly edited.
ALTER TABLE task ADD COLUMN reminder_before boolean NOT NULL DEFAULT false;
ALTER TABLE task ADD COLUMN reminder_after boolean NOT NULL DEFAULT false;
ALTER TABLE task ADD COLUMN reminder_eligible boolean NOT NULL DEFAULT true;
UPDATE task SET reminder_eligible=false WHERE due_date < (now() AT TIME ZONE 'Europe/Athens')::date;

CREATE TABLE task_reminder_job (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL,
  due_date date NOT NULL,
  day_offset smallint NOT NULL CHECK (day_offset IN (-1,0,1)),
  scheduled_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','delivered','cancelled','superseded','failed')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  next_attempt_at timestamptz NOT NULL,
  delivered_at timestamptz,
  last_error_code text,
  UNIQUE (task_id,due_date,day_offset),
  UNIQUE (workspace_id,id),
  FOREIGN KEY (workspace_id,task_id) REFERENCES task(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX task_reminder_job_ready ON task_reminder_job(workspace_id,next_attempt_at) WHERE state='pending';
ALTER TABLE task_notification ALTER COLUMN activity_id DROP NOT NULL;
ALTER TABLE task_notification ADD COLUMN reminder_job_id bigint;
ALTER TABLE task_notification ADD CONSTRAINT task_notification_origin CHECK (num_nonnulls(activity_id,reminder_job_id)=1);
ALTER TABLE task_notification ADD CONSTRAINT task_notification_reminder_fk FOREIGN KEY(workspace_id,reminder_job_id) REFERENCES task_reminder_job(workspace_id,id) ON DELETE CASCADE;
ALTER TABLE task_notification ADD CONSTRAINT task_notification_reminder_recipient UNIQUE(reminder_job_id,recipient_id);
