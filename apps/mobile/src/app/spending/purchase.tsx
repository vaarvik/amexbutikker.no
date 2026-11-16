import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import type { PurchaseSplit } from '../../spending/spending.model';
import { Choice, Field, FormError, Input, SubmitButton, formStyles } from '../../ui/form';
import { SPLIT_OPTIONS } from '../../ui/members';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/** "Legg til kjøp": one purchase on the card, paid by this phone. Stored on the phone only. */
export default function AddPurchase() {
  const { spending, spendingPresenter: format } = useServices();
  const palette = usePalette();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => format.dateInput(spending.today()));
  const [merchant, setMerchant] = useState('');
  const [split, setSplit] = useState<PurchaseSplit>('shared');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    spending
      .addPurchase({
        date: day,
        amountNok,
        split,
        ...(merchant.trim() === '' ? {} : { merchant: merchant.trim() }),
      })
      .then(() => {
        router.back();
      })
      .catch(() => {
        setError('Kunne ikke lagre. Prøv igjen.');
        setBusy(false);
      });
  };

  return (
    <ScrollView contentContainerStyle={formStyles.content} keyboardShouldPersistTaps="handled">
      <Field label="Beløp (kr)">
        <Input
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="1 299"
          autoFocus
        />
      </Field>
      <Field label="Dato">
        <Input value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      </Field>
      <Field label="Hvor (valgfritt)">
        <Input value={merchant} onChangeText={setMerchant} placeholder="Butikk eller nettside" />
      </Field>
      <Field label="Hvem er det for">
        <Choice value={split} options={SPLIT_OPTIONS} onChange={setSplit} />
      </Field>
      <FormError message={error} />
      <SubmitButton label="Lagre kjøp" busy={busy} onPress={save} />
      <Text style={{ color: palette.muted }}>Beløp lagres bare på telefonen din.</Text>
    </ScrollView>
  );
}
