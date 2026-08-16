# SYSTEM

RPG da vida real inspirado no sistema do Solo Leveling. PWA 100% offline para celular.

## Stack

- React 19 + Vite 8
- Tailwind CSS v4 (design system em `src/index.css`)
- localStorage como única fonte de verdade (chave `system.save.v1`)
- PWA: `vite-plugin-pwa` (manifest + service worker + precache)
- Fontes empacotadas localmente (`@fontsource`) → funcionam offline
- Ícones PNG gerados por script próprio (`npm run icons`), sem dependências

## Rodando

```bash
npm install
npm run dev       # desenvolvimento
npm run test      # testes do reducer (vitest)
npm run build     # build + PWA
npm run preview   # serve o build de produção
```

Instalar no celular: abra o endereço do `npm run preview` (ou dev com `--host`)
no navegador do Android/iPhone e use "Adicionar à tela inicial".

## Arquitetura

```
src/
├── state/
│   ├── reducer.js       # reducer puro — TODA mutação do save passa aqui (testável)
│   └── reducer.test.js  # 26 testes: XP, level, rank, streak, resets, dungeons
├── utils/
│   ├── history.js       # análise observacional: séries 30d, streaks, insights
│   ├── timer.js         # relógio do treino guiado (formatClock/formatLong)
│   ├── notify.js        # dungeonsExpiring (puro) + sendNotification
│   └── fullscreen.js    # tela cheia + trava de orientação (com guardas)
├── hooks/
├── hooks/
│   ├── useGame.jsx      # Provider + persistência + dispatcher
│   ├── usePlayer.js     # jogador (nome, XP, level, streak, atributos)
│   ├── useMissions.js   # diárias + semanais
│   ├── useDungeons.js   # dungeons
│   └── useXP.js         # derivados de XP/rank
├── data/
│   ├── defaultMissions.js  # seed + guias de exercício (SVG, passo a passo)
│   ├── achievements.js     # catálogo de conquistas + condições puras
│   ├── ranks.js            # tabela E→SSS
│   └── statMeta.js         # ícones/cores dos 6 atributos
├── components/          # RankBadge, XpBar, StatBar, MissionCard,
│                        # DungeonCard, ExerciseIllustration, LevelUpModal,
│                        # AchievementModal, AchievementBadge, BottomNav,
│                        # Toast, HistoryChart, InsightsPanel
├── screens/             # CharacterCreation, Status, Missions, Dungeons,
│                        # History, Profile
└── App.jsx              # orquestração: TICK, overlays, toasts, navegação
```

## Features extras (além do spec original)

- **SP (pontos de atributo)**: +3 SP por level para distribuir manualmente
  entre FOR/AGI/VIT/INT/PER/SEN — direto no modal de level up (grade com o
  valor atual de cada atributo, antes do CONTINUAR) ou no Perfil. Bônus:
  botão **"Distribuir auto"** que gasta todo o SP nos atributos mais fracos
  (ação pura `AUTO_DISTRIBUTE_SP`, testada) e mostra a distribuição feita.
- **Sons sintetizados** com Web Audio API (zero arquivos de áudio): missão,
  level up, rank up, dungeon, streak perdido, conquista e treino guiado.
  Toggle no Perfil + botão "Testar som" que toca a sequência completa
  (missão → level up → rank up).
- **Chip de dungeon urgente** no Status: mostra a dungeon ativa com o prazo
  mais próximo (título + "expira em X dias" + badge de dias), em vermelho
  quando faltam 2 dias ou menos, e toca direto na aba Dungeons. Quando a
  dungeon **expira hoje** (ou já venceu), o chip e o badge ganham **pulso
  vermelho de urgência** (`dangerPulse`, 1.4s) e o badge troca o número por
  "HOJE". **Com menos de 24h restantes**, o chip troca para contagem
  regressiva real: "faltam 19h" (ou "faltam 45min" na última hora) com
  badge em horas/minutos — via `hoursLeft`/`minsLeft` no
  `nextDungeonDeadline` (tempo real até a meia-noite do prazo, `now`
  injetável para testes). O chip também mostra o **progresso manual da
  dungeon** ("300 / 1000 flexões · 30%") com mini barra roxa.
