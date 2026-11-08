import type { Card } from '@amexbutikker/contracts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FormError, formStyles } from '../../ui/form';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/** "Kortet ditt": every Amex card in Norway; choosing one sets up its yearly goals. */
export default function PickCard() {
  const { cards, spending, spendingPresenter: format } = useServices();
  const palette = usePalette();
  const [list, setList] = useState<readonly Card[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void spending.overview().then((overview) => {
      setCurrent(overview.card?.id ?? null);
    });
    cards
      .list()
      .then(setList)
      .catch(() => {
        setError('Fikk ikke hentet kortene. Prøv igjen.');
      });
  }, [cards, spending]);

  const choose = (card: Card | null) => {
    setError(null);
    spending
      .setCard(card)
      .then(() => {
        router.back();
      })
      .catch(() => {
        setError('Noe gikk galt. Prøv igjen.');
      });
  };

  const goalLine = (card: Card) =>
    card.goals
      .map((goal) => `${goal.title} ved ${format.amount(goal.targetNok)} i året`)
      .join(' · ');

  const row = (
    key: string,
    title: string,
    line: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: palette.card,
          borderColor: selected ? palette.accent : palette.card,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.name, { color: palette.text }]}>{title}</Text>
      {line === '' ? null : <Text style={{ color: palette.muted }}>{line}</Text>}
    </Pressable>
  );

  const sources = list?.filter((card) => card.sourceUrl !== null) ?? [];

  return (
    <ScrollView contentContainerStyle={formStyles.content}>
      {list === null && error === null ? <ActivityIndicator color={palette.accent} /> : null}
      {list?.map((card) =>
        row(card.id, card.shortName, goalLine(card), current === card.id, () => {
          choose(card);
        }),
      )}
      {list === null
        ? null
        : // Not highlighted: no card chosen yet looks the same as "another card".
          row('none', 'Annet kort', '', false, () => {
            choose(null);
          })}
      <FormError message={error} />
      {sources.length === 0 ? null : (
        <Pressable
          onPress={() => {
            const url =
              sources.find((card) => card.id === current)?.sourceUrl ?? sources[0]?.sourceUrl;
            if (url !== null && url !== undefined) {
              void Linking.openURL(url);
            }
          }}
          accessibilityRole="link"
          hitSlop={6}
        >
          <Text style={[styles.source, { color: palette.muted }]}>
            Målene er hentet {format.date(sources[0]?.fetchedAt ?? '')}. Sjekk vilkårene.
          </Text>
        </Pressable>
      )}
      <View />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: 14, padding: 14, gap: 4, borderWidth: 2 },
  name: { fontSize: 17, fontWeight: '700' },
  source: { fontSize: 13, textDecorationLine: 'underline', textAlign: 'center' },
});
