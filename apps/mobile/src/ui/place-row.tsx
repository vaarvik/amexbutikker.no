import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useServices } from './services';
import { StatusBadge } from './status-badge';
import { usePalette } from './theme';

export function PlaceRow(props: { readonly summary: PlaceSummaryDto }) {
  const { presenter } = useServices();
  const palette = usePalette();
  const { place, status, distanceM } = props.summary;
  const details = [presenter.distance(distanceM), presenter.address(place)]
    .filter((part) => part !== null)
    .join(' · ');
  // A plain Pressable: expo-router's <Link asChild> drops a style given as a function, which
  // left the rows unstyled.
  return (
    <Pressable
      onPress={() => {
        router.push({ pathname: '/place/[id]', params: { id: place.id } });
      }}
      accessibilityRole="link"
      accessibilityLabel={`${place.name}, ${presenter.status(status.status).answer}`}
      style={[styles.row, { borderColor: palette.border, backgroundColor: palette.background }]}
    >
      <View style={styles.text}>
        <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
          {place.name}
        </Text>
        {details === '' ? null : (
          <Text style={[styles.details, { color: palette.muted }]} numberOfLines={1}>
            {details}
          </Text>
        )}
      </View>
      <StatusBadge status={status.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  details: { fontSize: 14 },
});
