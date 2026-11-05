import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from './category-icon';
import { useServices } from './services';
import { StatusBadge } from './status-badge';
import { usePalette } from './theme';

const RADIUS = 12;

/**
 * One place in a grouped list: category icon, name, category and distance, and the answer.
 * `first` and `last` round the group's corners; rows in between share a hairline separator.
 */
export function PlaceRow(props: {
  readonly summary: PlaceSummaryDto;
  readonly first?: boolean;
  readonly last?: boolean;
}) {
  const { presenter } = useServices();
  const palette = usePalette();
  const { place, status, distanceM } = props.summary;
  const first = props.first ?? true;
  const last = props.last ?? true;
  const details = [presenter.category(place.category), presenter.distance(distanceM)]
    .filter((part) => part !== null)
    .join(' · ');
  // A plain Pressable: expo-router's <Link asChild> drops a style given as a function.
  return (
    <Pressable
      onPress={() => {
        router.push({ pathname: '/place/[id]', params: { id: place.id } });
      }}
      accessibilityRole="link"
      accessibilityLabel={`${place.name}, ${details}, ${presenter.status(status.status).answer}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? palette.surface : palette.card,
          borderTopLeftRadius: first ? RADIUS : 0,
          borderTopRightRadius: first ? RADIUS : 0,
          borderBottomLeftRadius: last ? RADIUS : 0,
          borderBottomRightRadius: last ? RADIUS : 0,
        },
      ]}
    >
      <CategoryIcon category={place.category} />
      <View
        style={[
          styles.body,
          last
            ? null
            : { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
        ]}
      >
        <View style={styles.text}>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {place.name}
          </Text>
          <Text style={[styles.details, { color: palette.muted }]} numberOfLines={1}>
            {details}
          </Text>
        </View>
        <StatusBadge status={status.status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 14,
    marginHorizontal: 16,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingRight: 14,
    minHeight: 60,
  },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  details: { fontSize: 14 },
});
