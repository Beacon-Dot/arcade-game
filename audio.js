let ctx;
const tone = (f, d = .1, type = 'sine', v = .08, at = 0) => {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
  o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d);
};
export const sfx = {
  click: () => tone(520, .06, 'square', .04),
  turn: () => { tone(660, .1); tone(880, .12, 'sine', .08, .1); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .1, i * .1)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, .25, 'sawtooth', .06, i * .15))
};
