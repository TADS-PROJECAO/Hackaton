// =====================================================================
// game.js — The Last Halloween
// Interface, login, história, batalhas e ranking.
// O mapa (rotas, blocos, avatares, luz e neblina) vem de map.js.
// =====================================================================
const $ = (id) => document.getElementById(id);
const API = "/api";
const POKE_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const GHOSTS = [
  { id: 92, name: "Gastly", hp: 22, attack: 5, xp: 18 },
  { id: 200, name: "Misdreavus", hp: 28, attack: 6, xp: 24 },
  { id: 355, name: "Duskull", hp: 32, attack: 7, xp: 28 },
  { id: 94, name: "Gengar", hp: 42, attack: 9, xp: 45 },
  { id: 426, name: "Drifblim", hp: 48, attack: 10, xp: 55 }
];

// ---------- Telas do mundo ----------
// Cidade → Corredor → Encruzilhada → (esquerda) Bosque do puzzle · (direita) Cidade do Eclipse, a área final.
const START_SCREEN = "cidade";
const screenOf = (id) => WORLD[id] || WORLD[START_SCREEN];

let state = { token:null, player:null, current_map:"cidade", player_x:7, player_y:10, level:5, xp:0, hp:35, max_hp:35, secret_item:false, gym1_won:false, gym2_won:false, good_ending:false };
let battle = null, dialogQueue = [], startedAt = Date.now(), points = 0;
let puzzleProgress = [], puzzleSolved = false;
// O puzzle das runas muda a cada partida: a ordem é sorteada.
// As dicas são enigmas: as pistas 1, 2 e 3 estão nas pedras gravadas das três trilhas;
// a 4ª pista fica com o Espírito antigo, no bosque.
const RUNES = { lua: "Lua", chama: "Chama", folha: "Folha", estrela: "Estrela" };
const RIDDLES = {
  lua:     ["ilumina a noite sem aquecer", "muda de forma a cada noite no céu", "faz os lobos uivarem"],
  chama:   ["dança sem ter pés e devora a madeira", "aquece as mãos e assusta as sombras", "nasce de uma faísca"],
  folha:   ["cai das árvores quando chega o outono", "é verde na primavera e dourada no outono", "o vento carrega pelo chão do bosque"],
  estrela: ["guia os viajantes perdidos", "pisca lá no alto quando o céu escurece", "realiza desejos quando cai do céu"]
};
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let PUZZLE_ORDER = shuffle(Object.keys(RUNES)), clueText = [], cluesFound = [false, false, false, false];
const ORD = ["1ª", "2ª", "3ª", "4ª"];
const clueLine = (i) => `A ${ORD[i]} runa é a que ${clueText[i]}.`;
function newPuzzle() {
  PUZZLE_ORDER = shuffle(Object.keys(RUNES));
  clueText = PUZZLE_ORDER.map(r => RIDDLES[r][Math.floor(Math.random() * RIDDLES[r].length)]);
  cluesFound = [false, false, false, false]; puzzleProgress = []; puzzleSolved = false;
}
newPuzzle();
function readClue(i) {
  const first = !cluesFound[i]; cluesFound[i] = true;
  const total = cluesFound.filter(Boolean).length;
  if (first) { showMessage(`Pista ${ORD[i]} anotada (${total}/4): a runa que ${clueText[i]}.`); if (typeof updateHUD === "function" && state.token) updateHUD(); }
  return clueLine(i);
}

// ---------- Monstros selvagens no mapa ----------
// Cada tela tem seus próprios monstros: eles andam pela tela, perseguem o jogador quando ele chega perto
// e, se encostarem nele, começa a batalha. Eles nunca saem da tela onde nasceram.
// Na batalha, cada monstro usa um inimigo do GHOSTS (o Gengar fica reservado para o líder Noctus).
const WILD = [ { i: 0, w: 4, look: "sombra" }, { i: 1, w: 3, look: "caveira" }, { i: 2, w: 3, look: "morcego" }, { i: 4, w: 1, minLevel: 8, look: "sombraGrande" } ];
const SPAWNS = { corredor: 1, encruzilhada: 2, trilha1: 2, trilha2: 2, trilha3: 2, bosque: 1, eclipse: 1 }; // a cidade é segura
const CHASE_RADIUS = 6;      // distância (em blocos) em que o monstro percebe o jogador
const MONSTER_STEP = 22;     // quadros por passo do monstro (o jogador usa 14: dá para fugir)
const XP_PER_LEVEL = 100;
let monsters = [], encounterFlash = 0, touchedMonster = null, safeFrames = 0;
const canvas = $("game"), ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const images = {};
function sprite(id, back=false) {
  const key = `${id}-${back}`;
  if (!images[key]) { const im = new Image(); im.src = POKE_SPRITES + (back ? "back/" : "") + id + ".png"; images[key] = im; }
  return images[key];
}

// ---------- Tela atual ----------
let scr = START_SCREEN;
const cur = () => WORLD[scr];
const tileAt = (x, y) => cur().grid[y]?.[x];

// NPCs e líderes de cada tela (posições fixas)
const STORY = {
  cidade: {
    npcs: [
      { x: 4, y: 10, name: "Moradora", look: "moradora", text: "A névoa chegou quando o sino tocou. Dizem que o líder do ginásio fez um pacto com os espíritos. Ele guarda o portão norte da vila." },
      { x: 10, y: 4, name: "Guardião", look: "guardiao", text: "O portão norte leva à Trilha das Lápides. Só quem vencer o líder do ginásio pode passar." }
    ],
    leader: { x: 7, y: 1, name: "Líder do Ginásio 1", look: "lider", ghost: 0, flag: "gym1_won", guards: "n",
      intro: "O líder do Ginásio Fantasma bloqueia o portão. Ele desafia seu parceiro!" }
  },
  corredor: { npcs: [] },
  trilha1: { npcs: [] }, trilha2: { npcs: [] }, trilha3: { npcs: [] },
  encruzilhada: { npcs: [] },
  bosque: {
    npcs: [
      { x: 3, y: 6, name: "Espírito antigo", look: "espirito",
        text: () => `O Medalhão da Aurora está selado no altar por quatro runas. As pedras gravadas das três trilhas guardam as primeiras pistas. A última eu guardo: ${readClue(3)}` }
    ],
    altar: { x: 7, y: 4 }
  },
  eclipse: {
    npcs: [
      { x: 5, y: 7, name: "Sentinela", look: "guardiao", text: "O líder Noctus espera diante do ginásio. Dizem que, sem o poder do Medalhão da Aurora, nenhum parceiro consegue feri-lo." }
    ],
    leader: { x: 10, y: 3, name: "Noctus · Ginásio 2", look: "noctus", ghost: 3, flag: "gym2_won",
      intro: "O líder Noctus convoca seu último fantasma. Esta batalha decidirá o destino da região.",
      line: "Você chegou até aqui. Mostre que seu vínculo com seu parceiro é mais forte que qualquer sombra." }
  }
};
const storyFor = (id) => STORY[id] || { npcs: [] };
const leaderActive = (s) => s.leader && !state[s.leader.flag];
function blockers() {
  const s = storyFor(scr), list = [...s.npcs];
  if (leaderActive(s)) list.push(s.leader);
  return list;
}

