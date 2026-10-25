import { useColorScheme } from 'react-native';

// Palette generated with Realtime Colors (warm brown/orange). OKLCH values converted to sRGB hex.
// Role -> palette step is noted per token; the chosen steps keep text/label contrast >= ~4.5:1.
const light = {
  bg: '#F6F2EF', // background-50
  card: '#EDE4DE', // background-100
  border: '#DBC9BD', // background-200
  text: '#0E0D0B', // text-950
  muted: '#6A6056', // between text-600 and text-700, for >= 4.5:1 on card
  primary: '#90623C', // primary-600 (primary-500 is only 3.2:1 under a label)
  onPrimary: '#F6F2EF', // background-50
  secondary: '#9F602D', // secondary-600
  accent: '#834715', // accent-700
  done: '#286F2F',
  skipped: '#6A6056',
  missed: '#A52A26',
  danger: '#A52A26',
};

const dark: typeof light = {
  bg: '#110C09', // background-50
  card: '#221811', // background-100
  border: '#443022', // background-200
  text: '#F4F2F1', // text-950
  muted: '#A3998F', // text-600
  primary: '#B47A4B', // primary-500
  onPrimary: '#110C09', // background-50
  secondary: '#D19361', // secondary-600
  accent: '#E19251', // accent-600
  done: '#7FC581',
  skipped: '#A3998F',
  missed: '#FF8578',
  danger: '#FF8578',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Montserrat faces loaded in the root layout. Android can't synthesize weights, so one family per weight. */
export const fonts = {
  regular: 'Montserrat_400Regular',
  bold: 'Montserrat_700Bold',
} as const;

/** Type scale (px) from the design export: base 16, ratio 1.333. */
export const type = {
  small: 12,
  base: 16,
  h5: 21,
  h4: 28,
} as const;
