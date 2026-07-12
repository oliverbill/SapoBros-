# 🎮 Template do Motor de Plataforma

Um **motor de jogo de plataforma** (estilo Super Mario Bros) que se monta a
partir de **um único arquivo de configuração**. Você fornece imagens de
cenários, jogadores, inimigos e chefões; vozes; músicas; e **descreve os
comportamentos por nome** — o motor cria o jogo. O mesmo engine que roda o
Sapo Bros, generalizado para você reaproveitar.

> Nada de arte de terceiros aqui. Traga suas próprias imagens/áudios. Se algo
> faltar, o motor desenha um bloco colorido (placeholder) no lugar, então o
> jogo roda mesmo antes de você ter os assets prontos.

## Arquivos

```
template/
├── index.html        ← abre isto (ou publique a pasta)
├── engine.js         ← o motor. NÃO precisa editar.
├── game.config.js    ← ⚙️ VOCÊ EDITA ISTO (todo o conteúdo do jogo)
└── assets/
    ├── players/      ← imagens dos personagens (png com fundo transparente)
    ├── enemies/      ← imagens dos inimigos e power-ups
    ├── bosses/       ← imagens dos chefões
    ├── backgrounds/  ← imagens de fundo dos cenários (opcional)
    ├── voices/       ← vozes (mp3/ogg)
    └── music/        ← músicas (mp3/ogg)
```

## Como criar um jogo novo (passo a passo)

1. **Copie a pasta `template/`** para um novo lugar (ex.: `meu-jogo/`).
2. **Solte seus arquivos** em `assets/…` (imagens `.png`, áudios `.mp3`).
3. **Edite `game.config.js`**: aponte os caminhos das imagens/áudios,
   escolha um **comportamento** para cada inimigo/chefão e monte as fases
   com mapas de texto (ASCII).
4. **Abra `index.html`** no navegador (ou publique a pasta no GitHub Pages).
   Pronto — é um jogo novo com o mesmo motor.

Não sabe programar? Basta trocar os textos entre aspas em `game.config.js`
(nomes de arquivo e comportamentos). A estrutura já está montada.

## Descrevendo comportamentos

Cada inimigo/chefão tem um campo `behavior` com **um nome**. É assim que você
"descreve o comportamento": escolhendo da lista abaixo e ajustando alguns
parâmetros opcionais.

### Inimigos (`enemies`)

| behavior  | O que faz                                   | Parâmetros úteis            |
|-----------|---------------------------------------------|-----------------------------|
| `walker`  | Anda e vira nas beiras                       | `speed`                     |
| `hopper`  | Dá pulinhos frequentes                       | `jumpEvery`                 |
| `roller`  | Bola rápida que cai das plataformas          | `speed`                     |
| `jumper`  | Pula em direção ao jogador                    | `jumpEvery`                 |
| `shooter` | Atira um projétil reto                        | `shootEvery`, `shotSpeed`   |
| `lobber`  | Arremessa bombas em arco                      | `shootEvery`                |
| `splitter`| Ao ser pisado, vira dois menores              | —                           |
| `charger` | Dispara numa corrida quando você chega perto  | `range`                     |
| `drifter` | Fantasma que persegue pelo ar                 | —                           |
| `flyer`   | Voa em onda senoidal                          | `speed`                     |
| `diver`   | Voa e mergulha em cima de você                | `speed`                     |
| `zigzag`  | Voa em ziguezague                             | `speed`                     |
| `turret`  | Atirador blindado (só morre com fogo 🔥)       | `shootEvery`, `shotSpeed`   |
| `spiker`  | Espinho: **não pode ser pisado**              | `speed`                     |
| `bomber`  | Voa e solta bombas                            | `shootEvery`                |
| `spitter` | Atira um leque de 3 projéteis                 | `shootEvery`                |

### Chefões (`bosses`)

