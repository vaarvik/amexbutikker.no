import type { PlaceCategory } from '@amexbutikker/contracts';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

/** SF Symbols on iOS, Material Symbols on Android and the web. */
const ICONS: Readonly<Record<PlaceCategory, SymbolViewProps['name']>> = {
  restaurant: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  cafe: { ios: 'cup.and.saucer', android: 'local_cafe', web: 'local_cafe' },
  bar: { ios: 'wineglass', android: 'local_bar', web: 'local_bar' },
  pub: { ios: 'mug', android: 'sports_bar', web: 'sports_bar' },
  fast_food: { ios: 'takeoutbag.and.cup.and.straw', android: 'fastfood', web: 'fastfood' },
  shop: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  hotel: { ios: 'bed.double', android: 'hotel', web: 'hotel' },
  online_shop: { ios: 'globe', android: 'language', web: 'language' },
  other: { ios: 'mappin', android: 'location_on', web: 'location_on' },
};

/**
 * Map-style colours per category; white on each is at least 4.5:1. The icon is decorative, the
 * category name is always in the text next to it.
 */
const COLORS: Readonly<Record<PlaceCategory, string>> = {
  restaurant: '#C2410C',
  cafe: '#8B5A2B',
  bar: '#9D174D',
  pub: '#A16207',
  fast_food: '#B45309',
  shop: '#6D28D9',
  hotel: '#1D4ED8',
  online_shop: '#0F766E',
  other: '#4B5563',
};

/** A white category symbol in a coloured circle. */
export function CategoryIcon(props: { readonly category: PlaceCategory; readonly size?: number }) {
  const size = props.size ?? 36;
  return (
    <View
      style={[
        styles.well,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS[props.category],
        },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <SymbolView
        name={ICONS[props.category]}
        size={size * 0.5}
        tintColor="#FFFFFF"
        weight="semibold"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  well: { alignItems: 'center', justifyContent: 'center' },
});
