import assert from 'node:assert/strict';

// HTTP checks only. These do not execute browser JavaScript or verify the UI.
// Run against this project's local dev or production server on port 3100.
const origin = 'http://127.0.0.1:3100';
const pages = [
  ['/home', 'Welcome back, Alex.'],
  ['/home?task=t1', 'Welcome back, Alex.'],
  ['/boards', 'Boards'],
  ['/boards/website-refresh', 'Website refresh'],
  ['/boards/team-operations', 'Team operations'],
  ['/docs', 'Docs'],
  ['/docs/launch-brief', 'Launch brief'],
  ['/docs/content-outline', 'Content outline'],
  ['/docs/weekly-notes', 'Weekly notes'],
];
const unknownPages = ['/unknown', '/boards/missing-board', '/docs/missing-doc', '/home/extra'];
let passed = 0;
let failed = 0;

async function request(path) {
  return fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
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
