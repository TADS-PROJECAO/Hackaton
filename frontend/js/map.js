// =====================================================================
// map.js — motor do mapa do Bosque Sombrio
// Tela 256×192 · blocos 16×16 (16×12) · subgrade 8×8 (32×24) · personagem 16×24
// Contém: tipos de bloco, as telas do mundo (cidade, corredor, encruzilhada,
// bosque e eclipse), a pixel art dos blocos e os avatares originais. Usado por game.js.
// =====================================================================
const T=16, W=16, H=12, SW=W*T, SH=H*T; // 256×192
const TILES={
  0:{n:"Musgo",c:"#2e3b2a",walk:1},1:{n:"Árvore morta",c:"#3a2c42",walk:0},2:{n:"Trilha",c:"#6b5844",walk:1},
  3:{n:"Mato espinhoso",c:"#1f2a1c",walk:1},4:{n:"Abóbora",c:"#e2701e",walk:1},5:{n:"Pântano",c:"#2f4a3a",walk:0},
  6:{n:"Lápide",c:"#6c6a7a",walk:0},7:{n:"Placa",c:"#7a5432",walk:0},8:{n:"Casa",c:"#4a3446",walk:0},
  9:{n:"Calçada",c:"#4a4552",walk:1},10:{n:"Cerca",c:"#3a2a22",walk:0},11:{n:"Lampião",c:"#ffd36a",walk:0},
  12:{n:"Altar das runas",c:"#8a6ab8",walk:0},13:{n:"Pedra gravada",c:"#7a7a9a",walk:0}
};


