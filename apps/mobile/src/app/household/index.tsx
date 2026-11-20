import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { HouseholdStatus } from '../../households/households.model';
import { QrCode } from '../../ui/qr-code';
import { useServices } from '../../ui/services';
import { MEMBER_NAME_MAX_LENGTH } from '../../spending/spending.model';
import { STATUS_COLORS, usePalette } from '../../ui/theme';

/** "Ditt navn": how the other phones show who paid. Saved when the field is left. */
function NameField() {
  const { spending, households } = useServices();
  const palette = usePalette();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    void spending.overview().then((overview) => {
      const mine = overview.members.find((member) => member.id === overview.me)?.name ?? '';
      setName(mine);
      setSaved(mine);
    });
  }, [spending]);

  const save = () => {
    if (name.trim() === '' || name.trim() === saved) {
      return;
    }
    void spending
      .nameMe(name)
      .then(() => {
        setSaved(name.trim());
        return households.sync();
      })
      .catch(() => undefined);
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.muted }]}>Ditt navn</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        onBlur={save}
        onSubmitEditing={save}
        placeholder="F.eks. Johann"
        placeholderTextColor={palette.muted}
        maxLength={MEMBER_NAME_MAX_LENGTH}
        autoCapitalize="words"
        returnKeyType="done"
        accessibilityLabel="Ditt navn"
        style={[
          styles.input,
          { color: palette.text, backgroundColor: palette.card, borderColor: palette.border },
        ]}
      />
      <Text style={[styles.hint, { color: palette.muted }]}>
        {saved === '' ? 'Vises på kjøpene du betaler.' : 'Lagret. Vises på kjøpene du betaler.'}
      </Text>
    </View>
  );
}

/**
 * Web only: a link opened from a message lands in the browser, not in the Home Screen app, so
 * the invite can be pasted here instead.
 */
function InviteField() {
  const palette = usePalette();
  const [link, setLink] = useState('');
  const join = () => {
    if (link.trim() !== '') {
      router.push({ pathname: '/household/join', params: { invite: link.trim() } });
    }
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.muted }]}>Fått en lenke? Lim den inn</Text>
      <TextInput
        value={link}
        onChangeText={setLink}
        onSubmitEditing={join}
        placeholder="https://…/household/join#invite=…"
        placeholderTextColor={palette.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        accessibilityLabel="Invitasjonslenke"
        style={[
          styles.input,
          { color: palette.text, backgroundColor: palette.card, borderColor: palette.border },
        ]}
      />
      <Pressable
        onPress={join}
        disabled={link.trim() === ''}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          styles.outlined,
          {
            borderColor: palette.accent,
            opacity: pressed || link.trim() === '' ? 0.5 : 1,
          },
        ]}
      >
        <Text style={[styles.buttonText, { color: palette.accent }]}>Bli med</Text>
      </Pressable>
    </View>
  );
}

/** Settings → Del med husstand: start a household, show its invite, or leave it. */
export default function HouseholdScreen() {
  const { households, presenter, native } = useServices();
  const palette = usePalette();
  const [status, setStatus] = useState<HouseholdStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void households.status().then(setStatus);
    void households.sync().then(() => households.status().then(setStatus));
  }, [households]);

  const run = (action: () => Promise<HouseholdStatus>) => {
    setBusy(true);
    setMessage(null);
    action()
      .then(setStatus)
      .catch((error: unknown) => {
        setMessage(presenter.error(error));
      })
      .finally(() => {
        setBusy(false);
        setArmed(false);
      });
  };

  const text = { color: palette.text };
  const muted = { color: palette.muted };

  if (status === null) {
    return <ActivityIndicator style={styles.loading} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      {status.kind === 'alone' ? (
        <>
          <Text style={[styles.title, text]} accessibilityRole="header">
            Del Bonus med husstanden
          </Text>
          <Text style={[styles.body, muted]}>
            Dere ser samme Bonus når dere deler kort. Beløpene krypteres på telefonen.
          </Text>
          <Pressable
            onPress={() => {
              run(() => households.create());
            }}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: palette.accent, opacity: pressed || busy ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: palette.onAccent }]}>Lag husstand</Text>
          </Pressable>
          {native ? (
            <Text style={[styles.small, muted]}>
              Blir du invitert? Skann QR-koden med kameraet.
            </Text>
          ) : (
            <InviteField />
          )}
        </>
      ) : (
        <>
          <Text style={[styles.title, text]} accessibilityRole="header">
            {status.memberCount === 1
              ? 'Bare deg så langt'
              : `${String(status.memberCount)} telefoner deler Bonus`}
          </Text>
          <NameField />
          <Text style={[styles.body, muted]}>
            {native
              ? 'Den andre skanner koden med kameraet på sin telefon.'
              : 'Send lenken til den andre. Den limes inn under Husstand i appen.'}
          </Text>
          <View style={styles.qr}>
            <QrCode value={status.inviteLink} size={240} />
          </View>
          <Pressable
            onPress={() => {
              void Share.share({ message: status.inviteLink });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              styles.outlined,
              { borderColor: palette.accent, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: palette.accent }]}>Del lenke</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              run(() => households.leave());
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={armed ? 'Trykk igjen for å forlate husstanden' : 'Forlat husstand'}
            style={({ pressed }) => [styles.later, { opacity: pressed || busy ? 0.6 : 1 }]}
          >
            <Text style={[styles.body, { color: armed ? STATUS_COLORS.rejected : palette.muted }]}>
              {armed ? 'Forlate? Trykk igjen' : 'Forlat husstand'}
            </Text>
          </Pressable>
        </>
      )}
      {message === null ? null : <Text style={[styles.small, text]}>{message}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  content: { padding: 20, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  qr: { alignItems: 'center', paddingVertical: 8 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  outlined: { borderWidth: 1.5 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  later: { alignItems: 'center', paddingVertical: 8 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
  },
  hint: { fontSize: 13 },
});
