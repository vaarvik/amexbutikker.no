import UIKit

/// Opens `amexbutikker://paid` with the given values, the link the payment actions share.
enum PaymentLink {
  @MainActor
  static func open(_ values: KeyValuePairs<String, String?>) async {
    let query = values
      .compactMap { key, value -> String? in
        guard let value, !value.isEmpty else { return nil }
        return "\(key)=\(encode(value))"
      }
      .joined(separator: "&")
    if let url = URL(string: "amexbutikker://paid?\(query)") {
      await UIApplication.shared.open(url)
    }
  }

  /// Percent-encodes everything but unreserved characters, so `&`, `+` and `=` in a merchant
  /// name stay part of the value.
  private static func encode(_ value: String) -> String {
    var allowed = CharacterSet.alphanumerics
    allowed.insert(charactersIn: "-._~")
    return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
  }
}
