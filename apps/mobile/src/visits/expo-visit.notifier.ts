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
    const data = { placeId: prompt.placeId, kind: prompt.kind };
    await this.notifications.scheduleNotificationAsync({
      content:
        prompt.kind === 'ask'
          ? {
              title: `Betalte du med Amex hos ${prompt.name}?`,
              body: 'Trykk og hold for å svare. Svaret hjelper neste person.',
              data,
              categoryIdentifier: this.config.askCategory,
            }
          : {
              title: 'Her kan du betale med Amex',
              body: `${prompt.name} tar Amex, ifølge appen.`,
              data,
            },
      trigger: null,
    });
  }
}
