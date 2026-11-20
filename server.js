const express = require('express'), http = require('http'), { Server } = require('socket.io');
const app = express(); app.use(express.static('public'));
const srv = http.createServer(app), io = new Server(srv, { maxHttpBufferSize: 1e6 });
const rooms = {}, COLORS = ['#00f0ff', '#ff2bd6', '#b6ff00', '#ffb300', '#7c4dff', '#ff5252', '#00e676', '#40c4ff'];
const LIM = { sim: [2, 2], chase: [2, 2], towels: [2, 2], match: [3, 8], phone: [3, 8] };
const PROMPTS = `A food you could eat every day;The worst superpower;A terrible name for a pet goldfish;Something you'd find in a wizard's fridge;The best snack at the movies;A bad first-date idea;An item every backpack needs;Worst thing to hear on a plane;A sport that should exist;A word that sounds funnier than it is;The best season of the year;A job you'd be terrible at;Something you'd never lend;A great movie sequel title;The perfect road-trip song genre;An animal you'd fear if it were bigger;Worst flavor of ice cream;A holiday that should exist;Something found in every kitchen drawer;A good reason to be late;What a dragon collects;The most overrated invention;A famous landmark you'd like to visit;A cozy rainy-day activity;Best pizza topping;A name for a pirate ship;Something you'd do with a free day;Worst thing to step on barefoot;An excuse for skipping gym;A sound that annoys you;What aliens would find weird about us;Best board game;A talent you wish you had;A color that tastes like something;A good name for a band;Something you'd bring to a desert island;The best way to wake up;A weird thing to collect;Best breakfast food;A movie everyone has seen;A place you'd go to hide;Something that's always lost;A cool nickname;A vegetable that deserves more respect;The best pet for an apartment;An unwritten rule of the office;The most relaxing sound;Something people do when nobody's watching;A gift nobody wants;Worst thing to forget at home;A great theme for a party;Something you'd find under the couch`.split(';');
const rnd = a => a[Math.random() * a.length | 0], shuf = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const key = (a, b) => a < b ? a + '-' + b : b + '-' + a, norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const nm = (rm, id) => (rm.players.find(p => p.id === id) || {}).name;
const ids = rm => rm.players.map(p => p.id);
function end(rm, w, msg) { rm.over = { w, msg }; w.forEach(id => rm.pts[id] = (rm.pts[id] || 0) + 1); clearTimeout(rm.t); }

const K = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const okC = (s, r, c) => r >= 0 && c >= 0 && r < 8 && c < 8 && !s.x.includes(r + ',' + c);
const fit = (b, t, r, c) => Number.isInteger(r) && Number.isInteger(c) &&
  (t ? [[r, c], [r, c + 1]] : [[r, c], [r + 1, c]]).every(([y, x]) => y >= 0 && x >= 0 && y < 6 && x < 6 && !b[y * 6 + x]);

function grp(rm) {
  const s = rm.s; if (!s || s.ph !== 'ans') return; clearTimeout(rm.t);
  s.ph = 'group'; s.order = shuf(ids(rm)); s.dl = Date.now() + 25000;
  rm.t = setTimeout(() => score(rm), 25000); push(rm);
}
function score(rm) {
  const s = rm.s; if (!s || s.ph !== 'group') return; clearTimeout(rm.t);
  const o = s.order, pts = {};
  o.forEach(p => pts[p] = o.filter(q => q !== p && ((norm(s.ans[p]) && norm(s.ans[p]) === norm(s.ans[q])) ||
    ((s.sel[p] || []).includes(o.indexOf(q)) && (s.sel[q] || []).includes(o.indexOf(p))))).length);
  s.ph = 'res'; s.res = o.map(p => ({ n: nm(rm, p), t: s.ans[p] || '(none)', pts: pts[p] }));
  o.forEach(p => rm.pts[p] = (rm.pts[p] || 0) + pts[p]);
  const top = Math.max(...o.map(p => pts[p]));
  rm.over = { w: o.filter(p => pts[p] === top), msg: 'Round over!' }; push(rm);
}

