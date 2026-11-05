import type { AcceptanceResult, PlaceId } from '@amexbutikker/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { VisitCandidateSchema } from '../visits/visits.model';
import { CategoryIcon } from '../ui/category-icon';
import { useServices } from '../ui/services';
import { STATUS_COLORS, usePalette } from '../ui/theme';

type RowState = 'idle' | 'sending' | AcceptanceResult | 'failed';

const CandidatesSchema = z.array(VisitCandidateSchema).min(1);

function parse(raw: string | undefined) {
  try {
    const parsed = CandidatesSchema.safeParse(JSON.parse(raw ?? ''));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Opened from a visit notification when several places were equally likely. The user picks
 * the place and answers there; the candidates come with the notification.
 */
export default function VisitScreen() {
  const params = useLocalSearchParams<{ candidates: string }>();
  const { places, presenter } = useServices();
  const palette = usePalette();
  const [rows, setRows] = useState<Readonly<Record<string, RowState>>>({});
  const candidates = parse(params.candidates);

  if (candidates === null) {
    return (
      <Text style={[styles.note, { color: palette.muted }]}>Denne lenken er ikke gyldig.</Text>
    );
  }

  const answer = (placeId: PlaceId, result: AcceptanceResult) => {
    setRows((current) => ({ ...current, [placeId]: 'sending' }));
    places
      .submitReport(placeId, { result })
      .then(() => {
        setRows((current) => ({ ...current, [placeId]: result }));
      })
      .catch(() => {
        setRows((current) => ({ ...current, [placeId]: 'failed' }));
      });
  };

  const answered = Object.values(rows).some((row) => row === 'accepted' || row === 'rejected');

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.note, { color: palette.muted }]}>
        Flere steder ligger tett her. Velg der du betalte.
      </Text>
      <View style={[styles.group, { backgroundColor: palette.card }]}>
        {candidates.map((candidate, index) => {
          const row = rows[candidate.placeId] ?? 'idle';
          return (
            <View
              key={candidate.placeId}
              style={[
                styles.row,
                index === candidates.length - 1
                  ? null
                  : { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
              ]}
            >
              <View style={styles.place}>
                <CategoryIcon category={candidate.category} />
                <View style={styles.text}>
                  <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                    {candidate.name}
                  </Text>
                  <Text style={{ color: palette.muted }}>
                    {row === 'failed'
                      ? presenter.error(null)
                      : row === 'accepted' || row === 'rejected'
                        ? `Takk! ${presenter.status(row).label}.`
                        : presenter.category(candidate.category)}
                  </Text>
                </View>
              </View>
              {row === 'accepted' || row === 'rejected' ? null : (
                <View style={styles.buttons}>
                  {(['accepted', 'rejected'] as const).map((result) => (
                    <Pressable
                      key={result}
                      disabled={row === 'sending'}
                      onPress={() => {
                        answer(candidate.placeId, result);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${candidate.name}: ${result === 'accepted' ? 'Det funket' : 'Ble avvist'}`}
                      style={({ pressed }) => [
                        styles.button,
                        {
                          backgroundColor: STATUS_COLORS[result],
                          opacity: pressed || row === 'sending' ? 0.7 : 1,
                        },
                      ]}
                    >
                      <SymbolView
                        name={
                          result === 'accepted'
                            ? { ios: 'checkmark', android: 'check', web: 'check' }
                            : { ios: 'xmark', android: 'close', web: 'close' }
                        }
                        size={15}
                        weight="bold"
                        tintColor="#FFFFFF"
                      />
                      <Text style={styles.buttonText}>
                        {result === 'accepted' ? 'Det funket' : 'Ble avvist'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
      <Pressable
        onPress={() => {
          router.back();
        }}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.done}
      >
        <Text style={[styles.link, { color: palette.accent }]}>
          {answered ? 'Ferdig' : 'Ingen av disse'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  note: { fontSize: 15, lineHeight: 21, paddingHorizontal: 4 },
  group: { borderRadius: 12, paddingHorizontal: 14 },
  row: { paddingVertical: 12, gap: 10 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: 8, paddingLeft: 48 },
  button: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    minHeight: 44,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  done: { alignSelf: 'center', paddingVertical: 8 },
  link: { fontSize: 17 },
});
