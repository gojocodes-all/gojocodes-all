import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflows = {
  '.github/workflows/profile-tests.yml': [
    'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
  ],
  '.github/workflows/snake.yml': [
    'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    'Platane/snk/svg-only@d8f6715049803e982ee5ff501b6b9b7d5deeb09b',
    'crazy-max/ghaction-github-pages@c0d7ff0487ee0415efb7f32dab10ea880330b1dd',
  ],
};

for (const [path, expectedActions] of Object.entries(workflows)) {
  test(`${path} pins actions and does not persist checkout credentials`, async () => {
    const source = await readFile(path, 'utf8');
    const actionReferences = [...source.matchAll(/^\s*uses:\s+(\S+)/gm)].map(
      (match) => match[1],
    );

    assert.deepEqual(actionReferences, expectedActions);
    assert.ok(
      actionReferences.every((reference) => /@[0-9a-f]{40}$/.test(reference)),
      'every action must use an immutable commit SHA',
    );
    assert.match(
      source,
      /uses: actions\/checkout@[0-9a-f]{40} # v4\n\s+with:\n\s+persist-credentials: false/,
    );
  });
}

test('pull-request validation keeps read-only repository access', async () => {
  const source = await readFile('.github/workflows/profile-tests.yml', 'utf8');

  assert.match(source, /^permissions:\n  contents: read$/m);
});

test('scheduled publishing requests only repository-content write access', async () => {
  const source = await readFile('.github/workflows/snake.yml', 'utf8');

  assert.match(source, /^    permissions:\n      contents: write$/m);
  assert.doesNotMatch(source, /^\s+(actions|checks|deployments|id-token|issues|packages|pull-requests|security-events):\s+write$/m);
});
