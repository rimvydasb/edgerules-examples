// Validates the examples of this repository. Run it with tooling/validate.sh.
//
//   node tooling/validate.mjs [--base <git-ref>] [--root <dir>] [example-id ...]
//
// Checks: schema, format, engine link, tests, references, README, metadata, version, size, secrets.
// --base is the git ref the Version check compares with (default: origin/main; the check is skipped when it is missing).
// --root is the repository to validate (default: the repository of this script).
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, posix, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv';
import {check as prettierCheck} from 'prettier';
import highsLoader from 'highs';
import {MutableDecisionService, mapHighsSolution, toCplexLp} from '@edgerules/node/mutable';
import {
  createProjectFactory,
  exampleFromFiles,
  exampleMetadataOf,
  exampleToFiles,
} from 'edgerules-react/project-session';
import {runTestSuite} from 'edgerules-react/tests-manager';

const MAX_EXAMPLE_BYTES = 1024 * 1024;
const MAX_ASSET_BYTES = 300 * 1024;
const MAX_MODEL_LINES = 5000;
const MAX_DESCRIPTION = 160;

// Features by the model text or the layout that shows them; `validate` checks each listed feature against the model.
const FEATURE_EVIDENCE = {
  type: (dsl) => /^\s*type\s+\w+:/m.test(dsl),
  facts: (dsl) => /^\s*facts\s+\w+/m.test(dsl),
  function: (dsl) => /^\s*func\s+\w+/m.test(dsl),
  'decision-table': (dsl) => /^\s*ruleset\s+\w+/m.test(dsl),
  decision: (dsl) => /^\s*decision\s+\w+/m.test(dsl),
  service: (dsl) => /^\s*service\s+\w+/m.test(dsl),
  workbook: (dsl) => /^\s*workbook\s+\w+/m.test(dsl),
  loop: (dsl) => /^\s*loop\s+\w+/m.test(dsl),
  optimise: (dsl) => /^\s*optimise\s+\w+/m.test(dsl),
  chart: (_dsl, layouts) => Object.values(layouts).some((layout) => (layout.charts ?? []).length > 0),
};

const SECRET_PATTERNS = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, 'private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/, 'Slack token'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'API key'],
  [/(?:password|secret|api[_-]?key|token)\s*[:=]\s*["'][^"']{12,}["']/i, 'credential assignment'],
];

function parseArguments(argv) {
  const options = {base: 'origin/main', root: resolve(dirname(fileURLToPath(import.meta.url)), '..'), ids: []};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') options.base = argv[++i];
    else if (argv[i] === '--root') options.root = resolve(argv[++i]);
    else options.ids.push(argv[i]);
  }
  return options;
}

function readTree(directory, base = directory, files = {}) {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) readTree(path, base, files);
    else files[relative(base, path).split('\\').join('/')] = path;
  }
  return files;
}

function git(root, args) {
  try {
    return execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
  } catch {
    return undefined;
  }
}

function semverCompare(a, b) {
  const split = (v) => v.split('-')[0].split('.').map(Number);
  const [pa, pb] = [split(a), split(b)];
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  const [ra, rb] = [a.split('-')[1], b.split('-')[1]];
  if (ra === rb) return 0;
  if (ra === undefined) return 1;
  if (rb === undefined) return -1;
  return ra < rb ? -1 : 1;
}

function stripCode(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function createSchemaValidators() {
  const directory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'node_modules',
    'edgerules-react',
    'schemas',
  );
  const ajv = new Ajv({allErrors: true, strict: false});
  const load = (name) => ajv.compile(JSON.parse(readFileSync(join(directory, name), 'utf8')));
  return {
    manifest: load('example.schema.json'),
    descriptions: load('descriptions.schema.json'),
    suite: load('test-suite.schema.json'),
    layout: load('layout.schema.json'),
  };
}

const issues = [];
const fail = (id, check, message) => issues.push({id, check, message});

function schemaCheck(id, validate, value, path) {
  if (validate(value)) return;
  for (const error of validate.errors) fail(id, 'Schema', `${path}${error.instancePath} ${error.message}`);
}

async function registerSolver(service) {
  const highs = await highsLoader();
  service.registerSolver(
    (problem) => {
      const options = problem.timeLimit === undefined ? {} : {time_limit: problem.timeLimit / 1000};
      return mapHighsSolution(highs.solve(toCplexLp(problem), options), problem);
    },
    {name: 'highs-js'},
  );
}

