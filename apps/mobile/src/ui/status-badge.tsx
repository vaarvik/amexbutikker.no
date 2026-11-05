import type { AcceptanceStatus } from '@amexbutikker/contracts';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { useServices } from './services';
import { STATUS_COLORS, isLikely, usePalette } from './theme';

/**
 * Symbol plus answer as text, so the status reads without colour. Confirmed answers are filled;
 * likely answers are outlined in the same colour, with the text in the normal text colour so it
 * stays readable in dark mode; "Ikke sjekket" is plain muted text without a symbol.
 */
export function StatusBadge(props: { readonly status: AcceptanceStatus }) {
  const view = useServices().presenter.status(props.status);
  const palette = usePalette();
  const color = STATUS_COLORS[props.status];
  const unknown = props.status === 'unknown';
  const likely = isLikely(props.status);
  return (
    <View
      style={[
        styles.badge,
        unknown
          ? styles.plain
          : likely
            ? { borderWidth: 1.5, borderColor: color }
            : { backgroundColor: color },
      ]}
      accessible
      accessibilityLabel={`${view.answer}: ${view.label}`}
    >
      <Text
        style={[
          unknown ? styles.plainText : styles.text,
          { color: unknown ? palette.muted : likely ? palette.text : '#FFFFFF' },
        ]}
      >
        {unknown ? view.answer : `${view.symbol} ${view.answer}`}
      </Text>
    </View>
  );
}

const ICONS: Readonly<Record<AcceptanceStatus, SymbolViewProps['name']>> = {
  accepted: { ios: 'checkmark', android: 'check', web: 'check' },
  likely_accepted: { ios: 'checkmark', android: 'check', web: 'check' },
  rejected: { ios: 'xmark', android: 'close', web: 'close' },
  likely_rejected: { ios: 'xmark', android: 'close', web: 'close' },
  mixed: { ios: 'plusminus', android: 'exposure', web: 'exposure' },
  unknown: { ios: 'questionmark', android: 'question_mark', web: 'question_mark' },
};

/** The big answer on the place screen; filled, outlined or plain like the badge. */
export function StatusAnswer(props: { readonly status: AcceptanceStatus }) {
  const view = useServices().presenter.status(props.status);
  const palette = usePalette();
  const color = STATUS_COLORS[props.status];
  const unknown = props.status === 'unknown';
  const filled = !unknown && !isLikely(props.status);
  return (
    <View
      style={[
        styles.answer,
        filled
          ? { backgroundColor: color, borderColor: color }
          : {
              backgroundColor: palette.card,
              borderColor: unknown ? palette.border : color,
              borderWidth: unknown ? 1 : 2,
            },
      ]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${view.answer}. ${view.label}`}
    >
      <View
        style={[
          styles.symbol,
          { backgroundColor: filled ? 'rgba(255,255,255,0.18)' : palette.surface },
        ]}
      >
        <SymbolView
          name={ICONS[props.status]}
          size={26}
          weight="bold"
          tintColor={filled ? '#FFFFFF' : unknown ? palette.muted : color}
        />
      </View>
      <Text style={[styles.answerText, { color: filled ? '#FFFFFF' : palette.text }]}>
        {view.answer}
      </Text>
      <Text style={[styles.answerLabel, { color: filled ? '#FFFFFF' : palette.muted }]}>
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
  answerText: { fontSize: 34, fontWeight: '700' },
  answerLabel: { fontSize: 16, textAlign: 'center' },
});
