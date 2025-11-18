package com.audiostream

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean

class AudioRecorderService : Service() {
  private val binder = AudioRecorderBinder()
  private var audioRecord: AudioRecord? = null
  private var recordingThread: Thread? = null
  private val isRecording = AtomicBoolean(false)
  
  private var sampleRate: Int = 16000
  private var bufferSize: Int = 1024
  private var emitIntervalMs: Int = 100
  private var notificationTitle: String = "Audio Recording"
  private var notificationText: String = "Recording audio in background"
  
  private var audioDataCallback: ((ShortArray) -> Unit)? = null
  
  // WebSocket properties
  private var webSocketManager: WebSocketManager? = null
  private var websocketUrl: String? = null
  private var websocketHeaders: Map<String, String>? = null
  private var websocketReconnectConfig: ReconnectConfig? = null
  private var websocketBufferConfig: BufferConfig? = null
  private var websocketMessageCallback: ((String) -> Unit)? = null
  private var websocketStateCallback: ((String) -> Unit)? = null
  
  companion object {
    private const val TAG = "AudioRecorderService"
    private const val NOTIFICATION_ID = 12345
    private const val CHANNEL_ID = "audio_recorder_channel"
    private const val CHANNEL_NAME = "Audio Recording"
    
    const val ACTION_START_RECORDING = "com.audiostream.START_RECORDING"
    const val ACTION_STOP_RECORDING = "com.audiostream.STOP_RECORDING"
    
    const val EXTRA_SAMPLE_RATE = "sample_rate"
    const val EXTRA_BUFFER_SIZE = "buffer_size"
    const val EXTRA_EMIT_INTERVAL = "emit_interval"
    const val EXTRA_NOTIFICATION_TITLE = "notification_title"
    const val EXTRA_NOTIFICATION_TEXT = "notification_text"
    const val EXTRA_WEBSOCKET_URL = "websocket_url"
    const val EXTRA_WEBSOCKET_HEADERS = "websocket_headers"
    const val EXTRA_WEBSOCKET_RECONNECT_CONFIG = "websocket_reconnect_config"
    const val EXTRA_WEBSOCKET_BUFFER_CONFIG = "websocket_buffer_config"
  }
  
  inner class AudioRecorderBinder : Binder() {
    fun getService(): AudioRecorderService = this@AudioRecorderService
  }
  
