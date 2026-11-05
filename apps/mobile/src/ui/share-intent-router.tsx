import { router } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect } from 'react';

/**
 * Sends text shared from Google Maps or Apple Maps to the /shared screen. Renders nothing.
 * Native only: the root layout leaves it out on the web.
 */
export function ShareIntentRouter() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) {
      return;
    }
    const text = [shareIntent.text, shareIntent.webUrl]
      .filter((part): part is string => typeof part === 'string' && part !== '')
      .join('\n');
    resetShareIntent();
    if (text !== '') {
      router.push({ pathname: '/shared', params: { text } });
    }
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}
