import { CreatePlaceRequestDtoSchema, PLACE_CATEGORIES } from '@amexbutikker/contracts';
import type { GeoPoint, PlaceCategory } from '@amexbutikker/contracts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useServices } from '../ui/services';
import { usePalette } from '../ui/theme';

type Kind = 'physical' | 'online';
type LocationState = GeoPoint | 'locating' | 'unavailable';

const PHYSICAL_CATEGORIES = PLACE_CATEGORIES.filter((category) => category !== 'online_shop');

export default function AddPlace() {
  const { places, location, presenter } = useServices();
  const palette = usePalette();
  const [kind, setKind] = useState<Kind>('physical');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('shop');
  const [street, setStreet] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [position, setPosition] = useState<LocationState>('locating');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void location.findCurrent().then((point) => {
      setPosition(point ?? 'unavailable');
    });
  }, [location]);

  const optional = (value: string) => (value.trim() === '' ? null : value.trim());
  const site =
    website.trim() === '' || /^https?:\/\//.test(website.trim())
      ? website.trim()
      : `https://${website.trim()}`;

  const submit = () => {
    if (kind === 'physical' && typeof position !== 'object') {
      setError(
        'Vi trenger posisjonen din for å legge til et fysisk sted. Stå ved stedet og slå på posisjon.',
      );
      return;
    }
    const input = CreatePlaceRequestDtoSchema.safeParse(
      kind === 'online'
        ? { kind, name, website: site }
        : {
            kind,
            name,
            category,
            location: position,
            address: {
              street: optional(street),
              postcode: optional(postcode),
              city: optional(city),
            },
            ...(site === '' ? {} : { website: site }),
          },
    );
    if (!input.success) {
      setError(
        kind === 'online'
          ? 'Fyll inn navn og en gyldig nettadresse.'
          : 'Fyll inn navn. Postnummer har fire sifre, og nettadressen må være gyldig.',
      );
      return;
    }
    setSending(true);
    setError(null);
    places
      .create(input.data)
      .then(({ place }) => {
        router.replace({ pathname: '/place/[id]', params: { id: place.id } });
      })
      .catch((failure: unknown) => {
        setError(presenter.error(failure));
      })
      .finally(() => {
        setSending(false);
      });
  };

  const inputStyle = [
    styles.input,
    { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Choice
        options={[
          ['physical', 'Fysisk sted'],
          ['online', 'Nettbutikk'],
        ]}
        value={kind}
        onChange={setKind}
      />

      <Field label="Navn">
        <TextInput value={name} onChangeText={setName} style={inputStyle} autoFocus />
      </Field>

      {kind === 'physical' ? (
        <>
          <Field label="Type">
            <Choice
              options={PHYSICAL_CATEGORIES.map((value) => [value, presenter.category(value)])}
              value={category}
              onChange={setCategory}
            />
          </Field>
          <Field label="Gateadresse (valgfritt)">
            <TextInput value={street} onChangeText={setStreet} style={inputStyle} />
          </Field>
          <View style={styles.row}>
            <View style={styles.postcode}>
              <Field label="Postnr.">
                <TextInput
                  value={postcode}
                  onChangeText={setPostcode}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={inputStyle}
                />
              </Field>
            </View>
            <View style={styles.city}>
              <Field label="Sted">
                <TextInput value={city} onChangeText={setCity} style={inputStyle} />
              </Field>
            </View>
          </View>
          <Text style={[styles.hint, { color: palette.muted }]}>
            {position === 'locating'
              ? 'Finner posisjonen din …'
              : position === 'unavailable'
                ? 'Fant ikke posisjonen din. Stedet lagres der du står, så slå på posisjon.'
                : 'Stedet lagres der du står nå.'}
          </Text>
        </>
      ) : null}

      <Field label={kind === 'online' ? 'Nettadresse' : 'Nettadresse (valgfritt)'}>
        <TextInput
          value={website}
          onChangeText={setWebsite}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="eksempel.no"
          placeholderTextColor={palette.muted}
          style={inputStyle}
        />
      </Field>

      {error === null ? null : <Text style={[styles.error, { color: palette.text }]}>{error}</Text>}

      <Pressable
        disabled={sending}
        onPress={submit}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: palette.accent, opacity: pressed || sending ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.submitText, { color: palette.onAccent }]}>
          {sending ? 'Lagrer …' : 'Legg til'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Field(props: { readonly label: string; readonly children: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.text }]}>{props.label}</Text>
      {props.children}
    </View>
  );
}

function Choice<T extends string>(props: {
  readonly options: readonly (readonly [T, string])[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.choices} accessibilityRole="radiogroup">
      {props.options.map(([value, label]) => {
        const selected = value === props.value;
        return (
          <Pressable
            key={value}
            onPress={() => {
              props.onChange(value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              {
                borderColor: selected ? palette.accent : palette.border,
                backgroundColor: selected ? palette.accent : 'transparent',
              },
            ]}
          >
            <Text style={{ color: selected ? palette.onAccent : palette.text, fontWeight: '600' }}>
              {selected ? '✓ ' : ''}
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: '600' },
  input: {
    fontSize: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: 12 },
  postcode: { width: 110 },
  city: { flex: 1 },
  hint: { fontSize: 14 },
  error: { fontSize: 15, fontWeight: '600' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  submit: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', minHeight: 48 },
  submitText: { fontSize: 17, fontWeight: '700' },
});
