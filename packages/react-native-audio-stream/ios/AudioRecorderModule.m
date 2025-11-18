#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(AudioRecorder, RCTEventEmitter)

RCT_EXTERN_METHOD(initialize:(double)sampleRate
                  bufferSize:(double)bufferSize
                  emitIntervalMs:(double)emitIntervalMs
                  notificationTitle:(NSString *)notificationTitle
                  notificationText:(NSString *)notificationText
                  websocketUrl:(NSString *)websocketUrl
                  websocketHeaders:(NSString *)websocketHeaders
                  websocketReconnectConfig:(NSString *)websocketReconnectConfig
                  websocketBufferConfig:(NSString *)websocketBufferConfig
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startRecording:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopRecording:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cleanup:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(addListener:(NSString *)eventName)

RCT_EXTERN_METHOD(removeListeners:(double)count)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end

