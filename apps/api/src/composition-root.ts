/**
 * The only place in the API allowed to construct application and infrastructure classes.
 * Ports and use cases get wired here from phase 3 onwards.
 */
export class CompositionRoot {
  public async start(): Promise<void> {
    // Nothing to start yet: the HTTP adapter arrives in phase 4.
  }
}
