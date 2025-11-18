package com.audiostream

import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.*
import okio.ByteString
import java.util.concurrent.TimeUnit

data class ReconnectConfig(
    val initialDelayMs: Long = 1000,
    val maxDelayMs: Long = 30000,
    val delayMultiplier: Double = 2.0
)

data class BufferConfig(
    val enabled: Boolean = true,
    val maxChunks: Int = 50,
    val catchupDelayMs: Long = 10
)

class WebSocketManager {
    companion object {
        private const val TAG = "WebSocketManager"
    }

    private var client: OkHttpClient? = null
    private var webSocket: WebSocket? = null
    private var reconnectConfig = ReconnectConfig()
    private var bufferConfig = BufferConfig()
    private var currentUrl: String? = null
    private var currentHeaders: Map<String, String>? = null
    
    private var messageCallback: ((String) -> Unit)? = null
    private var stateCallback: ((String) -> Unit)? = null
    
    @Volatile
    private var isConnected = false
    
    @Volatile
    private var shouldReconnect = false
    
    private var currentReconnectDelay = 0L
    private val reconnectHandler = Handler(Looper.getMainLooper())
    private var reconnectRunnable: Runnable? = null
    
    // Circular buffer for offline chunks
    private val chunkBuffer = ArrayDeque<ByteArray>()
    private val bufferHandler = Handler(Looper.getMainLooper())
    @Volatile
    private var isCatchingUp = false

    fun connect(url: String, headers: Map<String, String> = emptyMap(), config: ReconnectConfig = ReconnectConfig(), bufferCfg: BufferConfig = BufferConfig()) {
        currentUrl = url
        currentHeaders = headers
        reconnectConfig = config
        bufferConfig = bufferCfg
        currentReconnectDelay = config.initialDelayMs
        shouldReconnect = true
        
        Log.d(TAG, "WebSocket configured: bufferEnabled=${bufferConfig.enabled}, maxChunks=${bufferConfig.maxChunks}, catchupDelay=${bufferConfig.catchupDelayMs}")
        
        performConnect()
    }

    private fun performConnect() {
        val url = currentUrl ?: return
        val headers = currentHeaders ?: emptyMap()
        
        try {
            Log.d(TAG, "Attempting to connect to WebSocket: $url")
            
            if (client == null) {
                client = OkHttpClient.Builder()
                    .connectTimeout(10, TimeUnit.SECONDS)
                    .readTimeout(0, TimeUnit.SECONDS)
                    .writeTimeout(10, TimeUnit.SECONDS)
                    .pingInterval(30, TimeUnit.SECONDS)
                    .build()
            }
            
            val requestBuilder = Request.Builder().url(url)
            headers.forEach { (key, value) ->
                requestBuilder.addHeader(key, value)
            }
            
            val request = requestBuilder.build()
            webSocket = client?.newWebSocket(request, webSocketListener)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error connecting to WebSocket", e)
            notifyStateChange("disconnected")
            scheduleReconnect()
        }
    }

    fun disconnect() {
        Log.d(TAG, "Disconnecting WebSocket")
        shouldReconnect = false
        cancelReconnect()
        
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        isConnected = false
        notifyStateChange("disconnected")
    }

    fun sendBinary(data: ByteArray): Boolean {
        Log.d(TAG, "sendBinary: isConnected=$isConnected, isCatchingUp=$isCatchingUp, bufferEnabled=${bufferConfig.enabled}, bufferSize=${chunkBuffer.size}")
        
        // If connected and not catching up, try to send immediately
        if (isConnected && !isCatchingUp && webSocket != null) {
            val sendResult = try {
                webSocket?.send(ByteString.of(*data)) ?: false
            } catch (e: Exception) {
                Log.e(TAG, "Error sending binary data", e)
                false
            }
            
            if (sendResult) {
                Log.d(TAG, "Sent chunk immediately: true")
                return true
            } else {
                // Send failed even though isConnected=true
                // Fall through to buffering logic if enabled
                Log.w(TAG, "Send failed even though connected, will buffer if enabled")
            }
        }
        
        // If disconnected OR send failed, and buffering is enabled, buffer the chunk
        if (bufferConfig.enabled) {
            synchronized(chunkBuffer) {
                // If buffer is full, remove oldest chunk
                if (chunkBuffer.size >= bufferConfig.maxChunks) {
                    chunkBuffer.removeFirst()
                    Log.d(TAG, "Buffer full, dropped oldest chunk")
                }
                chunkBuffer.addLast(data)
                
                if (isCatchingUp) {
                    Log.d(TAG, "Buffering during catch-up (${chunkBuffer.size}/${bufferConfig.maxChunks})")
                } else {
                    Log.d(TAG, "Buffered chunk (${chunkBuffer.size}/${bufferConfig.maxChunks})")
                }
            }
            return true
        }
        
        Log.w(TAG, "Cannot send data: not connected and buffering disabled")
        return false
    }

