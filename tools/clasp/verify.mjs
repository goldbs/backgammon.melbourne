import { configuration } from './deploy.mjs';
const { url } = configuration();
const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Backend GET returned HTTP ${response.status}.`);
const data = await response.json();
if (!Array.isArray(data.matches) || !Array.isArray(data.members) || data.registration?.version !== 1 || data.eventSubmissionsOpen !== false || data.matchConfirmationVersion !== 2) {
  throw new Error('Backend response does not match the deployed website capabilities.');
}
console.log('Backend GET verified: registration supported, member event submissions closed, independent two-player match confirmations required. No records submitted or emails sent.');
