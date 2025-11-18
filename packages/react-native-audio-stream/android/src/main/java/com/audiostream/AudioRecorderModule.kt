package com.audiostream

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.modules.core.DeviceEventManagerModule

class AudioRecorderModule(reactContext: ReactApplicationContext) : 
  NativeAudioRecorderSpec(reactContext) {
  
  private var audioRecorderService: AudioRecorderService? = null
  private var serviceBound = false
  
  private var sampleRate: Int = 16000
  private var bufferSize: Int = 1024
  private var emitIntervalMs: Int = 100
  private var notificationTitle: String? = null
  private var notificationText: String? = null
  private var websocketUrl: String? = null
  private var websocketHeaders: String? = null
  private var websocketReconnectConfig: String? = null
  private var websocketBufferConfig: String? = null
  
  companion object {
    private const val TAG = "AudioRecorderModule"
    const val NAME = "AudioRecorder"
    private const val EVENT_AUDIO_DATA = "onAudioData"
    private const val EVENT_WEBSOCKET_MESSAGE = "onWebSocketMessage"
    private const val EVENT_WEBSOCKET_STATE = "onWebSocketStateChange"
  }
  
  private val serviceConnection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
      val binder = service as AudioRecorderService.AudioRecorderBinder
      audioRecorderService = binder.getService()
      serviceBound = true
      
      audioRecorderService?.setAudioDataCallback { audioData ->
        sendAudioDataToJS(audioData)
      }
      
      audioRecorderService?.setWebSocketMessageCallback { message ->
        sendWebSocketMessageToJS(message)
      }
      
      audioRecorderService?.setWebSocketStateCallback { state ->
        sendWebSocketStateToJS(state)
      }
      
      Log.d(TAG, "Service connected")
    }
    
    override fun onServiceDisconnected(name: ComponentName?) {
      audioRecorderService = null
      serviceBound = false
      Log.d(TAG, "Service disconnected")
    }
  }
  
  override fun getName(): String = NAME
  
  override fun initialize(
    sampleRate: Double,
    bufferSize: Double,
    emitIntervalMs: Double,
    notificationTitle: String?,
    notificationText: String?,
    websocketUrl: String?,
    websocketHeaders: String?,
    websocketReconnectConfig: String?,
    websocketBufferConfig: String?,
    promise: Promise
  ) {
    try {
      this.sampleRate = sampleRate.toInt()
      this.bufferSize = bufferSize.toInt()
      this.emitIntervalMs = emitIntervalMs.toInt()
      this.notificationTitle = notificationTitle
      this.notificationText = notificationText
      this.websocketUrl = websocketUrl
      this.websocketHeaders = websocketHeaders
      this.websocketReconnectConfig = websocketReconnectConfig
      this.websocketBufferConfig = websocketBufferConfig
      
      Log.d(TAG, "Initialized with sampleRate=$sampleRate, bufferSize=$bufferSize, emitInterval=$emitIntervalMs, websocketUrl=$websocketUrl")
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e(TAG, "Error initializing", e)
      promise.reject("INIT_ERROR", "Failed to initialize: ${e.message}", e)
    }
  }
  
  override fun startRecording(promise: Promise) {
    try {
      val context = reactApplicationContext
      
      val intent = Intent(context, AudioRecorderService::class.java).apply {
        action = AudioRecorderService.ACTION_START_RECORDING
        putExtra(AudioRecorderService.EXTRA_SAMPLE_RATE, sampleRate)
        putExtra(AudioRecorderService.EXTRA_BUFFER_SIZE, bufferSize)
        putExtra(AudioRecorderService.EXTRA_EMIT_INTERVAL, emitIntervalMs)
        putExtra(AudioRecorderService.EXTRA_NOTIFICATION_TITLE, notificationTitle ?: "Audio Recording")
        putExtra(AudioRecorderService.EXTRA_NOTIFICATION_TEXT, notificationText ?: "Recording audio in background")
        
        // Add WebSocket configuration
        websocketUrl?.let { putExtra(AudioRecorderService.EXTRA_WEBSOCKET_URL, it) }
        websocketHeaders?.let { putExtra(AudioRecorderService.EXTRA_WEBSOCKET_HEADERS, it) }
        websocketReconnectConfig?.let { putExtra(AudioRecorderService.EXTRA_WEBSOCKET_RECONNECT_CONFIG, it) }
        websocketBufferConfig?.let { putExtra(AudioRecorderService.EXTRA_WEBSOCKET_BUFFER_CONFIG, it) }
      }
      
      context.startService(intent)
      context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
      
      Log.d(TAG, "Recording started")
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e(TAG, "Error starting recording", e)
      promise.reject("START_ERROR", "Failed to start recording: ${e.message}", e)
    }
  }
  
  override fun stopRecording(promise: Promise) {
    try {
      val context = reactApplicationContext
      
      if (serviceBound) {
        context.unbindService(serviceConnection)
        serviceBound = false
      }
      
      val intent = Intent(context, AudioRecorderService::class.java).apply {
        action = AudioRecorderService.ACTION_STOP_RECORDING
      }
      context.startService(intent)
      
      audioRecorderService = null
      
      Log.d(TAG, "Recording stopped")
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e(TAG, "Error stopping recording", e)
      promise.reject("STOP_ERROR", "Failed to stop recording: ${e.message}", e)
    }
  }
  
  override fun cleanup(promise: Promise) {
    try {
      if (serviceBound) {
        reactApplicationContext.unbindService(serviceConnection)
        serviceBound = false
      }
      
      audioRecorderService = null
      
      Log.d(TAG, "Cleanup completed")
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e(TAG, "Error during cleanup", e)
      promise.reject("CLEANUP_ERROR", "Failed to cleanup: ${e.message}", e)
    }
  }
  
  override fun addListener(eventName: String) {
    // Required for event emitter
  }
  
  override fun removeListeners(count: Double) {
    // Required for event emitter
  }
  
  private fun sendAudioDataToJS(audioData: ShortArray) {
    try {
      val array = Arguments.createArray()
      for (sample in audioData) {
        array.pushInt(sample.toInt())
      }
      
      val params = Arguments.createMap().apply {
        putArray("data", array)
      }
      
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_AUDIO_DATA, params)
    } catch (e: Exception) {
      Log.e(TAG, "Error sending audio data to JS", e)
    }
  }
  
  private fun sendWebSocketMessageToJS(message: String) {
    try {
      val params = Arguments.createMap().apply {
        putString("message", message)
      }
      
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_WEBSOCKET_MESSAGE, params)
    } catch (e: Exception) {
      Log.e(TAG, "Error sending WebSocket message to JS", e)
    }
  }
  
  private fun sendWebSocketStateToJS(state: String) {
    try {
      val params = Arguments.createMap().apply {
        putString("state", state)
      }
      
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_WEBSOCKET_STATE, params)
    } catch (e: Exception) {
      Log.e(TAG, "Error sending WebSocket state to JS", e)
    }
  }
  
  override fun invalidate() {
    super.invalidate()
    if (serviceBound) {
      try {
        reactApplicationContext.unbindService(serviceConnection)
      } catch (e: Exception) {
        Log.e(TAG, "Error unbinding service during invalidation", e)
      }
      serviceBound = false
    }
  }
}

