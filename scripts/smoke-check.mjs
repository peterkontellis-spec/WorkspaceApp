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
  const page = await fetch(`${origin}/home`, { redirect: 'manual' });
  assert.equal(page.status, 307);
  assert.ok(page.headers.get('location').includes('/sign-in'));
  assert.ok(!(await page.text()).includes('Prepare launch brief'));
});

await check('root redirects to Home', async () => {
  const response = await request('/');
  assert.ok([307, 308].includes(response.status), `Expected redirect, got ${response.status}`);
  assert.equal(new URL(response.headers.get('location'), origin).pathname, '/home');
});

for (const [path, heading] of pages) {
  await check(path, async () => {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    const html = await response.text();
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<!--[\s\S]*?-->/g, '');
    assert.equal(h1, heading, 'Expected page heading in server-rendered HTML');
    assert.ok(html.includes('Prototype · sample data'), 'Missing prototype disclosure');
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
    if (path.startsWith('/docs/')) {
      assert.match(html, /<textarea[^>]*id="document-body"/, 'Missing document writing surface');
      if (path.includes('returnTo=')) assert.match(html, /<a[^>]*href="\/boards\/website-refresh\?task=t1"[^>]*>[\s\S]*?Back to task<\/a>/, 'Missing contextual return link');
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

console.log(`\n${passed} passed; ${failed} failed. HTTP only; browser acceptance remains separate.`);
if (failed) process.exitCode = 1;
