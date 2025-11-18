import Foundation
import React

@objc(AudioRecorder)
class AudioRecorder: RCTEventEmitter {
    private static let TAG = "AudioRecorderModule"
    
    private var audioRecorderService: AudioRecorderService?
    
    private var sampleRate: Int = 16000
    private var bufferSize: Int = 1024
    private var emitIntervalMs: Int = 100
    private var notificationTitle: String? = nil
    private var notificationText: String? = nil
    private var websocketUrl: String? = nil
    private var websocketHeaders: String? = nil
    private var websocketReconnectConfig: String? = nil
    private var websocketBufferConfig: String? = nil
    
    private static let EVENT_AUDIO_DATA = "onAudioData"
    private static let EVENT_WEBSOCKET_MESSAGE = "onWebSocketMessage"
    private static let EVENT_WEBSOCKET_STATE = "onWebSocketStateChange"
    
    override init() {
        super.init()
        audioRecorderService = AudioRecorderService()
    }
    
    override static func moduleName() -> String! {
        return "AudioRecorder"
    }
    
    override func supportedEvents() -> [String]! {
        return [
            Self.EVENT_AUDIO_DATA,
            Self.EVENT_WEBSOCKET_MESSAGE,
            Self.EVENT_WEBSOCKET_STATE
        ]
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    @objc
    func initialize(
        _ sampleRate: Double,
        bufferSize: Double,
        emitIntervalMs: Double,
        notificationTitle: String?,
        notificationText: String?,
        websocketUrl: String?,
        websocketHeaders: String?,
        websocketReconnectConfig: String?,
        websocketBufferConfig: String?,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            self.sampleRate = Int(sampleRate)
            self.bufferSize = Int(bufferSize)
            self.emitIntervalMs = Int(emitIntervalMs)
            self.notificationTitle = notificationTitle
            self.notificationText = notificationText
            self.websocketUrl = websocketUrl
            self.websocketHeaders = websocketHeaders
            self.websocketReconnectConfig = websocketReconnectConfig
            self.websocketBufferConfig = websocketBufferConfig
            
            let wsUrl = websocketUrl != nil ? websocketUrl! : "none"
            print("[\(Self.TAG)] Initialized with sampleRate=\(self.sampleRate), bufferSize=\(self.bufferSize), emitInterval=\(self.emitIntervalMs), websocketUrl=\(wsUrl)")
            resolve(nil)
        } catch {
            print("[\(Self.TAG)] Error initializing: \(error.localizedDescription)")
            reject("INIT_ERROR", "Failed to initialize: \(error.localizedDescription)", error)
        }
    }
    
    @objc
    func startRecording(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            guard let service = audioRecorderService else {
                reject("START_ERROR", "Service not initialized", nil)
                return
            }
            
            // Parse WebSocket headers
            var headers: [String: String]? = nil
            if let headersJson = websocketHeaders, !headersJson.isEmpty {
                if let data = headersJson.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                    headers = json
                }
            }
            
            // Parse reconnect config
            var reconnectConfig: ReconnectConfig? = nil
            if let configJson = websocketReconnectConfig, !configJson.isEmpty {
                if let data = configJson.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let initialDelay = json["initialDelayMs"] as? Int64
                    let maxDelay = json["maxDelayMs"] as? Int64
                    let multiplier = json["delayMultiplier"] as? Double
                    reconnectConfig = ReconnectConfig(
                        initialDelayMs: initialDelay != nil ? initialDelay! : 1000,
                        maxDelayMs: maxDelay != nil ? maxDelay! : 30000,
                        delayMultiplier: multiplier != nil ? multiplier! : 2.0
                    )
                }
            }
            if reconnectConfig == nil {
                reconnectConfig = ReconnectConfig()
            }
            
            // Parse buffer config
            var bufferConfig: BufferConfig? = nil
            if let configJson = websocketBufferConfig, !configJson.isEmpty {
                if let data = configJson.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let enabled = json["enabled"] as? Bool
                    let maxChunks = json["maxChunks"] as? Int
                    let catchupDelay = json["catchupDelayMs"] as? Int64
                    bufferConfig = BufferConfig(
                        enabled: enabled != nil ? enabled! : true,
                        maxChunks: maxChunks != nil ? maxChunks! : 50,
                        catchupDelayMs: catchupDelay != nil ? catchupDelay! : 10
                    )
                }
            }
            if bufferConfig == nil {
                bufferConfig = BufferConfig()
            }
            
            // Configure service
            let notifTitle = notificationTitle != nil ? notificationTitle! : "Audio Recording"
            let notifText = notificationText != nil ? notificationText! : "Recording audio in background"
            
            service.configure(
                sampleRate: sampleRate,
                bufferSize: bufferSize,
                emitIntervalMs: emitIntervalMs,
                notificationTitle: notifTitle,
                notificationText: notifText,
                websocketUrl: websocketUrl,
                websocketHeaders: headers,
                websocketReconnectConfig: reconnectConfig,
                websocketBufferConfig: bufferConfig
            )
            
            // Set callbacks
            service.setAudioDataCallback { [weak self] audioData in
                self?.sendAudioDataToJS(audioData)
            }
            
            service.setWebSocketMessageCallback { [weak self] message in
                self?.sendWebSocketMessageToJS(message)
            }
            
            service.setWebSocketStateCallback { [weak self] state in
                self?.sendWebSocketStateToJS(state)
            }
            
            // Start recording
            try service.startRecording()
            
            print("[\(Self.TAG)] Recording started")
            resolve(nil)
        } catch {
            print("[\(Self.TAG)] Error starting recording: \(error.localizedDescription)")
            reject("START_ERROR", "Failed to start recording: \(error.localizedDescription)", error)
        }
    }
    
    @objc
    func stopRecording(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            audioRecorderService?.stopRecording()
            
            print("[\(Self.TAG)] Recording stopped")
            resolve(nil)
        } catch {
            print("[\(Self.TAG)] Error stopping recording: \(error.localizedDescription)")
            reject("STOP_ERROR", "Failed to stop recording: \(error.localizedDescription)", error)
        }
    }
    
    @objc
    func cleanup(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            audioRecorderService?.cleanup()
            
            print("[\(Self.TAG)] Cleanup completed")
            resolve(nil)
        } catch {
            print("[\(Self.TAG)] Error during cleanup: \(error.localizedDescription)")
            reject("CLEANUP_ERROR", "Failed to cleanup: \(error.localizedDescription)", error)
        }
    }
    
    @objc
    override func addListener(_ eventName: String) {
        super.addListener(eventName)
        // Required for event emitter
    }
    
    @objc
    override func removeListeners(_ count: Double) {
        super.removeListeners(count)
        // Required for event emitter
    }
    
    private func sendAudioDataToJS(_ audioData: [Int16]) {
        let dataArray = audioData.map { NSNumber(value: $0) }
        
        let params: [String: Any] = [
            "data": dataArray
        ]
        
        sendEvent(withName: Self.EVENT_AUDIO_DATA, body: params)
    }
    
    private func sendWebSocketMessageToJS(_ message: String) {
        let params: [String: Any] = [
            "message": message
        ]
        
        sendEvent(withName: Self.EVENT_WEBSOCKET_MESSAGE, body: params)
    }
    
    private func sendWebSocketStateToJS(_ state: String) {
        let params: [String: Any] = [
            "state": state
        ]
        
        sendEvent(withName: Self.EVENT_WEBSOCKET_STATE, body: params)
    }
    
    override func invalidate() {
        audioRecorderService?.cleanup()
        audioRecorderService = nil
        super.invalidate()
    }
}

