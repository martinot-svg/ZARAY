# ZARAY — WinBox 4.5 static reconstruction and functional replication

**Evidence date:** 2026-11-10. **Scope:** one user-supplied `WinBox(3).exe` analyzed *statically* in an isolated file-reading workflow, without execution. The new upload is SHA-256 identical to the previous `WinBox(2).exe`.

- SHA-256: `4ec6afb7b308633fd2d9e2354fbb164d727f3552216fd61a19518dbc1aaf6861`
- Size: 55,992,688 bytes; Windows PE32+, AMD64, GUI subsystem; PE COFF build timestamp 2026-11-03 11:27:41 UTC (a metadata value, not proof of release).
- The **VERSION** resource identifies **WinBox 4.5**, SIA “Mikrotikls”; Windows resource manifest identifies `Mikrotik.WinBox`.
- 13 PE sections: `.text`, `.data`, `.rodata`, `.rdata`, `.qtmimedatabase`, `.pdata`, `.xdata`, `.bss`, `.idata`, `.CRT`, `.tls`, `.rsrc`, `.reloc`. The `.qtmimedatabase` section strongly supports bundled Qt dependencies.
- Native PE resources observed: nine icons, one icon group, one VERSION resource, one MANIFEST resource. Qt QML resources are separate from those Win32 native resources; absence of ordinary Win32 dialogs does not prove absence of user interface forms.
- DLL imports include `WS2_32.dll`, `WINHTTP.dll`, `CRYPT32.dll`, `bcrypt.dll`, `ncrypt.dll`, `d3d11.dll`, `DWrite.dll`, and many Windows API libraries. **Imports indicate capabilities, not a verified protocol trace or proof of one call path.**
- Build has `HIGH_ENTROPY_VA`, `DYNAMIC_BASE` and `NX_COMPAT` PE flags. This is not an independent vulnerability or signature assessment.

## Direct binary evidence: UI and architecture

The compiled executable contains Qt Quick/QML imports and generated symbols matching `QmlCacheGeneratedCode...WinBoxQml...qml` for **65 distinct named components**. Examples:

| Observable identifier | Supported reconstruction | Confidence |
|---|---|---|
| `LoginView`, `ReconnectView`, `ConnectedView`, `WinBoxConnection` | Connection/reconnection and post-login views | Confirmed names; flows need dynamic verification |
| `WLeftMenu`, `WRightMenuGroup`, `MdiFactory`, `panels_MdiWindow` | Navigation/menu model and multi-document windows | Confirmed names; exact behavior unverified |
| `WTable`, `WTableFilter`, `WFindBar`, `WComboBox2` | Tabular data, search/filter, selectable values | Confirmed names; semantics only inferred |
| `panels_ObjectViewPanel`, `panels_QueryPanel`, `panels_ActionPanel`, `panels_SetupPanel` | Object details, queries, actions, configuration panes | Confirmed names; actions unverified |
| `WToolbarTools`, `WEventsList`, `WGraph`, `WBarGraph` | Toolbars, events, graphs | Confirmed names; specific data channels unverified |
| `Topology`, `TopologyNode`, `TopologyLink`, `TopologyNodesModel`, `TopologyLinksModel` | Network topology representation with nodes/links | Confirmed names and model strings; origin of links unverified |
| `TerminalView`, `TerminalViewModel`, `WFileTransfer` | Terminal and file transfer UI | Confirmed names; authentication/permissions unverified |
| `SettingsPopup`, `ShortcutsPopup`, `WDialog`, `WProgressBar` | Settings, keyboard shortcuts, dialogs, operation progress | Confirmed names; exact interactions unverified |

The strings `WBOXSESS,INFO: upgrade check use subscribe`, `WBOXSESS,INFO: upgrade check use polling`, `WinBoxImpl,INFO: tx keepalive msg`, `DISCOVERY,ERR parsing MNDP`, `ROMON,NEIGHS,ERR: failed start discovery`, `MACCON socket state changed`, and terminal `mepty` messages indicate separately instrumented components for session lifecycle, discovery, MAC transport, RoMON and terminal sessions. A string is **not proof** of a successful RouterOS operation, detailed message format or stable public protocol.

Names consistent with `WinBoxConnection::downloadSkinFile` and `WinBoxConnection::downoadIndexFile`, plus `WBOXSESS,ERR: parsing service files`, suggest that some definitions are fetched from a connected RouterOS device. The exact transfer format, validation, and authorization mechanism have **not** been recovered or executed. ZARAY must never download or execute untrusted interface code from a router merely to imitate this behavior.

## Limits of this reverse-engineering pass

