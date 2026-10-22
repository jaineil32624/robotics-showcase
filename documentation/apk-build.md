# APK build process

## Architecture

```
React Native shell (native UI)  ⇄  WebView  ⇄  viewer.js (three.js + RobotController)  ←  model.js (base64 GLB)
          injectJavaScript("window.argo.setClip('walk')")          postMessage({type:'state', …})
```

The shell provides native menus, bottom sheets, persisted settings and Android back-button handling. The 3D
view runs in a hardware-accelerated WebView using exactly the same runtime code as the website, loaded from
`file:///android_asset/viewer/` — **no network access is needed or requested**.

## Build locally

Prerequisites: Node 20, JDK 17, Android SDK (Android Studio), `ANDROID_HOME` set.

```bash
cd mobile-app
npm install
npx expo install --fix                 # align native module versions with the Expo SDK
npm run build:viewer                   # → assets/viewer/{index.html,viewer.js,model.js}
npx expo prebuild --platform android   # generates android/ and copies the viewer into its assets
cd android
./gradlew assembleRelease
adb install app/build/outputs/apk/release/app-release.apk
```

Development with live reload: `npm run android` (requires a device or emulator).

## CI

The `android` job in `ci.yml` runs the same steps on `ubuntu-latest` and uploads **ARGO-Q4-v1.0.0.apk**
as a workflow artifact. Pushing a tag such as `v1.0.0` also attaches the APK to a GitHub Release.

## Signing for Google Play

The CI APK is signed with the Expo template's debug keystore — fine for sideloading and demos, not for the
Play Store. For a store release:

1. `keytool -genkeypair -v -keystore argo-release.keystore -alias argo -keyalg RSA -keysize 2048 -validity 10000`
2. Add the keystore and passwords as repository secrets, and a `signingConfigs.release` block in
   `android/app/build.gradle` (or use `eas build -p android --profile production`).
3. Build an **AAB** for Play: `./gradlew bundleRelease`.
4. Bump `android.versionCode` in `app.json` for every upload.

## Performance settings

| Quality | Pixel ratio | Shadows |
|---|---|---|
| Battery | 1.0 | off |
| Balanced (default) | ≤ 1.5 | 1024² |
| High | ≤ 2.0 | 2048² |
