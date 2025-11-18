import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

export interface Spec extends TurboModule {
  initialize(
    sampleRate: number,
    bufferSize: number,
    emitIntervalMs: number,
    notificationTitle?: string,
    notificationText?: string,
    websocketUrl?: string,
    websocketHeaders?: string,
    websocketReconnectConfig?: string,
    websocketBufferConfig?: string
  ): Promise<void>
  
  startRecording(): Promise<void>
  
  stopRecording(): Promise<void>
  
  cleanup(): Promise<void>
  
  addListener(eventName: string): void
  
  removeListeners(count: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('AudioRecorder')

