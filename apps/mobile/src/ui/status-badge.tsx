import type { AcceptanceStatus } from '@amexbutikker/contracts';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { useServices } from './services';
import { STATUS_COLORS, isLikely, usePalette, useStatusColor } from './theme';

/**
 * The answer in a list row: a symbol and the word, no box. Confirmed answers get a filled
 * symbol and the status colour; likely answers an outlined symbol; "Ikke sjekket" is muted text.
 * The word carries the meaning, so it reads without colour.
 */
export function StatusBadge(props: { readonly status: AcceptanceStatus }) {
  const view = useServices().presenter.status(props.status);
  const palette = usePalette();
  const color = useStatusColor(props.status);
  const unknown = props.status === 'unknown';
  const likely = isLikely(props.status);
  return (
    <View style={styles.badge} accessible accessibilityLabel={`${view.answer}: ${view.label}`}>
      {unknown ? null : <SymbolView name={BADGE_ICONS[props.status]} size={17} tintColor={color} />}
      <Text
        style={[
          styles.text,
          unknown
            ? { color: palette.muted, fontWeight: '400' }
            : { color: likely ? palette.text : color },
        ]}
      >
        {view.answer}
      </Text>
    </View>
  );
}

const BADGE_ICONS: Readonly<Record<AcceptanceStatus, SymbolViewProps['name']>> = {
  accepted: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  likely_accepted: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  rejected: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
  likely_rejected: { ios: 'xmark.circle', android: 'cancel', web: 'cancel' },
  mixed: { ios: 'plusminus.circle', android: 'exposure', web: 'exposure' },
  unknown: { ios: 'questionmark.circle', android: 'help', web: 'help' },
};

const ICONS: Readonly<Record<AcceptanceStatus, SymbolViewProps['name']>> = {
  accepted: { ios: 'checkmark', android: 'check', web: 'check' },
  likely_accepted: { ios: 'checkmark', android: 'check', web: 'check' },
  rejected: { ios: 'xmark', android: 'close', web: 'close' },
  likely_rejected: { ios: 'xmark', android: 'close', web: 'close' },
  mixed: { ios: 'plusminus', android: 'exposure', web: 'exposure' },
  unknown: { ios: 'questionmark', android: 'question_mark', web: 'question_mark' },
};

/** The big answer on a place. `note` replaces the line under it, e.g. right after the user answered. */
export function StatusAnswer(props: { readonly status: AcceptanceStatus; readonly note?: string }) {
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
      accessibilityLabel={`${view.answer}. ${props.note ?? view.label}`}
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
        {props.note ?? view.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center' },
  text: { fontSize: 15, fontWeight: '600' },
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
