import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Choice, Field, FormError, Input, SubmitButton, formStyles } from '../../ui/form';
import { useServices } from '../../ui/services';

type PeriodKind = 'calendar_year' | 'window';

/** "Nytt mål": a custom milestone, e.g. 90 000 kr within 9 months for a welcome bonus. */
export default function AddMilestone() {
  const { spending, spendingPresenter: format } = useServices();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [reward, setReward] = useState('');
  const [kind, setKind] = useState<PeriodKind>('calendar_year');
  const [start, setStart] = useState(() => format.dateInput(spending.today()));
  const [months, setMonths] = useState('12');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    const targetNok = format.parseAmount(target);
    const startDate = format.parseDate(start);
    const monthCount = Number(months);
    if (title.trim() === '') {
      setError('Gi målet et navn.');
      return;
    }
    if (targetNok === null) {
      setError('Skriv beløpet du må bruke, for eksempel 150 000.');
      return;
    }
    if (kind === 'window' && startDate === null) {
      setError('Skriv startdatoen som dd.mm.åååå.');
      return;
    }
    if (
      kind === 'window' &&
      !(Number.isInteger(monthCount) && monthCount >= 1 && monthCount <= 60)
    ) {
      setError('Skriv antall måneder, fra 1 til 60.');
      return;
    }
    setBusy(true);
    spending
      .addMilestone({
        title: title.trim(),
        targetNok,
        reward: reward.trim(),
        period:
          kind === 'window' && startDate !== null
            ? { kind: 'window', start: startDate, months: monthCount }
            : { kind: 'calendar_year' },
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
      <Field label="Navn">
        <Input value={title} onChangeText={setTitle} placeholder="Velkomstbonus" autoFocus />
      </Field>
      <Field label="Bruk minst (kr)">
        <Input
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="90 000"
        />
      </Field>
      <Field label="Periode">
        <Choice
          value={kind}
          onChange={setKind}
          options={[
            { value: 'calendar_year', label: 'Hvert kalenderår' },
            { value: 'window', label: 'Fra en dato' },
          ]}
        />
      </Field>
      {kind === 'window' ? (
        <>
          <Field label="Fra" hint="For eksempel dagen kortet ble åpnet.">
            <Input value={start} onChangeText={setStart} keyboardType="numbers-and-punctuation" />
          </Field>
          <Field label="Antall måneder">
            <Input value={months} onChangeText={setMonths} keyboardType="number-pad" />
          </Field>
        </>
      ) : null}
      <Field label="Belønning (valgfritt)">
        <Input value={reward} onChangeText={setReward} placeholder="90 000 EuroBonus-poeng" />
      </Field>
      <FormError message={error} />
      <SubmitButton label="Lagre mål" busy={busy} onPress={save} />
    </ScrollView>
  );
}
