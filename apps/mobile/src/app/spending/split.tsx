import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { Purchase, PurchaseSplit } from '../../spending/spending.model';
import type { PurchaseUpdate, SpendingOverview } from '../../spending/spending.ports';
import { Choice, Field, FormError, Input, SubmitButton, formStyles } from '../../ui/form';
import { SPLIT_OPTIONS, memberLabel } from '../../ui/members';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/**
 * Tap a purchase in Bonus: who paid it and whether it is shared (saved on every tap), and its
 * amount, date and place (saved with Lagre).
 */
export default function PurchaseSplitScreen() {
  const { spending, households, spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [overview, setOverview] = useState<SpendingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [merchant, setMerchant] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void spending.overview().then((next) => {
      setOverview(next);
      const found = next.purchases.find((each) => each.id === id);
      if (found !== undefined) {
        setAmount(String(found.amountNok));
        setDate(format.dateInput(found.date));
        setMerchant(found.merchant ?? '');
      }
    });
  }, [spending, id, format]);

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

  // Who can have paid: this phone, everyone named in the household (also before their first
  // purchase), and the payer as it is now.
  const ids = [
    overview.me,
    ...overview.members.map((member) => member.id),
    ...(purchase.paidBy === null ? [] : [purchase.paidBy]),
  ].filter((each, index, all) => all.indexOf(each) === index);
  const payers = ids.map((each) => ({
    value: each,
    label: memberLabel(each, overview.members, overview.me),
  }));

  const update = (change: PurchaseUpdate, done?: () => void) => {
    setError(null);
    spending
      .updatePurchase(purchase.id, change)
      .then((next) => {
        setOverview(next);
        void households.sync().catch(() => undefined);
        done?.();
      })
      .catch(() => {
        setError('Kunne ikke lagre. Prøv igjen.');
        setBusy(false);
      });
  };

  const who = { paidBy: purchase.paidBy ?? overview.me, split: purchase.split };

  const save = () => {
    const amountNok = format.parseAmount(amount);
    const day = format.parseDate(date);
    if (amountNok === null) {
      setError('Skriv beløpet i kroner, for eksempel 1 299.');
      return;
    }
    if (day === null) {
      setError('Skriv datoen som dd.mm.åååå.');
      return;
    }
    setBusy(true);
    update(
      { ...who, amountNok, date: day, merchant: merchant.trim() === '' ? null : merchant },
      () => {
        router.back();
      },
    );
  };

  return (
    <ScrollView contentContainerStyle={formStyles.content} keyboardShouldPersistTaps="handled">
      <Field label="Betalt av">
        <Choice
          value={purchase.paidBy ?? ''}
          options={payers}
          onChange={(paidBy) => {
            update({ paidBy, split: purchase.split });
          }}
        />
      </Field>
      <Field label="Hvem er det for">
        <Choice
          value={purchase.split}
          options={SPLIT_OPTIONS}
          onChange={(split: PurchaseSplit) => {
            update({ paidBy: who.paidBy, split });
          }}
        />
      </Field>
      <Field label="Beløp (kr)">
        <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      </Field>
      <Field label="Dato">
        <Input value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      </Field>
      <Field label="Hvor (valgfritt)">
        <Input value={merchant} onChangeText={setMerchant} placeholder="Butikk eller nettside" />
      </Field>
      <FormError message={error} />
      <SubmitButton label="Lagre" busy={busy} onPress={save} />
    </ScrollView>
  );
}
