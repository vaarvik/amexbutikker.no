import type { MerchantNameParser } from '@amexbutikker/contracts';

/** "SQ *", "SumUp *", "Zettle_*", "PAYPAL *": a short processor name followed by an asterisk. */
const PROCESSOR_PREFIX = /^[\p{L}\p{N}]{1,8}\s*_?\s*\*\s*/u;
/** Norwegian, Nordic and English company forms, as a last word. */
const COMPANY_SUFFIX = /\s+(?:AS|ASA|NUF|DA|ANS|A\/S|AB|ApS|Oy|Ltd|GmbH|Inc)\.?$/iu;
/** Terminal ids and references: "#12", or a number of five digits or more. */
const REFERENCE = /(?:^|\s)(?:#\s*\d+|\d{5,})(?=\s|$)/gu;
const EDGE_PUNCTUATION = /^[\s\p{P}]+|[\s\p{P}]+$/gu;
const HAS_WORD = /[\p{L}\p{N}]/u;

/** Cleans a card merchant name with a few fixed patterns. */
export class RegexMerchantNameParser implements MerchantNameParser {
  public parse(merchant: string): string | null {
    let name = merchant.trim().replace(PROCESSOR_PREFIX, '');
    name = name.replace(REFERENCE, ' ');
    name = name.replace(/\s+/gu, ' ').trim();
    name = name.replace(COMPANY_SUFFIX, '');
    name = name.replace(EDGE_PUNCTUATION, '');
    return HAS_WORD.test(name) && !/^(?:AS|ASA|NUF)$/iu.test(name) ? name : null;
  }
}
