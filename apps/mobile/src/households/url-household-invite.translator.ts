import { HouseholdInviteSchema } from './households.model';
import type { HouseholdInvite } from './households.model';
import type { HouseholdInviteTranslator } from './households.ports';

const APP_PREFIX = 'amexbutikker://household/join?invite=';
/** The invite after `#` (web) or `?` (app link): `invite=<id>.<key>`. */
const INVITE_PARAM = /[#?&]invite=([^&#\s]+)/;

export interface UrlHouseholdInviteTranslatorConfig {
  /**
   * The web app's origin. Set: links open the web app, with the invite after `#` so the browser
   * never sends the key to the server. Null: links open the native app.
   */
  readonly webOrigin: string | null;
}

/**
 * `amexbutikker://household/join?invite=<id>.<key>` in the app,
 * `https://<site>/household/join#invite=<id>.<key>` on the web. The id is a UUID, the key base64url.
 */
export class UrlHouseholdInviteTranslator implements HouseholdInviteTranslator {
  public constructor(private readonly config: UrlHouseholdInviteTranslatorConfig) {}

  public toLink(invite: HouseholdInvite): string {
    const value = `${invite.householdId}.${invite.key}`;
    return this.config.webOrigin === null
      ? `${APP_PREFIX}${value}`
      : `${this.config.webOrigin}/household/join#invite=${value}`;
  }

  /** Takes either link, or the `invite` value alone (as expo-router hands it to a screen). */
  public fromLink(text: string): HouseholdInvite | null {
    const trimmed = text.trim();
    const value = INVITE_PARAM.exec(trimmed)?.[1] ?? trimmed;
    return this.fromValue(decodeURIComponent(value));
  }

  private fromValue(value: string): HouseholdInvite | null {
    const dot = value.indexOf('.');
    if (dot < 0) {
      return null;
    }
    const parsed = HouseholdInviteSchema.safeParse({
      householdId: value.slice(0, dot),
      key: value.slice(dot + 1),
    });
    return parsed.success ? parsed.data : null;
  }
}
