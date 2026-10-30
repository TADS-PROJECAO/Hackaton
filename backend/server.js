require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.error("ERRO: configure JWT_SECRET no .env");
  process.exit(1);
}

app.use(express.json({ limit: "30kb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida. Entre novamente." });
  }
}

const initialProgress = async (playerId) => {
  await db.query(
    `INSERT INTO game_progress (player_id) VALUES ($1)
     ON CONFLICT (player_id) DO NOTHING`, [playerId]
  );
};

app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username))
      return res.status(400).json({ error: "Usuário: 3 a 24 caracteres, letras, números ou _." });
    if (password.length < 6)
      return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      "INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, hash]
    );
    const player = result.rows[0];
    await initialProgress(player.id);
    const token = jwt.sign({ id: player.id, username: player.username }, SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, player });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Esse usuário já existe." });
    console.error(err);
    res.status(500).json({ error: "Não foi possível criar a conta." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const result = await db.query("SELECT * FROM players WHERE username = $1", [username]);
    const player = result.rows[0];
    if (!player || !(await bcrypt.compare(password, player.password_hash)))
      return res.status(401).json({ error: "Usuário ou senha incorretos." });

    await initialProgress(player.id);
    const token = jwt.sign({ id: player.id, username: player.username }, SECRET, { expiresIn: "7d" });
    res.json({ token, player: { id: player.id, username: player.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao entrar." });
  }
});

app.get("/api/me", auth, async (req, res) => {
  const result = await db.query(
    `SELECT p.id, p.username, g.* FROM players p
     JOIN game_progress g ON g.player_id = p.id WHERE p.id = $1`,
    [req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Jogador não encontrado." });
  res.json(result.rows[0]);
});

// Mapas aceitos: as telas do mundo (cidade, corredor, encruzilhada, bosque, eclipse), as rotas antigas e os nomes antigos.
const allowedMaps = new Set(["cidade", "corredor", "encruzilhada", "bosque", "eclipse", "vilarejo", "floresta", "cidade2"]);
const isValidMap = (m) => typeof m === "string" && (allowedMaps.has(m) || /^rota-\d{1,4}$/.test(m));
app.put("/api/progress", auth, async (req, res) => {
  try {
    const b = req.body;
    const map = isValidMap(b.current_map) ? b.current_map : "cidade";
    const x = Math.max(0, Math.min(19, Number.parseInt(b.player_x, 10) || 2));
    const y = Math.max(0, Math.min(13, Number.parseInt(b.player_y, 10) || 5));
    const level = Math.max(1, Math.min(99, Number.parseInt(b.level, 10) || 5));
    const xp = Math.max(0, Math.min(999999, Number.parseInt(b.xp, 10) || 0));
    const hp = Math.max(0, Math.min(999, Number.parseInt(b.hp, 10) || 0));
    const maxHp = Math.max(1, Math.min(999, Number.parseInt(b.max_hp, 10) || 35));
    const result = await db.query(
      `UPDATE game_progress SET current_map=$1, player_x=$2, player_y=$3,
       level=$4, xp=$5, hp=$6, max_hp=$7, secret_item=$8, gym1_won=$9,
       gym2_won=$10, good_ending=$11, updated_at=NOW()
       WHERE player_id=$12 RETURNING *`,
      [map,x,y,level,xp,hp,maxHp,!!b.secret_item,!!b.gym1_won,!!b.gym2_won,!!b.good_ending,req.user.id]
    );
    res.json({ saved: true, progress: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Não foi possível salvar o progresso." });
  }
});

app.post("/api/matches", auth, async (req, res) => {
  try {
    const points = Math.max(0, Math.min(100000, Number.parseInt(req.body.points, 10) || 0));
    const ending = ["good", "normal", "incomplete"].includes(req.body.ending) ? req.body.ending : "incomplete";
    const duration = Math.max(0, Math.min(86400, Number.parseInt(req.body.duration_seconds, 10) || 0));
    const result = await db.query(
      `INSERT INTO matches (player_id, points, ending, duration_seconds)
       VALUES ($1,$2,$3,$4) RETURNING id, points, ending, created_at`,
      [req.user.id, points, ending, duration]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Não foi possível registrar a partida." });
  }
});

app.get("/api/ranking", async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT p.username, MAX(m.points) AS points,
       MAX(m.ending) FILTER (WHERE m.ending <> 'incomplete') AS ending
       FROM matches m JOIN players p ON p.id=m.player_id
       GROUP BY p.id, p.username ORDER BY points DESC LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ranking indisponível." });
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", game: "The Last Halloween" }));

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../frontend/index.html")));

app.listen(PORT, () => console.log(`The Last Halloween rodando na porta ${PORT}`));
