# Troubleshooting Guide

## Common Issues and Solutions

### Module Not Found Error

**Error:**
```
TurboModuleRegistry.getEnforcing(...): 'AudioRecorder' could not be found
```

**Solution:**
```bash
# Clean rebuild
npx expo prebuild --clean
npx expo run:ios  # or run:android
```

For local packages:
```bash
yarn sync  # Sync packages/ to node_modules/
npx expo prebuild --clean
npx expo run:ios
```

---

### iOS Build Errors

**Error:** Swift/Objective-C compilation errors

**Solution:**
```bash
# Clean everything
rm -rf ios
npx expo prebuild --clean --platform ios
npx expo run:ios
```

**Error:** Character encoding issues in Swift

**Solution:** All `??` operators have been removed. If you see this, make sure files are synced:
```bash
yarn sync
npx expo run:ios
```

---

### Android Build Errors

**Error:** Gradle build failures

**Solution:**
```bash
# Clean Android build
cd android
./gradlew clean
cd ..
npx expo prebuild --clean --platform android
npx expo run:android
```

---

### WebSocket Not Connecting

**Symptoms:**
- State stays "disconnected"
- No audio streaming

**Solution:**
1. Check WebSocket URL is correct
2. Check server is running
3. Check network connectivity
4. Look for logs: `[WebSocketManager]`

**Debug logging:**
```typescript
AudioRecorder.addWebSocketStateListener((event) => {
  console.log('WebSocket state:', event.state)
})
```

---

### WebSocket Not Reconnecting

**Symptoms:**
- Stays disconnected after server restart
- No "reconnecting" state

**Check logs for:**
```
[WebSocketManager] [DISCONNECT] WebSocket closed
[WebSocketManager] [RECONNECT] Scheduling reconnection
[WebSocketManager] Scheduling reconnect in 1000ms
```

**If you don't see these logs:**
- Reconnection might be disabled
- Check `shouldReconnect` configuration
- Verify reconnect config is passed to initialize()

**Solution:**
```typescript
await AudioRecorder.initialize({
  websocket: {
    url: 'wss://...',
    reconnect: {
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      delayMultiplier: 2.0
    }
  }
})
```

---

### Audio Format Mismatch (iOS)

**Error:**
```
Format mismatch: input hw <48000 Hz>, client format <16000 Hz>
```

**This is already fixed!** The module uses hardware format and resamples. If you see this error:
```bash
yarn sync  # Make sure latest code is synced
npx expo run:ios
```

---

### Playback Not Working (expo-audio)

**Error:** "AudioContext doesn't exist"

**This means you have old cached code.**

**Solution:**
```bash
# Clear Metro cache
npx expo start --clear

# In simulator/device, reload:
# Press Cmd+R (iOS) or R+R (Android)
```

**Error:** Stack overflow on playback

**Solution:** Make sure you have the latest code that processes base64 in chunks.

---

### Permission Denied

**iOS:**
- Permission message appears in Info.plist
- User must tap "Allow" when prompted
- If denied, user must go to Settings → App → Permissions

**Android:**
- Permissions must be in AndroidManifest.xml
- User must grant at runtime
- If denied, request again or direct to settings

**Verify plugin is configured:**
```json
{
  "expo": {
    "plugins": ["react-native-audio-stream"]
  }
}
```

---

### Background Recording Stops

**iOS:**
- Background mode must be enabled in plugin
- Audio session must be active
- Background task has time limits

**Verify:**
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosBackgroundMode": true  // Must be true
        }
      ]
    ]
  }
}
```

**Android:**
- Foreground service must be enabled
- Notification must be shown

---

### Metro Cache Issues

**Symptoms:**
- Code changes don't appear
- Old code keeps running
- Editor shows different code than running

**Solution:**
```bash
# Kill all Metro processes
pkill -9 -f "expo|metro"

# Clear all caches
rm -rf .expo
rm -rf node_modules/.cache

# Restart Metro with clean cache
npx expo start --clear --reset-cache

# Reload app
# iOS: Cmd+R
# Android: R+R
```

---

### Cursor Editor Shows Old Code

**Symptoms:**
- File on disk is updated
- Editor shows old version
- Changes don't save

**Solution:**
1. Close file tab completely
2. Reopen from file explorer
3. Or: Cmd+Shift+P → "File: Revert File"
4. Or: Restart Cursor

---

### Local Package Not Syncing

**Symptoms:**
- Changes in packages/ don't appear in build
- Module seems outdated

**Solution:**
```bash
yarn sync  # Manual sync
# OR
yarn ios   # Auto-syncs before build
```

**Verify sync script exists:**
```bash
cat scripts/sync-local-packages.sh
```

---

### Build Warnings About Library Versions

**Warnings:**
```
ld: object file was built for newer iOS version...
```

**This is normal** - Just warnings, not errors. Build should still succeed.

---

## Debug Logging

### Enable Detailed Logs

All modules log with prefixes:
- `[AudioRecorderModule]` - Module operations
- `[AudioRecorderService]` - Audio recording
- `[WebSocketManager]` - WebSocket operations

**Filter console:**
```javascript
// In Chrome DevTools or React Native Debugger
// Filter by: [WebSocketManager]
```

### Check Connection State
```typescript
AudioRecorder.addWebSocketStateListener((event) => {
  console.log('State:', event.state)
  // Should show: 'connected', 'disconnected', 'reconnecting'
})
```

### Check Audio Data Flow
```typescript
AudioRecorder.addAudioDataListener((event) => {
  console.log(`Got ${event.data.length} samples`)
  // Should emit every 100ms (default emitIntervalMs)
})
```

---

## Getting Help

### Before Reporting Issues

1. ✅ Check this troubleshooting guide
2. ✅ Review PLUGIN_API.md for configuration
3. ✅ Check console logs for error messages
4. ✅ Try clean rebuild (prebuild --clean)
5. ✅ Verify you're on correct Expo SDK version

### When Reporting Issues

Include:
- Expo SDK version
- Platform (iOS/Android)
- React Native version
- Full error message
- Console logs (especially [WebSocketManager], [AudioRecorderModule])
- Your plugin configuration from app.json
- Steps to reproduce

---

## Quick Fixes Reference

| Issue | Quick Fix |
|-------|-----------|
| Module not found | `npx expo prebuild --clean && npx expo run:ios` |
| Build error | `rm -rf ios && npx expo prebuild --clean` |
| Metro cache | `npx expo start --clear` then reload app |
| WebSocket not connecting | Check URL, check server running |
| Local package out of sync | `yarn sync && npx expo run:ios` |
| Editor shows old code | Close tab, reopen file |
| Permission denied | Check plugin in app.json |
| Playback error | Clear cache, reload app |

---

**Last Updated:** November 18, 2024  
**Version:** 0.1.0  
**Status:** Production Ready

