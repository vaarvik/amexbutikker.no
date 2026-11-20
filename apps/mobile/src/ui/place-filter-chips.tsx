import type { PlaceCategory, PlaceFilterQueryDto } from '@amexbutikker/contracts';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePalette } from './theme';

/** What the chips have chosen: "Tar Amex" on or off, and any number of category groups. */
export interface PlaceFilterChoice {
  readonly acceptsOnly: boolean;
  /** Empty means every category. */
  readonly groups: readonly CategoryGroupKey[];
}

export const NO_FILTER: PlaceFilterChoice = { acceptsOnly: false, groups: [] };

type CategoryGroupKey = 'food' | 'cafe' | 'bar' | 'shop' | 'hotel';

/** The way people think about places, mapped onto the stored categories. */
const GROUPS: readonly {
  readonly key: CategoryGroupKey;
  readonly label: string;
  readonly categories: readonly PlaceCategory[];
}[] = [
  { key: 'food', label: 'Mat', categories: ['restaurant', 'fast_food'] },
  { key: 'cafe', label: 'Kafé', categories: ['cafe'] },
  { key: 'bar', label: 'Bar', categories: ['bar', 'pub'] },
  { key: 'shop', label: 'Butikk', categories: ['shop'] },
  { key: 'hotel', label: 'Hotell', categories: ['hotel'] },
];

/** The API filter for a choice; `{}` when nothing is chosen. */
export function toFilterQuery(choice: PlaceFilterChoice): PlaceFilterQueryDto {
  const categories = GROUPS.filter((group) => choice.groups.includes(group.key)).flatMap(
    (group) => group.categories,
  );
  return {
    ...(choice.acceptsOnly ? { acceptsOnly: true } : {}),
    ...(categories.length === 0 ? {} : { categories }),
  };
}

export function isFiltered(choice: PlaceFilterChoice): boolean {
  return choice.acceptsOnly || choice.groups.length > 0;
}

/** A row of chips on the navy header: "Tar Amex", then categories; several can be on at once. */
export function PlaceFilterChips(props: {
  readonly choice: PlaceFilterChoice;
  readonly onChange: (choice: PlaceFilterChoice) => void;
}) {
  const { choice, onChange } = props;
  return (
    <View style={styles.frame}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
      >
        <Chip
          label="Tar Amex"
          symbol
          selected={choice.acceptsOnly}
          onPress={() => {
            onChange({ ...choice, acceptsOnly: !choice.acceptsOnly });
          }}
        />
        {GROUPS.map((group) => (
          <Chip
            key={group.key}
            label={group.label}
            selected={choice.groups.includes(group.key)}
            onPress={() => {
              onChange({
                ...choice,
                groups: choice.groups.includes(group.key)
                  ? choice.groups.filter((key) => key !== group.key)
                  : [...choice.groups, group.key],
              });
            }}
          />
        ))}
      </ScrollView>
      <EdgeFade side="left" />
      <EdgeFade side="right" />
    </View>
  );
}

/** Steps of hero colour over the scroll edge, so chips fade out instead of being cut off. */
const FADE_STEPS = [0.95, 0.85, 0.72, 0.58, 0.44, 0.3, 0.18, 0.08];

function EdgeFade(props: { readonly side: 'left' | 'right' }) {
  const palette = usePalette();
  return (
    <View
      pointerEvents="none"
      style={[
        styles.fade,
        props.side === 'left' ? { left: 0 } : { right: 0, flexDirection: 'row-reverse' },
      ]}
    >
      {FADE_STEPS.map((opacity) => (
        <View key={opacity} style={[styles.fadeStep, { backgroundColor: palette.hero, opacity }]} />
      ))}
    </View>
  );
}

function Chip(props: {
  readonly label: string;
  readonly selected: boolean;
  readonly symbol?: boolean;
  readonly onPress: () => void;
}) {
  const palette = usePalette();
  const color = props.selected ? palette.hero : palette.onHero;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: props.selected }}
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.chip,
        props.selected
          ? // The hero band is the same in both modes, so a selected chip is too: white on it.
            { backgroundColor: palette.onHero, borderColor: palette.onHero }
          : { borderColor: palette.onHeroMuted },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {props.symbol === true ? (
        <SymbolView
          name={{
            ios: props.selected ? 'checkmark.circle.fill' : 'checkmark.circle',
            android: 'check_circle',
            web: 'check_circle',
          }}
          size={15}
          tintColor={props.selected ? '#1E6B34' : palette.onHero}
        />
      ) : null}
      <Text style={[styles.label, { color }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Inset from the screen edge; the chips scroll under a short fade at each side.
  frame: { marginHorizontal: 12 },
  row: { gap: 8, paddingHorizontal: 8 },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 16, flexDirection: 'row' },
  fadeStep: { flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  label: { fontSize: 15, fontWeight: '600' },
});
