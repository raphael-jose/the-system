// Metadados dos 6 atributos: ícones SVG custom (sem emojis), cores e nomes.
import { Dumbbell, Zap, Heart, Brain, Eye, Infinity as InfinityIcon } from "lucide-react";

export const STAT_NAMES = {
  FOR: "FORÇA",
  AGI: "AGILIDADE",
  VIT: "VITALIDADE",
  INT: "INTELIGÊNCIA",
  PER: "PERCEPÇÃO",
  SEN: "SENSO",
};

export const STAT_COLORS = {
  FOR: "#f97316",
  AGI: "#4f8ef7",
  VIT: "#22c55e",
  INT: "#a855f7",
  PER: "#facc15",
  SEN: "#38bdf8",
};

export const STAT_ICONS = {
  FOR: Dumbbell,
  AGI: Zap,
  VIT: Heart,
  INT: Brain,
  PER: Eye,
  SEN: InfinityIcon,
};

export const STAT_ORDER = ["FOR", "AGI", "VIT", "INT", "PER", "SEN"];
