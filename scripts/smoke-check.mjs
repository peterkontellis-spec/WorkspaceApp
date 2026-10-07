import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// HTTP checks only. These do not execute browser JavaScript or verify the UI.
// Run against this project's local dev or production server on port 3100.
const origin = 'http://127.0.0.1:3100';
const pages = [
  ['/home', 'Welcome back, Alex.'],
  ['/home?task=t1', 'Welcome back, Alex.'],
  ['/boards', 'Boards'],
  ['/boards/website-refresh', 'Website refresh'],
  ['/boards/website-refresh?q=launch&status=In+progress&task=t1', 'Website refresh'],
  ['/boards/team-operations', 'Team operations'],
  ['/docs', 'Docs'],
  ['/docs/launch-brief', 'Launch brief'],
  ['/docs/launch-brief?returnTo=%2Fboards%2Fwebsite-refresh%3Ftask%3Dt1', 'Launch brief'],
  ['/docs/content-outline', 'Content outline'],
  ['/docs/weekly-notes', 'Weekly notes'],
];
const unknownPages = ['/unknown', '/boards/missing-board', '/docs/missing-doc', '/home/extra'];
let cookie = '';
if (process.env.WORKSPACE_SMOKE_CREDENTIALS_FILE) {
  const credentials = JSON.parse(await readFile(process.env.WORKSPACE_SMOKE_CREDENTIALS_FILE, 'utf8'));
  const response = await fetch(`${origin}/api/auth/sign-in/email`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(credentials) });
  assert.equal(response.status, 200, 'Smoke account sign-in failed');
  cookie = response.headers.getSetCookie().map((part) => part.split(';')[0]).join('; ');
}
let passed = 0;
let failed = 0;

