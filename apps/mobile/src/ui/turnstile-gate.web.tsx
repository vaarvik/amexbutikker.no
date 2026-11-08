import { useEffect, useRef } from 'react';
import { useServices } from './services';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      readonly sitekey: string;
      readonly appearance: 'always' | 'execute' | 'interaction-only';
      readonly callback: (token: string) => void;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadTurnstile(): Promise<TurnstileApi> {
  const loaded = window.turnstile;
  if (loaded !== undefined) {
    return Promise.resolve(loaded);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile === undefined) {
        reject(new Error('Turnstile did not load.'));
      } else {
        resolve(window.turnstile);
      }
    };
    script.onerror = () => {
      reject(new Error('Turnstile did not load.'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Web: proves the browser is a person with Cloudflare Turnstile, once per device token, so its
 * answers count in full. Invisible unless Cloudflare wants an interaction. Off without
 * EXPO_PUBLIC_TURNSTILE_SITE_KEY.
 */
export function TurnstileGate() {
  const { attestation, turnstileSiteKey } = useServices();
  const container = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = container.current;
    if (turnstileSiteKey === null || element === null) {
      return;
    }
    const run = { cancelled: false };
    let widget: { api: TurnstileApi; id: string } | null = null;
    void (async () => {
      if (await attestation.isAttested()) {
        return;
      }
      const api = await loadTurnstile();
      if (run.cancelled) {
        return;
      }
      const id = api.render(element, {
        sitekey: turnstileSiteKey,
        appearance: 'interaction-only',
        callback: (token) => {
          void attestation.attestWithTurnstile(token);
        },
      });
      widget = { api, id };
    })().catch(() => {
      // Without Turnstile the site still works; answers count less.
    });
    return () => {
      run.cancelled = true;
      if (widget !== null) {
        widget.api.remove(widget.id);
      }
    };
  }, [attestation, turnstileSiteKey]);

  return <div ref={container} style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 10 }} />;
}
