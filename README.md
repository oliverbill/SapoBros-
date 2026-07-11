# 🐸 Sapo Bros — Aventura no Bosque

Um jogo de plataforma em HTML5 no estilo **Super Mario Bros**, protagonizado por
dois sapos **recortados diretamente de uma foto**: **Jones** (verde, jaqueta
vermelha, laço amarelo) e **Minja** (verde-claro, camisa amarela, laço amarelo).
Os sprites em `assets/rex.png` e `assets/lima.png` foram extraídos da foto com
remoção de fundo (segmentação GrabCut), preservando a arte original. Cada
personagem tem uma **voz** própria que toca ao pegar um cogumelo ou flor.

## 🎮 Jogar agora

**https://oliverbill.github.io/SapoBros-/**

Abra no navegador (no iPhone, use o **Safari** e toque em *Compartilhar →
Adicionar à Tela de Início* para instalar como app em tela cheia).

## Rodar localmente

**Basta dar duplo-clique em `index.html`** — abre em qualquer navegador moderno,
sem servidor, sem build e sem dependências. Os sprites vêm embutidos (base64, em
`assets.js`), então não há arquivos externos que o navegador bloqueie no modo
`file://`.

Se preferir, também funciona por HTTP local (opcional):

```bash
python3 -m http.server 8000   # ou: npx serve
# acesse http://localhost:8000
```

## Controles

| Ação    | Teclado              | Toque            |
|---------|----------------------|------------------|
| Mover   | ← / →                | Botões ◀ ▶       |
| Pular   | ↑ ou Barra de espaço | Botão ▲          |
| Atirar 🔥 | F ou X             | Botão 🔥 (aparece com a flor de fogo) |
| Mudo    | M                    | Botão 🔊 / 🔇 no HUD |

Segure o botão de pulo para pular mais alto (altura variável).

## Som

Efeitos sonoros e música de fundo no estilo **8-bit / chiptune** (pulo, moeda,
power-up, pisão, fogo, dano, morte, fim de fase e game over), tudo **sintetizado
no navegador** com a Web Audio API — nenhum arquivo de áudio externo. São
composições **originais** que evocam os clássicos plataformas 8-bit (não usam
áudio protegido). Use o botão **🔊 / 🔇** no HUD (ou a tecla **M**) para
ligar/desligar; a preferência é salva.

## Power-ups (estilo Mario)

Espalhados pelas fases, dão novos poderes ao personagem (mostrados no HUD "Poder"):

- 🍄 **Cogumelo** — faz o personagem **crescer** e **pular mais alto**.
- 🔥 **Flor de fogo** — permite **atirar bolas de fogo** (F / X ou o botão 🔥) que
  derrotam inimigos à distância.
- 🪽 **Flor voadora** — permite **voar**: segure o botão de pular para subir.

Ao tomar dano com um poder ativo, o personagem **perde o poder** em vez de morrer
(fica invulnerável por um instante). O poder é mantido entre as fases e salvo no
progresso.

## Objetivo

- 🍎 Colete maçãs para ganhar pontos (50 cada).
- 👾 Pule em cima dos inimigos para derrotá-los (100 cada). Encostar de lado
  tira uma vida.
- 🚩 Alcance a bandeira no fim da fase (+500) para avançar.
- ❤ Você começa com 3 vidas. Cair em buracos ou ser atingido custa uma vida.
- São **3 fases**; conclua todas para vencer.

## Opções

- **Escolha do personagem**: selecione **Jones** ou **Minja** na tela inicial. A
  escolha é lembrada entre as sessões.
- **♾️ Vidas infinitas**: ative o botão na tela inicial (ou durante o jogo) para
  jogar sem perder — ao cair ou ser atingido, você simplesmente renasce. O HUD
  mostra `∞`.
- **💾 Salvar progresso**: o jogo salva automaticamente (fase, pontuação, vidas,
  poder, personagem e modo) no `localStorage` do navegador. Se houver um jogo em
  andamento, o botão **Continuar** aparece na tela inicial e retoma exatamente de
  onde você parou. **Novo jogo** recomeça da fase 1 mantendo suas preferências.

## Detalhes técnicos

- Canvas 2D — os personagens jogáveis usam os sprites reais recortados da foto
  (`assets/*.png`); inimigos, moedas e cenário são desenhados proceduralmente.
- Física de plataforma com gravidade, atrito, pulo de altura variável, colisão
  por AABB, câmera com rolagem lateral e fundo em parallax.
- Inimigos patrulham plataformas e mudam de direção nas bordas.
- Suporte a teclado e a controles de toque (mobile).
- Progresso e preferências persistidos em `localStorage` (chave `sapobros_save_v1`).
- Publicação automática no GitHub Pages via `.github/workflows/pages.yml`.

## Arquivos

- `index.html` — estrutura, telas (início, seleção de personagem, mensagens) e HUD.
- `game.js` — motor do jogo, física, níveis, power-ups e renderização.
- `assets.js` — sprites embutidos em base64 (permite abrir sem servidor).
- `sound.js` — motor de áudio chiptune (efeitos e música, Web Audio API).
- `assets/rex.png`, `assets/lima.png` — sprites originais recortados da foto.
- `icon-*.png`, `manifest.webmanifest` — ícone e configuração de app (PWA/iPhone).
