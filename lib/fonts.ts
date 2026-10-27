import type { TextStyle } from 'react-native';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_400Regular_Italic } from '@expo-google-fonts/dm-sans/400Regular_Italic';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';

export type FontStyle = Pick<TextStyle, 'fontFamily' | 'fontWeight' | 'fontStyle'>;

/** Spread into text styles (`...fonts.bold`); never combine with a separate `fontWeight`. */
export type FontSet = {
  display: FontStyle;
  regular: FontStyle;
  italic: FontStyle;
  medium: FontStyle;
  semibold: FontStyle;
  bold: FontStyle;
};

/**
 * Go and Make type: Instrument Serif for display (titles, Scripture), DM Sans for the interface.
 * Each weight is its own family: Android ignores `fontWeight` for custom fonts and browsers would
 * fake-bold an already bold file.
 */
export const goAndMakeFonts: FontSet = {
  display: { fontFamily: 'InstrumentSerif_400Regular' },
  regular: { fontFamily: 'DMSans_400Regular' },
  italic: { fontFamily: 'DMSans_400Regular_Italic' },
  medium: { fontFamily: 'DMSans_500Medium' },
  semibold: { fontFamily: 'DMSans_600SemiBold' },
  bold: { fontFamily: 'DMSans_700Bold' },
};

/** The platform font, for pathways that keep their own look. */
export const systemFonts: FontSet = {
  display: { fontWeight: '700' },
  regular: { fontWeight: '400' },
  italic: { fontStyle: 'italic' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
};

/** Passed to `useFonts` in app/_layout.tsx. */
export const fontAssets = {
  InstrumentSerif_400Regular,
  DMSans_400Regular,
  DMSans_400Regular_Italic,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
};
