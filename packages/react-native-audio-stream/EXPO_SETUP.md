# Expo Prebuild Setup Guide

This guide explains how to use `react-native-audio-stream` with Expo's managed workflow and prebuild.

## Quick Setup

### 1. Install Dependencies

```bash
# From your project root
yarn install

# Install Expo config plugins (if not already installed)
yarn add -D @expo/config-plugins
```

### 2. Configure app.json

#### Option A: Default Configuration (Simplest)

Just add the plugin name:

```json
{
  "expo": {
    "plugins": [
      "react-native-audio-stream"
    ]
  }
}
```

The plugin will automatically:
- ✅ Add microphone permission to iOS Info.plist (default message)
- ✅ Enable background audio mode on iOS
- ✅ Add required Android permissions (RECORD_AUDIO, INTERNET, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MICROPHONE)

#### Option B: Custom Configuration (Fine-Grained Control)

Customize permissions and messages:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Velora needs microphone access to record your voice notes",
          "iosBackgroundMode": true,
          "androidPermissions": [
            "android.permission.RECORD_AUDIO",
            "android.permission.INTERNET",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.FOREGROUND_SERVICE_MICROPHONE"
          ],
          "androidForegroundService": true
        }
      ]
    ]
  }
}
```

### Plugin Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `iosMicrophonePermission` | string | 'This app needs access to the microphone to record audio' | iOS permission prompt message |
| `iosBackgroundMode` | boolean | true | Enable background audio mode on iOS |
| `androidPermissions` | string[] | See default list | Array of Android permission strings to add |
| `androidForegroundService` | boolean | true | Enable foreground service support on Android |

### 3. Run Prebuild

```bash
# Clean prebuild (recommended after adding new native modules)
npx expo prebuild --clean

# Or regular prebuild
npx expo prebuild
```

### 4. Build and Run

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

## What the Plugin Does

### iOS Configuration
- Adds `NSMicrophoneUsageDescription` to Info.plist
- Enables background audio mode (`UIBackgroundModes: ["audio"]`)

### Android Configuration
- Adds `RECORD_AUDIO` permission
- Adds `INTERNET` permission (for WebSocket streaming)
- Adds `FOREGROUND_SERVICE` permission
- Adds `FOREGROUND_SERVICE_MICROPHONE` permission (Android 14+)

## Configuration Examples

### Example 1: Minimal Setup (Use Defaults)
```json
{
  "expo": {
    "plugins": ["react-native-audio-stream"]
  }
}
```

### Example 2: Custom Permission Message
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Velora needs microphone access to record and transcribe your voice notes"
        }
      ]
    ]
  }
}
```

### Example 3: Disable Background Mode
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosBackgroundMode": false
        }
      ]
    ]
  }
}
```

### Example 4: Custom Android Permissions
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "androidPermissions": [
            "android.permission.RECORD_AUDIO",
            "android.permission.INTERNET"
          ]
        }
      ]
    ]
  }
}
```

### Example 5: Full Customization
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Record voice messages",
          "iosBackgroundMode": true,
          "androidPermissions": [
            "android.permission.RECORD_AUDIO",
            "android.permission.INTERNET",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.FOREGROUND_SERVICE_MICROPHONE",
            "android.permission.WAKE_LOCK"
          ],
          "androidForegroundService": true
        }
      ]
    ]
  }
}
```

### Example 6: For Velora (Voice AI App)
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Velora uses your microphone to capture voice notes for AI transcription and analysis",
          "iosBackgroundMode": true,
          "androidPermissions": [
            "android.permission.RECORD_AUDIO",
            "android.permission.INTERNET",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.FOREGROUND_SERVICE_MICROPHONE"
          ],
          "androidForegroundService": true
        }
      ]
    ]
  }
}
```

## Troubleshooting

### Module not found
If you get a "Module not found" error:
```bash
# Clean install
rm -rf node_modules
yarn install
npx expo prebuild --clean
```

### iOS Build Issues
If you encounter Swift/Objective-C bridging issues:
```bash
# For local packages, sync first
yarn sync  # If using local package in packages/
npx expo prebuild --clean
npx expo run:ios
```

### Android Build Issues
If you encounter Android build issues:
```bash
# Clean prebuild
yarn sync  # If using local package in packages/
npx expo prebuild --clean
npx expo run:android
```

### Local Package Sync Issues
If you're using this as a local package (file:./packages/react-native-audio-stream):
```bash
# Make sure changes are synced
yarn sync  # Syncs packages/ to node_modules/
npx expo prebuild --clean
npx expo run:ios
```

### New Architecture
This module supports React Native's New Architecture (Turbo Modules). Make sure your `app.json` has:
```json
{
  "expo": {
    "newArchEnabled": true
  }
}
```

## EAS Build

For building with EAS Build, no additional configuration is needed. The plugin will run automatically during the build process:

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Development Build

For development builds with Expo:

```bash
# Create a development build
npx expo install expo-dev-client
eas build --profile development --platform ios
eas build --profile development --platform android
```

Then use:
```bash
npx expo start --dev-client
```

## Usage Example

```typescript
import AudioRecorder from 'react-native-audio-stream'

// Initialize
await AudioRecorder.initialize({
  sampleRate: 16000,
  bufferSize: 1024,
  emitIntervalMs: 100,
  notificationTitle: 'Recording',
  notificationText: 'Audio recording in progress',
  websocket: {
    url: 'wss://your-server.com/audio',
    headers: {
      'Authorization': 'Bearer token'
    },
    reconnect: {
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      delayMultiplier: 2.0
    },
    buffer: {
      enabled: true,
      maxChunks: 50,
      catchupDelayMs: 10
    }
  }
})

// Listen for audio data
const removeListener = AudioRecorder.addAudioDataListener((event) => {
  console.log('Audio data received:', event.data.length, 'samples')
})

// Start recording
await AudioRecorder.startRecording()

// Stop recording
await AudioRecorder.stopRecording()

// Cleanup
removeListener()
await AudioRecorder.cleanup()
```

## Additional Resources

### Documentation
- **README.md** - Quick start and API reference
- **PLUGIN_API.md** - Complete plugin configuration guide
- **CHANGELOG.md** - Version history and changes

### Platform Support
- ✅ **iOS:** 13.0+
- ✅ **Android:** API 24+ (Android 7.0+)
- ✅ **Expo SDK:** 48+

### Known Working Setup
Tested and working with:
- Expo SDK 54
- React Native 0.81.5
- New Architecture (Turbo Modules) enabled
- expo-audio for playback

## Support

For issues or questions:
- Check `TROUBLESHOOTING.md` in the package
- Review `PLUGIN_API.md` for configuration help
- Check existing issues on GitHub
- Include your Expo SDK version and platform details when reporting issues

