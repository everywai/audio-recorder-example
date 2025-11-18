import Foundation

struct ReconnectConfig {
    let initialDelayMs: Int64
    let maxDelayMs: Int64
    let delayMultiplier: Double
    
    init(initialDelayMs: Int64 = 1000, maxDelayMs: Int64 = 30000, delayMultiplier: Double = 2.0) {
        self.initialDelayMs = initialDelayMs
        self.maxDelayMs = maxDelayMs
        self.delayMultiplier = delayMultiplier
    }
}

struct BufferConfig {
    let enabled: Bool
    let maxChunks: Int
    let catchupDelayMs: Int64
    
    init(enabled: Bool = true, maxChunks: Int = 50, catchupDelayMs: Int64 = 10) {
        self.enabled = enabled
        self.maxChunks = maxChunks
        self.catchupDelayMs = catchupDelayMs
    }
}

class WebSocketManager: NSObject {
    private static let TAG = "WebSocketManager"
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var reconnectConfig = ReconnectConfig()
    private var bufferConfig = BufferConfig()
    private var currentUrl: String?
    private var currentHeaders: [String: String]?
    
    private var messageCallback: ((String) -> Void)?
    private var stateCallback: ((String) -> Void)?
    
    private var isConnected = false
    private var shouldReconnect = false
    private var currentReconnectDelay: Int64 = 0
    private var reconnectWorkItem: DispatchWorkItem?
    private var connectionTimeoutWorkItem: DispatchWorkItem?
    
    private var chunkBuffer: [Data] = []
    private var isCatchingUp = false
    private let bufferQueue = DispatchQueue(label: "com.audiostream.websocket.buffer")
    
    func connect(url: String, headers: [String: String] = [:], config: ReconnectConfig = ReconnectConfig(), bufferCfg: BufferConfig = BufferConfig()) {
        currentUrl = url
        currentHeaders = headers
        reconnectConfig = config
        bufferConfig = bufferCfg
        currentReconnectDelay = config.initialDelayMs
        shouldReconnect = true
        
        print("[\(Self.TAG)] WebSocket configured")
        performConnect()
    }
    
