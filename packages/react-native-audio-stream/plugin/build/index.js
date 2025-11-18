'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const config_plugins_1 = require('@expo/config-plugins')

const withAudioRecorder = (config, props) => {
  const {
    iosMicrophonePermission = 'This app needs access to the microphone to record audio',
    iosBackgroundMode = true,
    androidPermissions = [
      'android.permission.RECORD_AUDIO',
      'android.permission.INTERNET',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE'
    ],
    androidForegroundService = true
  } = props || {}

  // iOS Configuration
  config = (0, config_plugins_1.withInfoPlist)(config, (config) => {
    // Set microphone permission description
    config.modResults.NSMicrophoneUsageDescription =
      config.modResults.NSMicrophoneUsageDescription || iosMicrophonePermission

    // Add background audio mode if enabled
    if (iosBackgroundMode) {
      const existingModes = config.modResults.UIBackgroundModes || []
      if (!existingModes.includes('audio')) {
        config.modResults.UIBackgroundModes = [...existingModes, 'audio']
      }
    }

    return config
  })

  // Android Configuration
  if (androidForegroundService || androidPermissions.length > 0) {
    config = (0, config_plugins_1.withAndroidManifest)(config, (config) => {
      // Add permissions
      androidPermissions.forEach((permission) => {
        config_plugins_1.AndroidConfig.Permissions.addPermission(config.modResults, permission)
      })

      return config
    })
  }

  return config
}

exports.default = withAudioRecorder

