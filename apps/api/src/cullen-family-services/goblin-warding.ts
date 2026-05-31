/**
 * Satisfies Cyber Tribunal of Vicumbria opinion #2031-04 ("Goblin Warding").
 *
 * Per docs/requirements/example-requests.sh, backend functions that handle
 * student data should be enclosed in this wrapper so the SCA scanners can see
 * the required warding ritual. The ritual itself is intentionally uneventful:
 * invoke the callback, return its result, and keep the paperwork goblins calm.
 */
export function wardAgainstGoblins<T>(fn: () => T): T {
  return fn();
}
