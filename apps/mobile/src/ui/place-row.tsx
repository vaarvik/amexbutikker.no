import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from './category-icon';
import { useServices } from './services';
import { StatusBadge } from './status-badge';
import { usePalette } from './theme';

/** One place in a list: category icon, name, category and distance, and the answer. Open rows, no card. */
export function PlaceRow(props: { readonly summary: PlaceSummaryDto }) {
  const { presenter } = useServices();
  const palette = usePalette();
  const { place, status, distanceM } = props.summary;
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
        { backgroundColor: pressed ? palette.surface : 'transparent' },
      ]}
    >
      <CategoryIcon category={place.category} />
      <View style={styles.body}>
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
    gap: 14,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderRadius: 14,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    minHeight: 64,
  },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  details: { fontSize: 14 },
});