// ---------- Visual dos NPCs (variações de cor dos avatares originais) ----------
const NPC_LOOKS = {
  moradora: { base: 0, pal: { P: "#6a4a2a", G: "#d8c070", H: "#3a2a1a" } },
  guardiao: { base: 1, pal: { C: "#5a3a2a", L: "#8a8a8a", Y: "#ffd34a" } },
  lider:    { base: 0, pal: { P: "#1e1a24", G: "#b8282a", H: "#e8e4d8" } },
  noctus:   { base: 1, pal: { C: "#2a1a3a", L: "#8a5ab8", Y: "#c8a0ff" } },
  espirito: { base: 3, pal: { W: "#b8f0d8", s: "#7ad0a8", o: "#1a3a2e" } }
};
function npcSprite(look) {
  const L = NPC_LOOKS[look], a = AVATARS[L.base];
  return { rows: a.down, pal: { ...a.pal, ...L.pal }, float: !!a.float };
}

// ---------- Jogador e avatar ----------
let avatar = AVATARS[0];
try { const s = localStorage.getItem("tlh-avatar"); const f = AVATARS.find(a => a.id === s); if (f) avatar = f; } catch (e) {}
const P = { x: 7, y: H - 1, fx: 7, fy: H - 1, dir: "up", moving: false, t: 0 };
let frame = 0, fade = 0, fadeDir = 0, pending = null, gloom = 1, pumpkins = [];
const held = new Set();
const fog = Array.from({ length: 6 }, (_, i) => ({ x: Math.random() * SW, y: 16 + i * 32, r: 34 + Math.random() * 24, s: .07 + Math.random() * .1 }));
const wisps = Array.from({ length: 4 }, () => ({ x: 16 + Math.random() * (SW - 32), y: 16 + Math.random() * (SH - 32), p: Math.random() * 6.28 }));
const dark = document.createElement("canvas"); dark.width = SW; dark.height = SH; const dc = dark.getContext("2d");

function syncState() { state.current_map = scr; state.player_x = P.x; state.player_y = P.y; }
function placeAtStart() { const st = WORLD[START_SCREEN].start; scr = START_SCREEN; P.x = P.fx = st.x; P.y = P.fy = st.y; P.dir = st.dir; P.moving = false; syncState(); }
// Volta para o ponto de entrada da tela atual (usado ao perder uma batalha)
let entryPoint = null;
function placeAtEntrance() {
  if (!entryPoint || entryPoint.scr !== scr) { placeAtStart(); return; }
  P.x = P.fx = entryPoint.x; P.y = P.fy = entryPoint.y; P.dir = entryPoint.dir; P.moving = false; syncState();
}
function canStand(x, y) {
  const v = tileAt(x, y);
  return v !== undefined && TILES[v].walk && !blockers().some(n => n.x === x && n.y === y);
}
// Começa na cidade, a menos que exista uma posição válida numa tela conhecida
function applySavedPosition() {
  const id = state.current_map;
  const allowed = WORLD[id] && (id === START_SCREEN || state.gym1_won);
  if (allowed) {
    scr = id;
    if (canStand(state.player_x, state.player_y)) { P.x = P.fx = state.player_x; P.y = P.fy = state.player_y; P.dir = "up"; P.moving = false; syncState(); }
    else placeAtStart();
  } else placeAtStart();
  entryPoint = { scr, x: P.x, y: P.y, dir: P.dir };
  scanPumpkins(); lamps = scanLights(); spawnMonsters();
}
function scanPumpkins() { pumpkins = []; cur().grid.forEach((r, y) => r.forEach((v, x) => { if (v === 4) pumpkins.push([x * T + 8, y * T + 9]); })); }
function scanLights() { const out = []; cur().grid.forEach((r, y) => r.forEach((v, x) => { if (v === 11) out.push([x * T + 8, y * T + 3]); })); return out; }
let lamps = [];

