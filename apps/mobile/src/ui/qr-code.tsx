import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * A QR code drawn with Views: one row per module row, dark runs merged into one View each. Dark
 * on white whatever the theme, with the quiet zone the scanners need.
 */
export function QrCode(props: { readonly value: string; readonly size: number }) {
  const rows = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(props.value);
    code.make();
    const count = code.getModuleCount();
    return Array.from({ length: count }, (_, row) => {
      const runs: { readonly start: number; readonly length: number }[] = [];
      let col = 0;
      while (col < count) {
        if (!code.isDark(row, col)) {
          col += 1;
          continue;
        }
        const start = col;
        while (col < count && code.isDark(row, col)) {
          col += 1;
        }
        runs.push({ start, length: col - start });
      }
      return { count, runs };
    });
  }, [props.value]);

  const count = rows[0]?.count ?? 1;
  const quiet = 4;
  // Whole points per module, so rows meet without hairline gaps.
  const cell = Math.max(1, Math.floor(props.size / (count + quiet * 2)));
  const side = cell * (count + quiet * 2);
  return (
    <View
      style={[styles.frame, { width: side, height: side, padding: cell * quiet }]}
      accessibilityRole="image"
      accessibilityLabel="QR-kode for å bli med i husstanden"
    >
      {rows.map((row, index) => (
        <View key={index} style={{ height: cell }}>
          {row.runs.map((run) => (
            <View
              key={run.start}
              style={[
                styles.dark,
                { left: run.start * cell, width: run.length * cell, height: cell },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#FFFFFF', borderRadius: 12 },
  dark: { position: 'absolute', top: 0, backgroundColor: '#000000' },
});
