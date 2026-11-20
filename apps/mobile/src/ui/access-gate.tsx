import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AccessState } from '../access/access.model';
import { ApiError } from '../shared/fetch-json.transport';
import { useServices } from './services';
import { usePalette } from './theme';

/** A short Norwegian reason; cancelling the Face ID dialog is not an error worth explaining. */
function signInError(error: unknown, registering: boolean): string | null {
  if (error instanceof ApiError) {
    if (error.status === 400 && registering) {
      return 'Feil invitasjonskode.';
    }
    if (error.status === 401) {
      return 'Denne passkeyen har ikke tilgang.';
    }
    if (error.status === 429) {
      return 'For mange forsøk. Prøv igjen om en time.';
    }
    return error.status === null ? 'Ingen nett. Prøv igjen.' : 'Noe gikk galt. Prøv igjen.';
  }
  if (error instanceof Error && error.name === 'NotAllowedError') {
    return null;
  }
  return 'Fikk ikke brukt passkey. Prøv igjen.';
}

/**
 * Shows the app only to someone signed in with a passkey, when the API asks for it. Each start
 * renews the session, so a phone in use stays signed in for good.
 */
export function AccessGate(props: { readonly children: ReactNode }) {
  const { access } = useServices();
  const palette = usePalette();
  const [state, setState] = useState<AccessState | null>(null);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void access.check().then((checked) => {
      if (current) {
        setState(checked);
      }
    });
    return () => {
      current = false;
    };
  }, [access]);

  if (state === 'open' || state === 'signed_in') {
    return props.children;
  }

  const run = (registering: boolean) => {
    setBusy(true);
    setMessage(null);
    (registering ? access.register(invite) : access.signIn())
      .then(() => {
        setState('signed_in');
      })
      .catch((error: unknown) => {
        setMessage(signInError(error, registering));
        setBusy(false);
      });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      {state === null ? (
        <ActivityIndicator color={palette.accent} />
      ) : (
        <View style={styles.content}>
          <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">
            Tar de Amex?
          </Text>
          <Pressable
            onPress={() => {
              run(false);
            }}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: palette.accent, opacity: pressed || busy ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: palette.onAccent }]}>Logg inn</Text>
          </Pressable>
          <Text style={[styles.body, { color: palette.muted }]}>
            Ny telefon? Skriv invitasjonskoden.
          </Text>
          <TextInput
            value={invite}
            onChangeText={setInvite}
            placeholder="Invitasjonskode"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Invitasjonskode"
            style={[
              styles.input,
              {
                color: palette.text,
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          />
          <Pressable
            onPress={() => {
              run(true);
            }}
            disabled={busy || invite.trim() === ''}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              styles.outlined,
              {
                borderColor: palette.accent,
                opacity: pressed || busy || invite.trim() === '' ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: palette.accent }]}>Lag passkey</Text>
          </Pressable>
          {message === null ? null : (
            <Text style={[styles.body, { color: palette.text }]}>{message}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills the window: outside the Stack nothing gives it a height, and the page shows through.
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: { gap: 14, maxWidth: 420, width: '100%' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  outlined: { borderWidth: 2 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
  },
});
