#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

NS_ASSUME_NONNULL_BEGIN

@protocol NativeAudioRecorderSpec <NSObject>

- (void)initialize:(double)sampleRate
        bufferSize:(double)bufferSize
    emitIntervalMs:(double)emitIntervalMs
 notificationTitle:(NSString * _Nullable)notificationTitle
  notificationText:(NSString * _Nullable)notificationText
      websocketUrl:(NSString * _Nullable)websocketUrl
   websocketHeaders:(NSString * _Nullable)websocketHeaders
websocketReconnectConfig:(NSString * _Nullable)websocketReconnectConfig
websocketBufferConfig:(NSString * _Nullable)websocketBufferConfig
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject;

- (void)startRecordingWithResolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject;

- (void)stopRecordingWithResolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject;

- (void)cleanupWithResolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject;

- (void)addListener:(NSString *)eventName;

- (void)removeListeners:(double)count;

@end

NS_ASSUME_NONNULL_END


