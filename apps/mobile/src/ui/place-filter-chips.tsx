import type { PlaceCategory, PlaceFilterQueryDto } from '@amexbutikker/contracts';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { usePalette } from './theme';

/** What the chips have chosen: "Tar Amex" on or off, and at most one category group. */
export interface PlaceFilterChoice {
  readonly acceptsOnly: boolean;
  readonly group: CategoryGroupKey | null;
}

export const NO_FILTER: PlaceFilterChoice = { acceptsOnly: false, group: null };

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
  const categories = GROUPS.find((group) => group.key === choice.group)?.categories;
  return {
    ...(choice.acceptsOnly ? { acceptsOnly: true } : {}),
    ...(categories === undefined ? {} : { categories }),
  };
}

export function isFiltered(choice: PlaceFilterChoice): boolean {
  return choice.acceptsOnly || choice.group !== null;
}

/** A row of chips on the navy header: "Tar Amex", then one category at a time. */
export function PlaceFilterChips(props: {
  readonly choice: PlaceFilterChoice;
  readonly onChange: (choice: PlaceFilterChoice) => void;
}) {
  const { choice, onChange } = props;
  return (
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
          selected={choice.group === group.key}
          onPress={() => {
            onChange({ ...choice, group: choice.group === group.key ? null : group.key });
          }}
        />
      ))}
    </ScrollView>
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
          ? { backgroundColor: palette.card, borderColor: palette.card }
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
  row: { gap: 8, paddingHorizontal: 20 },
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