const GM = {
  sim: {
    init: rm => ({ g: 'sim', p: ids(rm), e: {}, turn: 0 }), view: s => s,
    act(rm, id, d) {
      const s = rm.s; if (id !== s.p[s.turn] || typeof d.e !== 'string' || !/^[0-5]-[0-5]$/.test(d.e)) return;
      const [a, b] = d.e.split('-').map(Number); if (a >= b || s.e[d.e] !== undefined) return;
      s.e[d.e] = s.turn;
      for (let k = 0; k < 6; k++) if (k !== a && k !== b && s.e[key(a, k)] === s.turn && s.e[key(b, k)] === s.turn)
        return end(rm, [s.p[1 - s.turn]], nm(rm, id) + ' completed a triangle and loses!');
      s.turn ^= 1;
    }
  },
  chase: {
    init: rm => ({ g: 'chase', p: ids(rm), pos: [[0, 0], [7, 7]], x: [], turn: 0 }), view: s => s,
    act(rm, id, d) {
      const s = rm.s, t = s.turn; if (id !== s.p[t]) return;
      const [pr, pc] = s.pos[t];
      if (!K.some(([a, b]) => pr + a === d.r && pc + b === d.c) || !okC(s, d.r, d.c)) return;
      s.x.push(pr + ',' + pc); s.pos[t] = [d.r, d.c]; const o = s.pos[1 - t];
      if (o[0] === d.r && o[1] === d.c) return end(rm, [id], nm(rm, id) + ' caught the opponent!');
      if (!K.some(([a, b]) => okC(s, o[0] + a, o[1] + b))) return end(rm, [id], nm(rm, id) + ' trapped the opponent!');
      s.turn ^= 1;
    }
  },
  towels: {
    init: rm => ({ g: 'towels', p: ids(rm), b: Array(36).fill(0), turn: 0 }), view: s => s,
    act(rm, id, d) {
      const s = rm.s, t = s.turn; if (id !== s.p[t] || !fit(s.b, t, d.r, d.c)) return;
      (t ? [[d.r, d.c], [d.r, d.c + 1]] : [[d.r, d.c], [d.r + 1, d.c]]).forEach(([y, x]) => s.b[y * 6 + x] = t + 1);
      const n = 1 - t;
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (fit(s.b, n, y, x)) { s.turn = n; return; }
      end(rm, [id], nm(rm, id) + ' wins - opponent has no legal placement!');
    }
  },
  match: {
    init(rm) {
      rm.t = setTimeout(() => grp(rm), 30000);
      return { g: 'match', ph: 'ans', prompt: rnd(PROMPTS), ans: {}, sel: {}, done: {}, dl: Date.now() + 30000 };
    },
    view(s, id, rm) {
      const o = { g: 'match', ph: s.ph, prompt: s.prompt, dl: s.ph === 'res' ? 0 : s.dl, cnt: Object.keys(s.ans).length, n: rm.players.length, mine: s.ans[id] };
      if (s.ph !== 'ans') { o.list = s.order.map((p, i) => ({ i, t: s.ans[p] || '(no answer)' })); o.me = s.order.indexOf(id); o.sel = s.sel[id] || []; o.iDone = !!s.done[id]; }
      if (s.ph === 'res') o.res = s.res; return o;
    },
    act(rm, id, d) {
      const s = rm.s;
      if (s.ph === 'ans') {
        if (typeof d.t !== 'string' || !d.t.trim() || s.ans[id]) return;
        s.ans[id] = d.t.trim().slice(0, 60);
        if (Object.keys(s.ans).length === rm.players.length) grp(rm);
      } else if (s.ph === 'group') {
        if (Array.isArray(d.sel)) s.sel[id] = d.sel.filter(i => Number.isInteger(i) && i >= 0 && i < s.order.length && i !== s.order.indexOf(id));
        if (d.done) s.done[id] = 1;
        if (Object.keys(s.done).length === rm.players.length) score(rm);
      }
    }
  },
  phone: {
    init: rm => ({ g: 'phone', ph: 'play', r: 0, n: rm.players.length, ch: rm.players.map(() => []), sub: {} }),
    view(s, id, rm) {
      const n = s.n, pi = ids(rm).indexOf(id);
      if (s.ph === 'reveal') return { g: 'phone', ph: 'reveal', ch: s.ch, names: rm.players.map(p => p.name) };
      const ci = ((pi - s.r) % n + n) % n;
      return { g: 'phone', ph: 'play', r: s.r, n, draw: s.r % 2 === 1, prev: s.r ? s.ch[ci][s.r - 1].v : null, done: !!s.sub[id], cnt: Object.keys(s.sub).length };
    },
    act(rm, id, d) {
      const s = rm.s; if (s.ph !== 'play' || s.sub[id] || typeof d.v !== 'string') return;
      const n = s.n, pi = ids(rm).indexOf(id), draw = s.r % 2 === 1, ci = ((pi - s.r) % n + n) % n;
      if (draw ? !(d.v.startsWith('data:image/jpeg;base64,') && d.v.length < 400000) : !d.v.trim()) return;
      s.ch[ci][s.r] = { by: nm(rm, id), v: draw ? d.v : d.v.trim().slice(0, 100), d: draw };
      s.sub[id] = 1;
      if (Object.keys(s.sub).length === n) {
        s.r++; s.sub = {};
        if (s.r >= n) { s.ph = 'reveal'; rm.over = { w: ids(rm), msg: 'Album time! Flip through every chain.' }; }
      }
    }
  }
};

