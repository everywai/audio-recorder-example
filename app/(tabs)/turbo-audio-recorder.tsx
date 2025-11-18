import React, { FC, useEffect, useRef, useState } from 'react'
import { Dimensions, PermissionsAndroid, Platform, ScrollView, TextInput, View } from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import AudioRecorder, { AudioDataEvent, WebSocketMessageEvent, WebSocketStateEvent } from 'react-native-audio-stream'

const { width } = Dimensions.get('screen')

export const layout = {
  spacing: 8,
  radius: 8,
  knobSize: 24,
  indicatorSize: 48,
  screenWidth: width
} as const

export const colors = {
  white: '#ffffff',
  main: '#38ACDD',
  black: '#000000',
  gray: '#d7d7d7',
  yellow: '#FFD61E',

  background: '#222222',
  backgroundDark: '#1f2020',
  backgroundLight: '#333333',

  separator: '#333333',
  modalBackdrop: '#00000040',
  border: '#999999'
} as const

const SAMPLE_RATE = 16000
const BUFFER_SIZE = 1024
const EMIT_INTERVAL_MS = 100

const TurboAudioRecorder: FC = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [chunkCount, setChunkCount] = useState(0)
  const [lastChunkSize, setLastChunkSize] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasRecording, setHasRecording] = useState(false)
  
  // WebSocket state
  const [websocketUrl, setWebsocketUrl] = useState('ws://192.168.254.24:5001/api/v1/relay')
  const [websocketState, setWebsocketState] = useState<string>('disconnected')
  const [websocketMessages, setWebsocketMessages] = useState<string[]>([])
  const [initialDelay, setInitialDelay] = useState('1000')
  const [maxDelay, setMaxDelay] = useState('30000')
  const [delayMultiplier, setDelayMultiplier] = useState('2.0')
  
  const removeListenerRef = useRef<(() => void) | null>(null)
  const removeWsMessageListenerRef = useRef<(() => void) | null>(null)
  const removeWsStateListenerRef = useRef<(() => void) | null>(null)
  const audioChunksRef = useRef<number[][]>([])
  const recordingUriRef = useRef<string | null>(null)
  const player = useAudioPlayer(null)
  const playerStatus = useAudioPlayerStatus(player)

  // Update isPlaying based on actual player status
  useEffect(() => {
    setIsPlaying(playerStatus.playing)
    
    // Check if playback just finished
    if (playerStatus.didJustFinish) {
      console.log('Playback finished')
    }
  }, [playerStatus.playing, playerStatus.didJustFinish])

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (removeListenerRef.current) {
        removeListenerRef.current()
      }
      if (removeWsMessageListenerRef.current) {
        removeWsMessageListenerRef.current()
      }
      if (removeWsStateListenerRef.current) {
        removeWsStateListenerRef.current()
      }
      if (player.playing) {
        player.pause()
      }
      AudioRecorder.cleanup().catch(console.error)
    }
  }, [player])

  const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone to record audio.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK'
        }
      )
      return granted === PermissionsAndroid.RESULTS.GRANTED
    } catch (err) {
      console.error('Permission request error:', err)
      return false
    }
  }

  const handleInitialize = async () => {
    try {
      // Request microphone permission first
      const hasPermission = await requestAudioPermission()
      if (!hasPermission) {
        console.error('Microphone permission denied')
        alert('Microphone permission is required to record audio')
        return
      }

      await AudioRecorder.initialize({
        sampleRate: SAMPLE_RATE,
        bufferSize: BUFFER_SIZE,
        emitIntervalMs: EMIT_INTERVAL_MS,
        notificationTitle: 'Turbo Module Recording',
        notificationText: 'Recording with custom Turbo Module',
        websocket: websocketUrl ? {
          url: websocketUrl,
          reconnect: {
            initialDelayMs: parseInt(initialDelay) || 1000,
            maxDelayMs: parseInt(maxDelay) || 30000,
            delayMultiplier: parseFloat(delayMultiplier) || 2.0
          },
          buffer: {
            enabled: true,        // Enable buffering
            maxChunks: 50,        // Buffer up to 50 chunks (~5 seconds)
            catchupDelayMs: 25   // 100ms delay between sends during catch-up (matches chunk interval)
          }
        } : undefined
      })

      // Set up audio data listener
      removeListenerRef.current = AudioRecorder.addAudioDataListener((event: AudioDataEvent) => {
        setChunkCount((prev) => prev + 1)
        setLastChunkSize(event.data.length)
        // Store the chunk
        audioChunksRef.current.push(event.data)
        console.log(`Audio chunk received: ${event.data.length} samples`)
      })

      // Set up WebSocket message listener
      removeWsMessageListenerRef.current = AudioRecorder.addWebSocketMessageListener((event: WebSocketMessageEvent) => {
        console.log('WebSocket message:', event.message)
        setWebsocketMessages((prev) => [...prev, event.message].slice(-20)) // Keep last 20 messages
      })

      // Set up WebSocket state listener
      removeWsStateListenerRef.current = AudioRecorder.addWebSocketStateListener((event: WebSocketStateEvent) => {
        console.log('WebSocket state:', event.state)
        setWebsocketState(event.state)
      })

      setIsInitialized(true)
      console.log('Turbo Module initialized')
    } catch (error) {
      console.error('Error initializing:', error)
    }
  }

  const handleStartRecording = async () => {
    try {
      // Clear previous recording
      audioChunksRef.current = []
      setHasRecording(false)
      
      await AudioRecorder.startRecording()
      setIsRecording(true)
      setChunkCount(0)
      console.log('Recording started')
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const handleStopRecording = async () => {
    try {
      await AudioRecorder.stopRecording()
      setIsRecording(false)
      setHasRecording(audioChunksRef.current.length > 0)
      console.log('Recording stopped')
      console.log(`Total chunks recorded: ${audioChunksRef.current.length}`)
    } catch (error) {
      console.error('Error stopping recording:', error)
    }
  }

  const handleCleanup = async () => {
    try {
      if (removeListenerRef.current) {
        removeListenerRef.current()
        removeListenerRef.current = null
      }
      if (removeWsMessageListenerRef.current) {
        removeWsMessageListenerRef.current()
        removeWsMessageListenerRef.current = null
      }
      if (removeWsStateListenerRef.current) {
        removeWsStateListenerRef.current()
        removeWsStateListenerRef.current = null
      }
      await AudioRecorder.cleanup()
      audioChunksRef.current = []
      recordingUriRef.current = null
      if (player.playing) {
        player.pause()
      }
      setIsInitialized(false)
      setIsRecording(false)
      setChunkCount(0)
      setLastChunkSize(0)
      setHasRecording(false)
      setWebsocketState('disconnected')
      setWebsocketMessages([])
      console.log('Cleanup completed')
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }

  // Helper function to create WAV file from PCM data
  const createWavFile = async (pcmData: number[]): Promise<string> => {
    const numChannels = 1
    const bitsPerSample = 16
    const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8)
    const blockAlign = numChannels * (bitsPerSample / 8)
    const dataSize = pcmData.length * 2 // 2 bytes per Int16 sample
    
    // WAV file header
    const header = new ArrayBuffer(44)
    const view = new DataView(header)
    
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeString(view, 8, 'WAVE')
    
    // fmt sub-chunk
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true) // Subchunk1Size for PCM
    view.setUint16(20, 1, true) // AudioFormat PCM
    view.setUint16(22, numChannels, true)
    view.setUint32(24, SAMPLE_RATE, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitsPerSample, true)
    
    // data sub-chunk
    writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)
    
    // Convert header to base64
    const headerBytes = Array.from(new Uint8Array(header))
    
    // Convert PCM data to bytes (little-endian Int16)
    const pcmBytes: number[] = []
    for (const sample of pcmData) {
      const int16 = Math.max(-32768, Math.min(32767, Math.round(sample)))
      pcmBytes.push(int16 & 0xff)
      pcmBytes.push((int16 >> 8) & 0xff)
    }
    
    // Combine header and data
    const wavBytes = [...headerBytes, ...pcmBytes]
    
    // Convert to base64 in chunks to avoid stack overflow
    const chunkSize = 8192
    let binaryString = ''
    for (let i = 0; i < wavBytes.length; i += chunkSize) {
      const chunk = wavBytes.slice(i, i + chunkSize)
      binaryString += String.fromCharCode.apply(null, chunk as any)
    }
    const base64 = btoa(binaryString)
    
    // Save to file using legacy API
    const fileUri = (cacheDirectory || '') + 'recording.wav'
    await writeAsStringAsync(fileUri, base64, {
      encoding: EncodingType.Base64
    })
    
    return fileUri
  }
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  const handlePlayback = async () => {
    try {
      if (audioChunksRef.current.length === 0) {
        console.log('No audio data to play')
        return
      }

      setIsPlaying(true)

      // Flatten all chunks into a single array
      const allSamples = audioChunksRef.current.flat()
      console.log(`Preparing to play ${allSamples.length} samples`)

      // Create WAV file
      const wavUri = await createWavFile(allSamples)
      recordingUriRef.current = wavUri
      console.log(`WAV file created at: ${wavUri}`)

      // Load and play with expo-audio
      player.replace({ uri: wavUri })
      player.play()
      
      const duration = allSamples.length / SAMPLE_RATE
      console.log(`Playing back ${allSamples.length} samples (${duration.toFixed(2)}s)`)
    } catch (error) {
      console.error('Error during playback:', error)
      setIsPlaying(false)
    }
  }

  const handleStopPlayback = () => {
    try {
      if (player.playing) {
        player.pause()
      }
      if (player.isLoaded) {
        player.seekTo(0)
      }
      setIsPlaying(false)
      console.log('Playback stopped')
    } catch (error) {
      console.error('Error stopping playback:', error)
    }
  }

  const getStateColor = () => {
    switch (websocketState) {
      case 'connected':
        return colors.main
      case 'reconnecting':
        return colors.yellow
      default:
        return colors.gray
    }
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={{ gap: 20, paddingTop: 20, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.gray, fontSize: 18, textAlign: 'center' }}>
            Turbo Module Audio Recorder
          </Text>
          <Text style={{ color: colors.gray, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            Sample rate: {SAMPLE_RATE} Hz, Buffer: {BUFFER_SIZE}, Interval: {EMIT_INTERVAL_MS}ms
          </Text>
        </View>

        {/* WebSocket Configuration */}
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <Text style={{ color: colors.white, fontSize: 16, textAlign: 'center' }}>WebSocket Config</Text>
          <TextInput
            style={{
              backgroundColor: colors.backgroundLight,
              color: colors.white,
              padding: 10,
              borderRadius: 8,
              fontSize: 14
            }}
            placeholder='WebSocket URL'
            placeholderTextColor={colors.gray}
            value={websocketUrl}
            onChangeText={setWebsocketUrl}
            editable={!isInitialized}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: colors.backgroundLight,
                color: colors.white,
                padding: 10,
                borderRadius: 8,
                fontSize: 12
              }}
              placeholder='Initial delay (ms)'
              placeholderTextColor={colors.gray}
              value={initialDelay}
              onChangeText={setInitialDelay}
              keyboardType='numeric'
              editable={!isInitialized}
            />
            <TextInput
              style={{
                flex: 1,
                backgroundColor: colors.backgroundLight,
                color: colors.white,
                padding: 10,
                borderRadius: 8,
                fontSize: 12
              }}
              placeholder='Max delay (ms)'
              placeholderTextColor={colors.gray}
              value={maxDelay}
              onChangeText={setMaxDelay}
              keyboardType='numeric'
              editable={!isInitialized}
            />
            <TextInput
              style={{
                flex: 1,
                backgroundColor: colors.backgroundLight,
                color: colors.white,
                padding: 10,
                borderRadius: 8,
                fontSize: 12
              }}
              placeholder='Multiplier'
              placeholderTextColor={colors.gray}
              value={delayMultiplier}
              onChangeText={setDelayMultiplier}
              keyboardType='decimal-pad'
              editable={!isInitialized}
            />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: getStateColor(), fontSize: 14, fontWeight: 'bold' }}>
              WebSocket: {websocketState}
            </Text>
          </View>
        </View>

        {/* Initialization */}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={{ color: colors.white, fontSize: 16 }}>Initialization</Text>
          <Button onPress={handleInitialize} disabled={isInitialized}>
            <Text>Initialize Recorder</Text>
          </Button>
          <Text style={{ color: isInitialized ? colors.main : colors.gray, fontSize: 14 }}>
            Status: {isInitialized ? 'Initialized' : 'Not initialized'}
          </Text>
        </View>

        {/* Recording Controls */}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={{ color: colors.white, fontSize: 16 }}>Recording Controls</Text>
          <Button onPress={handleStartRecording} disabled={!isInitialized || isRecording}>
            <Text>Start Recording</Text>
          </Button>
          <Button onPress={handleStopRecording} disabled={!isRecording}>
            <Text>Stop Recording</Text>
          </Button>
          <Text style={{ color: isRecording ? colors.main : colors.gray, fontSize: 14 }}>
            Status: {isRecording ? 'Recording' : 'Stopped'}
          </Text>
          <Text style={{ color: colors.gray, fontSize: 14 }}>
            Chunks: {chunkCount} | Last: {lastChunkSize} samples
          </Text>
        </View>

        {/* WebSocket Messages */}
        {websocketMessages.length > 0 && (
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            <Text style={{ color: colors.white, fontSize: 16, textAlign: 'center' }}>
              Server Messages ({websocketMessages.length})
            </Text>
            <ScrollView
              style={{
                backgroundColor: colors.backgroundLight,
                maxHeight: 150,
                borderRadius: 8,
                padding: 10
              }}
            >
              {websocketMessages.map((msg, idx) => (
                <Text key={idx} style={{ color: colors.gray, fontSize: 12, marginBottom: 4 }}>
                  {msg}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Playback */}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={{ color: colors.white, fontSize: 16 }}>Playback</Text>
          <Button onPress={handlePlayback} disabled={!hasRecording || isPlaying || isRecording}>
            <Text>Play Recording</Text>
          </Button>
          <Button onPress={handleStopPlayback} disabled={!isPlaying}>
            <Text>Stop Playback</Text>
          </Button>
          <Text style={{ color: isPlaying ? colors.main : colors.gray, fontSize: 14 }}>
            {isPlaying ? 'Playing' : hasRecording ? `Ready (${chunkCount} chunks)` : 'No recording'}
          </Text>
        </View>

        {/* Cleanup */}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Button onPress={handleCleanup} disabled={isRecording || isPlaying}>
            <Text>Cleanup</Text>
          </Button>
        </View>
      </View>
    </ScrollView>
  )
}

export default TurboAudioRecorder

