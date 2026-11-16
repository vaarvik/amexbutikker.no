import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  MilestoneProgress,
  Purchase,
  SpendingShares,
  YearSpending,
} from '../../spending/spending.model';
import type { SpendingOverview } from '../../spending/spending.ports';
import { Choice } from '../../ui/form';
import { memberLabel } from '../../ui/members';
import { useServices } from '../../ui/services';
import { STATUS_COLORS, usePalette } from '../../ui/theme';

const PACE_BEHIND = '#8A5300';
const SHOWN_PURCHASES = 20;
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;
const MONTH_NAMES = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember',
] as const;
const CHART_HEIGHT = 96;

/** Which purchases the list shows: all, the shared ones, or those one member paid. */
type PurchaseFilter = 'all' | 'shared' | `paid:${string}`;

function matches(purchase: Purchase, filter: PurchaseFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'shared') {
    return purchase.split === 'shared';
  }
  return purchase.paidBy === filter.slice('paid:'.length);
}

/**
 * The goal shown big at the top: the card's first goal not yet reached (its companion ticket),
 * else the running goal that ends first, else the next to start, else the first.
 */
function leadOf(progress: readonly MilestoneProgress[]): MilestoneProgress | null {
  const card = progress.find(
    (item) => item.milestone.programmeId !== null && item.standing === 'active',
  );
  const byEnd = [...progress].sort((a, b) => a.end.localeCompare(b.end));
  return (
    card ??
    byEnd.find((item) => item.standing === 'active') ??
    byEnd.find((item) => item.standing === 'upcoming') ??
    progress[0] ??
    null
  );
}

/**
 * The Bonus tab: how far it is to the next bonus, and what has been spent this year. Goals are
 * set up in Settings. Everything here is stored on the phone only.
 */
