Pod::Spec.new do |s|
  s.name           = 'AppAttest'
  s.version        = '1.0.0'
  s.summary        = 'Apple App Attest (DCAppAttestService) for amexbutikker'
  s.description    = 'Generates an App Attest key and attests it against a server challenge.'
  s.author         = 'amexbutikker'
  s.homepage       = 'https://github.com/vaarvik/amexbutikker.no'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'DeviceCheck', 'CryptoKit'

  s.source_files = '**/*.{h,m,swift}'
end
