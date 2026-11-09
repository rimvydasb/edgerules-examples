// Tests of the repository scripts against a fixture repository: a copy of one example with two versions.
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {before, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SLUG = 'loan-repayment';
const EXAMPLE = join('examples', 'financial', SLUG);
const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

const git = (cwd, ...args) => execFileSync('git', args, {cwd, env: ENV, encoding: 'utf8'}).trim();

/** A new repository with the tooling and one example, committed as `main`. */
function fixtureRepository() {
  const dir = mkdtempSync(join(tmpdir(), 'edgerules-examples-'));
  mkdirSync(join(dir, 'tooling'));
  cpSync(join(repo, 'tooling', 'build-index.sh'), join(dir, 'tooling', 'build-index.sh'));
  for (const file of ['industries.json', 'featured.json', '.prettierrc.json'])
    cpSync(join(repo, file), join(dir, file));
  cpSync(join(repo, EXAMPLE), join(dir, EXAMPLE), {recursive: true});
  writeFileSync(join(dir, 'featured.json'), `["${SLUG}"]\n`);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'v1');
  return dir;
}

const manifestPath = (dir) => join(dir, EXAMPLE, 'edgerules.project.json');
const edit = (path, change) => writeFileSync(path, change(readFileSync(path, 'utf8')));
const buildIndex = (dir, ...args) =>
  spawnSync('bash', [join(dir, 'tooling', 'build-index.sh'), ...args], {cwd: dir, env: ENV, encoding: 'utf8'});
const validate = (dir, ...args) =>
  spawnSync('node', [join(repo, 'tooling', 'validate.mjs'), '--root', dir, ...args], {encoding: 'utf8'});

describe('build-index.sh', () => {
  let dir;
  let first;
  let second;
  before(() => {
    dir = fixtureRepository();
    first = git(dir, 'rev-parse', 'HEAD');
    edit(manifestPath(dir), (text) => text.replace('"version": "1.2.0"', '"version": "1.3.0"'));
    git(dir, 'commit', '-qam', 'v2');
    second = git(dir, 'rev-parse', 'HEAD');
  });

  it('lists both versions of the example with their commits, newest first', () => {
    const result = buildIndex(dir);
    assert.equal(result.status, 0, result.stderr);
    const index = JSON.parse(readFileSync(join(dir, 'library.json'), 'utf8'));
    assert.equal(index.generatedFrom, second);
    assert.deepEqual(index.featured, [SLUG]);
    const [entry] = index.examples;
    assert.equal(entry.id, SLUG);
    assert.equal(entry.path, `examples/financial/${SLUG}`);
    assert.deepEqual(
      entry.versions.map(({version, ref}) => [version, ref]),
      [
        ['1.3.0', second],
        ['1.2.0', first],
      ],
    );
    assert.ok(entry.stats.tests > 0 && entry.stats.lines > 0);
  });

  it('gives the same file on a second run, and --check accepts it', () => {
    const before = readFileSync(join(dir, 'library.json'), 'utf8');
    assert.equal(buildIndex(dir).status, 0);
    assert.equal(readFileSync(join(dir, 'library.json'), 'utf8'), before);
    assert.equal(buildIndex(dir, '--check').status, 0);
  });

  it('--check fails when library.json is stale, and --out leaves it alone', () => {
    const stale = join(dir, 'library.json');
    writeFileSync(stale, '{}\n');
    assert.equal(buildIndex(dir, '--check').status, 1);
    const out = join(dir, 'other.json');
    assert.equal(buildIndex(dir, '--out', out).status, 0);
    assert.equal(readFileSync(stale, 'utf8'), '{}\n');
    assert.equal(JSON.parse(readFileSync(out, 'utf8')).examples.length, 1);
  });

  it('warns and gives no ref to a version that is not committed', () => {
    edit(manifestPath(dir), (text) => text.replace('"version": "1.3.0"', '"version": "1.4.0"'));
    const result = buildIndex(dir, '--out', join(dir, 'dirty.json'));
    assert.match(result.stderr, /uncommitted/);
    const [entry] = JSON.parse(readFileSync(join(dir, 'dirty.json'), 'utf8')).examples;
    assert.deepEqual(entry.versions[0], {version: '1.4.0'});
    git(dir, 'checkout', '-q', '--', '.');
  });
});

describe('validate.sh', () => {
  let dir;
  before(() => {
    dir = fixtureRepository();
    git(dir, 'checkout', '-q', '-b', 'change');
  });

  it('passes the unchanged example', () => {
    const result = validate(dir, '--base', 'main');
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });

  it('fails a pull request with a failing test case', () => {
    const suite = join(dir, EXAMPLE, 'tests', 'pricingTier.tests.json');
    const original = readFileSync(suite, 'utf8');
    edit(suite, (text) => text.replace('"prime"', '"subprime"'));
    const result = validate(dir, '--base', 'main');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[Tests\]/);
    writeFileSync(suite, original);
  });

  it('fails a changed example without a greater model.version, and passes with one', () => {
    edit(join(dir, EXAMPLE, 'README.md'), (text) => `${text}\nOne more sentence.\n`);
    const stale = validate(dir, '--base', 'main');
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /\[Version\]/);

    edit(manifestPath(dir), (text) => text.replace('"version": "1.2.0"', '"version": "1.2.1"'));
    const bumped = validate(dir, '--base', 'main');
    assert.equal(bumped.status, 0, bumped.stderr + bumped.stdout);
  });

  it('fails a model path that does not exist in a description', () => {
    const file = join(dir, EXAMPLE, 'docs', 'descriptions.json');
    edit(file, (text) => text.replace('"annualRate"', '"missingRate"'));
    const result = validate(dir, '--base', 'main');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[References\]/);
  });
});
