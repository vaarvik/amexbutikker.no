import { CreatePlaceRequestDtoSchema, PLACE_CATEGORIES } from '@amexbutikker/contracts';
import type { GeoPoint, PlaceCategory, PlaceId } from '@amexbutikker/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../shared/fetch-json.transport';
import { useServices } from '../ui/services';
import { usePalette } from '../ui/theme';

type Kind = 'physical' | 'online';
type LocationState = GeoPoint | 'locating' | 'unavailable';

const PHYSICAL_CATEGORIES = PLACE_CATEGORIES.filter((category) => category !== 'online_shop');

export default function AddPlace() {
  const { places, location, presenter } = useServices();
  const palette = usePalette();
  const [kind, setKind] = useState<Kind>('physical');
  // A share that matched nothing arrives with the shared name filled in.
  const params = useLocalSearchParams<{ name?: string }>();
  const [name, setName] = useState(params.name ?? '');
  const [category, setCategory] = useState<PlaceCategory>('shop');
  const [street, setStreet] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [position, setPosition] = useState<LocationState>('locating');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Set when the API says we already have this place; the user opens it or adds theirs anyway.
  const [duplicate, setDuplicate] = useState<{ id: PlaceId; name: string } | null>(null);

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

  const submit = (allowDuplicate = false) => {
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
    setDuplicate(null);
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
      .create(allowDuplicate ? { ...input.data, allowDuplicate: true } : input.data)
      .then(({ place }) => {
        router.replace({ pathname: '/place/[id]', params: { id: place.id } });
      })
      .catch(async (failure: unknown) => {
        if (failure instanceof ApiError && failure.existingPlaceId !== null) {
          const id = failure.existingPlaceId as PlaceId;
          const existing = await places.getDetails(id).catch(() => null);
          setDuplicate({ id, name: existing?.place.name ?? 'Stedet' });
          return;
        }
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
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            setDuplicate(null);
          }}
          style={inputStyle}
          autoFocus
        />
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

      {duplicate === null ? null : (
        <View
          style={[styles.duplicate, { backgroundColor: palette.card }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.duplicateText, { color: palette.text }]}>
            Vi har allerede «{duplicate.name}» like ved. Er det samme sted?
          </Text>
          <Pressable
            onPress={() => {
              router.replace({ pathname: '/place/[id]', params: { id: duplicate.id } });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: palette.accent, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.submitText, { color: palette.onAccent }]}>
              Ja, åpne «{duplicate.name}»
            </Text>
          </Pressable>
          <Pressable
            disabled={sending}
            onPress={() => {
              submit(true);
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.anyway}
          >
            <Text style={[styles.anywayText, { color: palette.accent }]}>
              Nei, det er et annet sted. Legg til likevel
            </Text>
          </Pressable>
        </View>
      )}

      {duplicate === null ? (
        <Pressable
          disabled={sending}
          onPress={() => {
            submit();
          }}
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
      ) : null}
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
  duplicate: { borderRadius: 14, padding: 14, gap: 12 },
  duplicateText: { fontSize: 16 },
  anyway: { alignItems: 'center', paddingVertical: 6 },
  anywayText: { fontSize: 16, fontWeight: '600' },
  submit: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', minHeight: 48 },
  submitText: { fontSize: 17, fontWeight: '700' },
});
