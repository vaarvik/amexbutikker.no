import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AppServices } from '../composition-root';

const ServicesContext = createContext<AppServices | null>(null);

/** Makes the composition root's services available to every screen. */
export function ServicesProvider(props: {
  readonly services: AppServices;
  readonly children: ReactNode;
}) {
  return <ServicesContext value={props.services}>{props.children}</ServicesContext>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (services === null) {
    throw new Error('useServices() must be used inside <ServicesProvider>.');
  }
  return services;
}
