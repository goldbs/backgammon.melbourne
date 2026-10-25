import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deploy, configuration, repository, failureReason } from './deploy.mjs';

function fixture(t, { missingManifest = false, duplicateCode = false, wrongDeployment = false, backupFails = false, symlink = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mba-clasp-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const config = configuration();
  mkdirSync(join(root, 'tools/clasp'), { recursive: true });
  mkdirSync(join(root, 'apps-script'));
  for (const file of ['.clasp.json', 'tools/clasp/deployment.json', 'apps-script/Code.gs']) writeFileSync(join(root, file), readFileSync(join(repository, file)));
  const authFile = join(root, '.fake-auth.json');
  writeFileSync(authFile, '{}');
  const calls = [];
  const manifest = '{\n  "timeZone": "Australia/Melbourne", "runtimeVersion": "V8"\n}\n';
  let stage;
  let versions = 0;
  const run = (args, cwd) => {
    stage = cwd;
    const command = args[args.indexOf('--json') + 1];
    calls.push(command);
    if (command === 'clone-script') {
      assert.ok(!args.includes('--project'), 'clone must not reference a nonexistent project config');
      const content = args[args.indexOf('--rootDir') + 1];
      mkdirSync(content);
      writeFileSync(join(cwd, '.clasp.json'), JSON.stringify({ scriptId: config.scriptId, rootDir: 'content' }));
      if (!missingManifest) writeFileSync(join(content, 'appsscript.json'), manifest);
      writeFileSync(join(content, 'Code.js'), 'old source');
      writeFileSync(join(content, 'Helper.js'), 'keep helper');
      writeFileSync(join(content, 'Email.html'), '<p>keep email</p>');
      if (duplicateCode) writeFileSync(join(content, 'Code.gs'), 'duplicate');
      if (symlink) symlinkSync(join(content, 'Helper.js'), join(content, 'Unsafe.js'));
      return '{}';
    }
    if (command === 'list-deployments') return JSON.stringify([{ deploymentId: wrongDeployment ? 'wrong' : config.deploymentId, versionNumber: 4 }]);
    if (command === 'create-version') {
      if (backupFails) throw new Error('mock backup failure');
      return JSON.stringify({ versionNumber: ++versions + 9 });
    }
    if (command === 'push') {
      assert.equal(readFileSync(join(cwd, 'content/appsscript.json'), 'utf8'), manifest);
      assert.equal(readFileSync(join(cwd, 'content/Helper.js'), 'utf8'), 'keep helper');
      assert.equal(readFileSync(join(cwd, 'content/Email.html'), 'utf8'), '<p>keep email</p>');
      assert.equal(readFileSync(join(cwd, 'content/Code.js'), 'utf8'), config.source);
      assert.ok(!args.includes('--force'));
      return '["Code.js"]';
    }
    if (command === 'update-deployment') {
      assert.equal(args[6], config.deploymentId);
      assert.equal(args[args.indexOf('--versionNumber') + 1], '11');
      return JSON.stringify({ deploymentId: config.deploymentId, versionNumber: 11 });
    }
    throw new Error(`Unexpected mock command ${command}`);
  };
  return { options: { root, authFile, run, log() {} }, calls, getStage: () => stage };
}

test('plan is offline and needs no Google credentials', () => {
  assert.equal(deploy({ mode: 'plan', log() {}, run() { throw new Error('must not run'); } }).mode, 'plan');
});
test('deployment preserves all extra files and manifest, backs up before push, and keeps URL', t => {
  const f = fixture(t);
  const result = deploy({ ...f.options, mode: 'deploy' });
  assert.equal(result.previousLiveVersion, 4);
  assert.equal(result.backupVersion, 10);
  assert.equal(result.version, 11);
  assert.deepEqual(f.calls, ['clone-script', 'list-deployments', 'create-version', 'push', 'create-version', 'update-deployment']);
  assert.equal(existsSync(f.getStage()), false);
});
test('check performs no remote writes', t => {
  const f = fixture(t);
  assert.equal(deploy({ ...f.options, mode: 'check' }).liveVersion, 4);
  assert.deepEqual(f.calls, ['clone-script', 'list-deployments']);
});
for (const [name, flag] of [['missing manifest', 'missingManifest'], ['ambiguous Code files', 'duplicateCode'], ['wrong deployment', 'wrongDeployment'], ['unsafe symlink', 'symlink'], ['failed backup', 'backupFails']]) {
  test(`refuses push for ${name} and cleans staging`, t => {
    const f = fixture(t, { [flag]: true });
    assert.throws(() => deploy({ ...f.options, mode: 'deploy' }));
    assert.ok(!f.calls.includes('push'));
    assert.equal(existsSync(f.getStage()), false);
  });
}
test('missing Google auth fails before invoking clasp', t => {
  const f = fixture(t);
  assert.throws(() => deploy({ ...f.options, authFile: join(tmpdir(), 'nonexistent-mba-auth'), mode: 'deploy' }), /authorisation/);
  assert.deepEqual(f.calls, []);
});

test('diagnostics identify known failures without leaking raw output', () => {
  assert.match(failureReason({ stderr: 'Apps Script API has not been used or it is disabled. PRIVATE_TOKEN' }), /Enable Google Apps Script API/);
  assert.match(failureReason({ stderr: 'invalid_grant PRIVATE_TOKEN' }), /expired or was revoked/);
  assert.match(failureReason({ stderr: 'Requested entity was not found PRIVATE_TOKEN' }), /script project could not be found/);
  assert.ok(!failureReason({ stderr: 'unrecognised PRIVATE_TOKEN' }).includes('PRIVATE_TOKEN'));
});
