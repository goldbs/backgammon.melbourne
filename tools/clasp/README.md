# Apps Script deployment

The members carousel is website-only and does not require Apps Script changes.
This tooling deploys `apps-script/Code.gs` to the existing spreadsheet-bound project and existing web-app URL. Google authorisation is required before deployment can be verified or used.

## One-time setup on your Mac

1. Sign into the Google account that owns the existing MBA Apps Script deployment. Enable **Google Apps Script API** at https://script.google.com/home/usersettings.
2. Install Node.js 24 LTS from https://nodejs.org if `node --version` is unavailable. In Terminal run:

   ```sh
   npx --yes @google/clasp@3.4.1 --auth "$HOME/.mba-clasp-auth.json" login
   ```

   Complete the Google sign-in in the browser. Review the requested permissions. Use the existing deployment owner's account.
3. Open the resulting private file:

   ```sh
   open -a TextEdit "$HOME/.mba-clasp-auth.json"
   ```

   Copy its entire contents into a **new repository secret** named `CLASP_CREDENTIALS` at https://github.com/goldbs/backgammon.melbourne/settings/secrets/actions. Do not paste this file into chat, upload it to the repository, or put it in an ordinary variable.
4. Open https://github.com/goldbs/backgammon.melbourne/actions/workflows/deploy-apps-script.yml and choose **Run workflow**, using branch **main**. The workflow log should finish with the public-backend check passing.

After setup, changes to the Apps Script source or deployment tooling on `main` automatically run this workflow. Ordinary website-only changes continue through Cloudflare without an Apps Script deployment. Until the secret is configured, an Apps Script workflow run will fail with a setup message; the live backend remains unchanged.

If login reports a permissions or API error, share the error message only. If access is revoked or the refresh token expires, repeat login and replace the GitHub secret. Google Account security settings allow revoking clasp access.

## How deployment works

The pinned clasp dependency is installed using `npm ci --prefix tools/clasp`. The helper clones the existing remote project into temporary staging, verifies the existing versioned deployment, preserves the actual manifest and every extra source file, and replaces only `Code.gs` (or Google's downloaded `Code.js`). It saves the remote draft as an immutable version before uploading, creates a new version, and updates the same deployment ID. The live URL does not change. The final check reads the public feed without submitting matches, member applications or emails.

Do not run bare `clasp push` from the repository: clasp replaces the remote file set, and the repository intentionally does not contain a guessed manifest or every remote file. Use this helper. Avoid editing the Apps Script editor while a deployment is running. The helper preserves extra files but does not merge concurrent editor changes.

## Local commands

```sh
npm ci --prefix tools/clasp --no-audit --no-fund
node --test tools/clasp/deploy.test.mjs tests/events-backend.test.cjs
node tools/clasp/deploy.mjs --plan
CLASP_AUTH_FILE="$HOME/.mba-clasp-auth.json" node tools/clasp/deploy.mjs --check
CLASP_AUTH_FILE="$HOME/.mba-clasp-auth.json" node tools/clasp/deploy.mjs --deploy
```

`--plan` is offline. `--check` clones and checks without changing the remote project. `--deploy` writes code and updates the production backend. Credentials are ignored by Git and excluded from Cloudflare's static assets; GitHub writes the secret to a private temporary runner file and removes it after the run.

The workflow records the previous live version and backup version numbers. To roll back, use Apps Script **Deploy → Manage deployments → Edit**, select the previous version and deploy. Changing the selected version preserves the web-app URL. If deployment succeeds but the public check fails, inspect the workflow and roll back as needed; rollback is not automatic.

This setup grants code-deployment access. It does not connect a Google Sheets editing tool to this chat.