- **Notificações nativas** (Notification API, enquanto o app está aberto):
  lembrete diário em horário configurável — avisa com missões pendentes
  **ou com mensagem de encorajamento quando o dia está completo**
  (inclui a sequência atual quando streak ≥ 3) + **alerta de dungeon
  próxima do prazo** (threshold 1/2/3 dias, configurável no Perfil, com
  log diário em `_notifLog` para não repetir). **As mensagens variam por
  dia da semana reconhecendo os padrões do Histórico** (aprendizado por
  observação): `patternSentence` detecta o dia com mais treino
  ("Terça é seu dia de treino forte." quando hoje é o dia forte, senão
  "Seu dia mais forte costuma ser terça.") e o dia completo monta a
  mensagem com o padrão + "Dia completo" + sequência + **o que falta
  para a semanal mais próxima** ("Faltam 2 treinos para a semanal
  \"5 Treinos na Semana\"", com singular automático "Falta 1 treino")
  — `weeklyProgressLine` + `encouragementMessage` puros em
  `utils/history.js` e testáveis. Só registra como avisado
  quando a notificação realmente dispara. **Resumo opcional do
  meio-dia (12:00)**: toggle "Resumo do meio-dia" no Perfil envia um
  lembrete com o resumo do dia até agora ("Hoje: 3/8 missões · +95 XP.
  Faltam 5 — o Sistema aguarda." / "Dia completo…" / "Nenhuma missão
  registrada ainda") — `noonSummary` puro em `utils/notify.js`, com
  flag independente `notifNoonFired` para não repetir no dia. Lógica
  pura de expiração em
  `utils/notify.js` (testável). Dungeon falhada também é detectada
  automaticamente no TICK.
- **Backup/restauração**: exporta o save como JSON e importa de volta.
- **Botão de instalação do PWA** (beforeinstallprompt).
- **XP com contagem animada** e flash vermelho de streak perdido (spec).
- **Toasts**: missão semanal concluída, título desbloqueado, dungeon falhada.
- **Treino guiado com timer**: botão "Treino guiado" nas missões de
  exercício abre um modo de sessão — PREPARAR (3s) → SÉRIE × descanso →
  CONCLUÍDO. Séries por repetições (cronômetro + "Terminar série") ou por
  tempo (contagem regressiva: cardio 4×5min, estudo 20min, meditação 10min).
  **Modo imersivo**: tela cheia + travamento landscape + relógio gigante
  (30vmin), com saída automática ao fechar (utils/fullscreen.js). A
  **preferência imersivo é persistida** no save (`player.trainingImmersive`,)
  — se ligou na última sessão, o próximo treino abre direto em tela cheia
  (entra no "Começar treino", dentro do gesto); o minimizar desliga a
  preferência (ação `SET_TRAINING_IMMERSIVE`).
  Descanso configurável (30/45/60s, persiste em `player.restSec`), ticks
  sonoros nos últimos 3s, vibração nas transições, e "Concluir missão"
  dispara o fluxo normal de recompensa. Contagem baseada em timestamp
  (`utils/timer.js`), imune a drift.
- **Comandos de voz sintetizados no treino** (Web Speech API, sem arquivos):
  o Sistema fala "Comece" no início de cada série, "Descanse" no descanso,
  "Última série" na última e "Treino concluído" ao fim — pt-BR,
  seguindo o toggle de som. `utils/voice.js` (guardas + `globalThis`,
  testável) e `cancelSpeech` ao fechar o treino. **Contagem por toque**: em séries de
  repetições, cada toque na tela  conta 1 rep (som + vibração + pulso no
  número); ao atingir a meta aparece "SÉRIE COMPLETA" e a sessão avança
  sozinha para o descanso. No modo imersivo o número gigante vira o contador
  de reps com anel de progresso ao redor (SVG) — cada toque dispara um
  **flash no anel** (keyframes `ringFlash`) e, ao completar a série, o anel
  fica **dourado com glow** ("SÉRIE COMPLETA").
- **Resumo pós-treino no Histórico**: cada treino guiado concluído é
  registrado no dia (`sessions: [{ title, sec, sets }]` no `_dailyHistory`)
  e a tela de Histórico ganhou um card "Treino guiado" — total de sessões
  e tempo treinado no período (ex.: "5 sessões · 1h 14min"), strip de
  30 células com sessões por dia e as 3 últimas sessões (exercício, séries,
  duração). Helpers puros `sessionTotals`/`formatDuration` em
  `utils/history.js`.
- **Sistema de conquistas** (11 ao todo): além dos títulos de dungeon —
  primeiro level up, dia perfeito, 10 missões num dia, streak de 7 e 30 dias,
  rank D, nível 10, 100 missões, primeira dungeon, primeiro SP. Condições
  puras em `data/achievements.js`, avaliadas no reducer a cada ação; modal
  próprio ("CONQUISTA DESBLOQUEADA", flash dourado) que entra na fila atrás
  do LEVEL UP; grade de badges com raridade (comum/rar/épica) e contador no
  Perfil.
- **Aba de Conquistas dedicada** (6º tab da navegação): catálogo agrupado
  por raridade com **barra de progresso parcial em cada conquista**
  (ex.: "Sobrecarga 7/10 missões hoje", "Sete Dias 3/7 dias de sequência"),
  porcentagem à direita, e estado DESBLOQUEADA com data. Progresso puro e
  unificado em `achievementProgress` (current/target/unit) —
  `evaluateAchievements` agora é derivado dele (fonte única de verdade).
- **Recompensa real em conquistas épicas**: Sobrecarga concede +5 SP e Mês
  de Aço +10 SP ao desbloquear (`spReward` declarado no catálogo). O SP
  bônus  é creditado direto no jogador pelo reducer, aparece como badge
  "+N SP" no card do modal de conquista e dispara toast de recompensa.
- **Higiene bucal (escovação 3× ao dia)**: card no Status com os slots
  Manhã/Tarde/Noite — cada escovação +5 XP · +1 VIT, e fechar o dia 3/3
  concede bônus +10 XP · +1 SEN (contador de dias 3/3). Slots zeram no
  novo dia e entram no Histórico como hábito (`oral-0/1/2`). Constantes em
  `data/oralCare.js`, ação `ORAL_BRUSH` no reducer.
- **Sistema de disciplina (NoFap)**: contador de dias limpos temporal
  (desde a última recaída ou o início do save), check-in diário (+15 XP ·
  +1 SEN, uma vez por dia, registrado no Histórico como disciplina) e
  **marcos de 7/30/90 dias** com XP bônus (Barreira +50, Vontade de Ferro
  +150, Imaculado +300) e toast ao cruzar. Botão "Registrar recaída" com
  confirmação zera o contador e fixa o recorde. Tela full-screen
  "Disciplina" acessível pelo card no Perfil; helpers puros em
  `utils/nofap.js` (`nofapStreak`/`nofapMilestoneProgress`, testáveis) e
  ações `NOFAP_CHECKIN`/`NOFAP_RELAPSE` no reducer.
- **Destaque de conquistas recém-desbloqueadas no Perfil**: badges
  desbloqueados hoje ou ontem ganham pulso de glow na cor do tier
  (`badgePulse` + `--pulse-color`) e marca "NOVO" no canto — recência via
  helper puro `isRecentUnlock` em `utils/dates.js` (testado).
- **Histórico de sessão** (tab "Histórico"): gráficos SVG dos últimos 30 dias
  (XP e missões por dia), strip visual da sequência (células douradas = streak
  atual), resumo (XP/missões/dias ativos/melhor dia), distribuição por
  categoria (treino/estudo/mente/hábito/disciplina) e **insights por
  observação** — "você treina mais às terças", pico de atividade, dia mais
  produtivo, maior sequência, média por dia ativo. Nada sai do dispositivo.

### Decisões de arquitetura

- **Reducer puro** (`state/reducer.js`): toda transição de estado é uma função
  pura `(state, action) → [state, resultado]`. Zero acesso a localStorage/browser
  no reducer — o que torna a lógica do jogo 100% testável.
- **Reset por comparação de data** (não timer): `lastDailyReset` vs hoje,
  `lastWeeklyReset` vs segunda-feira. O app verifica ao abrir, ao focar a janela
  e à meia-noite.
- **Histórico persistente** (`_dailyHistory`): o reset diário apaga as flags de
  "completada", mas o histórico data→{ids, xp, hours, byCat} sobrevive —
  alimenta missões semanais ("5 treinos na semana", dias distintos) e o
  gráfico de sessão (XP por dia, categorias, horários de conclusão). Podado a
  60 dias; saves antigos (array de ids) são migrados automaticamente.
- **Aprendizado por observação** (`utils/history.js`): funções puras que
  extraem padrões do histórico — dia da semana com mais treino, horário de
  pico, sequências — sem treinar modelos e sem sair do dispositivo.
- **Streak** baseado em `lastActivityDate`: +1 a cada dia com missão, zera se
  um dia inteiro passa sem atividade. Bônus: 3d +10%, 7d +25%, 30d +50%.
- **Bônus de dia completo** (`d-all`): auto-completa quando as 7 diárias
  fecham, +50 XP +1 SEN, e registra a data em `_fullDailyDays`.
- **Migração**: saves antigos ganham campos novos automaticamente (`migrate`).

### Exercícios

Todas as missões de exercício têm um **protocolo expandível** com ilustração SVG
desenhada à mão (estilo HUD), passos numerados e dicas de forma — tudo em casa,
sem equipamento. As ilustrações são SVG inline: zero assets externos, zero
dependência de internet.

## Validação

- `npm test` → 52 testes passando (XP, level up, rank E→D, SP, streak, resets
  diário/semanal, bônus de dia, semanais por contador, dungeons com prazo,
  falha por expiração, backup/importação, migração, reset total, registro de
  sessão, insights, conquistas, treino guiado, alertas de notificação,
  distribuição automática de SP e chip de dungeon urgente)
- `npm run build` → PWA com 38 entradas precacheadas (~658 KB)
- Fluxo validado no preview: criar personagem → completar missões → XP +
  atributos + streak → level up com overlay → persistência em localStorage
