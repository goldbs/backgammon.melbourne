(() => {
  'use strict';
  // Participant-authorised public handles. These are not Galaxy-verified identities.
  const profiles = new Map([
    ['steven goldberg', { username: 'goldbs', profileUrl: 'https://www.backgammongalaxy.com/play/page_profile?id=6566e056a5e9320025e57b77' }]
  ]);
  const standings = document.getElementById('standingsBody');
  if (!standings) return;

  function decorate() {
    for (const row of standings.rows) {
      const nameCell = row.cells[1];
      if (!nameCell || nameCell.dataset.galaxyUsername) continue;
      const name = nameCell.textContent.trim();
      const profile = profiles.get(name.toLowerCase());
      const username = profile?.username;
      if (!username || !/^[a-z0-9_]{3,15}$/.test(username)) continue;
      nameCell.dataset.galaxyUsername = username;
      const line = document.createElement('span');
      line.className = 'flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] font-medium text-slateNavy';
      const label = document.createElement('span');
      label.textContent = 'Galaxy';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'underline underline-offset-2 hover:text-terracotta';
      copy.textContent = username;
      copy.title = `Copy ${name}’s Galaxy username`;
      copy.setAttribute('aria-label', `Copy Galaxy username ${username} for ${name}`);
      const feedback = document.createElement('span');
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');
      let timer;
      copy.addEventListener('click', async () => {
        clearTimeout(timer);
        try {
          await navigator.clipboard.writeText(username);
          feedback.textContent = 'Copied';
        } catch (_) {
          feedback.textContent = `Copy manually: ${username}`;
        }
        timer = setTimeout(() => { feedback.textContent = ''; }, 2500);
      });
      const open = document.createElement('a');
      open.href = profile.profileUrl;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      open.className = 'underline underline-offset-2 hover:text-terracotta';
      open.textContent = 'View profile ↗';
      open.title = `${name}’s Galaxy profile (${username}); Galaxy may require sign-in`;
      open.setAttribute('aria-label', `View ${name}’s Galaxy profile: ${username}`);
      line.append(label, copy, open, feedback);
      nameCell.append(line);
    }
  }
  // Leaderboard rows are replaced after the initial fetch and subsequent result updates.
  new MutationObserver(decorate).observe(standings, { childList: true, subtree: true });
  decorate();
})();