| behavior | O que faz                                            | Como vencer            |
|----------|------------------------------------------------------|------------------------|
| `brute`  | Anda e **investe**                                    | Pise nele              |
| `plant`  | **Sobe do chão e cospe** sementes                     | Pise/fogo quando à mostra |
| `ghost`  | Só avança **quando você está de costas**              | Encare e pise/fogo     |
| `mole`   | **Cava e salta** para fora                            | Pise quando aparecer   |
| `dragon` | Pula, **cospe fogo** e joga martelo (chefe final)     | Fogo/pise várias vezes |

O campo `hp` define quantos golpes o chefão aguenta.

## Montando as fases (mapas ASCII)

Cada caractere do mapa é um bloco de `tile` px. Símbolos fixos:

```
G = chão sólido    B = tijolo        ? = moeda
P = início         F = bandeira (fim da fase normal)
L = lava (morte)   ^ = espinho na parede    . = vazio
```

Os demais símbolos você define em `legend`, apontando para seus inimigos,
power-ups ou chefão. Exemplo:

```js
legend: {
  "a": { enemy: "caminhante" },
  "t": { enemy: "atirador" },
  "M": { powerup: "cogumelo" },
  "Z": { boss: "reptil" },
}
```

- Uma fase **com bandeira `F`** termina ao alcançá-la.
- Uma fase **com chefão** termina ao derrotá-lo (arena). Ponha paredes `B`,
  `L` (lava) e `^` (espinhos) para montar a arena — veja a fase 3 do exemplo.

## Mapa de fases e vidas infinitas

- **Mapa de fases (trilha):** com 2+ fases, o jogo abre um mapa em trilha
  sinuosa onde você escolhe a fase (as próximas vão desbloqueando). Fases de
  chefão aparecem com 👑. Para desligar e ir direto (linear), ponha
  `worldMap: false` na config.
- **Vidas infinitas:** há um interruptor na tela inicial. Para já vir ligado,
  use `infiniteLives: true` na config.

## Vários exemplos / estilos

Além de `game.config.js`, há exemplos prontos em `examples/`. Para ver um sem
sobrescrever o seu, abra `index.html?config=NOME` (sem a extensão). Ex.:

```
index.html?config=espaco   →  carrega examples/espaco.config.js (tema sci-fi)
```

Use um exemplo como ponto de partida: copie-o para `game.config.js` e edite.

## Validar a configuração (evita erros bobos)

Antes de rodar, rode o validador — ele aponta imagem/áudio faltando,
`behavior` inválido, letra de mapa sem legenda, fase sem início/fim, etc.:

```
node tools/validate.mjs                      # valida game.config.js
node tools/validate.mjs examples/espaco.config.js
```

Ele sai com código de erro se houver problema grave (bom para automação).

## Power-ups

`effect` define o efeito ao coletar:

- `grow` — cresce e aguenta um golpe a mais
- `fire` — pode atirar bolas de fogo (tecla **F**)
- `fly` — segure pular para voar

## Vozes e músicas

- `voices`: mapeie um nome → arquivo de áudio.
- `voiceEvents`: quando cada voz toca (`powerup`, `hurt`, `die`). Use
  `"@player"` para tocar a voz do personagem escolhido.
- `music`: um arquivo por tema; toca automaticamente na fase daquele tema.
- Efeitos sonoros (pulo, moeda, pisão…) já são sintetizados pelo motor.

## Controles

- Teclado: **← →** mover · **↑ / Espaço** pular · **F / X** atirar · **M** mudo
- Toque: botões na tela (aparecem em telas de toque)

## Publicar

É um site estático: suba a pasta no **GitHub Pages** (ou qualquer hospedagem)
e o jogo abre no navegador do celular/PC. Nenhum servidor necessário.

---

Dúvida rápida: abra `game.config.js` — ele está todo comentado e o exemplo
já roda como um mini-jogo de 3 fases (2 fases + 1 arena de chefão).
