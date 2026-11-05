import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from './theme';

/** The map uses native MapLibre; the web build points to the app instead. */
export function PlacesMap() {
  const palette = usePalette();
  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Text style={[styles.text, { color: palette.muted }]}>
        Kartet finnes i appen. Bruk Steder for å søke.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontSize: 16, textAlign: 'center' },
});