function rngOf(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hash=(x,y,s=0)=>{let h=(x*374761393+y*668265263+s*982451653)|0;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296};

// ---------- Mundo: telas fixas ligadas pelas bordas ----------
// Cidade → (norte) Corredor → (norte) Encruzilhada → leste: Eclipse (final)
//                                                   → oeste: Trilha 1 → Trilha 2 → Trilha 3 → Bosque (puzzle)
// Cada tela tem 16×12 blocos. As saídas ficam alinhadas: a coluna/linha de saída de uma tela
// é a mesma coluna/linha de entrada da tela vizinha (ex.: norte x 7–8 → sul x 7–8).
//
// Legenda dos mapas:
//  ,  musgo (0)        T  árvore morta (1)   =  trilha (2)      g  mato espinhoso (3)
//  p  abóbora (4)      ~  pântano (5)        t  lápide (6)      s  placa (7)
//  H  casa/ginásio (8) :  calçada (9)        #  cerca (10)      L  lampião (11)
//  A  altar das runas (12)   X  pedra gravada com pista (13)
const LEGEND={",":0,"T":1,"=":2,"g":3,"p":4,"~":5,"t":6,"s":7,"H":8,":":9,"#":10,"L":11,"A":12,"X":13};
const parseGrid=(rows)=>rows.map(r=>r.split("").map(ch=>LEGEND[ch]));

const WORLD={
  cidade:{
    title:"Vila das Lanternas", chapter:"CAPÍTULO 1 · A CIDADE",
    start:{x:7,y:10,dir:"up"},
    exits:{n:"corredor"},
    rows:[
      "TTTTTTT==TTTTTTT",
      "T######::######T",
      "T#,HHH,::,HHH,#T",
      "T#,HHH,::,HHH,#T",
      "T#p,:,L::L,:,p#T",
      "T#::::::::::::#T",
      "T#:,,,s::,,,,:#T",
      "T#:HHH,::,HHH:#T",
      "T#:HHH,::,HHH:#T",
      "T#:,:,L::L,:,:#T",
      "T#::::::::::::#T",
      "T##############T"],
    signs:{"6,6":"VILA DAS LANTERNAS. Portão norte: Trilha das Lápides."},
    houses:"A porta está trancada. Ninguém sai de casa nesta noite."
  },
  corredor:{
    title:"Trilha das Lápides", chapter:"CAPÍTULO 1 · O CORREDOR",
    exits:{n:"encruzilhada", s:"cidade"},
    rows:[
      "TTTTTTT==TTTTTTT",
      "TTTTTT,==,TTTTTT",
      "TTTTTt,==,gTTTTT",
      "TTTTTp,==,,TTTTT",
      "TTTTTT,==,tTTTTT",
      "TTTTTg,==,pTTTTT",
      "TTTTTt,==,,TTTTT",
      "TTTTTT,==,gTTTTT",
      "TTTTTp,==,tTTTTT",
      "TTTTTg,==,,TTTTT",
      "TTTTTT,==,TTTTTT",
      "TTTTTTT==TTTTTTT"]
  },
  encruzilhada:{
    title:"Encruzilhada", chapter:"CAPÍTULO 2 · ESCOLHA O CAMINHO",
    exits:{s:"corredor", w:"trilha1", e:"eclipse"},
    rows:[
      "TTTTTTTTTTTTTTTT",
      "TTTt,,TTTT,,pTTT",
      "TT,,g,,TT,,,,,TT",
      "TT,p,,,,,,,g,,TT",
      "T,,,,,,s,,,,,t,T",
      "================",
      "================",
      "TT,,g,,==,,t,,TT",
      "TTT,,,,==,,,,TTT",
      "TTTp,,,==,,g,TTT",
      "TTTT,,,==,,,TTTT",
      "TTTTTTT==TTTTTTT"],
    signs:{"7,4":"← Oeste: Trilhas das Runas e o Bosque dos Sussurros. Leia as pedras gravadas no caminho.  Leste: Cidade do Eclipse, o último ginásio →"}
  },
  // Três trilhas a oeste da encruzilhada. Cada uma tem uma pedra gravada (X) com uma pista do puzzle.
  trilha1:{
    title:"Pântano Raso", chapter:"CAPÍTULO 2 · TRILHA DAS RUNAS 1/3",
    exits:{e:"encruzilhada", w:"trilha2"}, clueIndex:0,
    rows:[
      "TTTTTTTTTTTTTTTT",
      "TTTt,,,,,,,,gTTT",
      "TT,,========,,TT",
      "TTg,========g,TT",
      "TT,,==,,,,==,pTT",
      "======,g,,======",
      "======,,g,======",
      "TT,g,,,,,,,,g,TT",
      "TT~~~,ggg,,~~~TT",
      "TTT~~~,X,,~~~TTT",
      "TTTT~~~~~~~~TTTT",
      "TTTTTTTTTTTTTTTT"]
  },
  trilha2:{
    title:"Cemitério Velho", chapter:"CAPÍTULO 2 · TRILHA DAS RUNAS 2/3",
    exits:{e:"trilha1", w:"trilha3"}, clueIndex:1,
    rows:[
      "TTTTTTTTTTTTTTTT",
      "TTT,t,X,t,,TTTTT",
      "TT,,,,,,,,,,gTTT",
      "TTt,t,,t,,t,ggTT",
      "TT,,,,g,,,,,,,TT",
      "====,,,,,,,=====",
      "====,t,,t,,=====",
      "TT==,,g,,,,==,TT",
      "TT===========,TT",
      "TTt,ggg,,,ggt,TT",
      "TTTTt,,,,,,tTTTT",
      "TTTTTTTTTTTTTTTT"]
  },
  trilha3:{
    title:"Clareira das Abóboras", chapter:"CAPÍTULO 2 · TRILHA DAS RUNAS 3/3",
    exits:{e:"trilha2", w:"bosque"}, clueIndex:2,
    rows:[
      "TTTTTTTTTTTTTTTT",
      "TTTp,,,,,,,,pTTT",
      "TT,,========,,TT",
      "TTp,==,p,p,==,TT",
      "TT,,==,ggg,==,TT",
      "======,ggg,=====",
      "======,,X,,=====",
      "TT,p,,,,,,,,,pTT",
      "TTT,,g,,,,g,,TTT",
      "TTTTp,,,,,,pTTTT",
      "TTTTTTT,,TTTTTTT",
      "TTTTTTTTTTTTTTTT"]
  },
  bosque:{
    title:"Bosque dos Sussurros", chapter:"CAPÍTULO 2 · O SELO DAS RUNAS",
    exits:{e:"trilha3"},
    rows:[
      "TTTTTTTTTTTTTTTT",
      "TT~~TTTTTTTTTTTT",
      "T~~,,,tTTt,,TTTT",
      "T~,,,:::::,,gTTT",
      "TT,,:::A:::,,,TT",
      "Tg,,:::::::::===",
      "T,,,,:::::::====",
      "TT,t,,,,,,g,,pTT",
      "TT~~,,,,,,,,,TTT",
      "TTT~~~,,t,,,TTTT",
      "TTTTT~~,,,TTTTTT",
      "TTTTTTTTTTTTTTTT"],
    runes:[[5,3],[9,3],[5,5],[9,5]]
  },
  eclipse:{
    title:"Cidade do Eclipse", chapter:"CAPÍTULO 3 · O ÚLTIMO GINÁSIO",
    exits:{w:"encruzilhada"},
    rows:[
      "TTTTTTTTTTTTTTTT",
      "TTTt,,,THHHHTTTT",
      "TT,,,g,LHHHHL,TT",
      "TT,p,,,,::::,,TT",
      "T,,,,t,,::::,g,T",
      "=========:::,,,T",
      "=========:::,p,T",
      "T,,t,,,,,,,,,,TT",
      "TT~~~,,g,,t,,TTT",
      "TTT~~,,,,,,,TTTT",
      "TTTTT,,p,,TTTTTT",
      "TTTTTTTTTTTTTTTT"],
    houses:"As portas do ginásio estão seladas por uma névoa escura."
  }
};
for(const [id,s] of Object.entries(WORLD)){s.id=id;s.grid=parseGrid(s.rows)}

// ---------- Pixel art original (blocos 16×16) ----------
function stamp(ctx,rows,pal,ox,oy){rows.forEach((row,y)=>{for(let x=0;x<row.length;x++){const ch=row[x];if(ch!=="."&&pal[ch]){ctx.fillStyle=pal[ch];ctx.fillRect(ox+x,oy+y,1,1)}}})}
const TREE=[
"..o.....o...o...","..oo...oo..oo...","...oo.oo..oo..o.",".o..ooo..oo..oo.",
".oo..oo.oo..oo..","..ooo.oooo.oo...","....oo.ooooo....","......oBBo......",
"......oBBo......","......oBbo......",".....oBBBo......",".....oBbBBo.....",
"....oBBBbBBo....","...ooBBoBBBoo...","..ssssssssssss..","................"];
const TREEPAL={o:"#4a3a56",B:"#5c4868",b:"#76608a",s:"rgba(0,0,0,.35)"};
const STONE=[
"................","................",".....oooooo.....","....oLLLLLLo....",
"...oLLLLLLLLo...","...oLLLDLLLLo...","...oLLDDDLLLo...","...oLLLDLLLLo...",
"...oLLLDLLLLo...","...oLDDDDDLLo...","...oLLLLLLLLo...","...oLDDLLLLLo...",
"..oooooooooooo..","..ommmmmmmmmmo..","...ssssssssss...","................"];
const STONEPAL={o:"#24222c",L:"#8c8a9a",D:"#5c5a6a",m:"#3a2e22",s:"rgba(0,0,0,.35)"};
const PUMP=[
"................","................","................",".......gg.......",
"......ggo.......","...oooooooooo...","..oPPpPPPPpPPo..",".oPPpYPPPPYpPPo.",
".oPpYYPPPPYYpPo.",".oPPpPPYYPPpPPo.",".oPpYPYYYYPYpPo.",".oPPpYYYYYYpPPo.",
"..oPPpPPPPpPPo..","...oooooooooo...","...ssssssssss...","................"];
const PUMPPAL={o:"#3a1a0a",P:"#e2701e",p:"#b8531a",Y:"#ffd34a",g:"#4a6a2a",s:"rgba(0,0,0,.35)"};
const SIGN=[
"..w.............",".w.w............","..oooooooooooo..","..oWWWWWWWWWWo..",
"..oWbbWbbbWWWo..","..oWWWWWWWWWWo..","..oWbbbWbbWWWo..","..oWWWWWWWWWWo..",
"..oooooooooooo..",".......oTo......",".......oTo......",".......oTo......",
"......soTos.....","................","................","................"];
const SIGNPAL={o:"#24140a",W:"#7a5432",b:"#4a3020",T:"#5e3e24",w:"#c8c4d4",s:"rgba(0,0,0,.35)"};
const TALL=[
"..p.............","..l....l...l....",".lm...lm..lm..l.",".mm.l.mm..mm.lm.",
"dmmlm.mml.mmlmm.","dmmmm.dmmldmmmd.",".dmmm..dmm.dmm..","..d.d...d...d..."];
const TALLPAL={l:"#5a7a4a",m:"#34472e",d:"#18211a",p:"#9a5ab8"};

// ---------- Monstros selvagens do mapa (originais, 16×16) ----------
const MONSTER_LOOKS={
  sombra:{rows:[
    "................",".....oooooo.....","....oPPPPPPo....","...oPPPPPPPPo...",
    "..oPPpPPPPpPPo..","..oPYYPPPPYYPo..","..oPYkPPPPYkPo..","..oPPPPPPPPPPo..",
    "..oPPPmmmmPPPo..","..oPPPPPPPPPPo..","..oPPPPPPPPPPo..","..oPpPPpPPpPPo..",
    "..ooPoPPoPPoPo..","...o.o..o..o.o..","................","................"],
    pal:{o:"#1a0e24",P:"#4a2a6a",p:"#6a3a8a",Y:"#c8ff6a",k:"#101010",m:"#1a0a22"},eye:"rgba(200,255,106,.35)"},
  sombraGrande:{rows:null,pal:{o:"#0e0616",P:"#2a1440",p:"#4a2466",Y:"#ff6a3a",k:"#101010",m:"#0a0410"},eye:"rgba(255,106,58,.35)"},
  caveira:{rows:[
    "................",".......ff.......","......fFFf......",".....ooooooo....",
    "....oWWWWWWWo...","...oWWWWWWWWWo..","...oWkkWWWkkWo..","...oWkkWWWkkWo..",
    "...oWWWWkWWWWo..","....oWWWWWWWo...",".....oWkWkWo....",".....oooooo.....",
    "......fFFf......",".......ff.......","................","................"],
    pal:{o:"#1a1622",W:"#e8e4d8",k:"#1a1422",f:"#5aa83a",F:"#b8f08a"},eye:"rgba(160,240,110,.35)"},
  morcego:{rows:[
    "................","................","................","................",
    "o......oo......o","oo....oBBo....oo","oBo..oBBBBo..oBo","oBBooBRBBRBooBBo",
    "oBBBBBBBBBBBBBBo",".oBBoBBBBBBoBBo.","..oo.oBwwBo.oo..","......oBBo......",
    ".......oo.......","................","................","................"],
    pal:{o:"#0e0a14",B:"#3a2a4a",R:"#ff4a3a",w:"#e8e4d8"},eye:"rgba(255,74,58,.3)"}
};
MONSTER_LOOKS.sombraGrande.rows=MONSTER_LOOKS.sombra.rows;

// ---------- Avatares originais (16×24) ----------
function dirs(down,faceRows,fill,eyeL,eyeR){
  return {down,
    up:down.map((r,i)=>faceRows.includes(i)?r.replace(/[Sk]/g,fill):r),
    left:down.map((r,i)=>eyeL[i]||r),
    right:down.map((r,i)=>eyeR[i]||r)};
}
// desenhados em 16×16 e esticados para 16×24 repetindo 8 linhas escolhidas (cabeça, tronco, pernas)
const grow=(rows,dup)=>rows.flatMap((r,i)=>dup.includes(i)?[r,r]:[r]);
const AVATARS=[
 {id:"bruxa",n:"Bruxa",dup:[2,3,7,8,10,11,12,14],pal:{o:"#120e18",P:"#5a2e8a",G:"#e2701e",H:"#d8602a",S:"#f2c8a0",k:"#1a1a22",N:"#2a2236"},
  ...dirs([
  ".......oo.......","......oPPo......",".....oPPPo......","....oPPPPPo.....",
  "..ooPPGGGPPoo...",".oPPPPPPPPPPPPo.","...oHSSSSSSHo...","...oHkSSSSkHo...",
  "...oHSSSSSSHo...","....oSSSSSSo....","...ooPPPPPPoo...","..oSoPPGGPPoSo..",
  "..oSoPPPPPPoSo..","...oPPPPPPPPo...","....oNNooNNo....",".....oo..oo....."],
  [6,7,8,9],"H",{7:"...oHkSSSSSHo..."},{7:"...oHSSSSSkHo..."})},
 {id:"andarilho",n:"Andarilho",dup:[1,2,4,6,9,10,12,14],pal:{o:"#0e1216",C:"#2f4f5f",S:"#f2c8a0",k:"#1a1a22",L:"#c89a3a",Y:"#ffd34a",N:"#1a1622"},
  ...dirs([
  ".....oooooo.....","....oCCCCCCo....","...oCCCCCCCCo...","..oCCoooooooCo..",
  "..oCoSSSSSSoCo..","..oCoSkSSkSoCo..","..oCoSSSSSSoCo..","...oCoSSSSoCo...",
  "...ooCCCCCCoo...","..oCCCCCCCCCoLo.","..oCoCCCCCCoLLo.","..oCoCCCCCCooYo.",
  "...oCCCCCCCCo...","...oCCCCCCCCo...","....oNNooNNo....",".....oo..oo....."],
  [4,5,6,7],"C",{5:"..oCoSkSkSSoCo.."},{5:"..oCoSSkSSkoCo.."})},
 {id:"esqueleto",n:"Esqueleto",dup:[1,2,5,8,10,11,13,14],pal:{o:"#0e0a12",W:"#e8e4d8",k:"#1a1422",K:"#2a2236"},
  ...dirs([
  ".....oooooo.....","....oWWWWWWo....","...oWWWWWWWWo...","...oWkkWWkkWo...",
  "...oWkkWWkkWo...","...oWWWWWWWWo...","....oWWkkWWo....","....oWkWkWkWo...",
  ".....oWWWWo.....","...ooKKKKKKoo...","..oWoKWKWKKoWo..","..oWoKWKWKKoWo..",
  "...ooKKKKKKoo...","....oWWooWWo....","....oWWooWWo....",".....oo..oo....."],
  [],"W",{3:"...okkWWkkWWo...",4:"...okkWWkkWWo..."},{3:"...oWWkkWWkko...",4:"...oWWkkWWkko..."})},
 {id:"lencol",n:"Lençol",float:true,dup:[3,4,7,9,10,11,12,13],pal:{o:"#1a1426",W:"#f0eef8",k:"#1a1422",s:"#c8c4dc"},
  ...dirs([
  "................",".....oooooo.....","....oWWWWWWo....","...oWWWWWWWWo...",
  "..oWWWWWWWWWWo..","..oWWkkWWkkWWo..","..oWWkkWWkkWWo..","..oWWWWWWWWWWo..",
  "..oWWWWkkWWWWo..","..oWWWWWWWWWWo..","..osWWWWWWWWso..","..osWWWWWWWWso..",
  "..osWWWWWWWWso..","..oWoWWoWWoWWo..","..oo.oo.oo.ooo..","................"],
  [],"W",{5:"..oWkkWWkkWWWo..",6:"..oWkkWWkkWWWo..",8:"..oWWWkkWWWWWo.."},{5:"..oWWWkkWWkkWo..",6:"..oWWWkkWWkkWo..",8:"..oWWWWWkkWWWo.."})}
];
AVATARS[2].up=AVATARS[2].down.map((r,i)=>i>=3&&i<=7?r.replace(/k/g,"W"):r);
AVATARS[3].up=AVATARS[3].down.map(r=>r.replace(/k/g,"W"));
AVATARS.forEach(a=>["down","up","left","right"].forEach(d=>a[d]=grow(a[d],a.dup)));

// ---------- Tiles ----------
function drawMoss(c,x,y,gx,gy){c.fillStyle="#2e3b2a";c.fillRect(x,y,T,T);c.fillStyle="#263222";
  for(let i=0;i<4;i++){const px=Math.floor(hash(gx,gy,i)*14),py=Math.floor(hash(gx,gy,i+9)*13);c.fillRect(x+px,y+py,1,2);c.fillRect(x+px+1,y+py+1,1,1)}
  if(hash(gx,gy,40)<.3){c.fillStyle="#3e5236";c.fillRect(x+Math.floor(hash(gx,gy,41)*14),y+Math.floor(hash(gx,gy,42)*14),2,1)}
  if(hash(gx,gy,50)<.12){const px=x+2+Math.floor(hash(gx,gy,51)*11),py=y+3+Math.floor(hash(gx,gy,52)*10);
    c.fillStyle="#9a5ab8";c.fillRect(px-1,py,3,1);c.fillStyle="#d8c8e0";c.fillRect(px,py+1,1,2)}}
function drawPath(c,x,y,gx,gy,g){c.fillStyle="#6b5844";c.fillRect(x,y,T,T);c.fillStyle="#5a4836";
  for(let i=0;i<5;i++)c.fillRect(x+Math.floor(hash(gx,gy,i)*15),y+Math.floor(hash(gx,gy,i+5)*15),1,1);
  if(hash(gx,gy,70)<.15){c.fillStyle="#d8d0c0";const px=x+3+Math.floor(hash(gx,gy,71)*9),py=y+3+Math.floor(hash(gx,gy,72)*9);c.fillRect(px,py,3,1);c.fillRect(px,py-1,1,1);c.fillRect(px+2,py+1,1,1)}
  c.fillStyle="#4a3b2c";const n=(dx,dy)=>{const v=g[gy+dy]?.[gx+dx];return v===undefined||v===2};
  if(!n(0,-1))c.fillRect(x,y,T,1);if(!n(0,1))c.fillRect(x,y+15,T,1);if(!n(-1,0))c.fillRect(x,y,1,T);if(!n(1,0))c.fillRect(x+15,y,1,T)}
function drawSwamp(c,x,y,gx,gy,g,f){c.fillStyle="#2f4a3a";c.fillRect(x,y,T,T);c.fillStyle="#4f6e52";
  const o=Math.floor(f/24)%4;c.fillRect(x+((2+o)%14),y+4,4,1);c.fillRect(x+((9+o)%13),y+10,3,1);
  if(hash(gx,gy,80)<.4){c.fillStyle="#6a8a5a";const bp=(f/10+hash(gx,gy,81)*40)%40;if(bp<6)c.fillRect(x+6,y+8-Math.floor(bp/2),2,2)}
  c.fillStyle="#1d2e24";const w=(dx,dy)=>g[gy+dy]?.[gx+dx]===5;
  if(!w(0,-1))c.fillRect(x,y,T,2);if(!w(-1,0))c.fillRect(x,y,2,T);if(!w(1,0))c.fillRect(x+14,y,2,T);if(!w(0,1))c.fillRect(x,y+15,T,1)}
function drawTall(c,x,y){stamp(c,TALL,TALLPAL,x,y);stamp(c,TALL,TALLPAL,x,y+8)}

// ---------- Sprites externos ----------
// Coloque sua imagem em sprites/abobora.png (PNG com fundo transparente).
// Se o arquivo não existir, o jogo usa a abóbora em pixel art desenhada no código.
// "crop" (opcional) recorta só a parte útil da imagem: {sx, sy, sw, sh} em pixels.
// "w"/"h" é o tamanho desenhado no mapa; o sprite fica centralizado e apoiado na base do bloco.
const MAP_SPRITES={
  abobora:{src:"sprites/abobora.png",w:16,h:16,crop:null}
};
for(const s of Object.values(MAP_SPRITES)){
  s.img=new Image();s.ready=false;
  s.img.onload=()=>{s.ready=true};
  s.img.onerror=()=>{s.ready=false};
  s.img.src=s.src;
}
function drawSprite(c,s,x,y){
  const cr=s.crop||{sx:0,sy:0,sw:s.img.naturalWidth,sh:s.img.naturalHeight};
  const k=Math.min(s.w/cr.sw,s.h/cr.sh); // cabe no tamanho sem distorcer
  const dw=Math.round(cr.sw*k),dh=Math.round(cr.sh*k);
  const prev=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;
  c.drawImage(s.img,cr.sx,cr.sy,cr.sw,cr.sh,x+Math.round((T-dw)/2),y+T-dh,dw,dh);
  c.imageSmoothingEnabled=prev;
}


// ---------- Blocos da cidade e do altar ----------
function drawCobble(c,x,y,gx,gy){c.fillStyle="#3a3642";c.fillRect(x,y,T,T);
  for(let r=0;r<4;r++){const off=(r%2)*4;for(let k=-1;k<3;k++){const sx=x+off+k*8,sy=y+r*4;const v=hash(gx*3+k,gy*5+r,7);
    c.fillStyle=v<.33?"#4a4552":v<.66?"#524c5c":"#45404e";const x0=Math.max(x,sx+1),x1=Math.min(x+T,sx+8);if(x1>x0)c.fillRect(x0,sy+1,x1-x0,3)}}}
function drawFence(c,x,y,gx,gy,g){drawMoss(c,x,y,gx,gy);const f=(dx,dy)=>g[gy+dy]?.[gx+dx]===10;
  c.fillStyle="#2a1c16";
  if(f(-1,0)||f(1,0)){c.fillRect(x,y+5,T,2);c.fillRect(x,y+10,T,2);c.fillStyle="#4a3424";c.fillRect(x,y+5,T,1);c.fillRect(x,y+10,T,1)}
  if(f(0,-1)||f(0,1)){c.fillStyle="#2a1c16";c.fillRect(x+6,y,4,T);c.fillStyle="#4a3424";c.fillRect(x+6,y,1,T)}
  c.fillStyle="#2a1c16";c.fillRect(x+6,y+2,4,13);c.fillStyle="#5a4030";c.fillRect(x+6,y+2,4,1);c.fillStyle="rgba(0,0,0,.3)";c.fillRect(x+5,y+15,6,1)}
function drawLamp(c,x,y,gx,gy,g,f){drawCobble(c,x,y,gx,gy);
  c.fillStyle="rgba(0,0,0,.35)";c.fillRect(x+4,y+14,8,2);
  c.fillStyle="#1c1822";c.fillRect(x+7,y+5,2,10);c.fillRect(x+5,y+13,6,2);
  c.fillStyle="#1c1822";c.fillRect(x+4,y,8,6);
  const fl=(Math.sin(f*.2+gx)>0.6)?"#ffe9a8":"#ffd36a";c.fillStyle=fl;c.fillRect(x+5,y+1,6,4);c.fillStyle="#fff6d8";c.fillRect(x+7,y+2,2,2)}
function drawAltar(c,x,y,gx,gy,g,f){drawCobble(c,x,y,gx,gy);
  c.fillStyle="rgba(0,0,0,.35)";c.fillRect(x+1,y+13,14,3);
  c.fillStyle="#2a2832";c.fillRect(x+1,y+4,14,10);c.fillStyle="#6c6a7a";c.fillRect(x+2,y+5,12,8);
  c.fillStyle="#8c8a9a";c.fillRect(x,y+2,16,3);c.fillStyle="#a8a6b8";c.fillRect(x,y+2,16,1);
  c.fillStyle=`rgba(167,139,250,${.6+Math.sin(f*.08)*.3})`;c.fillRect(x+5,y+7,6,1);c.fillRect(x+7,y+6,2,5);c.fillRect(x+5,y+10,6,1)}
// Pedra gravada: a inscrição brilhante é desenhada por cima em game.js (roxa = não lida, dourada = lida)
function drawClueStone(c,x,y,gx,gy){drawMoss(c,x,y,gx,gy);
  c.fillStyle="rgba(0,0,0,.35)";c.fillRect(x+2,y+13,12,3);
  c.fillStyle="#22202a";c.fillRect(x+2,y+3,12,11);c.fillRect(x+4,y+1,8,2);
  c.fillStyle="#6c6a80";c.fillRect(x+3,y+4,10,9);c.fillRect(x+5,y+2,6,2);
  c.fillStyle="#8a88a0";c.fillRect(x+3,y+4,10,1);c.fillRect(x+5,y+2,6,1);
  c.fillStyle="#4a4860";c.fillRect(x+12,y+5,1,8)}
function drawHouseGround(c,x,y,gx,gy){c.fillStyle="#241c26";c.fillRect(x,y,T,T)}
// Casas: cada bloco retangular de "H" vira uma construção; a porta fica no centro da base.
function houseRects(g){const seen=new Set(),out=[];
  for(let y=0;y<g.length;y++)for(let x=0;x<g[0].length;x++){if(g[y][x]!==8||seen.has(x+","+y))continue;
    let w=0;while(g[y][x+w]===8)w++;let h=0;while(g[y+h]&&g[y+h][x]===8)h++;
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)seen.add(xx+","+yy);
    out.push({x,y,w,h,door:{x:x+Math.floor(w/2),y:y+h-1}})}
  return out}
