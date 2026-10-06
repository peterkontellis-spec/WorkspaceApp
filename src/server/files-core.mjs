import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, lstat, realpath, open, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { transaction } from './database.mjs';
import { ATTACHMENT_MAX_BYTES, attachmentName } from '../lib/attachment-policy.mjs';

export class FilesError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new FilesError(status, message);
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function fileId(value) {
  if (typeof value !== 'string' || !uuid.test(value)) fail(400, 'Choose a valid task or file.');
  return value.toLowerCase();
}
const select = `SELECT a.id,a.task_id AS "taskId",t.title AS "taskTitle",t.board_id AS "boardId",b.name AS "boardName",a.original_name AS "originalName",a.media_type AS "mediaType",a.byte_size::float8 AS "byteSize",a.created_at AS "createdAt" FROM attachment a JOIN task t ON t.id=a.task_id AND t.workspace_id=a.workspace_id JOIN board b ON b.id=t.board_id AND b.workspace_id=t.workspace_id`;
async function member(c, session, workspaceId) {
  const value = (
    await c.query(
      `SELECT u.id,m.workspace_id,m.role FROM app_user u JOIN membership m ON m.user_id=u.id JOIN auth_session s ON s."userId"=u.auth_user_id WHERE u.auth_user_id=$1 AND s.id=$2 AND u.disabled_at IS NULL AND s."expiresAt">now() AND s."updatedAt">now()-interval '30 minutes' AND ($3::uuid IS NULL OR m.workspace_id=$3) ORDER BY m.workspace_id LIMIT 1`,
      [session.user.id, session.session.id, workspaceId ?? null],
    )
  ).rows[0];
  if (!value) fail(401, 'Sign in required.');
  return value;
}
async function authorized(pool, auth, headers, write, action, expectedWorkspace) {
  const session = await auth.api.getSession({ headers });
  if (!session) fail(401, 'Sign in required.');
  return transaction(pool, async (c) => {
    const initial = await member(c, session, expectedWorkspace);
    await c.query(`SELECT id FROM workspace WHERE id=$1 FOR ${write ? 'UPDATE' : 'SHARE'}`, [
      initial.workspace_id,
    ]);
    const current = await member(c, session, initial.workspace_id);
    if (write && !['owner', 'editor'].includes(current.role))
      fail(403, 'Only owners and editors can upload files.');
    const result = await action(c, current);
    if (write) await c.query('UPDATE auth_session SET "updatedAt"=now() WHERE id=$1', [session.session.id]);
    return result;
  });
}
async function task(c, workspace, id, write = false) {
  const saved = (
    await c.query(
      `SELECT t.revision,t.archived_at,b.archived_at AS board_archived_at
    FROM task t JOIN board b ON b.workspace_id=t.workspace_id AND b.id=t.board_id
    WHERE t.workspace_id=$1 AND t.id=$2`,
      [workspace, id],
    )
  ).rows[0];
  if (!saved) fail(404, 'Task not found.');
  if (write && (saved.archived_at || saved.board_archived_at))
    fail(409, 'This task is archived. Restore it before uploading files.');
  return saved;
}
export function listFiles(pool, auth, headers, taskId) {
  if (taskId !== null && taskId !== undefined) taskId = fileId(taskId);
  return authorized(pool, auth, headers, false, async (c, actor) => {
    if (taskId) await task(c, actor.workspace_id, taskId);
    return {
      files: (
        await c.query(
          `${select} WHERE a.workspace_id=$1 AND a.state='ready' AND ($2::uuid IS NULL OR a.task_id=$2) AND ($2::uuid IS NOT NULL OR (t.archived_at IS NULL AND b.archived_at IS NULL)) ORDER BY a.created_at DESC,a.id`,
          [actor.workspace_id, taskId ?? null],
        )
      ).rows,
    };
  });
}
async function storageRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.resolve(root) !== root)
    fail(503, 'File storage is not configured.');
  await mkdir(/* turbopackIgnore: true */ root, { recursive: true, mode: 0o700 });
  const stat = await lstat(/* turbopackIgnore: true */ root);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.mode & 0o077 ||
    (await realpath(/* turbopackIgnore: true */ root)) !== root
  )
    fail(503, 'File storage is unavailable.');
  return { root, stat };
}
async function unchangedRoot(saved) {
  const current = await lstat(/* turbopackIgnore: true */ saved.root);
  if (
    !current.isDirectory() ||
    current.isSymbolicLink() ||
    current.dev !== saved.stat.dev ||
    current.ino !== saved.stat.ino ||
    current.mode & 0o077
  )
    fail(503, 'File storage is unavailable.');
}
function validator(extension) {
  const isText = ['txt', 'md', 'csv'].includes(extension);
  const decoder = isText ? new TextDecoder('utf-8', { fatal: true }) : null;
  let head = Buffer.alloc(0),
    tail = Buffer.alloc(0);
  const text = (value) => {
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))
      fail(415, 'This text file contains unsupported characters.');
  };
  return {
    chunk(value) {
      if (head.length < 16) head = Buffer.concat([head, value.subarray(0, 16 - head.length)]);
      tail = Buffer.concat([tail, value.subarray(Math.max(0, value.length - 1024))]).subarray(-1024);
      if (decoder) {
        try {
          text(decoder.decode(value, { stream: true }));
        } catch (error) {
          if (error instanceof FilesError) throw error;
          fail(415, 'Text files must use UTF-8.');
        }
      }
    },
    finish() {
      if (decoder) {
        try {
          text(decoder.decode());
        } catch (error) {
          if (error instanceof FilesError) throw error;
          fail(415, 'Text files must use UTF-8.');
        }
        return;
      }
      const valid =
        extension === 'pdf'
          ? /^%PDF-[12]\.\d/.test(head.toString('latin1')) && /%%EOF\s*$/.test(tail.toString('latin1'))
          : extension === 'png'
            ? head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
              tail.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]))
            : head[0] === 255 &&
              head[1] === 216 &&
              head[2] === 255 &&
              tail.at(-2) === 255 &&
              tail.at(-1) === 217;
      if (!valid) fail(415, 'File contents do not match the selected file type.');
    },
  };
}
// Shared across route module instances within one server process. No waiting queue.
const uploadStateKey = Symbol.for('workspace.attachments.uploads');
const uploadState = (globalThis[uploadStateKey] ??= { active: 0 });
export async function uploadFile(pool, auth, request, options, taskId, name) {
  const details = attachmentName(name);
  if (!details)
    fail(415, 'Choose a PDF, PNG, JPEG, UTF-8 text, Markdown or CSV file with a simple filename.');
  taskId = fileId(taskId);
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared))))
    fail(400, 'Invalid file size.');
  if (declared !== null && Number(declared) > ATTACHMENT_MAX_BYTES)
    fail(413, 'Files must be 25 MiB or smaller.');
  if (!request.body) fail(400, 'Choose a nonempty file.');
  if (uploadState.active >= 2) fail(429, 'Two uploads are already running. Try again shortly.');
  uploadState.active++;
  let temp,
    final,
    fd,
    reader,
    metadataPrepared = false;
  try {
    const initial = await authorized(pool, auth, request.headers, true, async (c, actor) => {
      const saved = await task(c, actor.workspace_id, taskId, true);
      return { workspace: actor.workspace_id, revision: saved.revision };
    });
    const workspace = initial.workspace;
    const root = await storageRoot(options.storageRoot);
    const storageKey = randomUUID();
    temp = path.join(root.root, `${storageKey}.upload`);
    final = path.join(root.root, storageKey);
    fd = await open(
      /* turbopackIgnore: true */ temp,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    reader = request.body.getReader();
    const check = validator(details.extension);
    const deadline = Date.now() + (options.uploadTimeoutMs ?? 120000);
    let byteSize = 0;
    for (;;) {
      if (request.signal.aborted) fail(400, 'Upload interrupted.');
      if (Date.now() >= deadline) fail(408, 'Upload timed out. Try again.');
      let timer, abort;
      const read = reader.read();
      let item;
      try {
        item = await Promise.race([
          read,
          new Promise((_, reject) => {
            abort = () => reject(new FilesError(400, 'Upload interrupted.'));
            if (request.signal.aborted) return abort();
            request.signal.addEventListener('abort', abort, { once: true });
            timer = setTimeout(
              () => reject(new FilesError(408, 'Upload timed out. Try again.')),
              Math.max(0, Math.min(options.idleTimeoutMs ?? 15000, deadline - Date.now())),
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
        if (abort) request.signal.removeEventListener('abort', abort);
      }
      if (item.done) break;
      const chunk = item.value;
      if (!(chunk instanceof Uint8Array)) fail(400, 'Invalid file data.');
      byteSize += chunk.byteLength;
      if (byteSize > ATTACHMENT_MAX_BYTES) fail(413, 'Files must be 25 MiB or smaller.');
      check.chunk(chunk);
      let offset = 0;
      while (offset < chunk.byteLength) {
        const { bytesWritten } = await fd.write(chunk, offset, chunk.byteLength - offset);
        if (!bytesWritten) fail(503, 'File storage is unavailable.');
        offset += bytesWritten;
      }
    }
    if (!byteSize || (declared !== null && byteSize !== Number(declared)))
      fail(400, 'The file was empty or incomplete.');
    check.finish();
    await fd.sync();
    await fd.close();
    fd = null;
    await unchangedRoot(root);
    await link(/* turbopackIgnore: true */ temp, /* turbopackIgnore: true */ final);
    await unlink(/* turbopackIgnore: true */ temp);
    temp = null;
    const directory = await open(
      /* turbopackIgnore: true */ root.root,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      const current = await directory.stat();
      if (current.dev !== root.stat.dev || current.ino !== root.stat.ino)
        fail(503, 'File storage is unavailable.');
      await directory.sync();
    } finally {
      await directory.close();
    }
    const result = await authorized(
      pool,
      auth,
      request.headers,
      true,
      async (c, actor) => {
        if (request.signal.aborted) fail(400, 'Upload interrupted.');
        const current = await task(c, actor.workspace_id, taskId, true);
        if (current.revision !== initial.revision)
          fail(409, 'This task changed during upload. Check the task and upload again.');
        const inserted = (
          await c.query(
            `INSERT INTO attachment(workspace_id,task_id,uploaded_by,storage_key,original_name,media_type,byte_size,state) VALUES($1,$2,$3,$4,$5,$6,$7,'ready') RETURNING id`,
            [workspace, taskId, actor.id, storageKey, details.name, details.mediaType, byteSize],
          )
        ).rows[0];
        const result = {
          file: (await c.query(`${select} WHERE a.workspace_id=$1 AND a.id=$2`, [workspace, inserted.id]))
            .rows[0],
        };
        // Once the transaction is ready to commit, a connection error cannot tell
        // us whether COMMIT reached PostgreSQL. Retain the blob in that case: an
        // inaccessible orphan is recoverable; deleting a committed file is not.
        metadataPrepared = true;
        return result;
      },
      workspace,
    );
    return result;
  } finally {
    // Cancellation must not wait for a client-controlled stream's cancel promise.
    if (reader) {
      void reader.cancel().catch(() => {});
    }
    await fd?.close().catch(() => {});
    if (temp) await unlink(/* turbopackIgnore: true */ temp).catch(() => {});
    if (final && !metadataPrepared) await unlink(/* turbopackIgnore: true */ final).catch(() => {});
    uploadState.active--;
  }
}
export async function downloadFile(pool, auth, headers, options, id) {
  id = fileId(id);
  const file = await authorized(pool, auth, headers, false, async (c, actor) => {
    const row = (
      await c.query(
        `SELECT a.original_name,a.storage_key,a.byte_size::float8 AS byte_size FROM attachment a WHERE a.workspace_id=$1 AND a.id=$2 AND a.state='ready'`,
        [actor.workspace_id, id],
      )
    ).rows[0];
    if (!row) fail(404, 'File not found.');
    return row;
  });
  fileId(file.storage_key);
  const root = await storageRoot(options.storageRoot);
  let fd;
  try {
    fd = await open(
      /* turbopackIgnore: true */ path.join(root.root, file.storage_key),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    await unchangedRoot(root);
    const stat = await fd.stat();
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      stat.size !== file.byte_size ||
      stat.size < 1 ||
      stat.size > ATTACHMENT_MAX_BYTES ||
      stat.mode & 0o077
    )
      fail(503, 'This file is currently unavailable.');
  } catch (error) {
    await fd?.close().catch(() => {});
    if (error instanceof FilesError) throw error;
    fail(503, 'This file is currently unavailable.');
  }
  let closed = false,
    position = 0,
    timer;
  const close = async () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    await fd.close().catch(() => {});
  };
  const stream = new ReadableStream({
    start(controller) {
      timer = setTimeout(() => {
        controller.error(new Error('Download timed out.'));
        void close();
      }, options.downloadTimeoutMs ?? 120000);
      timer.unref?.();
    },
    async pull(controller) {
      if (closed) return;
      try {
        const buffer = Buffer.alloc(Math.min(65536, file.byte_size - position));
        const { bytesRead } = await fd.read(buffer, 0, buffer.length, position);
        if (closed) return;
        if (!bytesRead && position < file.byte_size) throw new Error('Incomplete file.');
        position += bytesRead;
        if (bytesRead) controller.enqueue(buffer.subarray(0, bytesRead));
        if (position === file.byte_size) {
          controller.close();
          await close();
        }
      } catch {
        if (!closed) controller.error(new Error('File read failed.'));
        await close();
      }
    },
    cancel: close,
  });
  return { stream, name: file.original_name, byteSize: file.byte_size };
}