- No original C++/QML source tree, build project, or headers have been reconstructed from this executable.
- No Windows/RouterOS runtime or packet capture was attached. No real login, authenticated control action, packet dump, binary decryption, or simulated WinBox protocol transcript was performed.
- No arbitrary disassembly of authentication/security routines was used as a basis for ZARAY authentication. There is no attempt to port private protocol details, code, artwork or cryptographic secrets.
- A compiled QML symbol name is evidence of a component in the binary, not proof of an end-user feature or of its availability on every RouterOS model and version.
- Official RouterOS REST and API references are used **as independent, documented interoperability interfaces**, not as substitutes for WinBox as the UX/functional reference.

## Functional replication inside ZARAY (PR #130)

A WinBox-inspired workflow has been implemented **independently** on the existing company- and router-scoped inventory endpoint:

1. Select company and router (existing ZARAY context, not replaced).
2. Select an observed source (interfaces, VLAN, ARP, DHCP, Hotspot/PPP, routes etc.; existing API and PR #130 extensions).
3. Search the **current server-paginated 50-row page** for name, IP, MAC, identity and source. Search is case- and accent-insensitive; does not pretend to search other pages.
4. Sort that page by name, IP, observation date or state, with reversible order; input data is never mutated by sorting.
5. Select “Propriétés” to inspect only the **already approved sanitized fields** (kind, identity, IP, MAC, observed status and timestamp). No raw RouterOS object or secret is fetched.
6. For sufficiently fresh Hotspot/PPPoE observations, retain the existing guarded “Déconnecter” operation (confirmation, reason, role, company/router ownership and agent acknowledgement). A stale/offline router cannot enable the control.
7. Preserve the ZARAY visual shell; do not copy Qt artwork, proprietary QML or WinBox layout code.

Implementation:
- `src/lib/network-inventory-workbench.ts`: filtering, stable sorting, timestamp validity guard.
- `src/app/gestion-reseau/page.tsx`: actual interactive search/sort and inspect-properties UI integrated into the current inventory view.
- `tests/network-winbox-workbench.test.mjs`: data-flow, filtering, sorting, freshness and integration assertions, run by CI.
- Existing PR #130 files, Supabase RLS, read-only collector, Preview environment restrictions and session command backend remain in place.

## Functional gap and evidence matrix

| WinBox capability/class | ZARAY implementation | Validation limit |
|---|---|---|
| Login, session and reconnect | Paired RouterOS agent + app auth; device session tracking | No WinBox protocol implementation nor physical router comparison |
| Windowed menus | ZARAY navigation plus integrated inventory panel | Functional counterpart; not MDI cloned |
| Table search, filter, properties | **Implemented in this PR** in Gestion réseau | CI tests are not an authenticated browser/hardware test |
| Interfaces/IP/ARP/VLAN/DHCP | Sanitized, paginated read-only inventory | Node connector + RouterOS REST compatibility required |
| Hotspot/PPP users and sessions | Existing account flow, observed sessions, queued disconnect | Real RouterOS hardware acknowledgement not yet proven |
| Firewall/NAT/routes/queues | Summary reads in the connector | Write actions deliberately disabled |
| Wi-Fi/CAPsMAN | Wi-Fi station samples in two API families | CAPsMAN configuration unsupported |
| Topology nodes/links | Identifiers found in WinBox only | Missing trustworthy link evidence and implementation in ZARAY |
| Terminal, file transfer and unrestricted config | WinBox component names observed | Deliberately not enabled in multi-tenant web app |
| Backup/restore, diagnostics and VPN | Planned gap | Not implemented by this tranche |

## Security and production readiness

- Preserve server-side tenant authorization and read-only views; **do not** connect a browser directly to RouterOS management services.
- Never store router passwords in client code, public database tables, browser local storage, or logs. The local connector owns its own credential.
- RouterOS REST support varies by version/package; unavailable sources must report unavailable/partial rather than falsely empty.
- Avoid time-sensitive changes in Vercel functions; local agent remains responsible for networking.
- Migration `20261109121500_mikrotik_administration_inventory.sql` remains additive and unapplied in production.
- Do not merge the PR or enable network writes without verifying a dedicated lab, running GitHub workflows and then CHR/physical RouterOS session tests.
- Verification hierarchy: **source exists → unit test → CI → authenticated Preview → CHR/real router → production**. No category is implicitly promoted to the next.

## References

- MikroTik official WinBox downloads and release notes: https://mikrotik.com/download/winbox
- MikroTik RouterOS REST: https://manual.mikrotik.com/docs/developer-guides/rest-api/
- MikroTik RouterOS API: https://manual.mikrotik.com/docs/developer-guides/api/