// ---------- Interface ----------
function showMessage(text) { $("log").textContent = text; }
async function api(path, options={}) {
  const headers = { "Content-Type":"application/json", ...(state.token ? {Authorization:`Bearer ${state.token}`} : {}), ...(options.headers||{}) };
  const response = await fetch(API+path, {...options, headers});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "Erro de comunicação.");
  return data;
}
function showAuthMessage(msg) { $("auth-message").textContent = msg; }
function enterGame() {
  $("auth-screen").classList.add("hidden"); $("game-screen").classList.remove("hidden");
  $("player-label").textContent = state.player.username;
  newPuzzle(); applySavedPosition(); updateHUD(); canvas.focus();
}
async function authenticate(mode) {
  try {
    const username = $("username").value.trim(), password = $("password").value;
    const data = await api("/"+mode,{method:"POST",body:JSON.stringify({username,password})});
    state.token=data.token; localStorage.setItem("tlh-token",data.token); state.player=data.player;
    // carrega o último progresso salvo pelo botão "Salvar progresso"
    try { await loadProgress(); } catch (e) {}
    startedAt=Date.now(); enterGame();
    if (!state._welcomed) { state._welcomed=true; say("A noite de Halloween chegou. Você é um jovem treinador e Caterpie é seu único parceiro. Você está na Vila das Lanternas. Saia pelo portão norte e descubra por que os fantasmas tomaram a região."); }
  } catch(e) { showAuthMessage(e.message); }
}
$("login-btn").onclick=()=>authenticate("login");
$("register-btn").onclick=()=>authenticate("register");
function applyProgress(p) {
  Object.assign(state,{current_map:p.current_map,player_x:p.player_x,player_y:p.player_y,level:p.level,xp:p.xp,hp:p.hp,max_hp:p.max_hp,secret_item:p.secret_item,gym1_won:p.gym1_won,gym2_won:p.gym2_won,good_ending:p.good_ending});
}
async function loadProgress() { applyProgress(await api("/me")); }
// O progresso é salvo no servidor quando o jogador clica em "Salvar progresso".
// As chamadas automáticas (saveProgress sem o botão) continuam desligadas, como no v7.
async function saveProgress(silent=false) { /* salvamento automático desativado */ }
async function saveNow() {
  syncState();
  const btn = $("save-btn"); btn.disabled = true; btn.textContent = "Salvando...";
  try { await api("/progress",{method:"PUT",body:JSON.stringify(state)}); showMessage(`Progresso salvo: ${cur().title}, nível ${state.level}.`); btn.textContent = "Progresso salvo"; }
  catch(e){ showMessage("Falha ao salvar: "+e.message); btn.textContent = "Salvar progresso"; }
  setTimeout(() => { btn.disabled = false; btn.textContent = "Salvar progresso"; }, 1500);
}
let saveTimer = null;
function scheduleSave() { /* salvamento automático desativado */ }

function updateHUD() {
  const c = cur();
  $("map-title").textContent=c.title; $("chapter").textContent=c.chapter;
  if (!state.gym2_won) gloom = 1; // escuridão e neblina só se dissipam ao vencer o segundo ginásio
  $("level").textContent=state.level; $("hp").textContent=`${state.hp}/${state.max_hp}`;
  const evolved = state.secret_item || state.good_ending;
  $("partner-name").textContent=evolved?"Rayquaza":"Caterpie";
  $("partner-sprite").src=POKE_SPRITES+(evolved?"384":"10")+".png";
  $("partner-type").textContent=evolved?"Dragão · Evolução pelo Medalhão":"Inseto · O único parceiro";
  $("xp-label").textContent=`${state.xp} XP`; $("xp-bar").style.width=(state.xp%100)+"%";
  $("q-gym1").textContent=(state.gym1_won?"✓":"□")+" Derrote o líder do Ginásio 1"; $("q-gym1").className=state.gym1_won?"done":"";
  $("q-item").textContent=(state.secret_item?"✓":"□")+" Encontre o item misterioso"; $("q-item").className=state.secret_item?"done":"";
  $("q-gym2").textContent=(state.gym2_won?"✓":"□")+" Vença o Ginásio 2"; $("q-gym2").className=state.gym2_won?"done":"";
  $("quest-text").textContent=!state.gym1_won
    ?"Vença o líder que guarda o portão norte da Vila das Lanternas."
    :state.gym2_won?"A maldição foi vencida. A região está livre."
    :!state.secret_item?`Na encruzilhada, siga à esquerda pelas três trilhas até o Bosque dos Sussurros. Leia as pedras gravadas: elas revelam a ordem das runas (pistas: ${cluesFound.filter(Boolean).length}/4). À direita fica o último ginásio.`
    :"Com o Medalhão da Aurora, volte à encruzilhada e siga à direita para enfrentar Noctus.";
}

// ---------- Diálogos ----------
const dialogOpen = () => !$("dialog").classList.contains("hidden");
function say(text,callback){held.clear();dialogQueue.push({text,callback});if(dialogQueue.length===1)showDialog();}
function showDialog(){const d=dialogQueue[0];if(!d)return $("dialog").classList.add("hidden");$("dialog-text").textContent=d.text;$("dialog").classList.remove("hidden");}
function nextDialog(){const d=dialogQueue.shift();if(dialogQueue.length)showDialog();else $("dialog").classList.add("hidden");if(d?.callback)d.callback();}
$("dialog-next").onclick=nextDialog;

// ---------- Movimento no mapa ----------
const DIRS = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
const EDGE = { up:"n", down:"s", left:"w", right:"e" };
const puzzleOpen = () => !$("puzzle-modal").classList.contains("hidden");
function busy() { return !state.token || dialogOpen() || puzzleOpen() || battle || fadeDir || P.moving || encounterFlash > 0; }
function tryMove(dir) {
  if (busy()) return;
  P.dir = dir;
  const [dx, dy] = DIRS[dir], nx = P.x + dx, ny = P.y + dy;
  if (nx < 0 || nx >= W || ny < 0 || ny >= H) { leaveScreen(EDGE[dir]); return; }
  if (tileAt(nx, ny) === 12) { useAltar(); return; }
  if (!canStand(nx, ny)) { if (!P.bumped) { SFX.play("bump"); P.bumped = true; } return; }
  P.bumped = false;
  const ground = tileAt(nx, ny);
  SFX.play("step", ground === 2 || ground === 9 ? "hard" : ground === 3 ? "grass" : "soft");
  P.moving = true; P.t = 0; P.tx = nx; P.ty = ny;
}
// Sai pela borda: entra na tela vizinha pelo lado oposto, na mesma coluna/linha
function leaveScreen(edge) {
  const to = cur().exits?.[edge];
  if (!to) return;
  const s = storyFor(scr);
  // o líder da cidade guarda o portão norte; dos outros lugares sempre dá para voltar
  if (leaderActive(s) && s.leader.guards === edge) { challenge(s.leader); return; }
  let x = P.x, y = P.y;
  if (edge === "n") y = H - 1; if (edge === "s") y = 0; if (edge === "w") x = W - 1; if (edge === "e") x = 0;
  goScreen(to, x, y);
}
function goScreen(id, x, y) { pending = { id, x, y, dir: P.dir }; fadeDir = 1; held.clear(); SFX.play("door"); }
function afterStep() {
  syncState(); scheduleSave();
  if (state.hp < state.max_hp && Math.random() < .35) { state.hp++; $("hp").textContent = `${state.hp}/${state.max_hp}`; } // recupera HP andando
  const s = storyFor(scr);
  if (leaderActive(s) && Math.abs(s.leader.x - P.x) + Math.abs(s.leader.y - P.y) <= 1) { challenge(s.leader); return; }
}

