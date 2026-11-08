import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Milestone } from '../spending/spending.model';
import { useServices } from './services';
import { STATUS_COLORS, usePalette } from './theme';

/** Settings → Bonusmål: the goals the Bonus tab tracks, and adding or removing them. */
export function BonusGoalsSettings() {
  const { spending, spendingPresenter: format } = useServices();
  const palette = usePalette();
  const [goals, setGoals] = useState<readonly Milestone[] | null>(null);
  // Removing takes two taps: the first arms the button, the second removes.
  const [armed, setArmed] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setArmed(null);
      void spending.overview().then((overview) => {
        setGoals(overview.progress.map((progress) => progress.milestone));
      });
    }, [spending]),
  );

  const remove = (id: string) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    void spending.removeMilestone(id).then((overview) => {
      setGoals(overview.progress.map((progress) => progress.milestone));
    });
  };

  const period = (goal: Milestone) =>
    goal.period.kind === 'calendar_year'
      ? 'hvert kalenderår'
      : `${String(goal.period.months)} måneder fra ${format.date(goal.period.start)}`;

  const muted = { color: palette.muted };
  const divider = { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth };

  return (
    <>
      <Text style={[styles.section, muted]}>BONUSMÅL</Text>
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        {goals?.map((goal, index) => (
          <View key={goal.id} style={[styles.row, index === 0 ? null : divider]}>
            <View style={styles.grow}>
              <Text style={[styles.label, { color: palette.text }]}>{goal.title}</Text>
              <Text style={[styles.small, muted]}>
                {format.amount(goal.targetNok)} · {period(goal)}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                remove(goal.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                armed === goal.id ? `Trykk igjen for å fjerne ${goal.title}` : `Fjern ${goal.title}`
              }
              hitSlop={8}
            >
              <Text
                style={[
                  styles.small,
                  { color: armed === goal.id ? STATUS_COLORS.rejected : palette.muted },
                ]}
              >
                {armed === goal.id ? 'Fjern?' : 'Fjern'}
              </Text>
            </Pressable>
          </View>
        ))}
        {(['/spending/programmes', '/spending/milestone'] as const).map((href, index) => (
          <Pressable
            key={href}
            onPress={() => {
              router.push(href);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              index === 0 && (goals?.length ?? 0) === 0 ? null : divider,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.label, { color: palette.accent }]}>
              {href === '/spending/programmes' ? 'Velg kortet ditt' : 'Lag eget mål'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.note, muted]}>
        Kortet gir deg bonusmålene det har, for eksempel 150 000 kr i året. Et eget mål kan være 90
        000 kr innen 9 måneder for en velkomstbonus. Bonus-fanen viser hvor langt du har kommet.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, paddingHorizontal: 16, marginBottom: -4 },
  card: { borderRadius: 12, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
  },
  grow: { flex: 1 },
  label: { fontSize: 17 },
  small: { fontSize: 13 },
  note: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16 },
});
