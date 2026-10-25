import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const raw = process.env.CLASP_CREDENTIALS;
if (!process.env.RUNNER_TEMP || !raw) throw new Error('Add the CLASP_CREDENTIALS repository secret in GitHub Settings → Secrets and variables → Actions. Do not send it in chat.');
const parsed = JSON.parse(raw);
if (!parsed.tokens?.default?.refresh_token) throw new Error('Use the complete private clasp 3.4.1 auth file produced by the documented login command.');
writeFileSync(join(process.env.RUNNER_TEMP, '.mba-clasprc.json'), raw, { mode: 0o600 });
console.log('Google credential file prepared privately for this runner.');
