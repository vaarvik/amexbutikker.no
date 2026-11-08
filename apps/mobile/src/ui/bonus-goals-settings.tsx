import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SpendingOverview } from '../spending/spending.ports';
import { useServices } from './services';
import { STATUS_COLORS, usePalette } from './theme';

/** Settings → Kort og mål: the card, its goals and the user's own (e.g. a welcome bonus). */
export function BonusGoalsSettings() {
  const { spending, spendingPresenter: format } = useServices();
  const palette = usePalette();
  const [overview, setOverview] = useState<SpendingOverview | null>(null);
  // Removing takes two taps: the first arms the button, the second removes.
  const [armed, setArmed] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setArmed(null);
      void spending.overview().then(setOverview);
    }, [spending]),
  );

  const remove = (id: string) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    void spending.removeMilestone(id).then(setOverview);
  };

  const muted = { color: palette.muted };
  const divider = { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth };
  const goals = overview?.progress.map((progress) => progress.milestone) ?? [];

  return (
    <>
      <Text style={[styles.section, muted]}>KORT OG MÅL</Text>
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <Pressable
          onPress={() => {
            router.push('/spending/card');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.label, { color: palette.text }]}>Kort</Text>
          <Text style={[styles.value, { color: palette.accent }]} numberOfLines={1}>
            {overview?.card?.shortName ?? 'Velg'} ›
          </Text>
        </Pressable>
        {goals.map((goal) => {
          const own = goal.programmeId === null;
          return (
            <View key={goal.id} style={[styles.row, divider]}>
              <Text style={[styles.label, styles.grow, { color: palette.text }]} numberOfLines={1}>
                {goal.title}
              </Text>
              <Text style={[styles.value, muted]}>{format.amount(goal.targetNok)}</Text>
              {own ? (
                <Pressable
                  onPress={() => {
                    remove(goal.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    armed === goal.id
                      ? `Trykk igjen for å fjerne ${goal.title}`
                      : `Fjern ${goal.title}`
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
              ) : null}
            </View>
          );
        })}
        <Pressable
          onPress={() => {
            router.push('/spending/milestone');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, divider, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.label, { color: palette.accent }]}>Legg til mål</Text>
        </Pressable>
      </View>
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
    paddingVertical: 12,
  },
  grow: { flex: 1 },
  label: { fontSize: 17 },
  value: { fontSize: 17, flexShrink: 1 },
  small: { fontSize: 13 },
});
