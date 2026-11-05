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
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  /** Secondary text; 6.3:1 on light, 8.5:1 on dark. */
  readonly muted: string;
  readonly border: string;
  readonly accent: string;
  readonly onAccent: string;
}

const LIGHT: Palette = {
  background: '#FFFFFF',
  surface: '#F3F4F6',
  text: '#1A1C1E',
  muted: '#5A6169',
  border: '#D5D9DE',
  accent: '#0B57D0',
  onAccent: '#FFFFFF',
};

const DARK: Palette = {
  background: '#111315',
  surface: '#1E2124',
  text: '#ECEEF0',
  muted: '#A9B0B7',
  border: '#33383D',
  accent: '#8AB4F8',
  onAccent: '#111315',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
