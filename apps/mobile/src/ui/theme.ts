import type { AcceptanceStatus } from '@amexbutikker/contracts';
import { useColorScheme } from 'react-native';

/** Status badges: white text on each colour has a contrast of at least 6.3:1 (WCAG AA needs 4.5). */
export const STATUS_COLORS: Readonly<Record<AcceptanceStatus, string>> = {
  accepted: '#1E6B34',
  rejected: '#B3261E',
  mixed: '#8A5300',
  unknown: '#4A5560',
};

export interface Palette {
  /** Screen background, behind the cards. */
  readonly background: string;
  /** Cards and grouped content. */
  readonly card: string;
  /** Inputs and icon wells. */
  readonly surface: string;
  readonly text: string;
  /** Secondary text; at least 4.9:1 on both background and card. */
  readonly muted: string;
  readonly border: string;
  readonly accent: string;
  readonly onAccent: string;
  /** The header band on the home screen. */
  readonly hero: string;
  readonly onHero: string;
  /** Secondary text on the hero; at least 7:1. */
  readonly onHeroMuted: string;
  /** A soft tint of the accent, for calls to action. */
  readonly accentSoft: string;
}

const LIGHT: Palette = {
  background: '#F2F3F6',
  card: '#FFFFFF',
  surface: '#ECEEF2',
  text: '#16181D',
  muted: '#585F6A',
  border: '#DADDE3',
  accent: '#3442A8',
  onAccent: '#FFFFFF',
  hero: '#161D3A',
  onHero: '#FFFFFF',
  onHeroMuted: '#C3C9E6',
  accentSoft: '#E6E8F7',
};

const DARK: Palette = {
  background: '#0D0F13',
  card: '#1A1D23',
  surface: '#252931',
  text: '#ECEEF2',
  muted: '#A9B0BB',
  border: '#2F343D',
  accent: '#A9B4FF',
  onAccent: '#121633',
  hero: '#161D3A',
  onHero: '#FFFFFF',
  onHeroMuted: '#C3C9E6',
  accentSoft: '#232A4D',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
