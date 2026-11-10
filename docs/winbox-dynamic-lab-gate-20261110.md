# WinBox 4.5 — Dynamic validation gate (2026-11-10)

## Execution status (do not overstate)
- SHA-256 of the user-provided `WinBox(3).exe`: `4ec6afb7b308633fd2d9e2354fbb164d727f3552216fd61a19518dbc1aaf6861`.
- **Static analysis only** was completed previously. The current Linux worker has neither Wine, QEMU, KVM, Windows Sandbox nor a physical RouterOS test router.
- **No dynamic WinBox session, network packet capture, CHR login, Safe Mode test, or WinBox/ZARAY parity run has been observed.**
- This kit defines a repeatable Windows execution baseline; source files committed to GitHub are not runtime evidence.

## Stage A: offline Windows Sandbox baseline
Requirements: licensed Windows 11 Pro/Enterprise/Education with Windows Sandbox enabled and sufficient virtualization support, separate lab machine, never a production host.

1. Create one input folder containing a locally obtained copy of the user-provided `WinBox(3).exe` and `tools/winbox-lab/WinBox-offline.ps1`.
2. Create a *new, empty* folder dedicated exclusively to lab evidence. It must not contain production documents, credentials or source repositories.
3. Copy `tools/winbox-lab/WinBox-offline.wsb.template` to a `.wsb` file. Replace the two absolute path placeholders with the input and evidence folders. Do not change `<Networking>Disable</Networking>`, `<VGpu>Disable</VGpu>`, or `<ClipboardRedirection>Disable</ClipboardRedirection>`.
4. Launch the `.wsb` on a machine that provides Windows Sandbox. The launch command verifies the executable's SHA-256, executes the GUI without networking and captures bounded process snapshots for 90 seconds.
5. Exit Windows Sandbox after reviewing the results. `environment.json` and `process-snapshots.jsonl` contain the sampled process status, loaded module *names*, basic resource usage and window title. **They do not contain a network trace, source code, Qt source files, decrypted symbols, or an authenticated RouterOS session.**

**Isolation warning:** the evidence directory is the only writable mapped host folder. Treat its contents as untrusted until inspected. Do not map a home directory or a Git workspace with write access. Windows Sandbox is a baseline only; it cannot substitute for an isolated private network CHR test.

## Stage B: authorized RouterOS functional comparison — NOT RUN
Use a *separate* Windows virtual machine on a fully private lab-only virtual network and a disposable MikroTik CHR. Windows Sandbox's default networking can expose the host's internal network and must not be used for this test. Do not route the CHR lab network to customer routers or production networks.

Record for each scenario:
- WinBox 4.5 version/hash, RouterOS build, packages, relevant hardware/license availability, permitted user role, session model, test data and timestamps.
- WinBox actions observed with sanitized screenshots/screens and outcome (success/error); compare the corresponding ZARAY view/action using the SAME RouterOS CHR test state.
- RouterOS state before and after using the official API/CLI. For writes, set a reversible lab snapshot first and verify rollback independently of ZARAY and WinBox.
- Network captures limited to the lab virtual switch, sanitized before disclosure (authentication data, tokens, full config dumps and Wi-Fi secrets must never be shared).
- Modules for baseline: launch/reconnect, neighbor discovery, interface read, VLAN/IP/DHCP read, search and details, multiple views, safe disconnect with lab client, recovery after an interrupted connection, and Safe Mode. Tests requiring physical radio interfaces or CAPsMAN hardware are explicitly excluded from CHR-only validation.

## Stage C: ZARAY functional behavior actually committed to PR #130

**New P1 action: request immediate read-only inventory collection** rather than merely refreshing a cached Supabase view.

- The user selects a company, router and source in Gestion réseau, then selects **Demander une nouvelle collecte RouterOS** (admin/owner, active local connector only).
- `POST /api/network/inventory/refresh` verifies tenant, router, agent type and current contact. Preview environments must pass the established isolated-lab guard.
- A single atomic function `public.request_network_inventory_refresh` rechecks authenticated tenant ownership and admin role, serializes per-router requests with a row lock, and limits to one request per router per minute. The browser has **no direct write grants** on the queue table.
- The already paired local Node connector retrieves at most two pending refresh requests at a poll and re-runs the selected RouterOS source(s) through the same bounded REST projection and `/api/network/agent` sync code.
- A refresh is acknowledged only if a fresh source snapshot exists for the matching company, router, kind, and request timestamp. Unavailable sources remain pending until expiry and are never reported as successful.
- The legacy native RouterOS script remains supported, but on-demand reads require the Node local connector; the browser does not connect directly to RouterOS and no persistent Vercel process is added.
- The UI retains **Relire les données collectées** to distinguish cached data retrieval from an actual new RouterOS request.

**Validation levels:** checked source code, Node behavior mocks, and isolated PostgreSQL RLS tests are separate from authenticated preview testing, CHR testing, physical MikroTik testing, and production deployment.

## Review gates before production
- Confirm all five CI workflows on the exact PR head commit and inspect the PostgreSQL and Node test logs, not just status badges.
- Apply and verify the additive PR migration *only* on an isolated Supabase lab and preview tied exclusively to it.
- Demonstrate offline Windows execution separately from CHR tests. CHR or physical tests are essential to claim an actual RouterOS result.
- Do not merge PR #130 or apply the migration in production until the tests demonstrate the permission and lifecycle assumptions.

References: https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file ; https://manual.mikrotik.com/docs/developer-guides/rest-api/
