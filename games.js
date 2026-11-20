const C = ['#00f0ff', '#ff2bd6'], TAU = Math.PI * 2;
const K = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
export const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const mk = () => { const c = document.createElement('canvas'); c.width = c.height = 480; c.className = 'cv'; return c; };
const pos = (c, e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };

const G = {
  sim(st, x) {
    const c = mk(), g = c.getContext('2d'), E = [];
    const N = [...Array(6)].map((_, i) => [240 + 190 * Math.cos(i * Math.PI / 3 - Math.PI / 2), 240 + 190 * Math.sin(i * Math.PI / 3 - Math.PI / 2)]);
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) E.push([a, b]);
    E.forEach(([a, b]) => { const o = st.e[a + '-' + b]; g.strokeStyle = o === undefined ? '#3a3f55' : C[o]; g.lineWidth = o === undefined ? 3 : 7; g.beginPath(); g.moveTo(...N[a]); g.lineTo(...N[b]); g.stroke(); });
    N.forEach(([px, py]) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 9, 0, TAU); g.fill(); });
    c.onclick = e => {
      if (!x.turn()) return; const [px, py] = pos(c, e); let best, bd = 14;
      E.forEach(([a, b]) => {
        if (st.e[a + '-' + b] !== undefined) return; const [ax, ay] = N[a], [bx, by] = N[b];
        const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
        const d = Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay)); if (d < bd) { bd = d; best = a + '-' + b; }
      });
      if (best) x.send({ e: best });
    };
    x.stage.append(c);
  },
  chase(st, x) {
    const c = mk(), g = c.getContext('2d'), s = 60, mv = [];
    if (x.turn()) { const [r0, c0] = st.pos[st.turn]; K.forEach(([a, b]) => { const r = r0 + a, q = c0 + b; if (r >= 0 && q >= 0 && r < 8 && q < 8 && !st.x.includes(r + ',' + q)) mv.push([r, q]); }); }
    for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
      g.fillStyle = (r + q) % 2 ? '#1a1d2b' : '#232738'; g.fillRect(q * s, r * s, s, s);
      if (st.x.includes(r + ',' + q)) { g.strokeStyle = '#ff5252'; g.lineWidth = 3; g.beginPath(); g.moveTo(q * s + 14, r * s + 14); g.lineTo(q * s + 46, r * s + 46); g.moveTo(q * s + 46, r * s + 14); g.lineTo(q * s + 14, r * s + 46); g.stroke(); }
      if (mv.some(m => m[0] === r && m[1] === q)) { g.fillStyle = '#b6ff0055'; g.fillRect(q * s + 3, r * s + 3, s - 6, s - 6); }
    }
    st.pos.forEach(([r, q], i) => { g.fillStyle = C[i]; g.shadowColor = C[i]; g.shadowBlur = 14; g.beginPath(); g.arc(q * s + 30, r * s + 30, 20, 0, TAU); g.fill(); g.shadowBlur = 0; });
    c.onclick = e => { const [px, py] = pos(c, e), r = py / s | 0, q = px / s | 0; if (mv.some(m => m[0] === r && m[1] === q)) x.send({ r, c: q }); };
    x.stage.append(c);
  },
  towels(st, x) {
    const c = mk(), g = c.getContext('2d'), s = 80, t = st.p.indexOf(x.me); let h = null;
    const cells = (r, q) => t ? [[r, q], [r, q + 1]] : [[r, q], [r + 1, q]];
    const fit = (r, q) => cells(r, q).every(([y, z]) => y >= 0 && z >= 0 && y < 6 && z < 6 && !st.b[y * 6 + z]);
    const draw = () => {
      g.clearRect(0, 0, 480, 480);
      for (let i = 0; i < 36; i++) { g.fillStyle = st.b[i] ? C[st.b[i] - 1] + 'cc' : '#1a1d2b'; g.fillRect((i % 6) * s + 2, (i / 6 | 0) * s + 2, s - 4, s - 4); }
      if (h && x.turn()) { g.fillStyle = fit(...h) ? '#b6ff0099' : '#ff525266'; cells(...h).forEach(([y, z]) => y < 6 && z < 6 && g.fillRect(z * s + 2, y * s + 2, s - 4, s - 4)); }
    };
    const at = e => { const [px, py] = pos(c, e); return [py / s | 0, px / s | 0]; };
    c.onmousemove = e => { h = at(e); draw(); }; c.onmouseleave = () => { h = null; draw(); };
    c.onclick = e => { const p = at(e); if (x.turn() && fit(...p)) x.send({ r: p[0], c: p[1] }); };
    draw(); x.stage.append(c);
    x.stage.insertAdjacentHTML('beforeend', `<small>${t ? 'You place horizontal (2×1) towels' : 'You place vertical (1×2) towels'}</small>`);
  },
  match(st, x) {
    const S = x.stage; S.innerHTML = `<h2 class="prompt">${esc(st.prompt)}</h2>`;
    if (st.ph === 'ans') {
      if (st.mine) S.insertAdjacentHTML('beforeend', `<p>Locked in: <b>${esc(st.mine)}</b><br>${st.cnt}/${st.n} answered…</p>`);
      else {
        S.insertAdjacentHTML('beforeend', '<input id="a" maxlength="60" placeholder="Your answer…"><button class="btn" id="go">Submit</button>');
        const go = () => { const v = S.querySelector('#a').value.trim(); v && x.send({ t: v }); };
        S.querySelector('#go').onclick = go; S.querySelector('#a').onkeydown = e => e.key === 'Enter' && go();
      }
    } else if (st.ph === 'group') {
      S.insertAdjacentHTML('beforeend', '<p>Tap answers that mean the same as yours. Matches score only when both players pick each other.</p><div class="list"></div>');
      const L = S.querySelector('.list');
      st.list.forEach(a => {
        const b = document.createElement('button'); b.className = 'chip' + (st.sel.includes(a.i) ? ' on' : '') + (a.i === st.me ? ' me' : '');
        b.textContent = a.t + (a.i === st.me ? ' (yours)' : ''); b.disabled = a.i === st.me || st.iDone;
        b.onclick = () => x.send({ sel: st.sel.includes(a.i) ? st.sel.filter(i => i !== a.i) : [...st.sel, a.i] }); L.append(b);
      });
      const d = document.createElement('button'); d.className = 'btn'; d.textContent = st.iDone ? 'Waiting…' : 'Done'; d.disabled = st.iDone; d.onclick = () => x.send({ done: 1 }); S.append(d);
    } else S.insertAdjacentHTML('beforeend', '<div class="list" style="flex-direction:column">' + st.res.map(r => `<div><b>${esc(r.n)}</b>: ${esc(r.t)} <span class="pts">+${r.pts}</span></div>`).join('') + '</div>');
  },
  phone(st, x) {
    const S = x.stage;
    if (st.ph === 'reveal') {
      let ci = 0, step = 0;
      const v = () => {
        const ch = st.ch[ci];
        S.innerHTML = `<div class="row">${st.names.map((n, i) => `<button class="chip${i === ci ? ' on' : ''}" data-i="${i}">${esc(n)}'s chain</button>`).join('')}</div>` +
          ch.slice(0, step + 1).map(e => `<div class="entry"><small>${esc(e.by)} ${e.d ? 'drew' : 'wrote'}</small>${e.d ? `<br><img src="${e.v}">` : `<p>${esc(e.v)}</p>`}</div>`).join('') +
          `<button class="btn" id="nx" ${step >= ch.length - 1 ? 'disabled' : ''}>Next step</button>`;
        S.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { ci = +b.dataset.i; step = 0; v(); });
        S.querySelector('#nx').onclick = () => { step++; v(); };
      };
      return v();
    }
    if (st.done) return S.innerHTML = `<p>Submitted! Waiting for others… ${st.cnt}/${st.n}</p>`;
    S.innerHTML = `<h3>Round ${st.r + 1}/${st.n}: ${st.r === 0 ? 'Write a prompt for someone to draw' : st.draw ? 'Draw this' : 'Caption this drawing'}</h3>` +
      (st.prev ? (st.draw ? `<p class="prompt">${esc(st.prev)}</p>` : `<img class="prev" src="${st.prev}">`) : '');
    if (!st.draw) {
      S.insertAdjacentHTML('beforeend', '<input id="t" maxlength="100" style="width:80%"><button class="btn" id="go">Submit</button>');
      const go = () => { const v = S.querySelector('#t').value.trim(); v && x.send({ v }); };
      S.querySelector('#go').onclick = go; S.querySelector('#t').onkeydown = e => e.key === 'Enter' && go(); return;
    }
    const c = document.createElement('canvas'); c.width = 480; c.height = 320; c.className = 'cv pad';
    const g = c.getContext('2d'); let col = '#000000', w = 6, strokes = [], cur;
    const redraw = () => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, 480, 320); g.lineCap = g.lineJoin = 'round';
      strokes.forEach(s => { g.strokeStyle = s.c; g.lineWidth = s.w; g.beginPath(); s.p.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); if (s.p.length === 1) g.lineTo(s.p[0][0] + .1, s.p[0][1]); g.stroke(); });
    };
    const P = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * 480 / r.width, (e.clientY - r.top) * 320 / r.height]; };
    c.onpointerdown = e => { c.setPointerCapture(e.pointerId); cur = { c: col, w, p: [P(e)] }; strokes.push(cur); redraw(); };
    c.onpointermove = e => { if (cur) { cur.p.push(P(e)); redraw(); } }; c.onpointerup = () => cur = null; redraw();
    S.append(c);
    S.insertAdjacentHTML('beforeend', '<div class="row"><input type="color" id="col" value="#000000"><input type="range" id="sz" min="2" max="24" value="6"><button class="ghost" id="un">Undo</button><button class="ghost" id="cl">Clear</button><button class="btn" id="go">Submit</button></div>');
    S.querySelector('#col').oninput = e => col = e.target.value; S.querySelector('#sz').oninput = e => w = +e.target.value;
    S.querySelector('#un').onclick = () => { strokes.pop(); redraw(); }; S.querySelector('#cl').onclick = () => { strokes = []; redraw(); };
    S.querySelector('#go').onclick = () => x.send({ v: c.toDataURL('image/jpeg', .6) });
  }
};

export function render(st, x) {
  const S = x.stage; x.turn = () => !!st.p && st.p[st.turn] === x.me && !st.over;
  // Skip re-render while the player is typing/drawing and nothing relevant changed
  const k = st.g === 'phone' && st.ph === 'play' ? 'p' + st.r + st.done : st.g === 'match' && st.ph === 'ans' ? 'a' + !!st.mine : null;
  if (k && S.dataset.k === k) return;
  k ? S.dataset.k = k : delete S.dataset.k;
  S.replaceChildren(); G[st.g](st, x);
}