const pub = rm => ({ code: rm.code, host: rm.host, game: rm.game, playing: !!rm.s, over: rm.over, pts: rm.pts, players: rm.players });
function push(rm) {
  io.to(rm.code).emit('room', pub(rm));
  if (rm.s) rm.players.forEach(p => io.to(p.id).emit('state', GM[rm.game].view(rm.s, p.id, rm)));
}
function drop(sk) {
  const rm = rooms[sk.code]; if (!rm) return;
  sk.leave(rm.code); sk.code = null; rm.players = rm.players.filter(p => p.id !== sk.id);
  if (!rm.players.length) { clearTimeout(rm.t); delete rooms[rm.code]; return; }
  if (rm.host === sk.id) rm.host = rm.players[0].id;
  if (rm.s) { clearTimeout(rm.t); rm.s = null; rm.over = null; io.to(rm.code).emit('toast', 'A player left - back to the lobby'); }
  push(rm);
}
function start(rm) {
  const [mn, mx] = LIM[rm.game], n = rm.players.length;
  if (n < mn) return `Need at least ${mn} players`;
  if (n > mx) return `This game allows at most ${mx} players`;
  clearTimeout(rm.t); rm.over = null; rm.s = GM[rm.game].init(rm); push(rm);
}

io.on('connection', sk => {
  const err = m => sk.emit('toast', m), mine = () => rooms[sk.code], host = () => mine() && mine().host === sk.id;
  const enter = (rm, name) => {
    drop(sk); sk.join(rm.code); sk.code = rm.code;
    rm.players.push({ id: sk.id, name: String(name || 'Player').trim().slice(0, 12) || 'Player', color: COLORS.find(c => !rm.players.some(p => p.color === c)) });
    push(rm);
  };
  sk.on('create', name => {
    let code; do { code = [...Array(4)].map(() => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); } while (rooms[code]);
    const rm = rooms[code] = { code, host: sk.id, players: [], game: 'sim', s: null, over: null, pts: {}, t: null };
    enter(rm, name);
  });
  sk.on('join', (c, name) => {
    const rm = rooms[String(c || '').toUpperCase()];
    if (!rm) return err('Room not found'); if (rm.s) return err('Game already in progress'); if (rm.players.length >= 8) return err('Room is full');
    enter(rm, name);
  });
  sk.on('select', g => { if (host() && !mine().s && LIM[g]) { mine().game = g; push(mine()); } });
  sk.on('start', () => { if (host() && !mine().s) { const e = start(mine()); e && err(e); } });
  sk.on('again', () => { if (host() && mine().over) { const e = start(mine()); e && err(e); } });
  sk.on('lobby', () => { if (host()) { const rm = mine(); clearTimeout(rm.t); rm.s = null; rm.over = null; push(rm); } });
  sk.on('act', d => {
    const rm = mine(); if (!rm || !rm.s || rm.over || typeof d !== 'object' || !d) return;
    try { GM[rm.game].act(rm, sk.id, d); } catch (e) { console.error(e); }
    if (rooms[rm.code]) push(rm);
  });
  sk.on('leave', () => drop(sk)); sk.on('disconnect', () => drop(sk));
});
srv.listen(process.env.PORT || 3000, () => console.log('Arcade on http://localhost:' + (process.env.PORT || 3000)));
