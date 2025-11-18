# Expo Config Plugin API Reference

## Overview

The `react-native-audio-stream` Expo config plugin automatically configures native permissions and capabilities for both iOS and Android.

## Basic Usage

### Default Configuration
```json
{
  "expo": {
    "plugins": ["react-native-audio-stream"]
  }
}
```

### With Custom Options
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Custom message",
          "iosBackgroundMode": true,
          "androidPermissions": [...],
          "androidForegroundService": true
        }
      ]
    ]
  }
}
```

## Configuration Options

### `iosMicrophonePermission`

**Type:** `string`  
**Default:** `'This app needs access to the microphone to record audio'`  
**Platform:** iOS only

The message shown to users when requesting microphone permission on iOS. This appears in the system permission dialog.

**Examples:**
```json
"iosMicrophonePermission": "Record voice notes"
"iosMicrophonePermission": "Velora needs microphone access to transcribe your voice"
"iosMicrophonePermission": "Enable voice recording for AI analysis"
```

**Best Practices:**
- Keep it concise (under 100 characters)
- Explain the value to the user
- Be specific about what you're recording
- Mention AI/transcription if applicable

### `iosBackgroundMode`

**Type:** `boolean`  
**Default:** `true`  
**Platform:** iOS only

Enables background audio mode on iOS, allowing recording to continue when the app is backgrounded.

**Values:**
- `true` - Adds 'audio' to UIBackgroundModes (recommended)
- `false` - No background audio (recording stops when app backgrounds)

**When to disable:**
- If you only need foreground recording
- To reduce battery usage
- For simple recording use cases

### `androidPermissions`

**Type:** `string[]`  
**Default:**
```json
[
  "android.permission.RECORD_AUDIO",
  "android.permission.INTERNET",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE"
]
```
**Platform:** Android only

Array of Android permission strings to add to AndroidManifest.xml.

**Common Permissions:**
```json
"android.permission.RECORD_AUDIO"                    // Required for recording
"android.permission.INTERNET"                        // Required for WebSocket
"android.permission.FOREGROUND_SERVICE"              // Required for background
"android.permission.FOREGROUND_SERVICE_MICROPHONE"   // Required Android 14+
"android.permission.WAKE_LOCK"                       // Optional: prevent sleep
"android.permission.MODIFY_AUDIO_SETTINGS"           // Optional: audio routing
```

**Minimal Configuration (Foreground Only):**
```json
"androidPermissions": [
  "android.permission.RECORD_AUDIO",
  "android.permission.INTERNET"
]
```

**Full Configuration (Background + Network):**
```json
"androidPermissions": [
  "android.permission.RECORD_AUDIO",
  "android.permission.INTERNET",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE",
  "android.permission.WAKE_LOCK"
]
```

### `androidForegroundService`

**Type:** `boolean`  
**Default:** `true`  
**Platform:** Android only

Enables foreground service support for background recording on Android.

**Values:**
- `true` - Enables foreground service (recommended for background recording)
- `false` - Disable if you don't need background recording

## Use Case Examples

### 1. Voice Note App (Like Velora)
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Velora records voice notes for AI transcription and organization",
          "iosBackgroundMode": true,
          "androidPermissions": [
            "android.permission.RECORD_AUDIO",
            "android.permission.INTERNET",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.FOREGROUND_SERVICE_MICROPHONE"
          ]
        }
      ]
    ]
  }
}
```

### 2. Live Transcription App
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Enable live transcription of meetings and conversations",
          "iosBackgroundMode": true,
          "androidPermissions": [
            "android.permission.RECORD_AUDIO",
            "android.permission.INTERNET",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.FOREGROUND_SERVICE_MICROPHONE",
            "android.permission.WAKE_LOCK"
          ]
        }
      ]
    ]
  }
}
```

### 3. Voice Command App
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Listen for voice commands to control your device",
          "iosBackgroundMode": false,
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

### 4. Audio Analysis App
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Analyze ambient sound levels and frequencies",
          "iosBackgroundMode": false,
          "androidPermissions": [
            "android.permission.RECORD_AUDIO",
            "android.permission.MODIFY_AUDIO_SETTINGS"
          ]
        }
      ]
    ]
  }
}
```

## How It Works

### iOS
1. Plugin reads your `iosMicrophonePermission` option
2. Sets `NSMicrophoneUsageDescription` in Info.plist
3. If `iosBackgroundMode` is true, adds 'audio' to UIBackgroundModes
4. During prebuild, these get written to the native iOS project

### Android
1. Plugin reads your `androidPermissions` array
2. Adds each permission to AndroidManifest.xml
3. During prebuild, manifest gets merged into the native Android project

## Backward Compatibility

The plugin is fully backward compatible:

```json
// This still works (uses defaults):
{
  "expo": {
    "plugins": ["react-native-audio-stream"]
  }
}

// This also works (partial config):
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Custom message only"
        }
      ]
    ]
  }
}
```

All options are optional with sensible defaults!

## Permission Messages Best Practices

### ✅ Good Permission Messages
- "Record voice notes for transcription and AI analysis"
- "Capture audio for real-time speech recognition"
- "Enable voice commands and dictation"
- "Record meetings for automatic note-taking"

### ❌ Avoid
- "We need your microphone" (too vague)
- Generic messages that don't explain value
- Technical jargon users won't understand
- Messages over 150 characters

### Tips
1. **Be specific** about what you're recording
2. **Explain the benefit** to the user
3. **Mention AI/ML** if that's what you're doing
4. **Keep it concise** but informative
5. **Use your app name** for brand recognition

## Testing Different Configurations

After changing plugin options:

```bash
# Regenerate native projects with new config
yarn prebuild:clean

# Rebuild
yarn ios
# or
yarn android
```

The new permission messages and settings will take effect!

## TypeScript Support

The plugin has full TypeScript types. In your IDE:

```typescript
import type { AudioRecorderPluginProps } from 'react-native-audio-stream/plugin/src'
```

This gives you autocomplete for all options!

## Advanced: Conditional Configuration

You can use different settings for dev vs production:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": process.env.NODE_ENV === 'production'
            ? "Record voice for AI analysis"
            : "Development: Testing audio recording",
          "iosBackgroundMode": true
        }
      ]
    ]
  }
}
```

## Summary

The plugin provides **complete control** over:
- ✅ iOS permission messages (user-facing text)
- ✅ iOS background mode (on/off)
- ✅ Android permissions (which ones to add)
- ✅ Android foreground service (on/off)

All with sensible defaults that work out of the box!


