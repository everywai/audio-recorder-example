# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-11-18

### Added - Initial Release

#### Core Features
- Real-time audio recording on Android and iOS
- Configurable sample rate, buffer size, and emit intervals
- 16-bit PCM audio output (mono channel)
- Background recording support on both platforms
- Event-based audio data emission to JavaScript

#### WebSocket Streaming
- Binary audio streaming over WebSocket
- Custom headers support (e.g., Authorization tokens)
- Automatic reconnection with exponential backoff (1s → 30s)
- Offline buffering (circular buffer, up to 50 chunks)
- Catch-up mode to flush buffer on reconnect
- Connection state events (connected/disconnected/reconnecting)
- Message receiving from WebSocket server

#### Android Implementation
- Kotlin-based Turbo Module
- Foreground service with persistent notification
- High-priority audio thread for real-time processing
- AudioRecord API for low-latency capture
- OkHttp WebSocket implementation
- Service binding for lifecycle management

#### iOS Implementation
- Swift-based Turbo Module
- AVAudioEngine for high-quality audio capture
- Hardware sample rate handling with automatic resampling
- Background task management
- Local notifications for background recording
- URLSession WebSocket with DispatchQueue-based reconnection
- Audio session configuration for background mode

#### Expo Integration
- Config plugin for automatic native configuration
- Configurable iOS microphone permission message
- Configurable iOS background mode (on/off)
- Configurable Android permissions array
- Configurable Android foreground service (on/off)
- Auto-linking support
- Seamless prebuild integration

#### Developer Experience
- TypeScript types for all APIs
- Comprehensive documentation (README, EXPO_SETUP, PLUGIN_API)
- Detailed logging for debugging
- Clean API design with promise-based methods
- Listener management with cleanup functions
- Auto-sync workflow for local package development

#### Documentation
- README.md - Main documentation with API reference
- EXPO_SETUP.md - Complete Expo integration guide
- PLUGIN_API.md - Config plugin API reference
- PACKAGE_REVIEW.md - Technical deep-dive
- FINAL_REVIEW_SUMMARY.md - Feature completeness matrix
- CHECKLIST.md - Production readiness verification

### Technical Details

#### Audio Format
- Sample Rate: Configurable (e.g., 16kHz, 44.1kHz, 48kHz)
- Bit Depth: 16-bit signed integers
- Channels: Mono
- Byte Order: Little-endian (for WebSocket)
- Format: PCM (uncompressed)

#### Platform Requirements
- Android: API 24+ (Android 7.0+)
- iOS: 13.0+
- React Native: 0.70+ (Turbo Modules)
- Expo: SDK 48+

#### Dependencies
- Android: OkHttp 4.12.0, Kotlin 1.9.22
- iOS: AVFoundation, UserNotifications (system frameworks)
- JavaScript: React, React Native, Expo (peer dependencies)

### Known Limitations
- Mono channel only (no stereo)
- PCM format only (no compression)
- No pause/resume (must stop and restart)
- No file output (streaming only)
- iOS background tasks have time limits (mitigated by audio session)

[0.1.0]: https://github.com/everywai/react-native-audio-stream/releases/tag/v0.1.0


