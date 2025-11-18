import { NativeEventEmitter, NativeModules, Platform } from 'react-native'
import NativeAudioRecorder from './specs/NativeAudioRecorder'

const LINKING_ERROR =
  `The package 'react-native-audio-stream' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n'

const AudioRecorderModule = NativeAudioRecorder
  ? NativeAudioRecorder
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR)
        }
      }
    )

const eventEmitter = new NativeEventEmitter(NativeModules.AudioRecorder)

export interface AudioRecorderConfig {
  sampleRate: number
  bufferSize: number
  emitIntervalMs: number
  notificationTitle?: string
  notificationText?: string
  websocket?: {
    url: string
    headers?: Record<string, string>
    reconnect?: {
      initialDelayMs?: number
      maxDelayMs?: number
      delayMultiplier?: number
    }
    buffer?: {
      enabled?: boolean
      maxChunks?: number
      catchupDelayMs?: number
    }
  }
}

export interface AudioDataEvent {
  data: number[]
}

export interface WebSocketMessageEvent {
  message: string
}

export interface WebSocketStateEvent {
  state: 'connected' | 'disconnected' | 'reconnecting'
}

export type AudioDataListener = (event: AudioDataEvent) => void
export type WebSocketMessageListener = (event: WebSocketMessageEvent) => void
export type WebSocketStateListener = (event: WebSocketStateEvent) => void

class AudioRecorder {
  private audioDataListeners: Map<AudioDataListener, any> = new Map()
  private websocketMessageListeners: Map<WebSocketMessageListener, any> = new Map()
  private websocketStateListeners: Map<WebSocketStateListener, any> = new Map()

  async initialize(config: AudioRecorderConfig): Promise<void> {
    const {
      sampleRate,
      bufferSize,
      emitIntervalMs,
      notificationTitle,
      notificationText,
      websocket
    } = config

    // Serialize WebSocket configuration
    const websocketUrl = websocket?.url
    const websocketHeaders = websocket?.headers ? JSON.stringify(websocket.headers) : undefined
    const websocketReconnectConfig = websocket?.reconnect ? JSON.stringify(websocket.reconnect) : undefined
    const websocketBufferConfig = websocket?.buffer ? JSON.stringify(websocket.buffer) : undefined

    return AudioRecorderModule.initialize(
      sampleRate,
      bufferSize,
      emitIntervalMs,
      notificationTitle,
      notificationText,
      websocketUrl,
      websocketHeaders,
      websocketReconnectConfig,
      websocketBufferConfig
    )
  }

  async startRecording(): Promise<void> {
    return AudioRecorderModule.startRecording()
  }

  async stopRecording(): Promise<void> {
    return AudioRecorderModule.stopRecording()
  }

  async cleanup(): Promise<void> {
    return AudioRecorderModule.cleanup()
  }

  addAudioDataListener(listener: AudioDataListener): () => void {
    const subscription = eventEmitter.addListener('onAudioData', listener)
    this.audioDataListeners.set(listener, subscription)

    return () => {
      this.removeAudioDataListener(listener)
    }
  }

  removeAudioDataListener(listener: AudioDataListener): void {
    const subscription = this.audioDataListeners.get(listener)
    if (subscription) {
      subscription.remove()
      this.audioDataListeners.delete(listener)
    }
  }

  addWebSocketMessageListener(listener: WebSocketMessageListener): () => void {
    const subscription = eventEmitter.addListener('onWebSocketMessage', listener)
    this.websocketMessageListeners.set(listener, subscription)

    return () => {
      this.removeWebSocketMessageListener(listener)
    }
  }

  removeWebSocketMessageListener(listener: WebSocketMessageListener): void {
    const subscription = this.websocketMessageListeners.get(listener)
    if (subscription) {
      subscription.remove()
      this.websocketMessageListeners.delete(listener)
    }
  }

  addWebSocketStateListener(listener: WebSocketStateListener): () => void {
    const subscription = eventEmitter.addListener('onWebSocketStateChange', listener)
    this.websocketStateListeners.set(listener, subscription)

    return () => {
      this.removeWebSocketStateListener(listener)
    }
  }

  removeWebSocketStateListener(listener: WebSocketStateListener): void {
    const subscription = this.websocketStateListeners.get(listener)
    if (subscription) {
      subscription.remove()
      this.websocketStateListeners.delete(listener)
    }
  }

  removeAllListeners(): void {
    this.audioDataListeners.forEach((subscription) => {
      subscription.remove()
    })
    this.audioDataListeners.clear()

    this.websocketMessageListeners.forEach((subscription) => {
      subscription.remove()
    })
    this.websocketMessageListeners.clear()

    this.websocketStateListeners.forEach((subscription) => {
      subscription.remove()
    })
    this.websocketStateListeners.clear()
  }
}

export default new AudioRecorder()

export type {
  AudioDataEvent, AudioDataListener, AudioRecorderConfig, WebSocketMessageEvent, WebSocketMessageListener, WebSocketStateEvent, WebSocketStateListener
}