// ----- Monstros: nascimento, movimento e perseguição -----
function pickWild() {
  const pool = WILD.filter(w => !w.minLevel || state.level >= w.minLevel);
  let r = Math.random() * pool.reduce((t, w) => t + w.w, 0);
  for (const w of pool) { if ((r -= w.w) < 0) return w; }
  return pool[0];
}
// cria os monstros da tela atual, longe do ponto onde o jogador entrou
function spawnMonsters() {
  monsters = []; touchedMonster = null;
  const n = SPAWNS[scr] || 0, g = cur().grid, taken = new Set(blockers().map(b => b.x + "," + b.y));
  // de preferência fora do alcance de perseguição, para o jogador ter tempo de ver a tela ao entrar
  const free = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++)
    if (TILES[g[y][x]].walk && !taken.has(x + "," + y)) free.push({ x, y, d: Math.abs(x - P.x) + Math.abs(y - P.y) });
  let spots = free.filter(s => s.d > CHASE_RADIUS + 1);
  if (spots.length < n) spots = free.filter(s => s.d >= 5);
  for (let k = 0; k < n && spots.length; k++) {
    const s = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    monsters.push({ x: s.x, y: s.y, fx: s.x, fy: s.y, home: { x: s.x, y: s.y }, wild: pickWild(), moving: false, t: 0,
      cool: 30 + Math.floor(Math.random() * 60), stun: 0, chasing: false, seed: Math.random() * 6 });
  }
}
const monsterAt = (x, y, self) => monsters.some(m => m !== self && ((m.x === x && m.y === y) || (m.moving && m.tx === x && m.ty === y)));
// o monstro só anda por blocos livres DENTRO da tela: nunca atravessa para outra tela
function monsterCanStand(m, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  const v = tileAt(x, y);
  return v !== undefined && TILES[v].walk && !blockers().some(n => n.x === x && n.y === y) && !monsterAt(x, y, m);
}
// próximo passo do caminho mais curto até o jogador (busca em largura nesta tela)
function stepToward(m, tx, ty) {
  const key = (x, y) => y * W + x, prev = new Map([[key(m.x, m.y), null]]), q = [[m.x, m.y]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) {
      let c = [x, y], p = prev.get(key(x, y));
      while (p && !(p[0] === m.x && p[1] === m.y)) { c = p; p = prev.get(key(p[0], p[1])); }
      return c;
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H || prev.has(key(nx, ny))) continue;
      if (!(nx === tx && ny === ty) && !monsterCanStand(m, nx, ny)) continue;
      prev.set(key(nx, ny), [x, y]); q.push([nx, ny]);
    }
  }
  return null;
}
function updateMonsters() {
  if (safeFrames > 0) safeFrames--;
  for (const m of monsters) {
    if (m.stun > 0) { m.stun--; m.chasing = false; continue; }
    if (m.moving) {
      m.t += 1 / MONSTER_STEP;
      m.fx = m.x + (m.tx - m.x) * Math.min(1, m.t); m.fy = m.y + (m.ty - m.y) * Math.min(1, m.t);
      if (m.t >= 1) { m.x = m.tx; m.y = m.ty; m.fx = m.x; m.fy = m.y; m.moving = false; }
      continue;
    }
    if (m.cool > 0) { m.cool--; continue; }
    const dist = Math.abs(m.x - P.x) + Math.abs(m.y - P.y);
    let next = null;
    m.chasing = dist <= CHASE_RADIUS && safeFrames === 0;
    if (m.chasing) { next = stepToward(m, P.x, P.y); m.cool = 4; }
    else {
      m.cool = 30 + Math.floor(Math.random() * 50);
      if (Math.random() < .6) { // passeia perto de onde nasceu
        const opts = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx, dy]) => [m.x + dx, m.y + dy])
          .filter(([x, y]) => Math.abs(x - m.home.x) + Math.abs(y - m.home.y) <= 3 && monsterCanStand(m, x, y));
        if (opts.length) next = opts[Math.floor(Math.random() * opts.length)];
      }
    }
    if (next) { m.tx = next[0]; m.ty = next[1]; m.moving = true; m.t = 0; }
  }
  // encostou no jogador: começa a batalha
  if (safeFrames === 0 && !encounterFlash) {
    const hit = monsters.find(m => !m.stun && Math.abs(m.fx - P.fx) + Math.abs(m.fy - P.fy) < 0.85);
    if (hit) { touchedMonster = hit; held.clear(); encounterFlash = 30; SFX.play("alert"); }
  }
}
function wildEncounter() {
  const m = touchedMonster; if (!m) return;
  const base = GHOSTS[m.wild.i];
  const lvl = Math.max(2, state.level + Math.floor(Math.random() * 5) - 3); // nível perto do seu
  const k = 1 + (lvl - 5) * 0.12;
  const enemy = { ...base, level: lvl, hp: Math.max(10, Math.round(base.hp * k)), attack: Math.max(2, Math.round(base.attack * 0.8 * k)), xp: Math.round(base.xp * (0.8 + lvl * 0.08)) };
  startBattle(enemy, `Um ${base.name} selvagem alcançou você!`, null);
  battle.monster = m;
}
function useAltar() {
  if (state.secret_item) { say("O altar está vazio. As quatro runas continuam brilhando em silêncio."); return; }
  if (puzzleSolved) { collectMedallion(); return; }
  openPuzzle();
}
function openPuzzle() {
  puzzleProgress = []; held.clear();
  // dica: os enigmas já encontrados aparecem no altar; os que faltam ficam como "?"
  const found = cluesFound.filter(Boolean).length;
  $("puzzle-clue").innerHTML = (found ? "Pistas que você encontrou:" : "Você ainda não tem pistas. Leia as pedras gravadas nas trilhas e fale com o espírito antigo.")
    + `<ol class="clue-list">${PUZZLE_ORDER.map((_, i) => cluesFound[i]
        ? `<li><strong>${ORD[i]} runa:</strong> a que ${clueText[i]}.</li>`
        : `<li class="missing"><strong>${ORD[i]} runa:</strong> ? ${i < 3 ? `(pedra gravada da trilha ${i + 1})` : "(espírito antigo)"}</li>`).join("")}</ol>`;
  // as runas mudam de lugar toda vez que o altar é aberto
  const grid = document.querySelector(".rune-grid");
  shuffle([...grid.children]).forEach(b => grid.append(b));
  updatePuzzleUI("As quatro runas precisam ser ativadas na ordem correta.");
  $("puzzle-modal").classList.remove("hidden");
}
function updatePuzzleUI(message) {
  $("puzzle-message").textContent = message;
  $("puzzle-progress").textContent = `Runas ativadas: ${puzzleProgress.length}/4`;
}
function chooseRune(rune) {
  if ($("puzzle-modal").classList.contains("hidden") || puzzleSolved) return;
  const expected = PUZZLE_ORDER[puzzleProgress.length];
  SFX.play("rune", rune === expected);
  if (rune !== expected) {
    puzzleProgress = [];
    updatePuzzleUI("A sequência se apagou! Releia as pistas e tente de novo.");
    return;
  }
  puzzleProgress.push(rune);
  if (puzzleProgress.length === PUZZLE_ORDER.length) {
    puzzleSolved = true;
    $("puzzle-modal").classList.add("hidden");
    say("As quatro runas brilham em harmonia! O selo se rompeu e o Medalhão da Aurora foi revelado.", () => collectMedallion());
    return;
  }
  updatePuzzleUI("A runa ressoou. Continue seguindo as pistas do bosque.");
}
function collectMedallion() {
  if (state.secret_item) return;
  state.secret_item = true; points += 300; updateHUD(); saveProgress(); SFX.play("medal");
  say("Você encontrou o Medalhão da Aurora! Uma luz ancestral envolve Caterpie... ele se transforma em RAYQUAZA! Seus ataques foram substituídos por técnicas lendárias.");
}
$("puzzle-close").onclick = () => {
  $("puzzle-modal").classList.add("hidden");
  showMessage("O selo permanece fechado. Volte ao altar quando estiver pronto."); canvas.focus();
};
document.querySelectorAll("[data-rune]").forEach(btn => btn.addEventListener("click", () => chooseRune(btn.dataset.rune)));

