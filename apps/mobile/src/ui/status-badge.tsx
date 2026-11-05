import type { AcceptanceStatus } from '@amexbutikker/contracts';
import { StyleSheet, Text, View } from 'react-native';
import { useServices } from './services';
import { STATUS_COLORS } from './theme';

/** Symbol plus answer as text, so the status reads without colour. */
export function StatusBadge(props: { readonly status: AcceptanceStatus }) {
  const view = useServices().presenter.status(props.status);
  return (
    <View
      style={[styles.badge, { backgroundColor: STATUS_COLORS[props.status] }]}
      accessible
      accessibilityLabel={`${view.answer}: ${view.label}`}
    >
      <Text style={styles.text}>
        {view.symbol} {view.answer}
      </Text>
    </View>
  );
}

/** The big answer on the place screen. */
export function StatusAnswer(props: { readonly status: AcceptanceStatus }) {
  const view = useServices().presenter.status(props.status);
  return (
    <View
      style={[styles.answer, { backgroundColor: STATUS_COLORS[props.status] }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${view.answer}. ${view.label}`}
    >
      <Text style={styles.answerText}>
        {view.symbol} {view.answer}
      </Text>
      <Text style={styles.answerLabel}>{view.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  answer: { borderRadius: 20, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center' },
  answerText: { color: '#FFFFFF', fontSize: 48, fontWeight: '800' },
  answerLabel: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginTop: 4 },
});
