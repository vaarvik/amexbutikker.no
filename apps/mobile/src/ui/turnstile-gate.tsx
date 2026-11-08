import { useEffect } from 'react';
import { useServices } from './services';

/**
 * Native: attests the install with App Attest once (iOS; nothing elsewhere). Renders nothing.
 * Metro picks `turnstile-gate.web.tsx` for the web, which runs Turnstile instead.
 */
export function TurnstileGate() {
  const { attestation } = useServices();

  useEffect(() => {
    void attestation.attestWithAppAttest();
  }, [attestation]);

  return null;
}
