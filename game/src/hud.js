// The DOM HUD: health, ammo, timer, score, money, alive counts,
// objective line, plant/defuse bar, hitmarker, damage flash, kill feed,
// buy menu and the start/pause/end overlays. It never touches the
// simulation; main.js pushes numbers into it.
import { BUY_ITEMS } from './weapon.js';

const SCREENS = {
  start: { title: 'EMBER YARD', copy: 'Vanguard attack. Plant the charge at Site A or B, or eliminate the Rustjackals. First to 5 rounds wins.', action: 'Click to play' },
  paused: { title: 'EMBER YARD', copy: 'Paused. Click to resume.', action: 'Click to resume' },
  round: { title: 'Round over', copy: '', action: 'Next round' },
  end: { title: 'Match over', copy: '', action: 'Play again' },
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), title = $('overlay-title'), copy = $('overlay-copy'), play = $('play');
  const ammo = $('ammo'), ammoMag = $('ammo-mag'), ammoReserve = $('ammo-reserve');
  const healthEl = $('health'), timerEl = $('timer'), scoreEl = $('score-value');
  const moneyEl = $('money'), aliveEl = $('alive'), objEl = $('objective');
  const barWrap = $('progress-wrap'), barFill = $('progress-fill'), barLabel = $('progress-label');
  const feed = $('killfeed'), buy = $('buy'), buyList = $('buy-list'), hitmarker = $('hitmarker');
  const damageFlash = $('damage-flash');
  const weaponEl = $('weapon-name');
  const banner = $('banner'), bannerTitle = $('banner-title'), bannerSub = $('banner-sub');
  const crosshair = $('crosshair');
  let hitTimer = 0, damageTimer = 0, bannerTimer = 0, last = {};
  function writeText(el, key, value) { if (last[key] !== value) { last[key] = value; el.textContent = value; } }
  return {
    setAmmo(mag, reserve, name) {
      writeText(ammoMag, 'mag', String(mag)); writeText(ammoReserve, 'res', `/ ${reserve}`);
      writeText(weaponEl, 'gun', name);
      ammo.classList.toggle('empty', mag === 0);
    },
    setHealth(hp, armor) { writeText(healthEl, 'hp', `HP ${Math.ceil(hp)}${armor > 0 ? ` +${Math.ceil(armor)}` : ''}`); },
    setTimer(seconds, planted) {
      const s = Math.max(0, Math.ceil(seconds));
      writeText(timerEl, 't', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${planted ? ' DET' : ''}`);
      timerEl.classList.toggle('urgent', s <= 15);
    },
    setScore(v, r) { writeText(scoreEl, 'score', `${v} — ${r}`); },
    setMoney(m) { writeText(moneyEl, 'money', `$${m}`); },
    setAlive(v, r) { writeText(aliveEl, 'alive', `V ${v} · R ${r}`); },
    setObjective(text) { writeText(objEl, 'obj', text); },
    setRound(round) { writeText($('round-label'), 'round', `ROUND ${round}`); },
    // The round-end banner: the result line stays on screen while the
    // next round is staged, so the outcome reads without opening the
    // pause overlay.
    showBanner(title, sub) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub || '';
      banner.classList.add('on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.remove('on'), 4500);
    },
    hideBanner() { banner.classList.remove('on'); clearTimeout(bannerTimer); },
    // The crosshair opens up as spread grows: firing on the move, or a
    // hot barrel, is visible before the shots miss.
    setCrosshair(spread) {
      const gap = Math.round(Math.min(11, 3 + spread * 260));
      crosshair.style.setProperty('--gap', `${gap}px`);
    },
    setProgress(label, frac) {
      if (!label) { barWrap.hidden = true; return; }
      barWrap.hidden = false;
      writeText(barLabel, 'plabel', label);
      barFill.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => { hitmarker.classList.remove('on'); hitmarker.style.transform = ''; }, holdMs);
    },
    // Brief red vignette when the player takes damage, so a hit reads
    // even when the shooter is off-screen.
    flashDamage() {
      damageFlash.classList.add('on');
      clearTimeout(damageTimer);
      damageTimer = setTimeout(() => damageFlash.classList.remove('on'), 180);
    },
    killFeed(text) {
      const line = document.createElement('div');
      line.textContent = text;
      feed.prepend(line);
      while (feed.children.length > 5) feed.removeChild(feed.lastChild);
      setTimeout(() => line.remove(), 6000);
    },
    showOverlay(mode, detail) {
      const text = SCREENS[mode];
      title.textContent = text.title;
      copy.textContent = detail || text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() { overlay.hidden = true; },
    onPlay(handler) { play.addEventListener('click', handler); },
    showBuy(money, onBuy) {
      buy.hidden = false;
      buyList.innerHTML = '';
      for (const item of BUY_ITEMS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'buy-item';
        btn.textContent = `${item.label} — $${item.price}`;
        btn.disabled = money < item.price;
        btn.addEventListener('click', () => onBuy(item.id));
        buyList.appendChild(btn);
      }
    },
    hideBuy() { buy.hidden = true; },
    updateBuy(money) {
      for (const btn of buyList.children) {
        const price = Number(btn.textContent.match(/\$(\d+)/)?.[1] || 0);
        btn.disabled = money < price;
      }
    },
  };
}
