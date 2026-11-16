// The match, kept in one place: rounds, economy, the charge objective
// and the score. Vanguard (the player plus two bots) attack; Rustjackals
// (four bots) defend. First to five round wins takes the match (best of
// nine). A round ends on elimination, on the charge detonating, on a
// defuse, or on the 100 s timer running out — the defenders win the
// round when the charge was never planted.
import { SITES } from './world.js';

export const ROUND_SECONDS = 100;
export const BUY_SECONDS = 12;
export const PLANT_SECONDS = 3;
export const DEFUSE_SECONDS = 4;
export const DETONATE_SECONDS = 35;
export const WIN_ROUNDS = 5;
export const AWARD = { win: 300, loss: 150, kill: 100, plant: 300 };

export function createMatch() {
  const s = {
    phase: 'buy', // 'buy' | 'live' | 'over'
    round: 1, winsV: 0, winsR: 0,
    timer: BUY_SECONDS, money: 800, kills: 0,
    planted: false, plantSite: null, plantProgress: 0, defuseProgress: 0,
    bombPos: null, detonateLeft: 0, roundWinner: null, roundReason: '',
    matchWinner: null, over: false, message: '',
  };
  function beginRound() {
    s.phase = 'live'; s.timer = ROUND_SECONDS;
    s.planted = false; s.plantSite = null; s.plantProgress = 0;
    s.defuseProgress = 0; s.bombPos = null; s.detonateLeft = 0;
    s.roundWinner = null; s.roundReason = '';
  }
  function finishRound(winner, reason) {
    if (s.phase === 'over') return;
    s.phase = 'over'; s.roundWinner = winner; s.roundReason = reason;
    s.timer = 5;
    if (winner === 'V') { s.winsV += 1; s.money += AWARD.win; }
    else { s.winsR += 1; s.money += AWARD.loss; }
    s.message = winner === 'V'
      ? `Vanguard take round ${s.round} — ${reason}`
      : `Rustjackals take round ${s.round} — ${reason}`;
    if (s.winsV >= WIN_ROUNDS || s.winsR >= WIN_ROUNDS) {
      s.matchWinner = winner; s.over = true;
    }
  }  function nextRound() {
    s.round += 1;
    s.phase = 'buy'; s.timer = BUY_SECONDS;
    s.planted = false; s.plantSite = null; s.plantProgress = 0;
    s.defuseProgress = 0; s.bombPos = null; s.detonateLeft = 0;
    s.roundWinner = null; s.roundReason = '';
  }
  function step(dt, ctx) {
    if (s.phase === 'buy') {
      s.timer -= dt;
      if (s.timer <= 0) beginRound();
      return;
    }
    if (s.phase === 'over') {
      s.timer -= dt;
      if (s.timer <= 0) {
        if (s.over) return; // match over: main.js shows the end overlay
        nextRound();
        ctx.onNextRound?.();
      }
      return;
    }
    // live
    s.timer -= dt;
    const wasLive = s.phase === 'live';
    // Planting: the player holds E inside a site.
    if (!s.planted) {
      if (ctx.planting && ctx.inSite) {
        s.plantProgress += dt;
        if (s.plantProgress >= PLANT_SECONDS) {
          s.planted = true; s.plantSite = ctx.inSite;
          const site = SITES[ctx.inSite];
          s.bombPos = { x: site.x, z: site.z };
          s.detonateLeft = DETONATE_SECONDS;
          s.money += AWARD.plant;
          s.message = `Charge planted at Site ${ctx.inSite} — ${DETONATE_SECONDS}s to detonation`;
          ctx.onPlant?.(ctx.inSite);
        }
      } else s.plantProgress = Math.max(0, s.plantProgress - dt * 2);
    } else {
      s.detonateLeft -= dt;
      if (ctx.defuser) {
        s.defuseProgress += dt;
        if (s.defuseProgress >= DEFUSE_SECONDS) { finishRound('R', 'charge defused'); return; }
      } else s.defuseProgress = Math.max(0, s.defuseProgress - dt * 2);
      if (s.detonateLeft <= 0) { finishRound('V', 'charge detonated'); return; }
    }
    // Elimination ends the round before a plant; after a plant, both
    // teams dead still ends in a detonation for the attackers.
    if (!s.planted) {
      if (ctx.aliveR === 0) { finishRound('V', 'all Rustjackals eliminated'); return; }
      if (ctx.aliveV === 0) { finishRound('R', 'all Vanguard eliminated'); return; }
    } else if (ctx.aliveR === 0 && ctx.aliveV === 0) {
      finishRound('V', 'charge detonated'); return;
    }
    if (s.timer <= 0) {
      if (s.planted) finishRound('V', 'charge detonated');
      else finishRound('R', 'time expired — charge never planted');
    }
    // The round just ended: tell the caller once, with the reason, so
    // it can show the banner and play the round sting.
    if (wasLive && s.phase === 'over') ctx.onRoundEnd?.(s.roundWinner, s.roundReason);
  }
  function reset() {
    s.round = 1; s.winsV = 0; s.winsR = 0; s.money = 800; s.kills = 0;
    s.matchWinner = null; s.over = false; s.phase = 'buy'; s.timer = BUY_SECONDS;
    s.planted = false; s.plantSite = null; s.plantProgress = 0; s.defuseProgress = 0;
    s.bombPos = null; s.detonateLeft = 0; s.roundWinner = null; s.roundReason = '';
  }
  return { state: s, step, startRound: beginRound, endRound: finishRound, nextRound, reset };
}
