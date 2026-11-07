import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Field, FormError, Input, SubmitButton, formStyles } from '../../ui/form';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/** "Legg til kjøp": one purchase on the card. Stored on the phone only. */
export default function AddPurchase() {
  const { spending, spendingPresenter: format } = useServices();
  const palette = usePalette();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => format.dateInput(spending.today()));
  const [merchant, setMerchant] = useState('');
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
      <FormError message={error} />
      <SubmitButton label="Lagre kjøp" busy={busy} onPress={save} />
      <Text style={{ color: palette.muted }}>Beløp lagres bare på telefonen din.</Text>
    </ScrollView>
  );
}
