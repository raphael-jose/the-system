import {
  Award,
  Bomb,
  Check,
  Crosshair,
  Flame,
  Layers,
  ListChecks,
  Plus,
  Shield,
  Trophy,
  Zap,
} from "lucide-react";

// Chave -> componente (o catálogo em data/achievements usa a chave).
const ICONS = {
  crosshair: Crosshair,
  zap: Zap,
  check: Check,
  plus: Plus,
  shield: Shield,
  award: Award,
  flame: Flame,
  list: ListChecks,
  layers: Layers,
  bomb: Bomb,
  trophy: Trophy,
};

export default function AchievementIcon({ id, size = 20, strokeWidth = 1.8 }) {
  const Icon = ICONS[id] || Trophy;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