    fun isConnected(): Boolean = isConnected

    private fun startCatchup() {
        if (!bufferConfig.enabled || chunkBuffer.isEmpty()) {
            return
        }
        
        isCatchingUp = true
        Log.d(TAG, "Starting catch-up: ${chunkBuffer.size} buffered chunks")
        
        processCatchupQueue()
    }
    
    private fun processCatchupQueue() {
        synchronized(chunkBuffer) {
            if (chunkBuffer.isEmpty()) {
                isCatchingUp = false
                Log.d(TAG, "Catch-up complete")
                return
            }
            
            val chunk = chunkBuffer.removeFirst()
            
            // Send the chunk
            try {
                if (webSocket?.send(ByteString.of(*chunk)) == true) {
                    Log.d(TAG, "Sent buffered chunk (${chunkBuffer.size} remaining)")
                } else {
                    Log.w(TAG, "Failed to send buffered chunk")
                    // Re-add to front if send failed
                    chunkBuffer.addFirst(chunk)
                    isCatchingUp = false
                    return
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending buffered chunk", e)
                chunkBuffer.addFirst(chunk)
                isCatchingUp = false
                return
            }
        }
        
        // Schedule next chunk with delay
        if (chunkBuffer.isNotEmpty()) {
            bufferHandler.postDelayed({
                processCatchupQueue()
            }, bufferConfig.catchupDelayMs)
        } else {
            isCatchingUp = false
            Log.d(TAG, "Catch-up complete")
        }
    }

    fun setMessageCallback(callback: (String) -> Unit) {
        messageCallback = callback
    }

    fun setStateCallback(callback: (String) -> Unit) {
        stateCallback = callback
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect) {
            Log.d(TAG, "Reconnection disabled, not scheduling")
            return
        }
        
        cancelReconnect()
        
        Log.d(TAG, "Scheduling reconnect in ${currentReconnectDelay}ms")
        notifyStateChange("reconnecting")
        
        reconnectRunnable = Runnable {
            if (shouldReconnect) {
                performConnect()
                // Increase delay for next attempt
                val nextDelay = (currentReconnectDelay * reconnectConfig.delayMultiplier).toLong()
                currentReconnectDelay = minOf(nextDelay, reconnectConfig.maxDelayMs)
            }
        }
        
        reconnectHandler.postDelayed(reconnectRunnable!!, currentReconnectDelay)
    }

    private fun cancelReconnect() {
        reconnectRunnable?.let { runnable ->
            reconnectHandler.removeCallbacks(runnable)
            reconnectRunnable = null
        }
    }

    private fun notifyStateChange(state: String) {
        stateCallback?.invoke(state)
    }

    private val webSocketListener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            Log.d(TAG, "WebSocket connected")
            isConnected = true
            currentReconnectDelay = reconnectConfig.initialDelayMs // Reset delay on success
            notifyStateChange("connected")
            
            // Start catch-up if there are buffered chunks
            startCatchup()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            Log.d(TAG, "Received text message: ${text.take(100)}")
            messageCallback?.invoke(text)
        }

        override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
            Log.d(TAG, "Received binary message: ${bytes.size} bytes")
            // Convert binary to text for callback if needed
            messageCallback?.invoke(bytes.utf8())
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            Log.d(TAG, "WebSocket closing: $code - $reason")
            isConnected = false
            webSocket.close(1000, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Log.d(TAG, "WebSocket closed: $code - $reason")
            isConnected = false
            notifyStateChange("disconnected")
            
            if (shouldReconnect) {
                scheduleReconnect()
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.e(TAG, "WebSocket failure", t)
            isConnected = false
            notifyStateChange("disconnected")
            
            if (shouldReconnect) {
                scheduleReconnect()
            }
        }
    }

    fun cleanup() {
        disconnect()
        client?.dispatcher?.executorService?.shutdown()
        client = null
    }
}

