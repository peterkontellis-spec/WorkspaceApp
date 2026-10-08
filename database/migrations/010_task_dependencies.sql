-- A directed edge means task_id waits for prerequisite_id. Workspace writes are
-- serialized by work-core, which validates cycles before replacing a task's edges.
CREATE TABLE task_dependency (
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL,
  prerequisite_id uuid NOT NULL,
  PRIMARY KEY (workspace_id, task_id, prerequisite_id),
  CHECK (task_id <> prerequisite_id),
  FOREIGN KEY (workspace_id, task_id) REFERENCES task(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, prerequisite_id) REFERENCES task(workspace_id, id) ON DELETE CASCADE
);
CREATE INDEX task_dependency_prerequisite ON task_dependency(workspace_id, prerequisite_id, task_id);
