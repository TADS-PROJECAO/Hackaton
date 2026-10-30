# Pokémon: The Last Halloween

Aventura 2D de navegador criada para a categoria **Avançada (Veteranos)** do Hackathon Projeção 2026.

## Tecnologias
- Frontend: HTML5, CSS3, JavaScript e Canvas.
- Backend: Node.js + Express (API REST).
- Banco: PostgreSQL.
- Autenticação: bcryptjs + JWT.
- Dados e sprites Pokémon: PokéAPI / repositório PokeAPI Sprites.

## Requisitos
- Node.js 20 ou superior.
- PostgreSQL (Neon, Supabase ou instalação local).
- Navegador moderno.

## Executar localmente
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um banco PostgreSQL e execute `database/schema.sql` nele.
3. Copie `.env.example` para `.env` e preencha:
   - `DATABASE_URL`
   - `JWT_SECRET` (uma chave longa e aleatória)
   - `PORT=3000`
4. Inicie:
   ```bash
   npm start
   ```
5. Acesse http://localhost:3000

## Publicar na internet (Render + Neon)
1. Crie um banco PostgreSQL no Neon e copie a connection string.
2. Envie este projeto para um repositório GitHub.
3. No Render, crie um **Web Service** conectado ao repositório.
4. Build command: `npm install`
5. Start command: `npm start`
6. Configure as variáveis `DATABASE_URL`, `JWT_SECRET` e `NODE_ENV=production`.
7. Execute `database/schema.sql` no SQL Editor do Neon.
8. Aguarde o deploy e teste a URL `/api/health`, o cadastro e o salvamento de progresso.

A URL pública deve ser adicionada aqui antes da entrega:
`https://SEU-SERVICO.onrender.com`

## Mapa e história
O mundo é formado por telas fixas de 16×12 blocos, ligadas pelas bordas:

```text
                                     Encruzilhada
 Bosque ◄─ Trilha 3 ◄─ Trilha 2 ◄─ Trilha 1 ◄─ (oeste · leste) ─►  Cidade do Eclipse
(puzzle)                                         ▲                    (final)
                                                 │
                                   Trilha das Lápides (corredor)
                                                 ▲
                                   Vila das Lanternas (cidade inicial)
```

- **Vila das Lanternas:** cidade inicial, cercada. O líder do Ginásio 1 guarda o portão norte.
- **Trilha das Lápides:** só um corredor até a encruzilhada.
- **Encruzilhada:** à esquerda começam as três Trilhas das Runas; à direita fica a Cidade do Eclipse.
- **Trilhas das Runas (Pântano Raso, Cemitério Velho, Clareira das Abóboras):** três telas de caminho antes do puzzle. Cada uma tem uma pedra gravada com uma pista.
- **Bosque dos Sussurros:** o altar com o puzzle das quatro runas e o Medalhão da Aurora.
- **Cidade do Eclipse:** o líder Noctus e a batalha final.
- As telas ficam em `WORLD`, no `frontend/js/map.js`. NPCs e líderes ficam em `STORY`, no `frontend/js/game.js`.
- Para trocar a arte das abóboras, coloque `frontend/sprites/abobora.png`.
- **Monstros selvagens:** aparecem no mapa de cada tela (a cidade é segura). Eles passeiam e, quando o jogador chega a até 6 blocos, perseguem; se encostarem, começa a batalha. São mais lentos que o jogador, então dá para fugir. Cada monstro fica preso à sua tela e nunca passa para a próxima. Vencer tira o monstro da tela (ele volta quando você sai e entra de novo); fugir deixa o monstro atordoado por alguns segundos. Vencer dá XP; a cada 100 XP o parceiro sobe de nível, recupera todo o HP e fica mais forte. Andando, o HP se recupera aos poucos.
- **Puzzle das runas:** a ordem é sorteada a cada partida. As dicas são enigmas (ex.: "a 1ª runa é a que ilumina a noite sem aquecer"): as pistas 1, 2 e 3 ficam nas pedras gravadas das trilhas, e a 4ª com o Espírito antigo. O altar mostra as pistas já encontradas. As runas mudam de lugar sempre que o altar é aberto. Os enigmas ficam em `RIDDLES`, no `game.js`.
- **Escuridão e neblina:** cobrem a região até a vitória contra o segundo ginásio; depois disso se dissipam.
- Ajustes rápidos no `game.js`: `SPAWNS` (quantos monstros por tela), `CHASE_RADIUS` (distância de perseguição), `MONSTER_STEP` (velocidade dos monstros), `XP_PER_LEVEL` (XP por nível), `WILD` (monstros do mato) e `P.t += 1 / 14` (velocidade de caminhada).

## Controles
- WASD ou setas: movimentar.
- K: botão A do Game Boy (confirmar/interagir).
- J: botão B do Game Boy (voltar/cancelar/fechar diálogo).
- E ou Enter: atalho alternativo para interagir.
- Em dispositivos móveis, use os botões direcionais na tela.

## Funcionalidades implementadas
- Cadastro e login com senha protegida por hash.
- Mapa 2D em pixel art no formato do DS: tela 256×192, blocos 16×16 (16×12) e subgrade 8×8.
- Mundo em telas conectadas: cidade, corredor, encruzilhada, bosque do puzzle (esquerda) e área final (direita).
- Avatares originais (Bruxa, Andarilho, Esqueleto, Lençol) e modo de mapa (escuridão, neblina, grade 16×16 e subgrade 8×8).
- NPCs e diálogos.
- Batalhas contra Pokémon Fantasma.
- Caterpie como parceiro único.
- Medalhão da Aurora como item secreto.
- Progressão dos ginásios e dois finais.
- Salvamento de progresso no PostgreSQL.
- Registro de partidas e ranking.

## Estrutura
```text
pokemon_the_last_halloween_web/
├── backend/
│   ├── db.js
│   └── server.js
├── database/
│   └── schema.sql
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── map.js    (mapa: telas do mundo, blocos, avatares, luz e neblina)
│       └── game.js   (interface, história, batalhas e ranking)
├── .env.example
├── package.json
└── README.md
```

## Observações importantes
- Os sprites são carregados do repositório público PokeAPI Sprites. Para apresentação sem internet, baixem os arquivos necessários e sirvam localmente.
- Pokémon e seus personagens são propriedades de seus respectivos titulares. Este é um projeto acadêmico, não oficial e sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Verifiquem as condições de uso dos recursos antes de redistribuição pública.
- A PokéAPI é somente leitura (GET). O progresso e as partidas do jogo são gravados pelo nosso próprio backend no PostgreSQL.
- Não coloque senhas reais ou `.env` dentro do ZIP de entrega.

\n## Solução de problemas\n\n**Não consigo criar conta / entrar:** não abra `frontend/index.html` diretamente. O navegador precisa acessar o backend. Execute `npm install`, configure o `.env`, crie o banco PostgreSQL e rode `npm start`; depois abra `http://localhost:3000`. Confira também se `DATABASE_URL` e `JWT_SECRET` estão preenchidos e se o script `database/schema.sql` foi executado no banco.\n\n**Teclas na tela de login:** os controles de gameplay ficam desativados até autenticar.\n**Interação:** K (A), E ou Enter interagem apenas quando há NPC/ponto de interesse próximo; sem alvo, nada acontece. J (B), Esc ou Backspace cancelam/fecham.\n