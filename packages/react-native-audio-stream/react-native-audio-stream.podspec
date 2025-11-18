require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'react-native-audio-stream'
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = package['license']
  s.authors      = package['author']
  s.homepage     = 'https://github.com/everywai/react-native-audio-stream'
  s.platforms    = { :ios => '13.0' }
  s.source       = { :git => 'https://github.com/everywai/react-native-audio-stream.git', :tag => "v#{s.version}" }
  
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  
  s.dependency 'React-Core'
  
  # Enable Turbo Module
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_OBJC_INTERFACE_HEADER_NAME' => 'ReactNativeAudioStream-Swift.h'
  }
  
  install_modules_dependencies(s)
end