  override fun onBind(intent: Intent?): IBinder {
    return binder
  }
  
  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }
  
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START_RECORDING -> {
        sampleRate = intent.getIntExtra(EXTRA_SAMPLE_RATE, 16000)
        bufferSize = intent.getIntExtra(EXTRA_BUFFER_SIZE, 1024)
        emitIntervalMs = intent.getIntExtra(EXTRA_EMIT_INTERVAL, 100)
        notificationTitle = intent.getStringExtra(EXTRA_NOTIFICATION_TITLE) ?: "Audio Recording"
        notificationText = intent.getStringExtra(EXTRA_NOTIFICATION_TEXT) ?: "Recording audio in background"
        
        // Extract WebSocket configuration
        websocketUrl = intent.getStringExtra(EXTRA_WEBSOCKET_URL)
        
        val headersJson = intent.getStringExtra(EXTRA_WEBSOCKET_HEADERS)
        websocketHeaders = if (!headersJson.isNullOrEmpty()) {
          try {
            val json = JSONObject(headersJson)
            val map = mutableMapOf<String, String>()
            json.keys().forEach { key ->
              map[key] = json.getString(key)
            }
            map
          } catch (e: Exception) {
            Log.e(TAG, "Error parsing WebSocket headers", e)
            null
          }
        } else null
        
        val reconnectConfigJson = intent.getStringExtra(EXTRA_WEBSOCKET_RECONNECT_CONFIG)
        websocketReconnectConfig = if (!reconnectConfigJson.isNullOrEmpty()) {
          try {
            val json = JSONObject(reconnectConfigJson)
            ReconnectConfig(
              initialDelayMs = json.optLong("initialDelayMs", 1000),
              maxDelayMs = json.optLong("maxDelayMs", 30000),
              delayMultiplier = json.optDouble("delayMultiplier", 2.0)
            )
          } catch (e: Exception) {
            Log.e(TAG, "Error parsing WebSocket reconnect config", e)
            ReconnectConfig()
          }
        } else ReconnectConfig()
        
        val bufferConfigJson = intent.getStringExtra(EXTRA_WEBSOCKET_BUFFER_CONFIG)
        websocketBufferConfig = if (!bufferConfigJson.isNullOrEmpty()) {
          try {
            val json = JSONObject(bufferConfigJson)
            BufferConfig(
              enabled = json.optBoolean("enabled", true),
              maxChunks = json.optInt("maxChunks", 50),
              catchupDelayMs = json.optLong("catchupDelayMs", 10)
            )
          } catch (e: Exception) {
            Log.e(TAG, "Error parsing WebSocket buffer config", e)
            BufferConfig()
          }
        } else BufferConfig()
        
        startForeground(NOTIFICATION_ID, createNotification())
        
        // Connect WebSocket first (in parallel with recording setup)
        if (!websocketUrl.isNullOrEmpty()) {
          connectWebSocket()
        }
        
        startRecording()
      }
      ACTION_STOP_RECORDING -> {
        stopRecording()
        disconnectWebSocket()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
    return START_STICKY
  }
  
  fun setAudioDataCallback(callback: (ShortArray) -> Unit) {
    audioDataCallback = callback
  }
  
  fun setWebSocketMessageCallback(callback: (String) -> Unit) {
    websocketMessageCallback = callback
  }
  
  fun setWebSocketStateCallback(callback: (String) -> Unit) {
    websocketStateCallback = callback
  }
  
  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Notification for audio recording service"
        setSound(null, null)
      }
      
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.createNotificationChannel(channel)
    }
  }
  
  private fun createNotification(): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(notificationTitle)
      .setContentText(notificationText)
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .build()
  }
  
  private fun startRecording() {
    if (isRecording.get()) {
      Log.w(TAG, "Already recording")
      return
    }
    
    try {
      val minBufferSize = AudioRecord.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT
      )
      
      val actualBufferSize = maxOf(minBufferSize, bufferSize * 2)
      
      audioRecord = AudioRecord(
        MediaRecorder.AudioSource.MIC,
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        actualBufferSize
      )
      
      if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
        Log.e(TAG, "AudioRecord initialization failed")
        return
      }
      
      audioRecord?.startRecording()
      isRecording.set(true)
      
      recordingThread = Thread({
        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)
        recordAudio()
      }, "AudioRecordingThread").apply {
        priority = Thread.MAX_PRIORITY
        start()
      }
      
      Log.d(TAG, "Recording started with sample rate: $sampleRate, buffer size: $bufferSize, emit interval: ${emitIntervalMs}ms")
    } catch (e: Exception) {
      Log.e(TAG, "Error starting recording", e)
      isRecording.set(false)
    }
  }
  
  private fun recordAudio() {
    val audioBuffer = ShortArray(bufferSize)
    val accumulatedBuffer = mutableListOf<Short>()
    val samplesPerEmit = (sampleRate * emitIntervalMs / 1000)
    
    while (isRecording.get()) {
      try {
        val readCount = audioRecord?.read(audioBuffer, 0, bufferSize) ?: 0
        
        if (readCount > 0) {
          // Accumulate samples
          for (i in 0 until readCount) {
            accumulatedBuffer.add(audioBuffer[i])
          }
          
          // Emit when we have enough samples
          if (accumulatedBuffer.size >= samplesPerEmit) {
            val emitData = accumulatedBuffer.take(samplesPerEmit).toShortArray()
            audioDataCallback?.invoke(emitData)
            
            // Send to WebSocket (will buffer if disconnected)
            webSocketManager?.let { wsManager ->
              val byteArray = shortArrayToByteArray(emitData)
              wsManager.sendBinary(byteArray)
            }
            
            // Keep remaining samples for next emit
            accumulatedBuffer.subList(0, samplesPerEmit).clear()
          }
        } else if (readCount < 0) {
          Log.e(TAG, "Error reading audio data: $readCount")
        }
      } catch (e: Exception) {
        Log.e(TAG, "Error in recording loop", e)
        break
      }
    }
  }
  
  private fun shortArrayToByteArray(shorts: ShortArray): ByteArray {
    val buffer = ByteBuffer.allocate(shorts.size * 2)
    buffer.order(ByteOrder.LITTLE_ENDIAN)
    for (short in shorts) {
      buffer.putShort(short)
    }
    return buffer.array()
  }
  
  private fun connectWebSocket() {
    val url = websocketUrl ?: return
    val headers = websocketHeaders ?: emptyMap()
    val config = websocketReconnectConfig ?: ReconnectConfig()
    val bufferCfg = websocketBufferConfig ?: BufferConfig()
    
    try {
      webSocketManager = WebSocketManager()
      webSocketManager?.setMessageCallback { message ->
        websocketMessageCallback?.invoke(message)
      }
      webSocketManager?.setStateCallback { state ->
        websocketStateCallback?.invoke(state)
      }
      webSocketManager?.connect(url, headers, config, bufferCfg)
      Log.d(TAG, "WebSocket connection initiated to: $url (buffering: ${bufferCfg.enabled})")
    } catch (e: Exception) {
      Log.e(TAG, "Error connecting WebSocket", e)
    }
  }
  
  private fun disconnectWebSocket() {
    webSocketManager?.disconnect()
    webSocketManager = null
    Log.d(TAG, "WebSocket disconnected")
  }
  
  private fun stopRecording() {
    isRecording.set(false)
    
    recordingThread?.join(1000)
    recordingThread = null
    
    audioRecord?.apply {
      try {
        stop()
        release()
      } catch (e: Exception) {
        Log.e(TAG, "Error stopping AudioRecord", e)
      }
    }
    audioRecord = null
    
    Log.d(TAG, "Recording stopped")
  }
  
  override fun onDestroy() {
    stopRecording()
    disconnectWebSocket()
    webSocketManager?.cleanup()
    super.onDestroy()
  }
}

