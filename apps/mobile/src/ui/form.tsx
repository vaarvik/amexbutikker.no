import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { usePalette } from './theme';

/** A labelled form field. */
export function Field(props: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.text }]}>{props.label}</Text>
      {props.children}
      {props.hint === undefined ? null : (
        <Text style={[styles.hint, { color: palette.muted }]}>{props.hint}</Text>
      )}
    </View>
  );
}

/** A text input in the app's form style. */
export function Input(props: TextInputProps) {
  const palette = usePalette();
  return (
    <TextInput
      placeholderTextColor={palette.muted}
      {...props}
      style={[
        styles.input,
        { color: palette.text, backgroundColor: palette.card, borderColor: palette.border },
        props.style,
      ]}
    />
  );
}

/** One choice of several, as chips. */
export function Choice<T extends string>(props: {
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.choices} accessibilityRole="radiogroup">
      {props.options.map((option) => {
        const selected = option.value === props.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              props.onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: palette.accent, borderColor: palette.accent }
                : { borderColor: palette.border, backgroundColor: palette.card },
            ]}
          >
            <Text style={[styles.chipText, { color: selected ? palette.onAccent : palette.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The main button at the bottom of a form. */
export function SubmitButton(props: {
  readonly label: string;
  readonly busy?: boolean;
  readonly onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.busy === true}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.submit,
        { backgroundColor: palette.accent, opacity: pressed || props.busy === true ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.submitText, { color: palette.onAccent }]}>{props.label}</Text>
    </Pressable>
  );
}

/** A form error, read out by screen readers when it appears. */
export function FormError(props: { readonly message: string | null }) {
  const palette = usePalette();
  return props.message === null ? null : (
    <Text accessibilityLiveRegion="polite" style={[styles.error, { color: palette.text }]}>
      {props.message}
    </Text>
  );
}

export const formStyles = StyleSheet.create({
  content: { padding: 16, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
});

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 14 },
  input: {
    fontSize: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 15, fontWeight: '600' },
  submit: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', minHeight: 48 },
  submitText: { fontSize: 17, fontWeight: '700' },
  error: { fontSize: 15, fontWeight: '600' },
});
