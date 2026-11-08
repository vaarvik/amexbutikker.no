import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useServices } from './services';

/** Syncs the household when the app starts and each time it comes to the foreground. */
export function HouseholdSync() {
  const { households } = useServices();
  useEffect(() => {
    void households.sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void households.sync();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [households]);
  return null;
}
