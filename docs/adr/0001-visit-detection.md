# ADR 0001: Visit detection

Status: accepted (first iteration), 2026-11-05

## Context

Most places have no answer yet ("Ikke sjekket"). The best moment to ask "did Amex work here?" is
right after someone paid, and the best moment to tell someone "Amex works here" is when they walk
in. Both need the app to notice visits while it is in the background.

Constraints:

- iOS monitors at most 20 regions per app; Android at most 100 geofences.
- Background location needs "Always" permission on iOS and `ACCESS_BACKGROUND_LOCATION` on
  Android. Both platforms show the user reminders that the app uses location in the background.
- Battery: continuous GPS is not acceptable. Region monitoring and iOS visit monitoring are
  low-power (cell and Wi-Fi based, woken by the OS).
- Privacy: positions and visits never leave the phone. Only an answer the user gives (place id,
  result, date) is sent, through the existing report endpoint.

## Options

1. **Geofences around nearby places** (expo-location `startGeofencingAsync` + expo-task-manager).
   Works on both platforms with Expo modules, no custom native code. Enter and exit events only;
   dwell is computed in the app from the enter and exit times. Accuracy is roughly 100–200 m in
   cities, so neighbouring shops share a fence.
2. **iOS `CLVisit` + Android Geofencing `DWELL`**. The OS decides that a visit happened (arrival
   and departure with times). Better signal, fewer false positives, but needs a custom Expo native
   module on iOS and only reports the location, not the shop.
3. **Continuous background location** and our own visit detection. Precise, but drains the
   battery and is the hardest to justify to users and app review.

## Decision

Start with option 1; keep the detection behind a port so option 2 can replace it later.

- **Regions:** the app registers fences around the nearest places it should ask about or announce,
  at most 18 on iOS (two slots stay free for a "moved far away" fence that triggers re-selection),
  radius 60 m. The set is refreshed from the nearby list whenever the app is opened and when the
  user leaves the outer fence.
- **Which places:** ask about places whose status is `unknown`, `mixed`, or older than the stale
  threshold. Announce places whose status is `accepted` (opt-in).
- **Ask on leaving, not on arrival.** On exit, if the user was inside for at least 3 minutes
  (`MIN_DWELL_MS`, per category later), show a local notification: "Betalte du med Amex hos X?"
  with the actions "Det funket" / "Ble avvist" / "Prøvde ikke". Asking on arrival would come before
  the payment.
- **Announce on arrival:** for accepted places, "Her kan du betale med Amex" on enter, at most once
  per place per day.
- **Rate limits on the phone:** at most one question per place per 30 days, at most three
  questions a day.
- **Local notifications only.** No push server.
- **Opt-in:** the feature is off until the user turns it on; the "Always" permission is requested
  only then, with an explanation first.

## Consequences

- New native modules (expo-task-manager, expo-notifications) need a new development build.
- Fences are coarse: in a shopping centre the app may ask about the wrong shop. The notification
  names the place and "Prøvde ikke" is always an answer, so a wrong guess costs one tap.
- Testing: the iOS Simulator fires region events when its location is moved with
  `xcrun simctl location`, so a walk in and out can be scripted (`infra/simulate-visit.sh`).

## Open questions

- Dwell thresholds per category (a kiosk visit is 1 minute, a restaurant 45).
- Whether to move to `CLVisit` on iOS once the first version has real-world data.
- How "Prøvde ikke" is stored: probably only locally, to suppress the next question.
