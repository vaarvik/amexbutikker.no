import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { Purchase, PurchaseSplit } from '../../spending/spending.model';
import type { SpendingOverview } from '../../spending/spending.ports';
import { Choice, Field, FormError, formStyles } from '../../ui/form';
import { SPLIT_OPTIONS, memberLabel } from '../../ui/members';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/** Tap a purchase in Bonus: who paid it and whether it is shared. Saved on every tap. */
export default function PurchaseSplitScreen() {
  const { spending, households, spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [overview, setOverview] = useState<SpendingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void spending.overview().then(setOverview);
  }, [spending]);

  if (overview === null) {
    return null;
  }
  const purchase: Purchase | undefined = overview.purchases.find((each) => each.id === id);
  if (purchase === undefined) {
    return (
      <View style={formStyles.content}>
        <Text style={{ color: palette.muted }}>Fant ikke kjøpet.</Text>
      </View>
    );
  }

  // Everyone who can have paid: this phone, the named members, and the payer as it is now.
  const ids = [
    overview.me,
    ...overview.members.map((member) => member.id),
    ...(purchase.paidBy === null ? [] : [purchase.paidBy]),
  ].filter((each, index, all) => all.indexOf(each) === index);
  const payers = ids.map((each) => ({
    value: each,
    label: memberLabel(each, overview.members, overview.me),
  }));

  const update = (paidBy: string, split: PurchaseSplit) => {
    setError(null);
    spending
      .updatePurchase(purchase.id, { paidBy, split })
      .then((next) => {
        setOverview(next);
        void households.sync().catch(() => undefined);
      })
      .catch(() => {
        setError('Kunne ikke lagre. Prøv igjen.');
      });
  };

  return (
    <ScrollView contentContainerStyle={formStyles.content}>
      <View>
        <Text style={{ color: palette.text, fontSize: 24, fontWeight: '700' }}>
          {format.amount(purchase.amountNok)}
        </Text>
        <Text style={{ color: palette.muted, fontSize: 15 }}>
          {[purchase.merchant, format.date(purchase.date)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Field label="Betalt av">
        <Choice
          value={purchase.paidBy ?? ''}
          options={payers}
          onChange={(paidBy) => {
            update(paidBy, purchase.split);
          }}
        />
      </Field>
      <Field label="Hvem er det for">
        <Choice
          value={purchase.split}
          options={SPLIT_OPTIONS}
          onChange={(split) => {
            update(purchase.paidBy ?? overview.me, split);
          }}
        />
      </Field>
      <FormError message={error} />
      <Text
        onPress={() => {
          router.back();
        }}
        accessibilityRole="button"
        style={{ color: palette.accent, fontSize: 17, fontWeight: '600', alignSelf: 'center' }}
      >
        Ferdig
      </Text>
    </ScrollView>
  );
}
