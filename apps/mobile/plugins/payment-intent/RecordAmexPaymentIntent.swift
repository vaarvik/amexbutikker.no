import AppIntents
import UIKit

/// "Registrer Amex-betaling": the action a Shortcuts "Transaksjon" automation runs after an
/// Apple Pay payment. It opens the app on `amexbutikker://paid?merchant=…&amount=…`, the same
/// link the hand-built automation opens (docs/wallet-shortcut.md). The amount goes to Bonus on
/// the phone; only the merchant name and position reach the API.
@available(iOS 16.0, *)
struct RecordAmexPaymentIntent: AppIntent {
  static var title: LocalizedStringResource = "Registrer Amex-betaling"
  static var description = IntentDescription(
    "Åpner Tar de Amex? og lagrer at stedet tar Amex. Beløpet går til Bonus."
  )
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Forhandler")
  var merchant: String

  @Parameter(title: "Beløp")
  var amount: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Registrer betaling hos \(\.$merchant) på \(\.$amount)")
  }

  @MainActor
  func perform() async throws -> some IntentResult {
    var query = "merchant=\(Self.encode(merchant))"
    if let amount, !amount.isEmpty {
      query += "&amount=\(Self.encode(amount))"
    }
    if let url = URL(string: "amexbutikker://paid?\(query)") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }

  /// Percent-encodes everything but unreserved characters, so `&`, `+` and `=` in a merchant
  /// name stay part of the value.
  private static func encode(_ value: String) -> String {
    var allowed = CharacterSet.alphanumerics
    allowed.insert(charactersIn: "-._~")
    return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
  }
}
