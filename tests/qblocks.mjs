/* ============================================================
   Validador estático de posições de blocos "?" (QBLOCKS_BY_LEVEL).

   Historicamente já bateram dois problemas por causa de dados
   mal colocados nesta tabela:

     1. Um "?" em cima de um tile de tijolo — o bloco aparece na
        tela, mas a cabeçada resolve na colisão do tijolo primeiro,
        deixando o "?" visualmente ativo porém INERTE.

     2. Um "?" com um tijolo/chão DIRETAMENTE abaixo — o jogador
        não tem espaço para pular por baixo e a cabeçada nunca
        acontece (bloco visível mas inacessível).

   Este teste roda em Node puro (sem Playwright) e falha o build
   se qualquer QBLOCK cair num desses dois casos. Assim garantimos
   que a próxima pessoa que mexer em LEVELS/QBLOCKS_BY_LEVEL veja
   a quebra na hora, em vez de descobrir no jogo.

   Rodar isolado:  node tests/qblocks.mjs
   ============================================================ */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = await readFile(path.join(ROOT, "game.js"), "utf8");

const levels = [...src
  .match(/const LEVELS = \[([\s\S]*?)\];/)[1]
  .matchAll(/`([^`]*)`/g)
].map(m => m[1].split("\n"));

const qblocks = eval("[" + src.match(/const QBLOCKS_BY_LEVEL = \[([\s\S]*?)\];/)[1] + "]");
const pipes   = eval("[" + src.match(/const PIPES_BY_LEVEL = \[([\s\S]*?)\];/)[1]   + "]");

const SOLID_CH = new Set(["B", "G"]);   // chars que geram um sólido no loader

// Um cano é 2x2 tiles a partir de (col,row); marca esses tiles como sólidos.
function pipeCovers(levelIdx, col, row) {
  for (const p of (pipes[levelIdx] || [])) {
    if (col >= p.col && col < p.col + 2 && row >= p.row && row < p.row + 2) return true;
  }
  return false;
}
function tileIsSolid(levelIdx, col, row) {
  const rows = levels[levelIdx]; if (!rows || row < 0 || row >= rows.length) return false;
  const ch = (rows[row] || "")[col];
  return SOLID_CH.has(ch) || pipeCovers(levelIdx, col, row);
}

const failures = [];
qblocks.forEach((qbs, i) => {
  const rows = levels[i];
  const groundRow = rows.length - 1;   // última linha = chão
  for (const q of qbs) {
    if (tileIsSolid(i, q.col, q.row))
      failures.push(`L${i} ${JSON.stringify(q)} — sólido no MESMO tile (bloco ficaria inerte)`);
    if (tileIsSolid(i, q.col, q.row + 1))
      failures.push(`L${i} ${JSON.stringify(q)} — sólido DIRETAMENTE ABAIXO (cabeçada impossível)`);
    // Estender: qualquer tijolo/pipe NA MESMA COLUNA entre o "?" e o chão gera
    // aquele visual de "?" empoleirado num tijolo — foi exatamente a queixa
    // repetida do usuário. Chão (G) na última linha NÃO conta (obviamente
    // sempre há chão abaixo). Só flagamos "B" e pipes.
    for (let r = q.row + 2; r < groundRow; r++) {
      const ch = (rows[r] || "")[q.col];
      if (ch === "B" || pipeCovers(i, q.col, r)) {
        failures.push(`L${i} ${JSON.stringify(q)} — tijolo na mesma coluna abaixo (r${r})`);
        break;   // uma denúncia por qblock basta
      }
    }
  }
});

// Também checa o desenho ASCII: nenhum "?" (moeda/apple) pode ter um "B" logo
// abaixo. Bug histórico: o desenho ficava com plataformas de tijolo grudadas
// embaixo das moedas, poluindo o cenário. Já corrigido em massa antes; este
// teste garante que ninguém reintroduza.
const undergroundMap = src.match(/const UNDERGROUND_MAP =\s*`([^`]*)`/)[1];
const allAsciiMaps = [...levels.map((rows, i) => ({ name: `LEVELS[${i}]`, rows })),
                      { name: "UNDERGROUND_MAP", rows: undergroundMap.split("\n") }];
for (const { name, rows } of allAsciiMaps) {
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === "?" && rows[r + 1] && rows[r + 1][c] === "B") {
        failures.push(`${name} r${r} c${c}: "B" logo abaixo de "?"`);
      }
    }
  }
}

if (failures.length) {
  console.error(`✗ Encontradas ${failures.length} violação(ões) de posicionamento:`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`✓ QBLOCKS_BY_LEVEL: ${qblocks.flat().length} blocos, todas as posições ok`);
console.log(`✓ ASCII maps: nenhum "B" logo abaixo de "?"`);
