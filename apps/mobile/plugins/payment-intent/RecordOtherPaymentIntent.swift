import AppIntents

/// "Registrer annen betaling": run by a second "Transaksjon" automation for the user's other
/// cards. It opens `amexbutikker://paid?merchant=…&card=other`, and the app asks "Tar de Amex?"
/// instead of saving anything. Paying with another card says nothing about Amex by itself.
@available(iOS 16.0, *)
struct RecordOtherPaymentIntent: AppIntent {
  static var title: LocalizedStringResource = "Registrer annen betaling"
  static var description = IntentDescription(
    "Åpner Tar de Amex? og spør om stedet tar Amex. Beløpet lagres ikke."
  )
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Forhandler")
  var merchant: String

  static var parameterSummary: some ParameterSummary {
    Summary("Registrer annen betaling hos \(\.$merchant)")
  }

  @MainActor
  func perform() async throws -> some IntentResult {
    await PaymentLink.open(["merchant": merchant, "card": "other"])
    return .result()
  }
}
