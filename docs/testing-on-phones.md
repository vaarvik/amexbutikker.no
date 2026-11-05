# Testing on phones and in the browser

How you and a few testers use the app without an App Store or Play listing. Three ways, from least to most setup:

| Way                  | Who             | Needs                   | Updates                      |
| -------------------- | --------------- | ----------------------- | ---------------------------- |
| Expo Go              | you, same Wi-Fi | the Expo Go app         | instant (dev server)         |
| Web build            | anyone          | a browser               | export again                 |
| Internal build (EAS) | testers         | APK / registered iPhone | over the air, or a new build |

## One-time setup (you)

1. `pnpm install`, `cp .env.example .env`, set `DEVICE_TOKEN_SECRET`.
2. `pnpm db:up && pnpm db:migrate`, then seed: `pnpm run import osm_overpass` (see CLAUDE.md).
3. In `.env`, keep `HOST=0.0.0.0` so phones on your Wi-Fi reach the API. macOS asks once whether `node` may accept incoming connections: allow it.
4. `brew install cloudflared` for testers outside your network.

## Expo Go (your own phone, same Wi-Fi)

Everything in the app runs in Expo Go; there are no custom native modules yet.

```bash
pnpm api                                                  # terminal 1
EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):3000 pnpm mobile   # terminal 2
```

Install Expo Go from the App Store or Play Store. Scan the QR code: with the Camera app on iPhone, inside Expo Go on Android. Code changes reload on the phone.

`localhost` on a phone is the phone itself, which is why the API URL uses the Mac's LAN address.

## Web

The same codebase runs in the browser. Things that only exist natively (sharing from a maps app, later visit detection) are hidden on the web, not faked.

```bash
pnpm api
pnpm mobile          # then press w; the page runs on http://localhost:8081, allowed by CORS_ORIGINS
```

A production-like static build:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm web:export   # writes apps/mobile/dist
pnpm web:serve                                                # serves it
```

The API only answers browsers from origins in `CORS_ORIGINS` (exact origins, comma-separated, no wildcard). Add the serve URL there if it is not 8081.

## Testers outside your network: tunnels

```bash
pnpm tunnel
```

It opens two Cloudflare quick tunnels, starts the API with CORS for the web tunnel, exports the web app against the API tunnel and prints both URLs. Send testers the web URL. Quick-tunnel URLs change on every run and stop when you press Ctrl-C, so this is for test sessions, not for builds that should keep working.

## Internal builds with EAS (Android APK, iPhone ad hoc)

Needed for Phase 7: share extensions do not run in Expo Go. Nothing here submits to a store.

The EAS project exists: `@vaarvik/amexbutikker`, id in `apps/mobile/app.json` (`extra.eas.projectId`; `EAS_PROJECT_ID` overrides it). Commands below need a logged-in EAS CLI (`brew install eas-cli`, then `eas login`; in a non-interactive shell `eas login --device` logs in with a code approved in the browser).

The API address for a build goes into the EAS environment:

```bash
cd apps/mobile
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://<stable-api-url> --visibility plaintext
```

A build bakes in `EXPO_PUBLIC_API_URL`, so it needs an API address that stays up: a quick-tunnel URL works only while that tunnel runs.

Bundle identifier and Android package default to `no.amexbutikker.app`. Override them with `APP_IOS_BUNDLE_ID` and `APP_ANDROID_PACKAGE` (in `.env` and the EAS environments) before the first build; changing them later makes a different app.

### Android

```bash
eas build --profile preview --platform android
```

The build page has a QR code and an `.apk` link. Testers open it on the phone and allow installing from the browser.

### iPhone

Ad hoc builds run only on registered devices.

```bash
eas device:create                # gives a link; each tester opens it on their iPhone to register it
eas build --profile preview --platform ios
```

After registering new devices, build again. Testers install from the build page link. On iOS 16 and later they must turn on Developer Mode (Settings → Privacy & Security) once.

### Sharing from Google Maps and Apple Maps

The app appears in the share sheet only in an EAS build (preview or development), never in Expo Go: the share extension is native code. Share a place from Google Maps or Apple Maps and pick amexbutikker. The app sends the shared text to the API, which matches it without calling Google. A clear match opens the place; otherwise the app lists up to three candidates and offers to add the place.

Short links (`maps.app.goo.gl/…`) are not followed, so a Google share that holds only a link finds nothing. Google Maps on Android and Apple Maps include the name and address, which is what the match uses.

To improve matching, save real share texts in `data/fixtures/shared/` (see the README there).

### Development builds

`eas build --profile development --platform android|ios` makes a build of your own Expo Go: it loads JavaScript from `pnpm mobile` and includes our native modules. Use it once Phase 7 adds native code.

## Over-the-air updates

Preview builds listen on the `preview` channel. A JS-only change reaches testers without a new build:

```bash
cd apps/mobile
eas update --channel preview --environment preview --message "Short description"
```

The app downloads the update in the background and uses it on the next start.

### Update or new build?

`runtimeVersion` uses the fingerprint policy: EAS hashes the native side of the app, and an update only reaches builds with the same hash. If you publish an update after a native change, it is ignored by the old builds instead of crashing them; the rule below tells you when to build instead.

| Change                                                                 | Ship as   |
| ---------------------------------------------------------------------- | --------- |
| Screens, copy, styles, logic in `src/`                                 | update    |
| `@amexbutikker/contracts` changes the app uses                         | update    |
| `EXPO_PUBLIC_*` values (they are inlined into the JS)                  | update    |
| Images and fonts loaded from JS                                        | update    |
| Adding or upgrading a package with native code (`expo install …`)      | new build |
| `app.json` / `app.config.ts`: name, icon, splash, plugins, permissions | new build |
| Bundle identifier, Android package, Expo SDK upgrade                   | new build |
| Share extension and other Phase 7 native features                      | new build |

When unsure, run `pnpm exec expo-updates fingerprint:generate --platform ios` (and `android`) in `apps/mobile` before and after the change; a different hash means a new build.
