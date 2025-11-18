import {
  ConfigPlugin,
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig
} from '@expo/config-plugins'

export type AudioRecorderPluginProps = {
  /**
   * iOS microphone permission message shown to users
   * @default 'This app needs access to the microphone to record audio'
   */
  iosMicrophonePermission?: string
  
  /**
   * Enable iOS background audio mode
   * @default true
   */
  iosBackgroundMode?: boolean
  
  /**
   * Android permissions to add (full permission names)
   * @default ['android.permission.RECORD_AUDIO', 'android.permission.INTERNET', 'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MICROPHONE']
   */
  androidPermissions?: string[]
  
  /**
   * Enable Android foreground service
   * @default true
   */
  androidForegroundService?: boolean
}

const withAudioRecorder: ConfigPlugin<AudioRecorderPluginProps | void> = (config, props) => {
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
  config = withInfoPlist(config, (config) => {
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
    config = withAndroidManifest(config, (config) => {
      // Add permissions
      androidPermissions.forEach((permission) => {
        AndroidConfig.Permissions.addPermission(config.modResults, permission)
      })

      return config
    })
  }

  return config
}

export default withAudioRecorder

