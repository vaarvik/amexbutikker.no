import type { PlaceCategory } from '@amexbutikker/contracts';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View, useColorScheme } from 'react-native';

/** SF Symbols on iOS, Material Symbols on Android and the web. */
const ICONS: Readonly<Record<PlaceCategory, SymbolViewProps['name']>> = {
  restaurant: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  cafe: { ios: 'cup.and.heat.waves', android: 'local_cafe', web: 'local_cafe' },
  bar: { ios: 'wineglass', android: 'local_bar', web: 'local_bar' },
  pub: { ios: 'mug', android: 'sports_bar', web: 'sports_bar' },
  fast_food: { ios: 'takeoutbag.and.cup.and.straw', android: 'fastfood', web: 'fastfood' },
  shop: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  hotel: { ios: 'bed.double', android: 'hotel', web: 'hotel' },
  online_shop: { ios: 'globe', android: 'language', web: 'language' },
  other: { ios: 'mappin', android: 'location_on', web: 'location_on' },
};

/**
 * One hue per category, as a deep tone for light mode and a lifted one for dark mode. The icon
 * takes the tone and sits on a faint wash of it. Decorative: the category name is in the text.
 */
const HUES: Readonly<Record<PlaceCategory, { readonly light: string; readonly dark: string }>> = {
  restaurant: { light: '#B4532A', dark: '#F0A07A' },
  cafe: { light: '#8A6240', dark: '#D9B48F' },
  bar: { light: '#A3416B', dark: '#EE9CBF' },
  pub: { light: '#93681C', dark: '#E6C27A' },
  fast_food: { light: '#A85E1B', dark: '#F2B57A' },
  shop: { light: '#5B4BC4', dark: '#B3A8F5' },
  hotel: { light: '#2F5FB8', dark: '#9DBBF2' },
  online_shop: { light: '#1F7A70', dark: '#86D2C8' },
  other: { light: '#5A6370', dark: '#B4BBC6' },
};

/** A category symbol in a soft tinted circle. */
export function CategoryIcon(props: { readonly category: PlaceCategory; readonly size?: number }) {
  const size = props.size ?? 40;
  const hue = HUES[props.category][useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <View
      style={[
        styles.well,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          // 8-digit hex: the tone at about 12 % opacity.
          backgroundColor: `${hue}1F`,
        },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <SymbolView name={ICONS[props.category]} size={size * 0.48} tintColor={hue} weight="medium" />
    </View>
  );
}

const styles = StyleSheet.create({
  well: { alignItems: 'center', justifyContent: 'center' },
});