export default function BonusScreen() {
  const { spending, households } = useServices();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [overview, setOverview] = useState<SpendingOverview | null>(null);
  const [sharedWith, setSharedWith] = useState<number | null>(null);
  // Removing a purchase takes two taps: the first arms the button, the second removes.
  const [armed, setArmed] = useState<string | null>(null);
  const [filter, setFilter] = useState<PurchaseFilter>('all');

  useFocusEffect(
    useCallback(() => {
      setArmed(null);
      void spending.overview().then(setOverview);
      // Show what is here at once, then what the household's other phones added.
      void households
        .sync()
        .then(async (result) => {
          if (result.kind === 'synced' && result.received > 0) {
            setOverview(await spending.overview());
          }
          const status = await households.status();
          setSharedWith(status.kind === 'member' ? status.memberCount : null);
        })
        .catch(() => undefined);
    }, [spending, households]),
  );

  const remove = (id: string) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    void spending.removeEntry(id).then(setOverview);
  };

  const muted = { color: palette.muted };
  const lead = overview === null ? null : leadOf(overview.progress);
  const others = overview?.progress.filter((item) => item !== lead) ?? [];
  const shares = overview?.shares ?? null;
  const filters: { readonly value: PurchaseFilter; readonly label: string }[] =
    overview === null || shares === null
      ? []
      : [
          { value: 'all', label: 'Alle' },
          { value: 'shared', label: 'Felles' },
          ...shares.members.map((share) => ({
            value: `paid:${share.member.id}` as const,
            label: memberLabel(share.member.id, overview.members, overview.me),
          })),
        ];
  const shown =
    overview?.purchases.filter((purchase) => matches(purchase, shares === null ? 'all' : filter)) ??
    [];
  const unnamed =
    overview !== null &&
    sharedWith !== null &&
    !overview.members.some((member) => member.id === overview.me);

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.scroll}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, paddingTop: insets.top + 12 }]}>
        <View style={[styles.column, styles.heroBody]}>
          <Text style={[styles.title, { color: palette.onHero }]} accessibilityRole="header">
            Bonus
          </Text>
          {overview === null ? null : lead === null ? (
            <YearHero year={overview.year} />
          ) : (
            <GoalHero progress={lead} />
          )}
        </View>
      </View>

      <View style={[styles.column, styles.body]}>
        {overview === null ? null : <YearCard year={overview.year} />}

        {others.map((progress) => (
          <MilestoneCard key={progress.milestone.id} progress={progress} />
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

        {unnamed ? (
          <Pressable
            onPress={() => {
              router.push('/household');
            }}
            accessibilityRole="button"
            style={[styles.card, { backgroundColor: palette.card }]}
          >
            <Text style={{ color: palette.text }}>
              Skriv navnet ditt, så ser dere hvem som betalte.
            </Text>
            <Text style={[styles.action, { color: palette.accent }]}>Skriv navn ›</Text>
          </Pressable>
        ) : null}

        {overview === null || shares === null ? null : (
          <SharesCard shares={shares} overview={overview} />
        )}

        {overview !== null && overview.purchases.length > 0 ? (
          <>
            <Text style={[styles.section, muted]}>SISTE KJØP</Text>
            {filters.length === 0 ? null : (
              <Choice value={filter} options={filters} onChange={setFilter} />
            )}
            <View style={[styles.list, { backgroundColor: palette.card }]}>
              {shown.length === 0 ? <Text style={[styles.row, muted]}>Ingen kjøp her.</Text> : null}
              {shown.slice(0, SHOWN_PURCHASES).map((purchase, index) => (
                <PurchaseRow
                  key={purchase.id}
                  purchase={purchase}
                  payer={
                    shares === null
                      ? null
                      : memberLabel(purchase.paidBy, overview.members, overview.me)
                  }
                  first={index === 0}
                  armed={armed === purchase.id}
                  onRemove={() => {
                    remove(purchase.id);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        {lead === null ? null : (
          <Pressable
            onPress={() => {
              router.navigate('/settings');
            }}
            accessibilityRole="link"
            hitSlop={8}
            style={styles.center}
          >
            <Text style={[styles.link, { color: palette.accent }]}>Endre bonusmål</Text>
          </Pressable>
        )}
        <Text style={[styles.note, muted]}>
          {sharedWith === null
            ? 'Beløpene lagres bare på denne telefonen.'
            : `Delt mellom ${String(sharedWith)} telefoner. Beløpene krypteres på telefonen.`}
        </Text>
      </View>
    </ScrollView>
  );
}

/** No goal yet: this year's total is the progress. */
function YearHero(props: { readonly year: YearSpending }) {
  const { spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { year } = props;
  return (
    <View style={styles.heroBlock}>
      <Text style={[styles.heroLabel, { color: palette.onHeroMuted }]}>
        Brukt på kortet i {String(year.year)}
      </Text>
      <Text style={[styles.heroAmount, { color: palette.onHero }]}>
        {format.amount(year.spentNok)}
      </Text>
      <Text style={[styles.heroLine, { color: palette.onHeroMuted }]}>
        {year.purchaseCount === 0
          ? 'Velg kortet ditt, så ser du hvor langt det er til bonusen.'
          : `${String(year.purchaseCount)} kjøp registrert`}
      </Text>
      <Pressable
        onPress={() => {
          router.push('/spending/card');
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.heroButton,
          { borderColor: palette.onHeroMuted, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.heroButtonText, { color: palette.onHero }]}>Sett et bonusmål</Text>
      </Pressable>
    </View>
  );
}

/** The goal that matters most right now, big. */
function GoalHero(props: { readonly progress: MilestoneProgress }) {
  const { spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { progress } = props;
  const { milestone } = progress;
  const share = Math.min(1, progress.spentNok / milestone.targetNok);
  const percent = Math.floor(share * 100);

  const line = (() => {
    switch (progress.standing) {
      case 'reached':
        return milestone.reward === '' ? 'Nådd!' : `Nådd! ${milestone.reward}`;
      case 'upcoming':
        return `Starter ${format.date(progress.start)}.`;
      case 'missed':
        return `Perioden sluttet ${format.date(progress.end)}.`;
      case 'active':
        return `${format.amount(progress.remainingNok)} igjen · ${String(progress.daysLeft)} dager til ${format.date(progress.end)}`;
    }
  })();

  return (
    <View
      style={styles.heroBlock}
      accessible
      accessibilityLabel={`${milestone.title}: ${format.amount(progress.spentNok)} av ${format.amount(milestone.targetNok)}, ${String(percent)} prosent. ${line}`}
    >
      <View style={styles.heroHead}>
        <Text style={[styles.heroLabel, styles.grow, { color: palette.onHeroMuted }]}>
          {milestone.title}
        </Text>
        {progress.standing === 'active' ? (
          <Text style={[styles.heroPace, { color: palette.onHero }]}>
            {progress.onPace ? '● I rute' : '● Bak skjema'}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.heroAmount, { color: palette.onHero }]}>
        {format.amount(progress.spentNok)}
        <Text style={[styles.heroOf, { color: palette.onHeroMuted }]}>
          {' '}
          av {format.amount(milestone.targetNok)}
        </Text>
      </Text>
      <View style={styles.meterRow}>
        <View style={[styles.heroTrack, styles.grow]}>
          <View
            style={[
              styles.heroBar,
              { width: `${String(share * 100)}%`, backgroundColor: palette.heroChart },
            ]}
          />
        </View>
        <Text style={[styles.percent, { color: palette.onHero }]}>{`${String(percent)} %`}</Text>
      </View>
      <Text style={[styles.heroLine, { color: palette.onHero }]}>{line}</Text>
      {progress.standing === 'active' && progress.perMonthNeededNok > 0 ? (
        <Text style={[styles.heroLine, { color: palette.onHeroMuted }]}>
          {format.amount(progress.perMonthNeededNok)} i måneden for å nå det
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          router.push({
            pathname: '/spending/total',
            params: { milestone: milestone.id, title: milestone.title },
          });
        }}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.heroAction}
      >
        <Text style={[styles.heroActionText, { color: palette.onHero }]}>
          Oppdater total fra kortappen
        </Text>
      </Pressable>
    </View>
  );
}

/** This year's purchases by month: one series, the current month labelled. */
function YearCard(props: { readonly year: YearSpending }) {
  const { spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { year } = props;
  const max = Math.max(...year.months.map((month) => month.nok), 1);
  const current = year.months.at(-1);
  const summary = year.months
    .map((month) => `${MONTH_NAMES[month.month - 1] ?? ''} ${format.amount(month.nok)}`)
    .join(', ');

  return (
    <View
      style={[styles.card, { backgroundColor: palette.card }]}
      accessible
      accessibilityLabel={`Brukt per måned i ${String(year.year)}: ${summary}. Til sammen ${format.amount(year.spentNok)}.`}
    >
      <Text style={[styles.cardTitle, { color: palette.text }]}>Per måned</Text>
      <Text style={[styles.small, { color: palette.muted }]}>
        {current === undefined || current.nok === 0
          ? `Ingen kjøp i ${MONTH_NAMES[(current?.month ?? 1) - 1] ?? ''} ennå`
          : `${format.amount(current.nok)} i ${MONTH_NAMES[current.month - 1] ?? ''}`}
      </Text>
      <View style={[styles.chart, { borderBottomColor: palette.border }]}>
        {Array.from({ length: 12 }, (_, index) => {
          const month = year.months[index];
          const height = month === undefined ? 0 : (month.nok / max) * CHART_HEIGHT;
          return (
            <View key={index} style={styles.barSlot}>
              {month !== undefined && month.nok > 0 ? (
                <View
                  style={[
                    styles.chartBar,
                    { height: Math.max(3, height), backgroundColor: palette.chart },
                  ]}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        {MONTH_LETTERS.map((letter, index) => (
          <Text
            key={index}
            style={[
              styles.axisLabel,
              {
                color: index === year.months.length - 1 ? palette.text : palette.muted,
                fontWeight: index === year.months.length - 1 ? '700' : '400',
              },
            ]}
          >
            {letter}
          </Text>
        ))}
      </View>
      <Text style={[styles.small, { color: palette.muted }]}>
        Kjøp registrert i appen. Totaler fra kortappen telles bare i målene.
      </Text>
    </View>
  );
}

/** A goal that is not the one at the top. */
function MilestoneCard(props: { readonly progress: MilestoneProgress }) {
  const { spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { progress } = props;
  const { milestone } = progress;
  const share = Math.min(1, progress.spentNok / milestone.targetNok);
  const reached = progress.standing === 'reached';

  const status = (() => {
    switch (progress.standing) {
      case 'reached':
        return 'Nådd.';
      case 'upcoming':
        return `Starter ${format.date(progress.start)}.`;
      case 'missed':
        return `Perioden sluttet ${format.date(progress.end)}.`;
      case 'active':
        return `${format.amount(progress.remainingNok)} igjen til ${format.date(progress.end)}`;
    }
  })();

  return (
    <View
      style={[styles.card, { backgroundColor: palette.card }]}
      accessible
      accessibilityLabel={`${milestone.title}: ${format.amount(progress.spentNok)} av ${format.amount(milestone.targetNok)}. ${status}`}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, styles.grow, { color: palette.text }]}>
          {milestone.title}
        </Text>
        {progress.standing === 'active' ? (
          <Text
            style={[
              styles.paceText,
              { color: progress.onPace ? STATUS_COLORS.accepted : PACE_BEHIND },
            ]}
          >
            {progress.onPace ? 'I rute' : 'Bak skjema'}
          </Text>
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
        <View
          style={[
            styles.bar,
            {
              width: `${String(share * 100)}%`,
              backgroundColor: reached ? STATUS_COLORS.accepted : palette.chart,
            },
          ]}
        />
      </View>
      <Text style={{ color: palette.text }}>{status}</Text>
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
    </View>
  );
}

/** The household's shared spending and who owes whom. */
function SharesCard(props: {
  readonly shares: SpendingShares;
  readonly overview: SpendingOverview;
}) {
  const { spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { shares, overview } = props;
  const name = (id: string) => memberLabel(id, overview.members, overview.me);
  const mine = shares.members.find((share) => share.member.id === overview.me);
  const others = shares.members.filter((share) => share.member.id !== overview.me);
  const other = others.length === 1 ? others[0] : undefined;

  const balance = (() => {
    if (mine === undefined) {
      return null;
    }
    const amount = format.amount(Math.abs(mine.balanceNok));
    if (mine.balanceNok === 0) {
      return 'Dere er skuls.';
    }
    if (other !== undefined) {
      return mine.balanceNok > 0
        ? `${name(other.member.id)} skylder deg ${amount}.`
        : `Du skylder ${name(other.member.id)} ${amount}.`;
    }
    return mine.balanceNok > 0
      ? `Du har betalt ${amount} mer enn din del.`
      : `Du har betalt ${amount} mindre enn din del.`;
  })();

  return (
    <View style={[styles.card, { backgroundColor: palette.card }]}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>Felles</Text>
      <Text style={[styles.amount, { color: palette.text }]}>
        {format.amount(shares.sharedNok)}
      </Text>
      {balance === null ? null : <Text style={{ color: palette.text }}>{balance}</Text>}
      {shares.members.map((share) => (
        <View key={share.member.id} style={styles.shareRow}>
          <Text style={[styles.grow, { color: palette.text }]}>{name(share.member.id)}</Text>
          <Text style={[styles.small, { color: palette.muted }]}>
            felles {format.amount(share.paidSharedNok)} · privat {format.amount(share.privateNok)}
          </Text>
        </View>
      ))}
      {shares.unassignedNok > 0 ? (
        <Text style={[styles.small, { color: palette.muted }]}>
          {format.amount(shares.unassignedNok)} fra før er ikke fordelt.
        </Text>
      ) : null}
    </View>
  );
}

function PurchaseRow(props: {
  readonly purchase: Purchase;
  /** Who paid, shown when the household has members; null otherwise. */
  readonly payer: string | null;
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
      <Pressable
        onPress={() => {
          router.push({ pathname: '/spending/split', params: { id: purchase.id } });
        }}
        accessibilityRole="button"
        accessibilityHint="Endre hvem som betalte"
        style={styles.grow}
      >
        <Text style={{ color: palette.text }} numberOfLines={1}>
          {purchase.merchant ?? 'Kjøp'}
        </Text>
        <Text style={[styles.small, { color: palette.muted }]}>
          {format.date(purchase.date)}
          {purchase.source === 'wallet' ? ' · Apple Pay' : ''}
          {props.payer === null ? '' : ` · ${props.payer}`}
          {purchase.split === 'private' ? ' · Privat' : ''}
        </Text>
      </Pressable>
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

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 22 },
  heroBody: { paddingHorizontal: 20, gap: 14 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: 0.3 },
  heroBlock: { gap: 8 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroLabel: { fontSize: 15, fontWeight: '600' },
  heroPace: { fontSize: 14, fontWeight: '700' },
  heroAmount: { fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  heroOf: { fontSize: 18, fontWeight: '500', letterSpacing: 0 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTrack: {
    height: 14,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroBar: { height: '100%', borderRadius: 999 },
  percent: { fontSize: 15, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  heroLine: { fontSize: 15 },
  heroAction: { alignSelf: 'flex-start', marginTop: 4 },
  heroButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 6,
  },
  heroButtonText: { fontSize: 15, fontWeight: '700' },
  heroActionText: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  body: { paddingHorizontal: 16, paddingTop: 20, gap: 14 },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  grow: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  chart: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartBar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', gap: 6 },
  axisLabel: { flex: 1, textAlign: 'center', fontSize: 12 },
  paceText: { fontSize: 13, fontWeight: '700' },
  amount: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  of: { fontSize: 15, fontWeight: '400' },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 999 },
  small: { fontSize: 13 },
  action: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  primary: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryText: { fontSize: 17, fontWeight: '700' },
  center: { alignSelf: 'center', paddingVertical: 4 },
  link: { fontSize: 16, fontWeight: '600' },
  section: { fontSize: 13, letterSpacing: 0.2, paddingHorizontal: 16, marginTop: 10 },
  list: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowAmount: { fontSize: 16, fontWeight: '600' },
  shareRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  note: { fontSize: 13, paddingHorizontal: 16 },
});
