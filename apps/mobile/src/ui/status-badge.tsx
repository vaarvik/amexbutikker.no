import type { AcceptanceStatus } from '@amexbutikker/contracts';
import { StyleSheet, Text, View } from 'react-native';
import { useServices } from './services';
import { STATUS_COLORS, usePalette } from './theme';

/**
 * Symbol plus answer as text, so the status reads without colour. Known answers are filled;
 * "Ikke sjekket" is plain muted text without a symbol, so the places with an answer stand out.
 */
export function StatusBadge(props: { readonly status: AcceptanceStatus }) {
  const view = useServices().presenter.status(props.status);
  const palette = usePalette();
  const unknown = props.status === 'unknown';
  return (
    <View
      style={[
        styles.badge,
        unknown ? styles.plain : { backgroundColor: STATUS_COLORS[props.status] },
      ]}
      accessible
      accessibilityLabel={`${view.answer}: ${view.label}`}
    >
      <Text
        style={[
          unknown ? styles.plainText : styles.text,
          { color: unknown ? palette.muted : '#FFFFFF' },
        ]}
      >
        {unknown ? view.answer : `${view.symbol} ${view.answer}`}
      </Text>
    </View>
  );
}

/** The big answer on the place screen. */
export function StatusAnswer(props: { readonly status: AcceptanceStatus }) {
  const view = useServices().presenter.status(props.status);
  const palette = usePalette();
  const unknown = props.status === 'unknown';
  const foreground = unknown ? palette.text : '#FFFFFF';
  return (
    <View
      style={[
        styles.answer,
        unknown
          ? { backgroundColor: palette.card, borderColor: palette.border }
          : {
              backgroundColor: STATUS_COLORS[props.status],
              borderColor: STATUS_COLORS[props.status],
            },
      ]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${view.answer}. ${view.label}`}
    >
      <View
        style={[
          styles.symbol,
          { backgroundColor: unknown ? palette.surface : 'rgba(255,255,255,0.18)' },
        ]}
      >
        <Text style={[styles.symbolText, { color: foreground }]}>{view.symbol}</Text>
      </View>
      <Text style={[styles.answerText, { color: foreground }]}>{view.answer}</Text>
      <Text style={[styles.answerLabel, { color: unknown ? palette.muted : '#FFFFFF' }]}>
        {view.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'center' },
  plain: { paddingHorizontal: 0 },
  text: { fontSize: 13, fontWeight: '600' },
  plainText: { fontSize: 13 },
  answer: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  symbol: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  symbolText: { fontSize: 28, fontWeight: '700' },
  answerText: { fontSize: 34, fontWeight: '700' },
  answerLabel: { fontSize: 16, textAlign: 'center' },
});
