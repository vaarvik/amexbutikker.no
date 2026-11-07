import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Field, FormError, Input, SubmitButton, formStyles } from '../../ui/form';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/**
 * "Oppdater total": what the card issuer's app says has been spent in this milestone's period.
 * It replaces the purchases up to today; purchases added later count on top.
 */
export default function UpdateTotal() {
  const { spending, spendingPresenter: format } = useServices();
  const palette = usePalette();
  const { milestone, title } = useLocalSearchParams<{ milestone: string; title?: string }>();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    const amountNok = format.parseAmount(amount);
    if (amountNok === null) {
      setError('Skriv beløpet i kroner, for eksempel 52 300.');
      return;
    }
    setBusy(true);
    spending
      .updateTotal(milestone, amountNok)
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
      <Field
        label={title === undefined ? 'Brukt hittil (kr)' : `Brukt hittil mot «${title}» (kr)`}
        hint="Se i kortappen hvor mye du har brukt i perioden. Kjøp du legger til etter i dag, kommer i tillegg."
      >
        <Input
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="52 300"
          autoFocus
        />
      </Field>
      <FormError message={error} />
      <SubmitButton label="Lagre total" busy={busy} onPress={save} />
      <Text style={{ color: palette.muted }}>Beløp lagres bare på telefonen din.</Text>
    </ScrollView>
  );
}
