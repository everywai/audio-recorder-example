import Foundation
import AVFoundation
import UserNotifications

class AudioRecorderService {
    private static let TAG = "AudioRecorderService"
    
    private var audioEngine: AVAudioEngine?
    private var isRecording = false
    
    private var sampleRate: Int = 16000
    private var bufferSize: Int = 1024
    private var emitIntervalMs: Int = 100
    private var notificationTitle: String = "Audio Recording"
    private var notificationText: String = "Recording audio in background"
    
    private var audioDataCallback: (([Int16]) -> Void)?
    
    // WebSocket properties
    private var webSocketManager: WebSocketManager?
    private var websocketUrl: String?
    private var websocketHeaders: [String: String]?
    private var websocketReconnectConfig: ReconnectConfig?
    private var websocketBufferConfig: BufferConfig?
    private var websocketMessageCallback: ((String) -> Void)?
    private var websocketStateCallback: ((String) -> Void)?
    
    // Audio accumulation
    private var accumulatedSamples: [Int16] = []
    private var samplesPerEmit: Int = 0
    
    // Background task
    private var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid
    
    func configure(
        sampleRate: Int,
        bufferSize: Int,
        emitIntervalMs: Int,
        notificationTitle: String,
        notificationText: String,
        websocketUrl: String?,
        websocketHeaders: [String: String]?,
        websocketReconnectConfig: ReconnectConfig?,
        websocketBufferConfig: BufferConfig?
    ) {
        self.sampleRate = sampleRate
        self.bufferSize = bufferSize
        self.emitIntervalMs = emitIntervalMs
        self.notificationTitle = notificationTitle
        self.notificationText = notificationText
        self.websocketUrl = websocketUrl
        self.websocketHeaders = websocketHeaders
        self.websocketReconnectConfig = websocketReconnectConfig
        self.websocketBufferConfig = websocketBufferConfig
        
        self.samplesPerEmit = (sampleRate * emitIntervalMs) / 1000
        
        let wsUrl = websocketUrl != nil ? websocketUrl! : "none"
        print("[\(Self.TAG)] Configured with sampleRate=\(sampleRate), bufferSize=\(bufferSize), emitInterval=\(emitIntervalMs), websocketUrl=\(wsUrl)")
    }
    
    func setAudioDataCallback(_ callback: @escaping ([Int16]) -> Void) {
        audioDataCallback = callback
    }
    
    func setWebSocketMessageCallback(_ callback: @escaping (String) -> Void) {
        websocketMessageCallback = callback
    }
    
    func setWebSocketStateCallback(_ callback: @escaping (String) -> Void) {
        websocketStateCallback = callback
    }
    
    func startRecording() throws {
        guard !isRecording else {
            print("[\(Self.TAG)] Already recording")
            return
        }
        
        // Request notification permission and show notification
        requestNotificationPermission()
        showRecordingNotification()
        
        // Start background task
        startBackgroundTask()
        
        // Configure audio session
        try configureAudioSession()
        
        // Connect WebSocket first (in parallel with recording setup)
        if let url = websocketUrl {
            connectWebSocket(url: url)
        }
        
        // Start audio recording
        try startAudioEngine()
        
        isRecording = true
        print("[\(Self.TAG)] Recording started")
    }
    
    func stopRecording() {
        guard isRecording else {
            print("[\(Self.TAG)] Not recording")
            return
        }
        
        isRecording = false
        
        // Stop audio engine
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine = nil
        
        // Disconnect WebSocket
        disconnectWebSocket()
        
        // Remove notification
        removeRecordingNotification()
        
        // End background task
        endBackgroundTask()
        
        // Clear accumulated samples
        accumulatedSamples.removeAll()
        
        print("[\(Self.TAG)] Recording stopped")
    }
    