function drawHouses(c,g,f){for(const r of houseRects(g)){
  const px=r.x*T,py=r.y*T,pw=r.w*T,ph=r.h*T,roofH=Math.round(ph*.5);
  // paredes
  c.fillStyle="#3a2c36";c.fillRect(px+1,py+roofH,pw-2,ph-roofH);
  c.fillStyle="#463440";for(let yy=py+roofH+3;yy<py+ph;yy+=4)c.fillRect(px+1,yy,pw-2,1);
  // telhado
  c.fillStyle="#1e1626";c.fillRect(px-1,py+2,pw+2,roofH);
  c.fillStyle="#3a2448";for(let yy=py+4;yy<py+roofH;yy+=4)c.fillRect(px,yy,pw,2);
  c.fillStyle="#5a3a6a";c.fillRect(px-1,py+2,pw+2,1);
  c.fillStyle="#120c16";c.fillRect(px-1,py+roofH+1,pw+2,1);
  // janelas acesas
  const dx=r.door.x*T+4;
  for(let wx=px+4;wx+6<=px+pw-3;wx+=12){if(Math.abs(wx-dx)<9)continue;
    const on=Math.sin(f*.03+wx)>-.7;c.fillStyle="#120c16";c.fillRect(wx-1,py+roofH+3,8,7);
    c.fillStyle=on?"#ffcf6a":"#6a4a2a";c.fillRect(wx,py+roofH+4,6,5);c.fillStyle="#120c16";c.fillRect(wx+3,py+roofH+4,1,5)}
  // porta
  c.fillStyle="#120c16";c.fillRect(dx-1,py+ph-12,10,12);c.fillStyle="#5a3a22";c.fillRect(dx,py+ph-11,8,11);
  c.fillStyle="#ffcf6a";c.fillRect(dx+6,py+ph-6,1,1);
  c.fillStyle="rgba(0,0,0,.35)";c.fillRect(px,py+ph,pw,2)}}

function renderTile(c,v,gx,gy,g,f){const x=gx*T,y=gy*T;
  if(v===2){drawPath(c,x,y,gx,gy,g);return}
  if(v===5){drawSwamp(c,x,y,gx,gy,g,f);return}
  if(v===8){drawHouseGround(c,x,y,gx,gy);return}
  if(v===9){drawCobble(c,x,y,gx,gy);return}
  if(v===10){drawFence(c,x,y,gx,gy,g);return}
  if(v===11){drawLamp(c,x,y,gx,gy,g,f);return}
  if(v===12){drawAltar(c,x,y,gx,gy,g,f);return}
  if(v===13){drawClueStone(c,x,y,gx,gy);return}
  drawMoss(c,x,y,gx,gy);
  if(v===1)stamp(c,TREE,TREEPAL,x,y);
  else if(v===3)drawTall(c,x,y);
  else if(v===4){if(MAP_SPRITES.abobora.ready)drawSprite(c,MAP_SPRITES.abobora,x,y);else stamp(c,PUMP,PUMPPAL,x,y)}
  else if(v===6)stamp(c,STONE,STONEPAL,x,y);
  else if(v===7)stamp(c,SIGN,SIGNPAL,x,y);
}