async function request(path) {
  return fetch(new URL(path, origin), { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
}

async function check(name, verify) {
  try {
    await verify();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`);
  }
}

if (cookie) await check('signed-out account and workspace requests are denied', async () => {
  const denied = await fetch(`${origin}/api/account`);
  assert.equal(denied.status, 401);
  for (const path of ['/home', '/overview', '/time']) {
    const page = await fetch(`${origin}${path}`, { redirect: 'manual' });
    assert.equal(page.status, 307);
    assert.ok(page.headers.get('location').includes('/sign-in'));
    assert.ok(!(await page.text()).includes('Prepare launch brief'));
  }
});

await check('account forms fail safely before scripts load', async () => {
  for (const path of ['/sign-in', '/reset-password?token=qa-invalid-token']) {
    const html = await (await fetch(origin + path)).text();
    assert.match(html, /<form[^>]*method="post"/i);
    assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""/i);
    assert.ok(html.includes('JavaScript is required'));
  }
});

await check('root redirects to Home', async () => {
  const response = await request('/');
  assert.ok([307, 308].includes(response.status), `Expected redirect, got ${response.status}`);
  assert.equal(new URL(response.headers.get('location'), origin).pathname, '/home');
});

const checkedPages = cookie ? pages.filter(([path]) => !path.includes('/boards/') && path !== '/home?task=t1').map(([path, heading]) => [path, path === '/home' ? 'Your workspace' : heading]) : pages;
if (cookie) checkedPages.push(['/overview', 'Overview'], ['/time', 'Time'], ['/templates', 'Templates']);
for (const [path, heading] of checkedPages) {
  await check(path, async () => {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    const html = await response.text();
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<!--[\s\S]*?-->/g, '');
    assert.equal(h1, heading, 'Expected page heading in server-rendered HTML');
    assert.ok(html.includes(cookie ? (path.startsWith('/docs') ? 'Docs draft · storage not connected' : 'Saved work · local database') : 'Prototype · sample data'), 'Missing accurate persistence disclosure');
    assert.ok(html.includes('id="main-content"'), 'Missing main landmark target');
    assert.ok(html.includes('Assistant — Later'), 'Missing planned assistant navigation');
    if (path.includes('task=t1')) {
      assert.ok(html.includes('date-picker-trigger'), 'Missing in-page date control');
      assert.doesNotMatch(html, /<input[^>]*type="date"/, 'Native date popup must not be used');
    }
    if (path.startsWith('/boards/website-refresh')) {
      const rows = html.match(/<li class="board-task(?: |")/g) ?? [];
      assert.equal(rows.length, path.includes('q=launch') ? 1 : 6, 'Board filters must affect rendered task rows');
    }
    if (cookie && path.startsWith('/docs')) { assert.ok(html.includes('Document storage is not connected yet.')); assert.doesNotMatch(html, /<textarea/, 'Deferred Docs must not accept unsaved writing'); }
    if (!cookie && path.startsWith('/docs/')) {
      assert.match(html, /<textarea[^>]*id="document-body"/, 'Missing document writing surface');
      if (!cookie && path.includes('returnTo=')) assert.match(html, /<a[^>]*href="\/boards\/website-refresh\?task=t1"[^>]*>[\s\S]*?Back to task<\/a>/, 'Missing contextual return link');
    }
    if (path === '/home?task=t1') {
      assert.ok(html.includes('task-panel-title'), 'Missing selected-task detail');
      assert.ok(html.includes('name="task-notes"'), 'Missing task notes');
    }
  });
}

for (const path of unknownPages) {
  await check(`not found: ${path}`, async () => {
    const response = await request(path);
    assert.equal(response.status, 404);
    // Next may deliver this error boundary through its client payload instead
    // of an HTML anchor. Verify recovery-link rendering/clicks in the browser.
    await response.arrayBuffer();
  });
}


if (cookie) {
  await check('Notifications page and updates API respect account boundaries', async () => {
    const page = await request('/notifications'); assert.equal(page.status, 200);
    assert.match(await page.text(), /<h1>Notifications<\/h1>/);
    const response = await request('/api/updates'); assert.equal(response.status, 200);
    const data = await response.json(); assert.ok(Array.isArray(data.items));
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal((await fetch(`${origin}/api/updates`)).status, 401);
    assert.equal((await request('/notifications/unexpected')).status, 404);
  });
  await check('Files page and API respect account boundaries', async () => {
    const page = await request('/files'); assert.equal(page.status, 200);
    assert.match(await page.text(), /Attachments saved with/);
    const response = await request('/api/files'); assert.equal(response.status, 200);
    assert.ok(Array.isArray((await response.json()).files));
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal((await fetch(`${origin}/api/files`)).status, 401);
    assert.equal((await request('/files/unexpected')).status, 404);
  });
  await check('time API respects account boundaries and returns saved totals', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const path = `/api/time?from=${today}&to=${today}&timeZone=UTC`;
    const response = await request(path); assert.equal(response.status, 200);
    const data = await response.json(); assert.ok(data.actor.id); assert.ok(Array.isArray(data.entries));
    assert.ok(Number.isFinite(data.summary.totalSeconds));
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal((await fetch(origin + path)).status, 401);
    assert.equal((await request('/time/unexpected')).status, 404);
  });
  await check('template library respects account boundaries', async () => {
    const response = await request('/api/templates'); assert.equal(response.status, 200);
    const data = await response.json(); assert.ok(data.actor.id); assert.ok(Array.isArray(data.templates)); assert.ok(Array.isArray(data.archivedTemplates));
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal((await fetch(`${origin}/api/templates`)).status, 401);
    assert.equal((await request('/templates/unexpected')).status, 404);
  });
  await check('work API returns only the authenticated workspace', async () => {
    const response = await request('/api/work'); assert.equal(response.status, 200);
    const data = await response.json(); assert.ok(data.actor.id); assert.ok(Array.isArray(data.boards)); assert.ok(Array.isArray(data.tasks)); assert.ok(Number.isInteger(data.unreadNotifications) && data.unreadNotifications >= 0);
    assert.equal((await fetch(`${origin}/api/work`)).status, 401);
    assert.match(response.headers.get('cache-control'), /no-store/);
  });
  await check('sample board URLs do not masquerade as saved boards', async () => {
    assert.equal((await request('/boards/website-refresh')).status, 404);
  });
  await check('database readiness is available without exposing records', async () => {
    const response = await fetch(`${origin}/api/health`); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: 'ready' });
  });
  await check('team page is protected and available to a signed-in account', async () => {
    const response = await request('/team');
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('Team access'));
    assert.equal((await fetch(`${origin}/api/team`)).status, 401);
  });
  await check('invalid invitations fail without exposing membership', async () => {
    const response = await fetch(`${origin}/api/invitations?token=invalid`);
    assert.equal(response.status, 400);
    assert.match(response.headers.get('cache-control'), /no-store/);
  });
}
console.log(`\n${passed} passed; ${failed} failed. HTTP only; browser acceptance remains separate.`);
if (failed) process.exitCode = 1;
