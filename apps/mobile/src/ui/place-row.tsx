import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import { Link } from 'expo-router';
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
  return (
    <Link href={{ pathname: '/place/[id]', params: { id: place.id } }} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.row,
          {
            borderColor: palette.border,
            backgroundColor: pressed ? palette.surface : 'transparent',
          },
        ]}
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
    </Link>
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