function challenge(L) {
  const win = L.flag === "gym1_won"
    ? () => { state.gym1_won = true; points += 250; updateHUD(); say("Você venceu! O líder abre o portão: a Trilha das Lápides está livre ao norte."); saveProgress(); }
    : () => finishGame();
  const go = () => say(L.intro, () => startBattle(L.ghost, L.name, win));
  if (L.line) say(L.name + ": " + L.line, go); else go();
}
function interact() {
  if (dialogOpen()) { nextDialog(); return; }
  if (battle || puzzleOpen() || !state.token || P.moving) return;
  const s = storyFor(scr), [dx, dy] = DIRS[P.dir], fx = P.x + dx, fy = P.y + dy;
  if (leaderActive(s) && Math.abs(s.leader.x - P.x) + Math.abs(s.leader.y - P.y) <= 1) { challenge(s.leader); return; }
  const npc = s.npcs.find(n => n.x === fx && n.y === fy) || s.npcs.find(n => Math.abs(n.x - P.x) + Math.abs(n.y - P.y) <= 1);
  if (npc) { say(npc.name + ": " + (typeof npc.text === "function" ? npc.text() : npc.text)); return; }
  const v = tileAt(fx, fy);
  if (v === 12) { useAltar(); return; }
  if (v === 13 && cur().clueIndex !== undefined) { say("Uma pedra antiga com letras que brilham no escuro: " + readClue(cur().clueIndex)); return; }
  if (v === 7) { const t = cur().signs?.[fx + "," + fy]; if (t) say(t); return; }
  if (v === 8 && cur().houses) { say(scr === "eclipse" && state.gym2_won ? "O ginásio está em silêncio. A névoa se dissipou." : cur().houses); return; }
  // Sem NPC, placa ou ponto de interesse por perto: nada acontece.
}

