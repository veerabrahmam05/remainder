import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { fonts } from './theme';

/**
 * Drop-in replacement for react-native's Text that applies Montserrat.
 * Custom fonts on Android ignore fontWeight, so we map it to the regular / bold face ourselves.
 */
export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  // Montserrat has tall built-in line metrics; Android's default font padding adds even more
  // empty space above and below the text, so turn it off.
  if (flat.fontFamily) return <RNText {...props} style={[style, { includeFontPadding: false }]} />;

  const weight = flat.fontWeight;
  const bold = weight === 'bold' || (weight !== undefined && Number(weight) >= 600);
  return (
    <RNText
      {...props}
      style={[
        style,
        { fontFamily: bold ? fonts.bold : fonts.regular, fontWeight: 'normal', includeFontPadding: false },
      ]}
    />
  );
}
