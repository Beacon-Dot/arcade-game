import { sfx } from './audio.js';
import { render, esc } from './games.js';
const $ = s => document.querySelector(s), sk = io();
const G = {
  sim: { n: 'Sim', i: 'hexagon', k: 'duel', p: '2 players', t: '~5 min', h: 'Take turns claiming gray edges of the hexagon in your colour. Complete a triangle of your own colour and you lose!' },
  chase: { n: 'Night Chase', i: 'moon', k: 'duel', p: '2 players', t: '~8 min', h: 'Move like a chess knight. Squares you leave are crossed out forever. Land on your rival, or leave them with no moves, to win.' },
  towels: { n: 'Beach Towels', i: 'umbrella', k: 'duel', p: '2 players', t: '~6 min', h: 'Player 1 lays vertical 1×2 towels, Player 2 horizontal 2×1 towels. If you cannot place a towel, you lose.' },
  match: { n: 'Match the Room', i: 'users', k: 'party', p: '3-8 players', t: '~5 min', h: 'Answer a prompt in 30 seconds. Then tap the answers that mean the same as yours. Mutual matches score a point each.' },
  phone: { n: 'Paper Telephone', i: 'phone', k: 'party', p: '3-8 players', t: '~15 min', h: 'Write a prompt, draw the one you receive, caption the next drawing... Every chain is revealed at the end.' }
};
let room, st, filter = 'all', last = '', wasMine = false;
const show = v => ['menu', 'lobby', 'game'].forEach(x => $('#' + x).hidden = x !== v);
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2500); };
const name = () => { const n = $('#nick').value.trim() || 'Player' + (Math.random() * 90 + 10 | 0); try { localStorage.nick = $('#nick').value.trim(); } catch { } return n; };
try { $('#nick').value = localStorage.nick || ''; } catch { }

function menu() {
  $('#grid').innerHTML = Object.entries(G).filter(([, g]) => filter === 'all' || g.k === filter).map(([id, g]) =>
    `<div class="card"><i data-lucide="${g.i}"></i><h3>${g.n}</h3><div><span class="badge">${g.p}</span> <span class="badge">${g.t}</span></div><button class="ghost" data-h="${id}"><i data-lucide="help-circle"></i> How to Play</button></div>`).join('');
  $('#grid').querySelectorAll('[data-h]').forEach(b => b.onclick = () => { const g = G[b.dataset.h]; $('#mt').textContent = g.n; $('#mb').textContent = g.h; $('#dlg').showModal(); });
  lucide.createIcons();
}
$('#gs').innerHTML = Object.entries(G).map(([id, g]) => `<option value="${id}">${g.n}</option>`).join('');
document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; document.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); menu(); });
$('#create').onclick = () => { sfx.click(); sk.emit('create', name()); };
$('#join').onclick = () => { sfx.click(); sk.emit('join', $('#code').value.trim(), name()); };
$('#gs').onchange = e => sk.emit('select', e.target.value);
$('#st').onclick = () => { sfx.click(); sk.emit('start'); };
$('#pa').onclick = () => sk.emit('again'); $('#rl').onclick = () => sk.emit('lobby');
$('#copy').onclick = () => { navigator.clipboard.writeText(room.code).then(() => toast('Code copied!'), () => toast(room.code)); };
document.querySelectorAll('.leave').forEach(b => b.onclick = () => { sk.emit('leave'); room = st = null; show('menu'); });

function lobby() {
  const host = room.host === sk.id;
  $('#lc').textContent = room.code; $('#gs').value = room.game; $('#gs').disabled = !host;
  $('#hint').textContent = 'Players needed: ' + G[room.game].p; $('#st').disabled = !host; $('#st').textContent = host ? 'Start Game' : 'Waiting for host…';
  $('#av').innerHTML = room.players.map(p => `<div class="av" style="--c:${p.color}"><span>${esc(p.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span><small>${esc(p.name)}${p.id === room.host ? ' ★' : ''}</small></div>`).join('');
}
function bar() {
  $('#rc').textContent = room.code;
  $('#sb').innerHTML = room.players.map(p => `<span class="pl" style="--c:${p.color}">${esc(p.name)} <b>${room.pts[p.id] || 0}</b></span>`).join('');
  const o = room.over; $('#ov').hidden = !o;
  if (o) { $('#om').textContent = o.msg; $('#pa').disabled = $('#rl').disabled = room.host !== sk.id; const k = o.msg + room.code + Object.values(room.pts).join(); if (k !== last) { last = k; (o.w.includes(sk.id) ? sfx.win : sfx.lose)(); } } else last = '';
  const mine = !!st?.p && st.p[st.turn] === sk.id && !o;
  $('#tn').textContent = st?.p && !o ? (mine ? 'Your turn!' : "Opponent's turn") : '';
  if (mine && !wasMine) sfx.turn(); wasMine = mine;
}
sk.on('room', r => {
  room = r;
  if (!r.playing) { st = null; $('#stage').replaceChildren(); delete $('#stage').dataset.k; lobby(); show('lobby'); } else { show('game'); bar(); }
  lucide.createIcons();
});
sk.on('state', s => {
  st = s; if (!room?.playing) return; show('game'); bar();
  render(s, { me: sk.id, send: d => { sfx.click(); sk.emit('act', d); }, stage: $('#stage'), players: room.players });
});
sk.on('toast', toast);
setInterval(() => {
  $('#tm').textContent = st?.dl && !room?.over ? Math.max(0, Math.ceil((st.dl - Date.now()) / 1000)) + 's' : st?.n && st.r !== undefined && !room?.over ? `Round ${st.r + 1}/${st.n}` : '';
}, 250);
menu();