// ---------- Batalhas ----------
function startBattle(foe,title,onWin){
  const enemy=typeof foe==="number"?{...GHOSTS[foe],level:foe===3?20:state.level+1}:foe;
  battle={enemy:{...enemy,currentHp:enemy.hp},onWin,over:false};held.clear();SFX.play("battleStart");
  $("battle-title").textContent=title;$("enemy-name").textContent=`${enemy.name} · Nv. ${enemy.level}`;$("enemy-sprite").src=sprite(enemy.id).src;$("enemy-hp").textContent=`HP ${enemy.hp}/${enemy.hp}`;$("ally-hp").textContent=`HP ${state.hp}/${state.max_hp}`;$("battle-ally").src=POKE_SPRITES+(state.secret_item || state.good_ending ? "384.png" : "10.png");
  const evolved = state.secret_item || state.good_ending; $("battle-partner-name").textContent = evolved ? "Rayquaza" : "Caterpie";
  $("attack-btn").textContent = evolved ? "Draco Meteor" : "Investida"; $("web-btn").textContent = evolved ? "Hiper Raio" : "Fio de Seda";
  $("battle-message").textContent=`${enemy.name} apareceu!`; $("battle").classList.remove("hidden");
}
function endBattle(win,run=false){
  $("battle").classList.add("hidden");const b=battle;battle=null;
  if(win){
    const partner=state.secret_item || state.good_ending ? "Rayquaza" : "Caterpie";
    SFX.play("victory");
    state.xp+=b.enemy.xp;points+=b.enemy.xp*2;
    if(b.monster){monsters=monsters.filter(m=>m!==b.monster);safeFrames=60;} // monstro derrotado some da tela
    say(`${b.enemy.name} foi derrotado! ${partner} ganhou ${b.enemy.xp} XP.`);
    // sobe quantos níveis o XP permitir; cada nível aumenta HP e força dos ataques
    if(state.xp>=XP_PER_LEVEL)setTimeout(()=>SFX.play("levelup"),700);
    while(state.xp>=XP_PER_LEVEL){state.xp-=XP_PER_LEVEL;state.level++;state.max_hp+=6;state.hp=state.max_hp;
      say(`${partner} subiu para o nível ${state.level}! HP máximo: ${state.max_hp}. Seus ataques ficaram mais fortes.`);}
    if(b.onWin)b.onWin();
  }
  else if(run){SFX.play("run");if(b.monster)b.monster.stun=150;safeFrames=150;} // fugiu: o monstro fica atordoado e dá tempo de escapar
  else {SFX.play("defeat");state.hp=Math.max(1,Math.ceil(state.max_hp/2));placeAtEntrance();spawnMonsters();safeFrames=120;say((state.secret_item || state.good_ending ? "Rayquaza" : "Caterpie")+" foi resgatado, mas precisará se recuperar. Você voltou à entrada desta área.");}
  updateHUD();saveProgress();
}
function attack(power){
  if(!battle||battle.over)return;
  const b=battle, evolved=state.secret_item || state.good_ending;
  const partner=evolved?"Rayquaza":"Caterpie";
  // Sem o Medalhão, Caterpie não consegue ferir Gengar: a batalha é impossível de vencer.
  const powerlessAgainstGengar = b.enemy.name === "Gengar" && !evolved;
  const damage = powerlessAgainstGengar ? 0 : Math.max(2,Math.floor((state.level*1.6+power)*(evolved?5.5:1.4)));
  b.enemy.currentHp-=damage;
  SFX.play(powerlessAgainstGengar?"noEffect":"attack", evolved);
  if(b.enemy.currentHp<=0){SFX.play("faint");
    $("enemy-hp").textContent="HP 0";
    b.over=true;$("battle-message").textContent=`${partner} causou ${damage} de dano! Vitória!`;
    setTimeout(()=>endBattle(true),650);return;
  }
  const hit=b.enemy.attack;
  state.hp=Math.max(0,state.hp-hit);
  setTimeout(()=>SFX.play("hurt"),260); // o contra-ataque do inimigo
  $("enemy-hp").textContent=`HP ${b.enemy.currentHp}/${b.enemy.hp}`;
  $("ally-hp").textContent=`HP ${state.hp}/${state.max_hp}`;
  $("hp").textContent=`${state.hp}/${state.max_hp}`;
  $("battle-message").textContent=powerlessAgainstGengar
    ? `Caterpie tentou atacar, mas Gengar é poderoso demais! O Medalhão da Aurora poderia despertar seu verdadeiro poder. Gengar causou ${hit} de dano.`
    : `${partner} causou ${damage} de dano. ${b.enemy.name} respondeu com ${hit}!`;
  if(state.hp<=0){b.over=true;$("battle-message").textContent=`${partner} não consegue continuar...`;setTimeout(()=>endBattle(false),650);}
}
$("attack-btn").onclick=()=>attack(state.secret_item || state.good_ending ? 12 : 3);$("web-btn").onclick=()=>attack(state.secret_item || state.good_ending ? 20 : 5);$("run-btn").onclick=()=>endBattle(false,true);
function finishGame(){
  state.gym2_won=true;state.good_ending=state.secret_item;points+=500;
  say("O fantasma de Noctus se desfaz. A escuridão e a neblina começam a se dissipar sobre a região...");
  if(state.good_ending){say("Rayquaza libera todo o seu poder e derrota a maldição! Você conquistou o FINAL BOM.",()=>recordMatch("good"));}
  else{say("A maldição foi vencida. Mas sem o Medalhão, o segredo de Caterpie permanece adormecido. FINAL NORMAL.",()=>recordMatch("normal"));}
  updateHUD();saveProgress();
}
async function recordMatch(ending){try{await api("/matches",{method:"POST",body:JSON.stringify({points,ending,duration_seconds:Math.floor((Date.now()-startedAt)/1000)})});showMessage("Sua partida foi registrada no ranking!");}catch(e){showMessage(e.message);}}

// ---------- Laço do jogo ----------
function update() {
  frame++;
  if (fadeDir) {
    fade += fadeDir * 0.1;
    if (fade >= 1) {
      fade = 1; scr = pending.id;
      P.x = P.fx = pending.x; P.y = P.fy = pending.y; P.dir = pending.dir; P.moving = false; pending = null; fadeDir = -1;
      if (!canStand(P.x, P.y)) placeAtStart();
      entryPoint = { scr, x: P.x, y: P.y, dir: P.dir };
      scanPumpkins(); lamps = scanLights(); spawnMonsters(); syncState(); updateHUD(); saveProgress(true);
      showMessage(`Você entrou em ${cur().title}.`);
    } else if (fade <= 0) { fade = 0; fadeDir = 0; }
  }
  if (P.moving) {
    P.t += 1 / 14; // velocidade de caminhada: quanto maior o divisor, mais devagar
    P.fx = P.x + (P.tx - P.x) * Math.min(1, P.t); P.fy = P.y + (P.ty - P.y) * Math.min(1, P.t);
    if (P.t >= 1) { P.x = P.tx; P.y = P.ty; P.fx = P.x; P.fy = P.y; P.moving = false; afterStep(); }
  }
  if (state.gym2_won && gloom > 0) gloom = Math.max(0, gloom - 0.006); // ~3 s para clarear
  if (encounterFlash > 0 && --encounterFlash === 0) wildEncounter();
  // os monstros só se mexem quando o jogo não está pausado por diálogo, puzzle, batalha ou troca de tela
  if (!fadeDir && !dialogOpen() && !puzzleOpen() && !battle && !encounterFlash) updateMonsters();
  if (!busy() && held.size) tryMove([...held].pop());
  fog.forEach(f => { f.x += f.s; if (f.x - f.r > SW) f.x = -f.r; });
  wisps.forEach(w => { w.p += .02; w.x += Math.cos(w.p * .7) * .3; w.y += Math.sin(w.p) * .25; if (w.x < 0) w.x = SW; if (w.x > SW) w.x = 0; if (w.y < 0) w.y = SH; if (w.y > SH) w.y = 0; });
}

