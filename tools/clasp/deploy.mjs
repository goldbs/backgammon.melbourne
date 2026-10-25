import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = text => createHash('sha256').update(text).digest('hex');

export function configuration(root = repository) {
  const project = JSON.parse(readFileSync(join(root, '.clasp.json'), 'utf8'));
  const { deploymentId } = JSON.parse(readFileSync(join(root, 'tools/clasp/deployment.json'), 'utf8'));
  if (!/^[A-Za-z0-9_-]+$/.test(project.scriptId || '') || !/^AKfy[A-Za-z0-9_-]+$/.test(deploymentId || '')) {
    throw new Error('Missing or invalid existing Apps Script/deployment IDs.');
  }
  const source = readFileSync(join(root, 'apps-script/Code.gs'), 'utf8');
  const url = `https://script.google.com/macros/s/${deploymentId}/exec`;
  if (!source.includes(`const SCRIPT_URL = "${url}";`)) throw new Error('Deployment ID does not match the website backend URL.');
  return { scriptId: project.scriptId, deploymentId, source, url };
}

export function overlayCode(contentDir, source) {
  const manifestPath = join(contentDir, 'appsscript.json');
  if (!existsSync(manifestPath) || lstatSync(manifestPath).isSymbolicLink()) throw new Error('Remote manifest is missing or unsafe.');
  const manifest = readFileSync(manifestPath);
  JSON.parse(manifest.toString());
  const candidates = ['Code.gs', 'Code.js'].filter(name => existsSync(join(contentDir, name)));
  if (candidates.length !== 1) throw new Error('Expected exactly one remote Code.gs or Code.js. Inspect the remote project before deploying.');
  const target = candidates[0];
  const before = new Map();
  function inspect(folder, prefix = '') {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Remote staging contains a symlink.');
      const relative = prefix + entry.name;
      if (entry.isDirectory()) inspect(join(folder, entry.name), relative + '/');
      else before.set(relative, hash(readFileSync(join(folder, entry.name))));
    }
  }
  inspect(contentDir);
  writeFileSync(join(contentDir, target), source);
  for (const [name, digest] of before) {
    if (name !== target && hash(readFileSync(join(contentDir, name))) !== digest) throw new Error(`Unexpected change to remote file ${name}.`);
  }
  if (!readFileSync(manifestPath).equals(manifest)) throw new Error('The live manifest must be preserved unchanged.');
  return { target, fileCount: before.size };
}

export function failureReason(error) {
  // Match known failures without printing command output, credentials or source.
  const detail = [error.message, error.stderr, error.stdout].map(value => String(value || '')).join(' ').toLowerCase();
  const reasons = [
    [/script api.*disabled|apps script api.*not.*enabled|accessnotconfigured|service_disabled|script.googleapis.com.*disabled/, 'Enable Google Apps Script API at https://script.google.com/home/usersettings for the signed-in account.'],
    [/invalid_grant|invalid.*refresh.*token|token.*expired|token.*revoked/, 'Google authorisation expired or was revoked. Sign in again and replace CLASP_CREDENTIALS.'],
    [/permission.denied|permission_denied|caller does not have permission|insufficient.*permission|insufficient.*scope|403/, 'Google denied access. Check that the login account owns or can edit this script and that the Apps Script API is enabled.'],
    [/not found|requested entity|404|invalid script id/, 'The script project could not be found. Check the configured script ID against the Apps Script editor URL.'],
    [/project file already exists/, 'clasp found an existing staging project unexpectedly. The deployment helper needs correction.'],
    [/unknown option|unknown command/, 'The installed clasp command rejected a helper option. The deployment helper needs correction.'],
    [/enoent/, 'A required local executable or staging path was not found. The deployment helper needs correction.'],
    [/invalid_client|unauthorized_client/, 'Google rejected the OAuth client. Repeat the documented clasp login and replace CLASP_CREDENTIALS.'],
    [/not logged in|could not load.*credential|no.*credential/, 'clasp could not load the Google login. Replace CLASP_CREDENTIALS with the complete clasp auth file.'],
  ];
  for (const [pattern, message] of reasons) if (pattern.test(detail)) return message;
  return 'Google/clasp returned an unrecognised error. Use the documented local read-only diagnostic to obtain its message privately.';
}