async function validateExample({root, base, validators, industries, directory, slug, industryFolder, paths}) {
  const id = slug;
  const files = {};
  const binary = {};
  for (const [path, absolute] of Object.entries(readTree(directory))) {
    if (path.startsWith('assets/')) binary[path] = absolute;
    else files[path] = readFileSync(absolute, 'utf8');
  }

  // --- Schema
  let manifest;
  try {
    manifest = JSON.parse(files['edgerules.project.json']);
  } catch (error) {
    return fail(id, 'Schema', `edgerules.project.json: ${error.message}`);
  }
  schemaCheck(id, validators.manifest, manifest, 'edgerules.project.json');
  if (typeof manifest.description === 'string' && manifest.description.length > MAX_DESCRIPTION) {
    fail(id, 'Schema', `description is longer than ${MAX_DESCRIPTION} characters`);
  }
  const listed = [manifest.model?.source, manifest.documentation, manifest.flow, ...(manifest.tests ?? [])];
  for (const path of listed.filter(Boolean)) {
    if (files[path] === undefined) fail(id, 'Schema', `${path} is listed in the manifest but missing`);
  }
  const json = (path) => {
    try {
      return JSON.parse(files[path]);
    } catch (error) {
      fail(id, 'Schema', `${path}: ${error.message}`);
      return undefined;
    }
  };
  const descriptions = manifest.documentation ? json(manifest.documentation) : undefined;
  if (descriptions) schemaCheck(id, validators.descriptions, descriptions, manifest.documentation);
  const layouts = manifest.flow ? json(manifest.flow) : undefined;
  if (layouts) schemaCheck(id, validators.layout, layouts, manifest.flow);
  const suites = {};
  for (const path of manifest.tests ?? []) {
    const suite = json(path);
    if (!suite) continue;
    schemaCheck(id, validators.suite, suite, path);
    suites[posix.basename(path).replace(/\.tests\.json$/, '')] = suite;
  }

  // --- Format
  for (const [path, text] of Object.entries(files)) {
    if (!/\.(json|md)$/.test(path)) continue;
    if (!(await prettierCheck(text, {filepath: join(directory, path), ...prettierOptions}))) {
      fail(id, 'Format', `${path} is not formatted: run npm run format`);
    }
  }
  let input;
  try {
    input = exampleFromFiles(files);
    const written = exampleToFiles(input, exampleMetadataOf(files));
    for (const path of new Set([...Object.keys(files), ...Object.keys(written)])) {
      if (files[path] !== written[path]) fail(id, 'Format', `${path} differs from the canonical files of the example`);
    }
  } catch (error) {
    return fail(id, 'Format', error.message);
  }

  // --- Engine link
  const dsl = input.model.dsl;
  let service;
  try {
    createProjectFactory({engine: MutableDecisionService}).createBundle(input);
    service = MutableDecisionService.fromCode(dsl);
    const linked = service.link();
    if (linked && typeof linked === 'object' && linked.message) throw new Error(linked.message);
  } catch (error) {
    return fail(id, 'Engine link', error.message ?? String(error));
  }

  try {
    if (manifest.example?.requires?.includes('milp-solver')) await registerSolver(service);

    // --- Tests
    for (const [subject, suite] of Object.entries(suites)) {
      for (const outcome of await runTestSuite(service, subject, suite)) {
        if (!outcome.passed) fail(id, 'Tests', `${subject} / ${outcome.name}: ${outcome.failures.join('; ')}`);
      }
    }

    // --- References
    const exists = (path) => {
      const value = service.get(path);
      return !(value && typeof value === 'object' && value['@kind'] === 'error');
    };
    for (const path of Object.keys(descriptions?.byPath ?? {})) {
      if (path !== '*' && !exists(path)) fail(id, 'References', `description of the missing path '${path}'`);
    }
    for (const subject of Object.keys(suites)) {
      if (subject !== '*' && !exists(subject)) fail(id, 'References', `tests of the missing subject '${subject}'`);
    }
    for (const [root, layout] of Object.entries(layouts?.layouts ?? {})) {
      if (root !== '*' && !exists(root)) fail(id, 'References', `layout of the missing flow root '${root}'`);
      for (const sink of [...layout.outputs, ...(layout.charts ?? [])]) {
        if (sink.source && !exists(sink.source.node)) {
          fail(id, 'References', `${sink.id} of '${root}' points to the missing node '${sink.source.node}'`);
        }
      }
    }

    // --- README
    const readme = files['README.md'];
    if (readme === undefined) fail(id, 'README', 'README.md is missing');
    else {
      const prose = stripCode(readme);
      if (/<\/?[A-Za-z][A-Za-z0-9-]*(\s[^<>]*)?>/.test(prose)) fail(id, 'README', 'README.md contains raw HTML');
      for (const [, target] of prose.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        if (target.startsWith('model:')) {
          const path = decodeURIComponent(target.slice('model:'.length));
          if (!exists(path)) fail(id, 'README', `model: link to the missing path '${path}'`);
        } else if (!/^[a-z][a-z0-9+.-]*:|^#/i.test(target)) {
          const file = target.split('#')[0];
          if (file && !existsSync(join(directory, file))) fail(id, 'README', `broken relative link '${target}'`);
        }
      }
    }

    // --- Metadata
    for (const feature of manifest.example?.features ?? []) {
      const evidence = FEATURE_EVIDENCE[feature];
      if (!evidence) fail(id, 'Metadata', `unknown feature '${feature}'`);
      else if (!evidence(dsl, layouts?.layouts ?? {})) fail(id, 'Metadata', `feature '${feature}' is not in the model`);
    }
    if (Boolean(manifest.example?.requires?.includes('milp-solver')) !== /^\s*optimise\s+\w+/m.test(dsl)) {
      fail(id, 'Metadata', "'milp-solver' must be required exactly when the model has an optimise element");
    }
    if (manifest.example?.thumbnail && !binary[manifest.example.thumbnail]) {
      fail(id, 'Metadata', `thumbnail '${manifest.example.thumbnail}' is missing`);
    }
  } finally {
    service[Symbol.dispose]?.();
  }
  if (!industries.has(manifest.example?.industry))
    fail(id, 'Metadata', `unknown industry '${manifest.example?.industry}'`);
  if (manifest.example?.industry !== industryFolder) {
    fail(id, 'Metadata', `industry '${manifest.example?.industry}' differs from the folder '${industryFolder}'`);
  }
  if (paths.get(slug).length > 1) fail(id, 'Metadata', `duplicate slug in ${paths.get(slug).join(', ')}`);

  // --- Version
  if (base.available) {
    const folder = relative(root, directory).split('\\').join('/');
    const changed = git(root, ['diff', '--name-only', base.mergeBase, '--', folder]);
    const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '--', folder]);
    const before = git(root, ['show', `${base.mergeBase}:${folder}/edgerules.project.json`]);
    if (before !== undefined && (changed?.trim() || untracked?.trim())) {
      const previous = JSON.parse(before).model?.version;
      const current = manifest.model?.version;
      if (previous && current && semverCompare(current, previous) <= 0) {
        fail(
          id,
          'Version',
          `files changed, but model.version ${current} is not greater than ${previous} on ${base.ref}`,
        );
      }
    }
  }

  // --- Size
  const total = [
    ...Object.values(files).map((text) => Buffer.byteLength(text)),
    ...Object.values(binary).map((p) => statSync(p).size),
  ].reduce((a, b) => a + b, 0);
  if (total > MAX_EXAMPLE_BYTES) fail(id, 'Size', `example is ${total} bytes, over ${MAX_EXAMPLE_BYTES}`);
  for (const [path, absolute] of Object.entries(binary)) {
    if (statSync(absolute).size > MAX_ASSET_BYTES) fail(id, 'Size', `${path} is over ${MAX_ASSET_BYTES} bytes`);
  }
  const lines = dsl.split('\n').length - 1;
  if (lines > MAX_MODEL_LINES) fail(id, 'Size', `${manifest.model.source} has ${lines} lines, over ${MAX_MODEL_LINES}`);

  // --- Secrets
  for (const [path, text] of Object.entries(files)) {
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(text)) fail(id, 'Secrets', `${path} contains a ${label}`);
    }
  }
}

