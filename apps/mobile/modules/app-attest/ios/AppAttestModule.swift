import CryptoKit
import DeviceCheck
import ExpoModulesCore

/// Apple App Attest for the API's device attestation (docs/hosting.md, Phase 16).
/// Not supported in the simulator: `isSupported` is false there.
public class AppAttestModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppAttest")

    Function("isSupported") { () -> Bool in
      DCAppAttestService.shared.isSupported
    }

    /// A new key in the Secure Enclave; resolves with its key id (base64).
    AsyncFunction("generateKey") { (promise: Promise) in
      DCAppAttestService.shared.generateKey { keyId, error in
        if let keyId {
          promise.resolve(keyId)
        } else {
          promise.reject("ERR_APP_ATTEST_KEY", error?.localizedDescription ?? "No key id")
        }
      }
    }

    /// Asks Apple to attest the key. The client data hash is SHA-256 of the API's challenge, as
    /// the server computes it. Resolves with the attestation object (base64).
    AsyncFunction("attestKey") { (keyId: String, challenge: String, promise: Promise) in
      let clientDataHash = Data(SHA256.hash(data: Data(challenge.utf8)))
      DCAppAttestService.shared.attestKey(keyId, clientDataHash: clientDataHash) { attestation, error in
        if let attestation {
          promise.resolve(attestation.base64EncodedString())
        } else {
          promise.reject("ERR_APP_ATTEST_ATTEST", error?.localizedDescription ?? "No attestation")
        }
      }
    }
  }
}