function hole(x,y,r,a){const g=dc.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(0,0,0,${a})`);g.addColorStop(1,"rgba(0,0,0,0)");dc.fillStyle=g;dc.fillRect(x-r,y-r,r*2,r*2)}
function glow(x,y,r,col){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}

function drawCharacter(rows, pal, floating, fx, fy, bobWalk) {
  const baseY = Math.round(fy * T), hx = Math.round(fx * T);
  const bob = floating ? Math.round(Math.sin(frame * .08 + fx) * 1.5) - 2 : bobWalk;
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(hx + 4, baseY + 14, 8, 2);
  // Avatares e NPCs mantêm o pixel art original (16x24); somente Pokémon usam 16x16.
  stamp(ctx, rows, pal, hx, baseY + T - rows.length + bob);
  const tx = Math.round(fx), ty = Math.round(fy), g = cur().grid;
  if (g[ty]?.[tx] === 3 && !floating) { ctx.save(); ctx.beginPath(); ctx.rect(tx*T, ty*T+8, T, 8); ctx.clip(); drawMoss(ctx, tx*T, ty*T, tx, ty); drawTall(ctx, tx*T, ty*T); ctx.restore(); }
}

function drawMonster(m) {
  const L = MONSTER_LOOKS[m.wild.look], hx = Math.round(m.fx * T), baseY = Math.round(m.fy * T);
  const bob = Math.round(Math.sin(frame * .12 + m.seed) * 1.5) - 3;
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(hx + 4, baseY + 13, 8, 2);
  if (m.stun > 0 && (frame >> 3) % 2) ctx.globalAlpha = .45; // pisca enquanto está atordoado
  stamp(ctx, L.rows, L.pal, hx, baseY + bob);
  ctx.globalAlpha = 1;
  if (m.chasing) { ctx.fillStyle = "#ff6a3a"; ctx.fillRect(hx + 7, baseY + bob - 3, 2, 2); } // ponto laranja: está perseguindo
}
function draw() {
  const g = cur().grid, s = storyFor(scr);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) renderTile(ctx, g[y][x], x, y, g, frame);
  drawHouses(ctx, g, frame);
  // runas do bosque: roxas enquanto o selo está fechado, douradas depois
  (cur().runes || []).forEach(([rx, ry], i) => {
    const on = puzzleSolved || state.secret_item, a = .55 + Math.sin(frame * .08 + i) * .25;
    ctx.fillStyle = on ? `rgba(246,215,139,${a})` : `rgba(167,139,250,${a})`;
    const x = rx * T + 6, y = ry * T + 6; ctx.fillRect(x, y + 1, 4, 2); ctx.fillRect(x + 1, y, 2, 4);
  });
  // inscrição das pedras gravadas: roxa enquanto não lida, dourada depois
  if (cur().clueIndex !== undefined) g.forEach((row, y) => row.forEach((v, x) => { if (v !== 13) return;
    const read = cluesFound[cur().clueIndex], a = .6 + Math.sin(frame * .09) * .3;
    ctx.fillStyle = read ? `rgba(246,215,139,${a})` : `rgba(190,160,255,${a})`;
    const px = x * T, py = y * T; ctx.fillRect(px + 5, py + 6, 6, 1); ctx.fillRect(px + 7, py + 5, 2, 6); ctx.fillRect(px + 5, py + 10, 6, 1);
  }));
  // Medalhão da Aurora sobre o altar
  if (s.altar && !state.secret_item) {
    const ix = s.altar.x * T + 8, iy = s.altar.y * T - 2 + Math.round(Math.sin(frame * .1));
    ctx.fillStyle = "#f6d78b"; ctx.fillRect(ix - 2, iy - 2, 4, 4);
    ctx.fillStyle = "#fff6d8"; ctx.fillRect(ix - 1, iy - 5, 2, 10); ctx.fillRect(ix - 5, iy - 1, 10, 2);
  }
  // personagens ordenados por linha (quem está mais abaixo fica na frente)
  const actors = blockers().map(n => ({ y: n.y, draw: () => { const sp = npcSprite(n.look); drawCharacter(sp.rows, sp.pal, sp.float, n.x, n.y, 0); } }));
  monsters.forEach(m => actors.push({ y: m.fy, draw: () => drawMonster(m) }));
  actors.push({ y: P.fy, draw: () => drawCharacter(avatar[P.dir], avatar.pal, !!avatar.float, P.fx, P.fy, P.moving && P.t > .25 && P.t < .75 ? -1 : 0) });
  actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());
  if (encounterFlash > 0) { // balão de "!" quando um monstro aparece no mato
    const bx = Math.round(P.fx * T) + 4, by = Math.round(P.fy * T) - 22 - (encounterFlash > 30 ? 40 - encounterFlash : 0);
    ctx.fillStyle = "#1a1224"; ctx.fillRect(bx - 1, by - 1, 10, 12); ctx.fillStyle = "#fff6d8"; ctx.fillRect(bx, by, 8, 10);
    ctx.fillStyle = "#c8282a"; ctx.fillRect(bx + 3, by + 1, 2, 5); ctx.fillRect(bx + 3, by + 7, 2, 2);
  }

  wisps.forEach(w => { ctx.fillStyle = "#9fe870"; ctx.fillRect(Math.round(w.x), Math.round(w.y), 2, 2); });
  if (gloom > .01) fog.forEach(f => { const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); gr.addColorStop(0, `rgba(190,180,220,${.14 * gloom})`); gr.addColorStop(1, "rgba(190,180,220,0)"); ctx.fillStyle = gr; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); });
  if (gloom > .01) {
    const cx = Math.round(P.fx * T) + 8, cy = Math.round(P.fy * T) + 4;
    dc.globalCompositeOperation = "source-over"; dc.clearRect(0, 0, SW, SH); dc.fillStyle = `rgba(8,4,22,${.82 * gloom})`; dc.fillRect(0, 0, SW, SH);
    dc.globalCompositeOperation = "destination-out";
    const fl = Math.sin(frame * .21) * 2 + Math.sin(frame * .07) * 1.5;
    hole(cx, cy, 46 + fl, 1);
    pumpkins.forEach(([px, py], i) => hole(px, py, 22 + Math.sin(frame * .15 + i) * 1.5, .85));
    wisps.forEach(w => hole(w.x, w.y, 9, .6));
    lamps.forEach(([lx, ly], i) => hole(lx, ly + 2, 30 + Math.sin(frame * .13 + i) * 1.5, .9));
    houseRects(g).forEach(r => hole(r.x * T + r.w * 8, r.y * T + r.h * 10, 14 + r.w * 3, .45));
    if (s.altar) hole(s.altar.x * T + 8, s.altar.y * T + 4, state.secret_item ? 18 : 24, .9);
    (cur().runes || []).forEach(([rx, ry]) => hole(rx * T + 8, ry * T + 8, 10, .6));
    g.forEach((row, y) => row.forEach((v, x) => { if (v === 13) hole(x * T + 8, y * T + 8, 20, .85); }));
    monsters.forEach(m => hole(m.fx * T + 8, m.fy * T + 6, 14, .55)); // os olhos brilham no escuro
    s.npcs.filter(n => n.look === "espirito").forEach(n => hole(n.x * T + 8, n.y * T + 4, 18, .7));
    ctx.drawImage(dark, 0, 0);
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = gloom;
    glow(cx, cy, 40 + fl, "rgba(255,170,70,.10)");
    pumpkins.forEach(([px, py]) => glow(px, py, 18, "rgba(255,120,30,.16)"));
    wisps.forEach(w => glow(w.x + 1, w.y + 1, 7, "rgba(160,240,110,.25)"));
    monsters.forEach(m => glow(m.fx * T + 8, m.fy * T + 6, 12, MONSTER_LOOKS[m.wild.look].eye));
    lamps.forEach(([lx, ly]) => glow(lx, ly + 2, 24, "rgba(255,200,100,.16)"));
    if (s.altar) glow(s.altar.x * T + 8, s.altar.y * T + 4, 18, state.secret_item ? "rgba(167,139,250,.18)" : "rgba(255,220,140,.25)");
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, SW, SH); }
}
(function loop() {
  if (!$("game-screen").classList.contains("hidden")) { update(); draw(); }
  requestAnimationFrame(loop);
})();

// ---------- Avatares e modo de mapa ----------
AVATARS.forEach(a => {
  const b = document.createElement("button"); b.className = "av"; b.type = "button"; b.setAttribute("aria-pressed", a === avatar);
  const c = document.createElement("canvas"); c.width = 16; c.height = 24; stamp(c.getContext("2d"), a.down, a.pal, 0, 0);
  b.append(c, document.createTextNode(a.n));
  b.addEventListener("click", () => {
    avatar = a; document.querySelectorAll(".av").forEach(x => x.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", "true");
    try { localStorage.setItem("tlh-avatar", a.id); } catch (e) {}
    canvas.focus();
  });
  $("avatars").append(b);
});
// ---------- Som ----------
function updateSoundButton() {
  const b = $("sound-btn"); b.setAttribute("aria-pressed", SFX.enabled);
  b.textContent = SFX.enabled ? "Som: ligado" : "Som: desligado";
}
$("sound-btn").addEventListener("click", () => { SFX.toggle(); updateSoundButton(); canvas.focus(); });
updateSoundButton();
// o navegador só libera o áudio depois da primeira interação do jogador
["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, () => SFX.unlock(), { once: true }));

// ---------- Controles ----------
const KEY_DIRS = { w:"up", arrowup:"up", s:"down", arrowdown:"down", a:"left", arrowleft:"left", d:"right", arrowright:"right" };
function inGame() { return state.token && $("auth-screen").classList.contains("hidden"); }
window.addEventListener("keydown", e => {
  // Os controles do jogo só funcionam depois da autenticação.
  if (!inGame()) return;
  const key = e.key.toLowerCase();
  if (KEY_DIRS[key]) { e.preventDefault(); if (!dialogOpen() && !battle && !puzzleOpen()) { held.delete(KEY_DIRS[key]); held.add(KEY_DIRS[key]); } return; }
  if (key === "m") { e.preventDefault(); SFX.toggle(); updateSoundButton(); return; }
  // K = A do Game Boy (confirmar/interagir); E e Enter são atalhos.
  if (key === "k" || key === "e" || key === "enter") { e.preventDefault(); if (!e.repeat) interact(); return; }
  // J = B do Game Boy (voltar/cancelar/fechar diálogo ou modal).
  if (key === "j" || key === "escape" || key === "backspace") {
    e.preventDefault();
    if (dialogOpen()) { dialogQueue = []; $("dialog").classList.add("hidden"); }
    else if (puzzleOpen()) $("puzzle-close").click();
    else if (!$("battle").classList.contains("hidden")) endBattle(false, true);
    else if (!$("ranking-modal").classList.contains("hidden")) $("ranking-modal").classList.add("hidden");
  }
});
window.addEventListener("keyup", e => { const d = KEY_DIRS[e.key.toLowerCase()]; if (d) held.delete(d); });
window.addEventListener("blur", () => held.clear());
document.querySelectorAll("[data-dir]").forEach(btn => {
  const d = btn.dataset.dir;
  btn.addEventListener("pointerdown", e => { e.preventDefault(); if (!dialogOpen() && !battle && !puzzleOpen()) held.add(d); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => btn.addEventListener(ev, () => held.delete(d)));
});
$("interact-btn").onclick = interact; $("save-btn").onclick = () => { if (!battle) saveNow(); };
$("logout-btn").onclick=()=>{localStorage.removeItem("tlh-token");state.token=null;location.reload();};
$("ranking-open").onclick=async()=>{ $("ranking-modal").classList.remove("hidden");try{const rows=await api("/ranking");$("ranking-list").innerHTML=rows.length?rows.map(r=>`<li><strong>${escapeHtml(r.username)}</strong> — ${r.points} pts <small>(${r.ending||"em jornada"})</small></li>`).join(""):"<li>Ainda não há partidas registradas.</li>";}catch(e){$("ranking-list").innerHTML="<li>Ranking indisponível.</li>";}};
$("ranking-close").onclick=()=>$("ranking-modal").classList.add("hidden");
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

// Retoma a sessão salva, se houver
(async()=>{const token=localStorage.getItem("tlh-token");if(token){state.token=token;try{const me=await api("/me");state.player={id:me.player_id,username:me.username};applyProgress(me);enterGame();}catch{localStorage.removeItem("tlh-token");state.token=null;}}})();
