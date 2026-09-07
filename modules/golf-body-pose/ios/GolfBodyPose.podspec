Pod::Spec.new do |s|
  s.name           = 'GolfBodyPose'
  s.version        = '0.1.0'
  s.summary        = 'MediaPipe Pose Landmarker integration for Golf Body OS'
  s.description    = 'Local Expo Module wrapping MediaPipe PoseLandmarker for iOS. Provides IMAGE and VIDEO mode pose detection with 33 landmarks.'
  s.homepage       = 'https://github.com/golfbodyos'
  s.license        = 'MIT'
  s.author         = 'Golf Body OS'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.source_files   = '**/*.swift'
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksVision', '~> 0.10'
end
