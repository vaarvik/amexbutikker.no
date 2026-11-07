import type { CardProgramme } from '../../spending/spending.model';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field, FormError, Input, SubmitButton, formStyles } from '../../ui/form';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/**
 * "Velg kort": preset milestones for known cards. Terms change, so every preset shows where it
 * was read and when, and tells the user to check the issuer's terms.
 */
export default function PickProgramme() {
  const { spending, spendingPresenter: format } = useServices();
  const palette = usePalette();
  const [chosen, setChosen] = useState<CardProgramme | null>(null);
  const [start, setStart] = useState(() => format.dateInput(spending.today()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsStart = chosen?.milestones.some((m) => m.period.kind === 'window') === true;

  const add = (programme: CardProgramme) => {
    const startDate = format.parseDate(start);
    if (needsStart && startDate === null) {
      setError('Skriv startdatoen som dd.mm.åååå.');
      return;
    }
    setBusy(true);
    spending
      .addProgramme(programme.id, startDate ?? undefined)
      .then(() => {
        router.back();
      })
      .catch(() => {
        setError('Kunne ikke legge til. Prøv igjen.');
        setBusy(false);
      });
  };

  const choose = (programme: CardProgramme) => {
    setError(null);
    if (programme.milestones.some((m) => m.period.kind === 'window')) {
      setChosen(programme);
    } else {
      add(programme);
    }
  };

  return (
    <ScrollView contentContainerStyle={formStyles.content} keyboardShouldPersistTaps="handled">
      {spending.programmes().map((programme) => {
        const selected = chosen?.id === programme.id;
        return (
          <Pressable
            key={programme.id}
            onPress={() => {
              choose(programme);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: palette.card,
                borderColor: selected ? palette.accent : palette.card,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.name, { color: palette.text }]}>{programme.name}</Text>
            {programme.milestones.map((milestone) => (
              <Text key={milestone.title} style={{ color: palette.text }}>
                {milestone.title}: {format.amount(milestone.targetNok)}{' '}
                {milestone.period.kind === 'calendar_year'
                  ? 'i løpet av et kalenderår'
                  : `innen ${String(milestone.period.months)} måneder`}
                . {milestone.reward}.
              </Text>
            ))}
            <Pressable
              onPress={() => {
                void Linking.openURL(programme.sourceUrl);
              }}
              accessibilityRole="link"
              hitSlop={6}
            >
              <Text style={[styles.source, { color: palette.muted }]}>
                Hentet {format.date(programme.fetchedAt)}. Sjekk vilkårene hos kortutstederen.
              </Text>
            </Pressable>
          </Pressable>
        );
      })}

      {chosen !== null && needsStart ? (
        <>
          <Field label="Når fikk du kortet?" hint="Perioden regnes fra denne datoen.">
            <Input value={start} onChangeText={setStart} keyboardType="numbers-and-punctuation" />
          </Field>
          <SubmitButton
            label={`Legg til ${chosen.name}`}
            busy={busy}
            onPress={() => {
              add(chosen);
            }}
          />
        </>
      ) : null}
      <FormError message={error} />
      <View />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, gap: 6, borderWidth: 2 },
  name: { fontSize: 17, fontWeight: '700' },
  source: { fontSize: 13, textDecorationLine: 'underline' },
});