    private func configureAudioSession() throws {
        let audioSession = AVAudioSession.sharedInstance()
        
        try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.mixWithOthers, .allowBluetooth])
        try audioSession.setActive(true)
        
        print("[\(Self.TAG)] Audio session configured")
    }
    
    private func startAudioEngine() throws {
        audioEngine = AVAudioEngine()
        
        guard let audioEngine = audioEngine else {
            throw NSError(domain: "AudioRecorderService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to create audio engine"])
        }
        
        let inputNode = audioEngine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)
        
        // Use the hardware format for the tap (required by iOS)
        // We'll resample in processAudioBuffer if needed
        print("[\(Self.TAG)] Hardware format: \(inputFormat)")
        
        // Install tap on input node with hardware format
        inputNode.installTap(onBus: 0, bufferSize: AVAudioFrameCount(bufferSize), format: inputFormat) { [weak self] (buffer, time) in
            self?.processAudioBuffer(buffer, hwSampleRate: inputFormat.sampleRate)
        }
        
        try audioEngine.start()
        
        print("[\(Self.TAG)] Audio engine started with hardware sample rate: \(inputFormat.sampleRate), target sample rate: \(sampleRate), buffer size: \(bufferSize)")
    }
    
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, hwSampleRate: Double) {
        guard let channelData = buffer.floatChannelData?[0] else {
            return
        }
        
        let frameLength = Int(buffer.frameLength)
        
        // If hardware sample rate matches target, no resampling needed
        if Int(hwSampleRate) == sampleRate {
            // Convert Float32 to Int16 directly
            for i in 0..<frameLength {
                let sample = channelData[i]
                let clampedSample = max(-1.0, min(1.0, sample))
                let int16Sample = Int16(clampedSample * Float(Int16.max))
                accumulatedSamples.append(int16Sample)
            }
        } else {
            // Resample: simple decimation/interpolation
            let ratio = hwSampleRate / Double(sampleRate)
            let outputSamples = Int(Double(frameLength) / ratio)
            
            for i in 0..<outputSamples {
                let srcIndex = Int(Double(i) * ratio)
                if srcIndex < frameLength {
                    let sample = channelData[srcIndex]
                    let clampedSample = max(-1.0, min(1.0, sample))
                    let int16Sample = Int16(clampedSample * Float(Int16.max))
                    accumulatedSamples.append(int16Sample)
                }
            }
        }
        
        // Emit when we have enough samples
        while accumulatedSamples.count >= samplesPerEmit {
            let emitData = Array(accumulatedSamples.prefix(samplesPerEmit))
            
            // Send to JS callback
            audioDataCallback?(emitData)
            
            // Send to WebSocket (will buffer if disconnected)
            if let wsManager = webSocketManager {
                let byteArray = int16ArrayToData(emitData)
                _ = wsManager.sendBinary(data: byteArray)
            }
            
            // Remove emitted samples
            accumulatedSamples.removeFirst(samplesPerEmit)
        }
    }
    
    private func int16ArrayToData(_ samples: [Int16]) -> Data {
        var data = Data(capacity: samples.count * 2)
        for sample in samples {
            var littleEndianSample = sample.littleEndian
            withUnsafeBytes(of: &littleEndianSample) { bytes in
                data.append(contentsOf: bytes)
            }
        }
        return data
    }
    
    private func connectWebSocket(url: String) {
        let headers = websocketHeaders != nil ? websocketHeaders! : [:]
        let config = websocketReconnectConfig != nil ? websocketReconnectConfig! : ReconnectConfig()
        let bufferCfg = websocketBufferConfig != nil ? websocketBufferConfig! : BufferConfig()
        
        webSocketManager = WebSocketManager()
        webSocketManager?.setMessageCallback { [weak self] message in
            self?.websocketMessageCallback?(message)
        }
        webSocketManager?.setStateCallback { [weak self] state in
            self?.websocketStateCallback?(state)
        }
        webSocketManager?.connect(url: url, headers: headers, config: config, bufferCfg: bufferCfg)
        
        print("[\(Self.TAG)] WebSocket connection initiated to: \(url) (buffering: \(bufferCfg.enabled))")
    }
    
    private func disconnectWebSocket() {
        webSocketManager?.disconnect()
        webSocketManager = nil
        print("[\(Self.TAG)] WebSocket disconnected")
    }
    
    private func startBackgroundTask() {
        backgroundTaskID = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
    }
    
    private func endBackgroundTask() {
        if backgroundTaskID != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTaskID)
            backgroundTaskID = .invalid
        }
    }
    
    private func requestNotificationPermission() {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            if let error = error {
                print("[\(Self.TAG)] Error requesting notification permission: \(error.localizedDescription)")
            }
        }
    }
    
    private func showRecordingNotification() {
        let content = UNMutableNotificationContent()
        content.title = notificationTitle
        content.body = notificationText
        content.sound = nil
        
        let request = UNNotificationRequest(
            identifier: "audio_recording_notification",
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("[\(Self.TAG)] Error showing notification: \(error.localizedDescription)")
            }
        }
    }
    
    private func removeRecordingNotification() {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["audio_recording_notification"])
    }
    
    func cleanup() {
        stopRecording()
        webSocketManager?.cleanup()
        webSocketManager = nil
    }
}

