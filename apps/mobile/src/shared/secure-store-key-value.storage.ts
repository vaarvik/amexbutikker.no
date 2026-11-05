import type { KeyValueStorage, SecureStoreModule } from './shared.ports';

/** KeyValueStorage over expo-secure-store (Keychain on iOS, Keystore on Android). */
export class SecureStoreKeyValueStorage implements KeyValueStorage {
  public constructor(private readonly secureStore: SecureStoreModule) {}

  public getItem(key: string): Promise<string | null> {
    return this.secureStore.getItemAsync(key);
  }

  public setItem(key: string, value: string): Promise<void> {
    return this.secureStore.setItemAsync(key, value);
  }

  public removeItem(key: string): Promise<void> {
    return this.secureStore.deleteItemAsync(key);
  }
}