export function deploy({ mode = 'plan', root = repository, authFile = process.env.CLASP_AUTH_FILE, run, log = console.log } = {}) {
  if (!['plan', 'check', 'deploy'].includes(mode)) throw new Error('Use --plan, --check or --deploy.');
  const config = configuration(root);
  if (mode === 'plan') {
    log('Plan: clone the existing project to temporary staging, preserve its manifest/extra files, replace only Code, then update the existing deployment.');
    log(`Project: ${config.scriptId}\nDeployment: ${config.deploymentId}`);
    log('Live deployment is not validated until Google authorisation and --check succeed.');
    return { mode };
  }
  if (!authFile || !existsSync(authFile)) throw new Error('Google authorisation is required. Set CLASP_AUTH_FILE to your private clasp auth file; never paste it into chat.');
  const stage = mkdtempSync(join(tmpdir(), 'mba-clasp-'));
  const contentDir = join(stage, 'content');
  const projectFile = join(stage, '.clasp.json');
  const invoke = run || ((args, cwd) => execFileSync(join(root, 'tools/clasp/node_modules/.bin/clasp'), args, {
    cwd, encoding: 'utf8', env: { ...process.env, CI: 'true' }, stdio: ['ignore', 'pipe', 'pipe']
  }));
  const clasp = args => {
    try {
      const output = invoke(['--auth', resolve(authFile), '--project', projectFile, '--json', ...args], stage);
      return output.trim() ? JSON.parse(output) : {};
    } catch (error) {
      // Avoid dumping credentials or remote file contents from command output.
      throw new Error(`clasp ${args[0]} failed. ${failureReason(error)}`, { cause: error });
    }
  };
  try {
    clasp(['clone-script', config.scriptId, '--rootDir', contentDir]);
    const project = JSON.parse(readFileSync(projectFile, 'utf8'));
    if (project.scriptId !== config.scriptId || resolve(stage, project.rootDir || '.') !== contentDir) throw new Error('Unexpected cloned project settings.');
    const deployments = clasp(['list-deployments']);
    const existing = Array.isArray(deployments) && deployments.find(item => item.deploymentId === config.deploymentId);
    if (!existing || !Number.isInteger(existing.versionNumber)) throw new Error('The configured existing versioned deployment was not found. Nothing has been pushed.');
    const staged = overlayCode(contentDir, config.source);
    log(`Verified staging: ${staged.fileCount} remote files retained; only ${staged.target} replaced; manifest unchanged.`);
    if (mode === 'check') return { mode, ...staged, liveVersion: existing.versionNumber };
    const description = `GitHub ${String(process.env.GITHUB_SHA || 'local').slice(0, 12)}`;
    const backup = clasp(['create-version', `Before ${description}`]);
    if (!Number.isInteger(backup.versionNumber)) throw new Error('Could not establish an immutable pre-push backup. Nothing has been pushed.');
    log(`Pre-push backup version: ${backup.versionNumber}; previous live version: ${existing.versionNumber}`);
    const pushed = clasp(['push']);
    if (!Array.isArray(pushed)) throw new Error('Upload was not confirmed. Existing live deployment remains unchanged.');
    const version = clasp(['create-version', description]);
    if (!Number.isInteger(version.versionNumber)) throw new Error('Source uploaded but no deployment version confirmed. Existing live deployment remains unchanged.');
    const updated = clasp(['update-deployment', config.deploymentId, '--versionNumber', String(version.versionNumber), '--description', description]);
    if (updated.deploymentId !== config.deploymentId || updated.versionNumber !== version.versionNumber) throw new Error('Deployment response did not confirm the requested ID/version.');
    log(`Updated existing deployment to version ${version.versionNumber}. URL unchanged: ${config.url}`);
    return { mode, version: version.versionNumber, backupVersion: backup.versionNumber, previousLiveVersion: existing.versionNumber };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argument = process.argv[2] || '--plan';
    if (process.argv.length > 3 || !['--plan', '--check', '--deploy'].includes(argument)) throw new Error('Usage: node tools/clasp/deploy.mjs [--plan|--check|--deploy]');
    deploy({ mode: argument.slice(2) });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
