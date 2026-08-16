// Higiene bucal — escovação padrão 3x ao dia, cada uma com o seu momento.
// O horário de cada escovação é contextual: só vale no momento certo do dia.
export const ORAL_SLOTS = [
  { id: 0, label: "Manhã", hint: "ao acordar" },
  { id: 1, label: "Tarde", hint: "depois do almoço" },
  { id: 2, label: "Noite", hint: "antes de dormir" },
];

// Duração mínima de cada escovação — 2 minutos, o padrão dos dentistas.
// O modal só marca o slot quando o relógio completa (cancelar = sem crédito).
export const ORAL_BRUSH_SEC = 120;

export const ORAL_XP = 5;
export const ORAL_BONUS_XP = 10; // bônus por fechar o dia 3/3
