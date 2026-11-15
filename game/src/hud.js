// The DOM HUD: health, ammo, timer, score, money, alive counts, objective,
// plant/defuse bar, hitmarker, kill feed, buy menu and the start/pause/end
// overlays. It never touches the simulation; main.js pushes numbers in.
import { BUY_ITEMS } from './weapon.js';

const COPY = {
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
  const weaponEl = $('weapon-name');
  let hitTimer = 0, last = {};
  function setText(el, key, value) { if (last[key] !== value) { last[key] = value; el.textContent = value; } }
  return {
    setAmmo(mag, reserve, name) {
      setText(ammoMag, 'mag', String(mag)); setText(ammoReserve, 'res', `/ ${reserve}`);
      setText(weaponEl, 'gun', name);
      ammo.classList.toggle('empty', mag === 0);
    },
    setHealth(hp, armor) { setText(healthEl, 'hp', `HP ${Math.ceil(hp)}${armor > 0 ? ` +${Math.ceil(armor)}` : ''}`); },
    setTimer(seconds, planted) {
      const s = Math.max(0, Math.ceil(seconds));
      setText(timerEl, 't', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${planted ? ' DET' : ''}`);
      timerEl.classList.toggle('urgent', s <= 15);
    },
    setScore(v, r) { setText(scoreEl, 'score', `${v} — ${r}`); },
    setMoney(m) { setText(moneyEl, 'money', `$${m}`); },
    setAlive(v, r) { setText(aliveEl, 'alive', `V ${v} · R ${r}`); },
    setObjective(text) { setText(objEl, 'obj', text); },
    setRound(round) { setText($('round-label'), 'round', `ROUND ${round}`); },
    setProgress(label, frac) {
      if (!label) { barWrap.hidden = true; return; }
      barWrap.hidden = false;
      setText(barLabel, 'plabel', label);
      barFill.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => { hitmarker.classList.remove('on'); hitmarker.style.transform = ''; }, holdMs);
    },
    killFeed(text) {
      const line = document.createElement('div');
      line.textContent = text;
      feed.prepend(line);
      while (feed.children.length > 5) feed.removeChild(feed.lastChild);
      setTimeout(() => line.remove(), 6000);
    },
    showOverlay(mode, detail) {
      const text = COPY[mode];
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
