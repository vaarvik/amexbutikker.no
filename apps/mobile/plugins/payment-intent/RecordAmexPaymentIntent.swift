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
    await PaymentLink.open(["merchant": merchant, "amount": amount])
    return .result()
  }
}