    private func performConnect() {
        guard let urlString = currentUrl, let url = URL(string: urlString) else {
            print("[\(Self.TAG)] Invalid URL")
            return
        }
        
        print("[\(Self.TAG)] Attempting to connect to WebSocket")
        
        if let existingTask = webSocketTask {
            existingTask.cancel(with: .goingAway, reason: nil)
            webSocketTask = nil
        }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        
        if let headers = currentHeaders {
            for (key, value) in headers {
                request.setValue(value, forHTTPHeaderField: key)
            }
        }
        
        if urlSession == nil {
            let configuration = URLSessionConfiguration.default
            configuration.timeoutIntervalForRequest = 10
            configuration.timeoutIntervalForResource = 0
            urlSession = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        }
        
        webSocketTask = urlSession?.webSocketTask(with: request)
        webSocketTask?.resume()
        receiveMessage()
        
        let timeoutWorkItem = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            if !self.isConnected && self.shouldReconnect {
                print("[\(Self.TAG)] Connection timeout")
                self.isConnected = false
                self.notifyStateChange(state: "disconnected")
                self.scheduleReconnect()
            }
        }
        connectionTimeoutWorkItem = timeoutWorkItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 15.0, execute: timeoutWorkItem)
    }
    
    func disconnect() {
        print("[\(Self.TAG)] Disconnecting WebSocket")
        shouldReconnect = false
        cancelReconnect()
        
        connectionTimeoutWorkItem?.cancel()
        connectionTimeoutWorkItem = nil
        
        webSocketTask?.cancel(with: .goingAway, reason: "Client disconnect".data(using: .utf8))
        webSocketTask = nil
        isConnected = false
        notifyStateChange(state: "disconnected")
    }
    
    func sendBinary(data: Data) -> Bool {
        if isConnected && !isCatchingUp && webSocketTask != nil {
            let message = URLSessionWebSocketTask.Message.data(data)
            webSocketTask?.send(message) { error in
                if let error = error {
                    print("[\(Self.TAG)] Error sending binary data: \(error.localizedDescription)")
                }
            }
            return true
        }
        
        if bufferConfig.enabled {
            bufferQueue.sync {
                if chunkBuffer.count >= bufferConfig.maxChunks {
                    chunkBuffer.removeFirst()
                }
                chunkBuffer.append(data)
            }
            return true
        }
        
        return false
    }
    
    func getIsConnected() -> Bool {
        return isConnected
    }
    
    private func startCatchup() {
        bufferQueue.async { [weak self] in
            guard let self = self else { return }
            
            if !self.bufferConfig.enabled || self.chunkBuffer.isEmpty {
                return
            }
            
            self.isCatchingUp = true
            print("[\(Self.TAG)] Starting catch-up: \(self.chunkBuffer.count) chunks")
            
            DispatchQueue.main.async {
                self.processCatchupQueue()
            }
        }
    }
    
    private func processCatchupQueue() {
        var chunk: Data?
        
        bufferQueue.sync {
            if chunkBuffer.isEmpty {
                isCatchingUp = false
                print("[\(Self.TAG)] Catch-up complete")
                return
            }
            chunk = chunkBuffer.removeFirst()
        }
        
        guard let dataToSend = chunk else {
            return
        }
        
        let message = URLSessionWebSocketTask.Message.data(dataToSend)
        webSocketTask?.send(message) { [weak self] error in
            guard let self = self else { return }
            
            if let error = error {
                print("[\(Self.TAG)] Failed to send buffered chunk: \(error.localizedDescription)")
                self.bufferQueue.sync {
                    self.chunkBuffer.insert(dataToSend, at: 0)
                    self.isCatchingUp = false
                }
                return
            }
            
            print("[\(Self.TAG)] Sent buffered chunk (\(self.chunkBuffer.count) remaining)")
            
            self.bufferQueue.sync {
                if !self.chunkBuffer.isEmpty {
                    DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(Int(self.bufferConfig.catchupDelayMs))) {
                        self.processCatchupQueue()
                    }
                } else {
                    self.isCatchingUp = false
                }
            }
        }
    }
    
    func setMessageCallback(_ callback: @escaping (String) -> Void) {
        messageCallback = callback
    }
    
    func setStateCallback(_ callback: @escaping (String) -> Void) {
        stateCallback = callback
    }
    
    private func scheduleReconnect() {
        guard shouldReconnect else {
            print("[\(Self.TAG)] Reconnection disabled")
            return
        }
        
        cancelReconnect()
        
        print("[\(Self.TAG)] Scheduling reconnect in \(currentReconnectDelay)ms")
        notifyStateChange(state: "reconnecting")
        
        let delaySeconds = Double(currentReconnectDelay) / 1000.0
        
        let workItem = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            guard self.shouldReconnect else { return }
            
            print("[\(Self.TAG)] Executing reconnect attempt")
            self.performConnect()
            
            let nextDelay = Int64(Double(self.currentReconnectDelay) * self.reconnectConfig.delayMultiplier)
            self.currentReconnectDelay = min(nextDelay, self.reconnectConfig.maxDelayMs)
        }
        
        reconnectWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + delaySeconds, execute: workItem)
    }
    
    private func cancelReconnect() {
        reconnectWorkItem?.cancel()
        reconnectWorkItem = nil
        connectionTimeoutWorkItem?.cancel()
        connectionTimeoutWorkItem = nil
    }
    
    private func notifyStateChange(state: String) {
        stateCallback?(state)
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.messageCallback?(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.messageCallback?(text)
                    }
                @unknown default:
                    break
                }
                self.receiveMessage()
                
            case .failure(let error):
                print("[\(Self.TAG)] Error receiving message: \(error.localizedDescription)")
                self.isConnected = false
                self.notifyStateChange(state: "disconnected")
                
                if self.shouldReconnect {
                    self.scheduleReconnect()
                }
            }
        }
    }
    
    func cleanup() {
        disconnect()
        urlSession?.invalidateAndCancel()
        urlSession = nil
    }
}

extension WebSocketManager: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        print("[\(Self.TAG)] WebSocket CONNECTED")
        isConnected = true
        currentReconnectDelay = reconnectConfig.initialDelayMs
        
        connectionTimeoutWorkItem?.cancel()
        connectionTimeoutWorkItem = nil
        
        notifyStateChange(state: "connected")
        startCatchup()
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        print("[\(Self.TAG)] [DISCONNECT] WebSocket closed - code: \(closeCode.rawValue), shouldReconnect: \(shouldReconnect)")
        
        isConnected = false
        notifyStateChange(state: "disconnected")
        
        if shouldReconnect {
            print("[\(Self.TAG)] [RECONNECT] Scheduling reconnection")
            scheduleReconnect()
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            print("[\(Self.TAG)] [ERROR] WebSocket error: \(error.localizedDescription)")
            isConnected = false
            notifyStateChange(state: "disconnected")
            
            if shouldReconnect {
                print("[\(Self.TAG)] [RECONNECT] Scheduling reconnection after error")
                scheduleReconnect()
            }
        }
    }
}
