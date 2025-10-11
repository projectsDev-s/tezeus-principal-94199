import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Paleta de cores vibrantes para conexões
export const CONNECTION_COLORS = [
  '#3B82F6', // Azul
  '#8B5CF6', // Roxo
  '#EC4899', // Rosa
  '#F97316', // Laranja
  '#10B981', // Verde
  '#06B6D4', // Ciano
  '#F59E0B', // Amarelo
  '#EF4444', // Vermelho
  '#6366F1', // Índigo
  '#14B8A6', // Teal
];

// Gera cor aleatória para nova conexão
export function getRandomConnectionColor(): string {
  return CONNECTION_COLORS[Math.floor(Math.random() * CONNECTION_COLORS.length)];
}
