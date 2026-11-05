import type { VisitAnswer, VisitPrompt } from './visits.model';
import type { ExpoNotificationsModule, VisitNotifier } from './visits.ports';

export interface ExpoVisitNotifierConfig {
  /** The notification category that carries the answer buttons. */
  readonly askCategory: string;
}

const ANSWERS: readonly { readonly answer: VisitAnswer; readonly title: string }[] = [
  { answer: 'accepted', title: 'Det funket' },
  { answer: 'rejected', title: 'Ble avvist' },
  { answer: 'skipped', title: 'Prøvde ikke' },
];

/** Local notifications through expo-notifications. Nothing is sent to a push server. */
export class ExpoVisitNotifier implements VisitNotifier {
  public constructor(
    private readonly notifications: ExpoNotificationsModule,
    private readonly config: ExpoVisitNotifierConfig,
  ) {}

  public async requestPermission(): Promise<boolean> {
    try {
      const { granted } = await this.notifications.requestPermissionsAsync();
      if (granted) {
        await this.notifications.setNotificationCategoryAsync(
          this.config.askCategory,
          ANSWERS.map(({ answer, title }) => ({
            identifier: answer,
            buttonTitle: title,
            // An answer is sent from the app, so it has to open; "Prøvde ikke" needs nothing.
            options: { opensAppToForeground: answer !== 'skipped' },
          })),
        );
      }
      return granted;
    } catch {
      return false;
    }
  }

  public async show(prompt: VisitPrompt): Promise<void> {
    await this.notifications.scheduleNotificationAsync({
      content: this.content(prompt),
      trigger: null,
    });
  }

  private content(prompt: VisitPrompt): {
    title: string;
    body: string;
    data: Record<string, string>;
    categoryIdentifier?: string;
  } {
    switch (prompt.kind) {
      case 'ask':
        return {
          title: `Betalte du med Amex hos ${prompt.candidate.name}?`,
          body: 'Svaret ditt hjelper neste person.',
          data: { kind: 'ask', placeId: prompt.candidate.placeId },
          categoryIdentifier: this.config.askCategory,
        };
      case 'pick':
        return {
          title: 'Betalte du med Amex nå nettopp?',
          body: `Var du hos ${this.names(prompt.candidates.map((c) => c.name))}? Trykk for å svare.`,
          // The candidates travel with the notification, so answering needs no stored state.
          data: { kind: 'pick', candidates: JSON.stringify(prompt.candidates) },
        };
      case 'announce':
        return {
          title: 'Her kan du betale med Amex',
          body: `${prompt.candidate.name} tar Amex, ifølge appen.`,
          data: { kind: 'announce', placeId: prompt.candidate.placeId },
        };
    }
  }

  /** "A eller B", "A, B eller C", "A, B, C eller et annet sted i nærheten". */
  private names(names: readonly string[]): string {
    if (names.length > 3) {
      return `${names.slice(0, 3).join(', ')} eller et annet sted i nærheten`;
    }
    const shown = [...names];
    const last = shown.pop() ?? '';
    return shown.length === 0 ? last : `${shown.join(', ')} eller ${last}`;
  }
}