const prettierOptions = {};

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const {root} = options;
  Object.assign(prettierOptions, JSON.parse(readFileSync(join(root, '.prettierrc.json'), 'utf8')));
  const validators = createSchemaValidators();

  const industriesFile = JSON.parse(readFileSync(join(root, 'industries.json'), 'utf8'));
  const industries = new Set(industriesFile.map((industry) => industry.id));
  const featured = JSON.parse(readFileSync(join(root, 'featured.json'), 'utf8'));

  const examplesRoot = join(root, 'examples');
  const found = [];
  const paths = new Map();
  for (const industryFolder of readdirSync(examplesRoot).sort()) {
    const folder = join(examplesRoot, industryFolder);
    if (!statSync(folder).isDirectory()) continue;
    for (const slug of readdirSync(folder).sort()) {
      if (!statSync(join(folder, slug)).isDirectory()) continue;
      found.push({directory: join(folder, slug), slug, industryFolder});
      paths.set(slug, [...(paths.get(slug) ?? []), `${industryFolder}/${slug}`]);
    }
  }
  for (const id of featured) {
    if (!paths.has(id)) fail('featured.json', 'Metadata', `unknown featured id '${id}'`);
  }

  const mergeBase = git(root, ['merge-base', 'HEAD', options.base])?.trim();
  const base = {available: Boolean(mergeBase), mergeBase, ref: options.base};
  if (!base.available) console.log(`note: ${options.base} not found; the Version check is skipped`);

  const selected = found.filter((example) => options.ids.length === 0 || options.ids.includes(example.slug));
  for (const example of selected) {
    const before = issues.length;
    await validateExample({root, base, validators, industries, paths, ...example});
    console.log(`${issues.length === before ? '✓' : '✗'} ${example.slug}`);
  }

  for (const {id, check, message} of issues) console.error(`  ${id}: [${check}] ${message}`);
  if (issues.length > 0) {
    console.error(`${issues.length} problem(s) in ${selected.length} example(s)`);
    process.exit(1);
  }
  console.log(`${selected.length} example(s) valid`);
}

await main();
