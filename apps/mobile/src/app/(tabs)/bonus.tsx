import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MilestoneProgress, Purchase } from '../../spending/spending.model';
import type { SpendingOverview } from '../../spending/spending.ports';
import { useServices } from '../../ui/services';
import { STATUS_COLORS, usePalette } from '../../ui/theme';

const PACE_BEHIND = '#8A5300';
const SHOWN_PURCHASES = 20;

/**
 * The Bonus tab: how much has been spent on the card, and how far it is to each milestone.
 * Everything here is stored on the phone only.
 */
export default function BonusScreen() {
  const { spending } = useServices();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [overview, setOverview] = useState<SpendingOverview | null>(null);
  // Removing takes two taps: the first arms the button, the second removes.
  const [armed, setArmed] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setArmed(null);
      void spending.overview().then(setOverview);
    }, [spending]),
  );

  const remove = (id: string, milestone: boolean) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    void (milestone ? spending.removeMilestone(id) : spending.removeEntry(id)).then(setOverview);
  };

  const muted = { color: palette.muted };
  const empty = overview !== null && overview.progress.length === 0;

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.scroll}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, paddingTop: insets.top + 12 }]}>
        <View style={styles.column}>
          <Text style={[styles.title, { color: palette.onHero }]} accessibilityRole="header">
            Bonus
          </Text>
          <Text style={[styles.lead, { color: palette.onHeroMuted }]}>
            Hvor mye du har brukt på kortet, og hvor langt det er til neste bonus.
          </Text>
        </View>
      </View>

      <View style={[styles.column, styles.body]}>
        {empty ? (
          <View style={[styles.card, { backgroundColor: palette.card }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Legg til et mål</Text>
            <Text style={muted}>
              Velg kortet ditt for å få bonusmålene, eller lag et eget, for eksempel 90 000 kr innen
              9 måneder for en velkomstbonus.
            </Text>
          </View>
        ) : null}

        {overview?.progress.map((progress) => (
          <MilestoneCard
            key={progress.milestone.id}
            progress={progress}
            armed={armed === progress.milestone.id}
            onRemove={() => {
              remove(progress.milestone.id, true);
            }}
          />
        ))}

        <Pressable
          onPress={() => {
            router.push('/spending/purchase');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: palette.accent, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.primaryText, { color: palette.onAccent }]}>Legg til kjøp</Text>
        </Pressable>
        <View style={styles.links}>
          <TextLink label="Velg kort" href="/spending/programmes" />
          <TextLink label="Lag eget mål" href="/spending/milestone" />
        </View>

        {overview !== null && overview.purchases.length > 0 ? (
          <>
            <Text style={[styles.section, muted]}>SISTE KJØP</Text>
            <View style={[styles.list, { backgroundColor: palette.card }]}>
              {overview.purchases.slice(0, SHOWN_PURCHASES).map((purchase, index) => (
                <PurchaseRow
                  key={purchase.id}
                  purchase={purchase}
                  first={index === 0}
                  armed={armed === purchase.id}
                  onRemove={() => {
                    remove(purchase.id, false);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.note, muted]}>
          Beløpene lagres bare på denne telefonen. Appen sender dem aldri.
        </Text>
      </View>
    </ScrollView>
  );
}

function MilestoneCard(props: {
  readonly progress: MilestoneProgress;
  readonly armed: boolean;
  readonly onRemove: () => void;
}) {
  const { spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { progress } = props;
  const { milestone } = progress;
  const share = Math.min(1, progress.spentNok / milestone.targetNok);
  const reached = progress.standing === 'reached';
  const fill = reached ? STATUS_COLORS.accepted : palette.accent;

  const status = (() => {
    switch (progress.standing) {
      case 'reached':
        return 'Nådd. Du har brukt nok.';
      case 'upcoming':
        return `Starter ${format.date(progress.start)}.`;
      case 'missed':
        return `Perioden sluttet ${format.date(progress.end)}.`;
      case 'active':
        return `${format.amount(progress.remainingNok)} igjen · ${format.amount(progress.perMonthNeededNok)} i måneden til ${format.date(progress.end)}`;
    }
  })();

  return (
    <View
      style={[styles.card, { backgroundColor: palette.card }]}
      accessible
      accessibilityLabel={`${milestone.title}: ${format.amount(progress.spentNok)} av ${format.amount(milestone.targetNok)}. ${status}`}
    >
      <View style={styles.cardHead}>
        <View style={styles.grow}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{milestone.title}</Text>
          {milestone.reward === '' ? null : (
            <Text style={{ color: palette.muted }}>{milestone.reward}</Text>
          )}
        </View>
        {progress.standing === 'active' ? (
          <View
            style={[
              styles.pace,
              { borderColor: progress.onPace ? STATUS_COLORS.accepted : PACE_BEHIND },
            ]}
          >
            <Text
              style={[
                styles.paceText,
                { color: progress.onPace ? STATUS_COLORS.accepted : PACE_BEHIND },
              ]}
            >
              {progress.onPace ? 'I rute' : 'Bak skjema'}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.amount, { color: palette.text }]}>
        {format.amount(progress.spentNok)}
        <Text style={[styles.of, { color: palette.muted }]}>
          {' '}
          av {format.amount(milestone.targetNok)}
        </Text>
      </Text>
      <View style={[styles.track, { backgroundColor: palette.surface }]}>
        <View style={[styles.bar, { width: `${String(share * 100)}%`, backgroundColor: fill }]} />
      </View>
      <Text style={{ color: palette.text }}>{status}</Text>
      {progress.totalAsOf === null ? null : (
        <Text style={[styles.small, { color: palette.muted }]}>
          Total fra kortappen per {format.date(progress.totalAsOf)}, pluss kjøp etter det.
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            router.push({
              pathname: '/spending/total',
              params: { milestone: milestone.id, title: milestone.title },
            });
          }}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.action, { color: palette.accent }]}>Oppdater total</Text>
        </Pressable>
        <Pressable onPress={props.onRemove} accessibilityRole="button" hitSlop={8}>
          <Text
            style={[styles.action, { color: props.armed ? STATUS_COLORS.rejected : palette.muted }]}
          >
            {props.armed ? 'Trykk igjen for å fjerne' : 'Fjern'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PurchaseRow(props: {
  readonly purchase: Purchase;
  readonly first: boolean;
  readonly armed: boolean;
  readonly onRemove: () => void;
}) {
  const { spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { purchase } = props;
  return (
    <View
      style={[
        styles.row,
        props.first
          ? null
          : { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={styles.grow}>
        <Text style={{ color: palette.text }} numberOfLines={1}>
          {purchase.merchant ?? 'Kjøp'}
        </Text>
        <Text style={[styles.small, { color: palette.muted }]}>{format.date(purchase.date)}</Text>
      </View>
      <Text style={[styles.rowAmount, { color: palette.text }]}>
        {format.amount(purchase.amountNok)}
      </Text>
      <Pressable
        onPress={props.onRemove}
        accessibilityRole="button"
        accessibilityLabel={props.armed ? 'Trykk igjen for å fjerne kjøpet' : 'Fjern kjøpet'}
        hitSlop={8}
      >
        <Text
          style={[styles.small, { color: props.armed ? STATUS_COLORS.rejected : palette.muted }]}
        >
          {props.armed ? 'Fjern?' : 'Fjern'}
        </Text>
      </Pressable>
    </View>
  );
}

function TextLink(props: {
  readonly label: string;
  readonly href: '/spending/programmes' | '/spending/milestone';
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={() => {
        router.push(props.href);
      }}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Text style={[styles.link, { color: palette.accent }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 20 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: 0.3, paddingHorizontal: 20 },
  lead: { fontSize: 15, paddingHorizontal: 20, marginTop: 6 },
  body: { paddingHorizontal: 16, paddingTop: 20, gap: 14 },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  grow: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  pace: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  paceText: { fontSize: 13, fontWeight: '700' },
  amount: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  of: { fontSize: 16, fontWeight: '400' },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 999 },
  small: { fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  action: { fontSize: 15, fontWeight: '600' },
  primary: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryText: { fontSize: 17, fontWeight: '700' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  link: { fontSize: 16, fontWeight: '600' },
  section: { fontSize: 13, letterSpacing: 0.2, paddingHorizontal: 16, marginTop: 10 },
  list: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowAmount: { fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13, paddingHorizontal: 16, marginTop: 6 },
});
