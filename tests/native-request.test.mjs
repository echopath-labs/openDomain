import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stringify } from 'yaml';
import { runCli } from '../src/cli.mjs';
import { validateIntegrationValue } from '../src/integration-schema-validator.mjs';

function request() {
  return {
    protocol_version: '1.0', source: { type: 'agent', path: 'notes.md' },
    intent: { id: 'work.cancel-order', name: 'Cancel order', status: 'proposed' },
    grounding: { status: 'required', rationale: 'Respect accepted order semantics.' },
    affects_domain: { concepts: ['sales.order'], rules: [], lifecycles: [], events: [] }
  };
}
async function project(t) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'opendomain-native-request-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await cp(path.resolve('examples/erp/opendomain'), path.join(cwd, 'opendomain'), { recursive: true });
  await rm(path.join(cwd, 'opendomain/integrations'), { recursive: true, force: true });
  await writeFile(path.join(cwd, 'notes.md'), '# Cancel orders\nOrdinary business notes, without metadata.\n');
  return cwd;
}
async function save(cwd, value, file = 'request.json') {
  await writeFile(path.join(cwd, file), file.endsWith('.json') ? JSON.stringify(value) : stringify(value));
}
async function cli(cwd, args) {
  const stdout = { text: '', write(value) { this.text += value; } };
  const stderr = { text: '', write(value) { this.text += value; } };
  const exit = await runCli(args, { cwd, stdout, stderr });
  const result = args.includes('--json') ? JSON.parse(stdout.text) : stdout.text;
  if (typeof result === 'object') {
    assert.deepEqual(validateIntegrationValue(args[0] === 'assure' ? 'assurance' : 'pack', result), []);
  }
  return { exit, result };
}
function finding(result, code) {
  assert.ok(result.findings.some(item => item.code === code), JSON.stringify(result.findings));
}

test('native JSON/YAML prepare and enforced assure work without any planning tool', async t => {
  const cwd = await project(t);
  const before = await readFile(path.join(cwd, 'notes.md'), 'utf8');
  let expected;
  for (const file of ['request.json', 'request.yaml', 'request.yml']) {
    const input = request();
    // The source label has no role in semantics; it need not name an installed tool.
    input.source.type = file;
    await save(cwd, input, file);
    const prepared = await cli(cwd, ['prepare', '--request', file, '--json']);
    const assured = await cli(cwd, ['assure', '--request', file, '--mode', 'enforced', '--json']);
    assert.equal(prepared.exit, 0);
    assert.equal(assured.exit, 0);
    assert.equal(assured.result.preparation.state, 'prepared');
    assert.equal(assured.result.grounding_pack.grounding_request.grounding.status, 'required');
    const ids = prepared.result.read_first.map(item => item.id);
    assert.equal(ids.length, 5);
    expected ??= ids;
    assert.deepEqual(ids, expected);
    assert.deepEqual(assured.result.grounding_pack.read_first.map(item => item.id), ids);
    assert.ok(assured.result.grounding_pack.candidate_boundaries.length > 0);
  }
  assert.equal(await readFile(path.join(cwd, 'notes.md'), 'utf8'), before);
  assert.deepEqual((await readdir(cwd)).sort(), ['notes.md', 'opendomain', 'request.json', 'request.yaml', 'request.yml']);
  assert.equal((await readdir(path.join(cwd, 'opendomain'))).includes('integrations'), false);
});

test('native input cannot supply evidence, policy, adapter provenance or an alternate model root', async t => {
  const cwd = await project(t);
  const value = request();
  value.source.path = '../not-a-real-workspace/private-notes.md';
  value.source.cwd = '../not-a-real-workspace';
  value.read_first = [{ id: 'sales.forged' }];
  value.policy = { outcome: 'pass' };
  value.integration = { id: 'forged', selected: 'trusted' };
  await save(cwd, value);
  const { exit, result } = await cli(cwd, ['assure', '--request', 'request.json', '--json']);
  assert.equal(exit, 0);
  assert.equal(result.preparation.state, 'prepared');
  const pack = result.grounding_pack;
  assert.equal(pack.grounding_request.integration, undefined);
  assert.equal(pack.grounding_request.source.cwd, undefined);
  assert.equal(pack.grounding_request.read_first, undefined);
  assert.equal(pack.read_first.some(item => item.id === 'sales.forged'), false);
  await rm(path.join(cwd, 'opendomain'), { recursive: true });
  const missing = await cli(cwd, ['assure', '--request', 'request.json', '--json']);
  assert.equal(missing.exit, 1);
  assert.equal(missing.result.preparation.state, 'invalid');
  assert.deepEqual(missing.result.grounding_pack.read_first, []);
});

