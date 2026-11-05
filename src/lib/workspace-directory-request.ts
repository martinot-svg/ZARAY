/** Share only simultaneous /api/sites reads across mounted workspace modules.
 * Never retain an authorized response once the request settles: changing account,
 * membership or site must always be checked by the server again.
 */
let inFlight: Promise<Response> | null = null;

export function fetchWorkspaceDirectory(): Promise<Response> {
  if (!inFlight) {
    const request = fetch('/api/sites', { cache: 'no-store' });
    inFlight = request;
    void request.then(
      () => { if (inFlight === request) inFlight = null; },
      () => { if (inFlight === request) inFlight = null; },
    );
  }
  // Each caller consumes an independent stream while sharing one network request.
  return inFlight.then(response => response.clone());
}
