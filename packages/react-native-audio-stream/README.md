# react-native-audio-stream

A React Native Turbo Module for real-time audio streaming with background recording support on Android and iOS.

## Features

- ✅ Real-time audio capture with configurable sample rate and buffer size
- ✅ Foreground and background recording support on both platforms
- ✅ High-priority audio processing to prevent interruptions
- ✅ Event-based audio frame emission to JavaScript
- ✅ WebSocket streaming with automatic reconnection and offline buffering
- ✅ Configurable notifications for background recording
- ✅ Hardware sample rate resampling on iOS
- ✅ Built with Turbo Modules for optimal performance
- ✅ Expo compatible with auto-configuration plugin

## Installation

### For Expo Projects

#### Simple Setup (Recommended)

Add to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      "react-native-audio-stream"
    ]
  }
}
```

#### Custom Configuration

For fine-grained control over permissions and messages:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "iosMicrophonePermission": "Your custom permission message",
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

**Available Options:**
- `iosMicrophonePermission` (string) - Custom iOS permission message
- `iosBackgroundMode` (boolean) - Enable iOS background audio (default: true)
- `androidPermissions` (string[]) - Array of Android permissions to add
- `androidForegroundService` (boolean) - Enable foreground service (default: true)

See `EXPO_SETUP.md` and `PLUGIN_API.md` for detailed configuration options and examples.

Add to your `package.json`:

```json
{
  "dependencies": {
    "react-native-audio-stream": "file:./packages/react-native-audio-stream"
  }
}
```

Then run:

```bash
yarn install
yarn prebuild:clean
yarn ios    # or yarn android
```

See `EXPO_SETUP.md` for detailed Expo integration instructions.

## Permissions

Permissions are automatically configured when using the Expo plugin. If not using Expo:

**iOS** - Add to `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app needs access to the microphone to record audio</string>
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

**Android** - Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE"/>
```

## Usage

```typescript
import AudioRecorder from 'react-native-audio-stream'

// Initialize the recorder
await AudioRecorder.initialize({
  sampleRate: 16000,
  bufferSize: 1024,
  emitIntervalMs: 100,
  notificationTitle: 'Recording Audio',
  notificationText: 'Recording in progress',
  websocket: {
    url: 'wss://your-server.com/audio',
    headers: {
      'Authorization': 'Bearer your-token'
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

// Add audio data listener
const removeAudioListener = AudioRecorder.addAudioDataListener((event) => {
  console.log('Audio data received:', event.data.length, 'samples')
  // event.data is an array of Int16 audio samples
})

// Add WebSocket state listener
const removeStateListener = AudioRecorder.addWebSocketStateListener((event) => {
  console.log('WebSocket state:', event.state) // 'connected' | 'disconnected' | 'reconnecting'
})

// Add WebSocket message listener
const removeMessageListener = AudioRecorder.addWebSocketMessageListener((event) => {
  console.log('WebSocket message:', event.message)
})

// Start recording
await AudioRecorder.startRecording()

// Stop recording
await AudioRecorder.stopRecording()

// Cleanup when done
removeAudioListener()
removeStateListener()
removeMessageListener()
await AudioRecorder.cleanup()
```

## API

### `initialize(config: AudioRecorderConfig): Promise<void>`

Initialize the audio recorder with configuration.

**Parameters:**
- `sampleRate` (number): Audio sample rate in Hz (e.g., 16000, 44100)
- `bufferSize` (number): Buffer size in samples
- `emitIntervalMs` (number): Interval in milliseconds to emit audio chunks
- `notificationTitle` (string, optional): Title for the foreground service notification
- `notificationText` (string, optional): Text for the foreground service notification

### `startRecording(): Promise<void>`

Start recording audio. This will start a foreground service on Android.

### `stopRecording(): Promise<void>`

Stop recording audio and remove the foreground service notification.

### `cleanup(): Promise<void>`

Clean up resources and remove all listeners.

### `addAudioDataListener(listener: AudioDataListener): () => void`

Add a listener for audio data events. Returns a function to remove the listener.

**AudioDataListener:**
```typescript
type AudioDataListener = (event: AudioDataEvent) => void

interface AudioDataEvent {
  data: number[] // Int16 audio samples
}
```

### `removeAudioDataListener(listener: AudioDataListener): void`

Remove a specific audio data listener.

### `removeAllListeners(): void`

Remove all audio data listeners.

## Platform Support

- ✅ Android (API 24+)
- ✅ iOS (13.0+)

## Example

See the `turbo-audio-recorder.tsx` tab in the example app for a complete implementation.

## Architecture

### Android
- **Turbo Modules** for optimal JavaScript-native communication
- **Foreground Service** with microphone permission for background recording
- **High-priority audio thread** to prevent recording interruptions
- **AudioRecord** API for low-latency PCM audio capture
- **OkHttp WebSocket** for streaming with reconnection

### iOS
- **Turbo Modules** (New Architecture compatible)
- **AVAudioEngine** for audio capture with hardware format handling
- **Automatic sample rate conversion** (e.g., 48kHz hardware → 16kHz target)
- **Background tasks** with local notifications
- **URLSession WebSocket** with exponential backoff reconnection
- **Offline buffering** with automatic catch-up on reconnect

## License

MIT

