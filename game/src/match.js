// The match, in one place: rounds, economy, the charge objective, score.
// Vanguard (player + 2 bots) attack; Rustjackals (4 bots) defend. First to
// 5 round wins takes the match (best of 9). A round ends on elimination,
// on the charge detonating, on a defuse, or on the 100 s timer expiring
// (defenders win when the charge was never planted).
import { SITES } from './world.js';

export const ROUND_SECONDS = 100;
export const BUY_SECONDS = 12;
export const PLANT_SECONDS = 3;
export const DEFUSE_SECONDS = 4;
export const DETONATE_SECONDS = 35;
export const WIN_ROUNDS = 5;
export const AWARD = { win: 300, loss: 150, kill: 100, plant: 300 };

export function createMatch() {
  const state = {
    phase: 'buy', // 'buy' | 'live' | 'over'
    round: 1, winsV: 0, winsR: 0,
    timer: BUY_SECONDS, money: 800, kills: 0,
    planted: false, plantSite: null, plantProgress: 0, defuseProgress: 0,
    bombPos: null, detonateLeft: 0, roundWinner: null, roundReason: '',
    matchWinner: null, over: false, message: '',
  };
  function startRound() {
    state.phase = 'live'; state.timer = ROUND_SECONDS;
    state.planted = false; state.plantSite = null; state.plantProgress = 0;
    state.defuseProgress = 0; state.bombPos = null; state.detonateLeft = 0;
    state.roundWinner = null; state.roundReason = '';
  }
  function endRound(winner, reason) {
    if (state.phase === 'over') return;
    state.phase = 'over'; state.roundWinner = winner; state.roundReason = reason;
    state.timer = 5;
    if (winner === 'V') { state.winsV += 1; state.money += AWARD.win; }
    else { state.winsR += 1; state.money += AWARD.loss; }
    state.message = winner === 'V'
      ? `Vanguard take round ${state.round} — ${reason}`
      : `Rustjackals take round ${state.round} — ${reason}`;
    if (state.winsV >= WIN_ROUNDS || state.winsR >= WIN_ROUNDS) {
      state.matchWinner = winner; state.over = true;
    }
  }
  function nextRound() {
    state.round += 1;
    state.phase = 'buy'; state.timer = BUY_SECONDS;
    state.planted = false; state.plantSite = null; state.plantProgress = 0;
    state.defuseProgress = 0; state.bombPos = null; state.detonateLeft = 0;
    state.roundWinner = null; state.roundReason = '';
  }
  function step(dt, ctx) {
    if (state.phase === 'buy') {
      state.timer -= dt;
      if (state.timer <= 0) startRound();
      return;
    }
    if (state.phase === 'over') {
      state.timer -= dt;
      if (state.timer <= 0) {
        if (state.over) return; // match over: main.js shows the end overlay
        nextRound();
        ctx.onNextRound?.();
      }
      return;
    }
    // live
    state.timer -= dt;
    // Planting: the player holds E inside a site.
    if (!state.planted) {
      if (ctx.planting && ctx.inSite) {
        state.plantProgress += dt;
        if (state.plantProgress >= PLANT_SECONDS) {
          state.planted = true; state.plantSite = ctx.inSite;
          const site = SITES[ctx.inSite];
          state.bombPos = { x: site.x, z: site.z };
          state.detonateLeft = DETONATE_SECONDS;
          state.money += AWARD.plant;
          state.message = `Charge planted at Site ${ctx.inSite} — ${DETONATE_SECONDS}s to detonation`;
        }
      } else state.plantProgress = Math.max(0, state.plantProgress - dt * 2);
    } else {
      state.detonateLeft -= dt;
      if (ctx.defuser) {
        state.defuseProgress += dt;
        if (state.defuseProgress >= DEFUSE_SECONDS) { endRound('R', 'charge defused'); return; }
      } else state.defuseProgress = Math.max(0, state.defuseProgress - dt * 2);
      if (state.detonateLeft <= 0) { endRound('V', 'charge detonated'); return; }
    }
    // Elimination ends the round before a plant; after a plant both teams
    // dead still ends in a detonation for the attackers.
    if (!state.planted) {
      if (ctx.aliveR === 0) { endRound('V', 'all Rustjackals eliminated'); return; }
      if (ctx.aliveV === 0) { endRound('R', 'all Vanguard eliminated'); return; }
    } else if (ctx.aliveR === 0 && ctx.aliveV === 0) {
      endRound('V', 'charge detonated'); return;
    }
    if (state.timer <= 0) {
      if (state.planted) endRound('V', 'charge detonated');
      else endRound('R', 'time expired — charge never planted');
    }
  }
  function reset() {
    state.round = 1; state.winsV = 0; state.winsR = 0; state.money = 800; state.kills = 0;
    state.matchWinner = null; state.over = false; state.phase = 'buy'; state.timer = BUY_SECONDS;
    state.planted = false; state.plantSite = null; state.plantProgress = 0; state.defuseProgress = 0;
    state.bombPos = null; state.detonateLeft = 0; state.roundWinner = null; state.roundReason = '';
  }
  return { state, step, startRound, endRound, nextRound, reset };
}