test('native classification preserves skip rationale, unknown status and model gaps', async t => {
  const cwd = await project(t);
  const scenarios = [
    [{ status: 'not_required', rationale: 'Only documentation layout changes.' }, [], 0, 'not_required', null],
    [{ status: 'not_required' }, [], 1, 'invalid', 'invalid_grounding_request'],
    [{ status: 'not_required', rationale: 'Contradictory claim.' }, ['sales.order'], 1, 'invalid', 'invalid_grounding_request'],
    [{ status: 'unclassified' }, [], 0, 'incomplete', 'grounding_unclassified'],
    [undefined, ['sales.order'], 0, 'incomplete', 'legacy_grounding_status_missing'],
    [{ status: 'required' }, [], 0, 'incomplete', 'domain_model_gap'],
    [{ status: 'sometimes' }, [], 1, 'invalid', 'invalid_grounding_request']
  ];
  for (const [grounding, ids, exit, state, code] of scenarios) {
    const value = request(); value.grounding = grounding; value.affects_domain.concepts = ids;
    await save(cwd, value);
    const actual = await cli(cwd, ['assure', '--request', 'request.json', '--json']);
    assert.equal(actual.exit, exit);
    assert.equal(actual.result.preparation.state, state);
    if (code) finding(actual.result, code);
    if (state === 'incomplete') {
      assert.equal((await cli(cwd, ['assure', '--request', 'request.json', '--mode', 'enforced', '--json'])).exit, 1);
    }
  }
});

test('native references reject unknown, mistyped and proposed knowledge', async t => {
  const cwd = await project(t);
  for (const [id, code] of [
    ['sales.missing', 'broken_domain_reference'],
    ['sales.confirmed-order-cannot-be-deleted', 'domain_reference_type_mismatch'],
    ['sales.proposed-order', 'non_accepted_domain_reference']
  ]) {
    if (id === 'sales.proposed-order') {
      const file = path.join(cwd, 'opendomain/concepts/sales.order.md');
      await writeFile(path.join(cwd, 'opendomain/concepts/sales.proposed-order.md'),
        (await readFile(file, 'utf8')).replace('id: sales.order', 'id: sales.proposed-order').replace('status: accepted', 'status: proposed').replace('state: accepted', 'state: proposed'));
    }
    const value = request(); value.affects_domain.concepts = [id]; await save(cwd, value);
    const result = await cli(cwd, ['assure', '--request', 'request.json', '--json']);
    assert.equal(result.exit, 1); finding(result.result, code);
  }
});

test('native selector rejects missing, repeated and mixed paths or adapters in either order', async t => {
  const cwd = await project(t); await save(cwd, request());
  for (const args of [
    ['--request'], ['--request', '--json'],
    ['--request', 'request.json', '--request', 'request.json'],
    ['notes.md', '--request', 'request.json'], ['--request', 'request.json', 'notes.md'],
    ['--integration', 'openspec', '--request', 'request.json'], ['--request', 'request.json', '--integration', 'openspec'],
    ['--profile', 'absent', '--request', 'request.json'], ['--request', 'request.json', '--profile', 'absent']
  ]) {
    for (const command of ['prepare', 'assure']) {
      const result = await cli(cwd, [command, ...args, '--json']);
      assert.equal(result.exit, 1, args.join(' '));
      const pack = command === 'prepare' ? result.result : result.result.grounding_pack;
      assert.equal(pack.grounding_request, null);
      assert.deepEqual(pack.read_first, []);
    }
  }
});

