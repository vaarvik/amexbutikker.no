import { HouseholdInviteSchema } from './households.model';
import type { HouseholdInvite } from './households.model';
import type { HouseholdInviteTranslator } from './households.ports';

const PREFIX = 'amexbutikker://household/join?invite=';

/** `amexbutikker://household/join?invite=<id>.<key>`; the id is a UUID and the key base64url. */
export class UrlHouseholdInviteTranslator implements HouseholdInviteTranslator {
  public toLink(invite: HouseholdInvite): string {
    return `${PREFIX}${invite.householdId}.${invite.key}`;
  }

  /** Takes the whole link, or the `invite` value alone (as expo-router hands it to a screen). */
  public fromLink(text: string): HouseholdInvite | null {
    const trimmed = text.trim();
    const value = trimmed.startsWith(PREFIX) ? trimmed.slice(PREFIX.length) : trimmed;
    return this.fromValue(value);
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