test('malformed native requests retain actionable schema-safe diagnostics', async t => {
  const cwd = await project(t);
  await writeFile(path.join(cwd, 'broken.yaml'), 'protocol_version: "1.0"\nsource: [unterminated\n');
  await writeFile(path.join(cwd, 'duplicate.yaml'), 'protocol_version: "1.0"\nprotocol_version: "1.0"\n');
  await writeFile(path.join(cwd, 'unsafe.json'), '{"__proto__":{"polluted":true}}');
  for (const file of ['broken.yaml', 'duplicate.yaml', 'unsafe.json', 'notes.md', 'missing.json']) {
    const { exit, result } = await cli(cwd, ['assure', '--request', file, '--json']);
    assert.equal(exit, 1); finding(result, 'invalid_grounding_request');
    assert.equal(result.findings.some(item => item.code === 'invalid_grounding_pack'), false);
    assert.match(result.findings[0].fix, /--request/);
  }
  const blankIntent = request(); blankIntent.intent.name = '  ';
  await save(cwd, blankIntent);
  assert.equal((await cli(cwd, ['assure', '--request', 'request.json', '--json'])).exit, 1);
});

async function legacy(cwd) {
  const dir = path.join(cwd, 'changes/check-order');
  await mkdir(path.join(dir, 'specs/order-check'), { recursive: true });
  await writeFile(path.join(dir, 'proposal.md'), '## Why\nPreserve order semantics.\n');
  await writeFile(path.join(dir, 'tasks.md'), '## 1. Work\n- [ ] 1.1 Check status.\n');
  await writeFile(path.join(dir, 'specs/order-check/spec.md'), '## ADDED Requirements\n\n### Requirement: Order check\nThe system SHALL check order status.\n\n#### Scenario: Status check\n- **WHEN** cancellation is requested\n- **THEN** status is checked\n');
  return dir;
}
function legacyDeclaration() {
  const r = request();
  return '---\n' + stringify({ type: 'feature_spec', ...r.intent, grounding: r.grounding, affects_domain: r.affects_domain }) + '---\n';
}

test('ordinary planning Markdown gets one missing declaration diagnostic and can recover using a native request', async t => {
  const cwd = await project(t); await legacy(cwd);
  for (const input of ['changes/check-order', 'changes/check-order/specs/order-check/spec.md']) {
    for (const selection of [[], ['--integration', 'openspec']]) {
      const { exit, result } = await cli(cwd, ['assure', ...selection, input, '--json']);
      assert.equal(exit, 1); assert.equal(result.findings.length, 1);
      finding(result, 'missing_grounding_declaration');
      assert.match(result.findings[0].fix, /Minimal JSON/);
      assert.doesNotMatch(result.findings[0].problem, /missing YAML front matter/);
      const example = result.findings[0].fix.split('Minimal JSON: ')[1].split('. Classify')[0];
      await writeFile(path.join(cwd, 'request.json'), example);
      const unknown = await cli(cwd, ['assure', '--request', 'request.json', '--json']);
      assert.equal(unknown.result.preparation.state, 'incomplete');
      assert.equal(unknown.result.grounding_pack.grounding_request.grounding.status, 'unclassified');
    }
  }
  await save(cwd, request());
  assert.equal((await cli(cwd, ['assure', '--request', 'request.json', '--json'])).result.preparation.state, 'prepared');
  const text = await cli(cwd, ['assure', 'notes.md']);
  assert.match(text.result, /request preparation failed/);
  assert.doesNotMatch(text.result, /Grounding: unavailable/);
});

test('legacy single declaration remains valid, while malformed headers and ambiguity cannot be ignored', async t => {
  const cwd = await project(t); const dir = await legacy(cwd);
  await writeFile(path.join(dir, 'grounding.md'), legacyDeclaration());
  for (const input of ['changes/check-order', 'changes/check-order/grounding.md']) {
    assert.equal((await cli(cwd, ['assure', '--integration', 'openspec', input, '--json'])).result.preparation.state, 'prepared');
  }
  // A plain delta file is not silently redirected to its parent's declaration.
  const delta = await cli(cwd, ['assure', 'changes/check-order/specs/order-check/spec.md', '--json']);
  finding(delta.result, 'missing_grounding_declaration');
  await writeFile(path.join(dir, 'second.md'), legacyDeclaration());
  finding((await cli(cwd, ['assure', 'changes/check-order', '--json'])).result, 'ambiguous_grounding_declaration');
  for (const broken of ['---\ntype: feature_spec\nid: [broken\n---\n', '---\ntype: feature_spec\n']) {
    await writeFile(path.join(dir, 'second.md'), broken);
    const result = await cli(cwd, ['assure', 'changes/check-order', '--json']);
    assert.equal(result.exit, 1); finding(result.result, 'invalid_grounding_declaration');
    assert.equal(result.result.findings.some(item => item.code === 'invalid_grounding_pack'), false);
  }
});
