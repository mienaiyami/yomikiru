# App-wide keybinding refactor specification

Status: complete design proposal, using the explicit working assumptions below. This document describes the target system, not functionality already implemented or individually approved product choices.

Baseline: repository commit `f9a2205`, inspected on 2026-09-08.

## 1. Objective and completion boundary

Replace the app's distributed shortcut matching and dispatch with one command-based input module per renderer window. Make command identity, input configuration, active ownership, execution policy, and displayed bindings discoverable in predictable places.

The work covers the entire app: manga and book readers, home views, gallery details, selection, search, tab cycling, Settings, overlays, menus, native Electron actions, shortcut persistence, labels, documentation, and tests.

Completion requires removal of every superseded command dispatcher, formatter, registry, fallback keymap, obsolete global, and abandoned implementation. Compatibility code that reads old user data remains necessary; it must terminate at the new model and must never execute an old input system.

Native text editing and widget interaction remain supported. Every remaining application keyboard listener must have an explicit purpose in the final inventory. Keeping a widget's Enter/Space activation or text input behavior is not retaining a legacy shortcut engine.

### Confirmed requirements

- Users may assign the same binding to different commands. Duplicate assignment must not be rejected or require confirmation.
- The Shortcuts tab displays persistent warnings about conflicts. Warnings are calculated from current binding data and context rules, never saved to disk or stored as independent application state.
- Warnings remain visible for as long as their condition exists, including after reopening Settings or restarting; they disappear when the condition is resolved.
- Existing customization and reader complexity must be accounted for throughout migration.
- This specification and its plan must stand alone in the repository for later implementation and review.

### Working design assumptions

The proposal uses the recommendations below so it is implementable as a coherent design. These remain revisable product assumptions rather than recorded individual approvals. If a choice changes, update its dependent requirements and implementation stages together.

| ID | Decision | Recommended contract |
| --- | --- | --- |
| Q1 | Simultaneously applicable duplicate bindings | Execute one command; most specific active context wins, then a stable documented command order. |
| Q2 | Warning coverage | Warn on possible context overlap; show harmless reuse separately as information. |
| Q3 | Previously fixed app shortcuts | Make app commands configurable; protect native editing, Tab focus movement, and Escape dismissal. |
| Q4 | Binding capabilities | Multiple alternative single-step combinations, including modifiers and mouse back/forward; remove the current four-binding UI cap. Defer sequences, macros, user conditions, and profiles. |
| Q5 | Layout semantics | Preserve physical key positions; support Meta/Cmd distinctly. Defer character-based bindings. |
| Q6 | Pointer gestures | Keep existing gesture configuration; invoke the same command implementations for existing Ctrl+wheel, middle-click, and reader click actions where applicable. |
| Q7 | Windows | Preserve the Sync Settings preference; serialize shortcut writes in main; keep runtime ownership window-local. |
| Q8 | Editor | Searchable groups, context labels, live conflict details, recording/add/remove, per-command and full reset; defer standalone import/export. |

## 2. Current system and problems

The current catalog has 54 configurable command IDs in `src/renderer/utils/keybindings.ts`. It defines names and default key strings, but not execution ownership or contexts. Additional app actions remain hardcoded in component handlers and Electron menus.

| Concern | Current locations | Consequence |
| --- | --- | --- |
| Catalog, formatting, healing | `src/renderer/utils/keybindings.ts` | Physical-key strings mix persistence and display; Meta is omitted; healing drops unknown commands. |
| Persistence | `src/renderer/store/shortcuts.ts`, `src/renderer/utils/file.ts` | Renderer module-load reads/healing and reducer writes; refresh follows a different validation path. |
| App dispatch | `src/renderer/App.tsx` | Separate global keyboard/mouse switch and handwritten matching. |
| Reader dispatch | `manga/Reader.tsx`, `epub/EPubReader.tsx` under `src/renderer/features/reader/` | Independent switches, hold state, focus rules, wheel handling, and button-ref invocation. |
| Reusable hook | `src/renderer/hooks/useKeybindings.ts` | Each caller attaches listeners; ordering between callers is implicit. |
| Search, cycling, selection | `usePageSearchFocus.ts`, `useCycleShortcutGroups.ts`, `useSelectionShortcuts.ts` | Separate priorities, capture behavior, fixed selection keys, and visibility rules. |
| Widget command matching | `ListNavigator`, `Combobox`, `MenuList`, `ContextMenu`, `InputMultiSelect` | Configurable list commands are resolved again inside widgets. |
| Shortcut editor | `src/renderer/features/settings/components/Shortcuts.tsx` | Rejects all duplicate keys, enforces a binding cap, lists some fixed commands separately. |
| Electron actions | `src/electron/main.ts` | Native menu roles and independent accelerators can bypass renderer decisions. |

Observed hazards that the new contract addresses:

- Hidden Classic Bookmark and History lists can both register selection handling.
- `stopPropagation()` on one window listener does not establish an ordering contract among other listeners on that window.
- Reader hold state uses shared `window.app.keydown` / `keyRepeated`; unrelated releases can stop an action, and lost focus can leave ownership unclear.
- Reader handlers suppress some browser keys before proving a command was handled.
- Book Escape passes a guard but is formatted to an empty string before comparison with `"escape"`.
- Settings and reader overlays can each react to one Escape.
- The abandoned `useReaderKeybinding.ts` contains an entirely commented implementation.

These are source findings, not claims of completed fixes or runtime reproduction.

## 3. Domain and module interface

**Command:** a stable semantic operation, independent of the binding that invokes it and the mounted view that implements it.

**Binding:** serializable input data assigned to a command. Several bindings are alternatives for one command; a reused binding is not a macro.

**Context kind:** a documented environment in which commands apply, such as app, home, manga reader, book reader, selection, Settings, modal, or focused list widget.

**Owner:** one mounted instance implementing commands in a context. It has an identity, parent relationship, active/visible state, and current handlers. Owners are local to one renderer.

**Applicability:** whether an input belongs to a command in a context, considering the target, modality, and repeat rules.

**Availability:** whether the command can act on current state, such as a selected preset or deletable selection. This is separate from context overlap used for warnings.

**Input session:** ownership of a held trigger and its cancellation lifecycle. It is transient and never persisted.

The public interface should stay small:

| Interface responsibility | Contract |
| --- | --- |
| Register an owner | Register context and current command handlers; return cleanup that removes only that registration. |
| Execute a command | Resolve or explicitly target an owner, validate availability, invoke once, and return a typed outcome. |
| Read command presentation | Expose translated metadata, effective bindings, applicability descriptions, and derived diagnostics. |
| Edit the keymap | Submit a typed operation and reconcile a durable result or visible failure. |

A React hook adapts owner registration to mount, update, and unmount. Feature code supplies domain operations and active context; it does not format events, inspect saved keys, attach command listeners, or assign numeric global priorities.

Buttons and menu actions corresponding to commands call the same operation through this interface. A button may provide its explicit visible owner so focus changes caused by clicking do not accidentally retarget the operation. Unrelated UI callbacks need not become commands.

## 4. Catalog and configuration

### Command catalog

Define the typed catalog in a process-agnostic module. Each entry owns:

- Stable command ID and translated label/description keys.
- Discoverability group and Settings target ID.
- Default bindings, with platform distinctions where needed.
- Applicable context kinds and target policy.
- Invocation policy: one-shot, operating-system repeat, or held action.
- Deterministic tie order and whether the action is configurable or a protected interaction.

Retain existing persisted command IDs and existing `shortcut:<command>` navigation IDs unless there is a concrete semantic reason to change one. File organization can change without renaming user configuration. If a command is split, specify its mapping and preserve the prior binding on the appropriate replacement commands.

Generate the command ID type, editor rows, binding labels, Settings shortcut targets, and conflict metadata from this catalog. Feature adapters supply execution only. Avoid independent lists of command IDs for defaults, labels, reserved shortcuts, and search.

New configurable entries must cover currently fixed app actions under Q3: window creation/closing, reload/force reload, developer tools, help, and app-list select-all. Book find focus is already an implementation of `focusPageSearch`; preserve that identity rather than inventing a second find-focus command. Its Enter/Shift+Enter field interactions share find operations but remain field-owned. Protected Escape interactions remain visible in contextual help. Native edit roles remain native.

Settings currently reuses `nextChapter` / `prevChapter` bindings for tab movement. Separate this semantic overload into `settingsTabNext` / `settingsTabPrev`. Fresh defaults retain the existing Settings tab keys. Legacy migration copies the corresponding saved chapter bindings, including explicit unbinding, to these new Settings commands while preserving the reader commands. This keeps existing behavior without coupling future chapter and Settings-tab customization.

### Binding representation

Use a versioned schema with typed keyboard and pointer triggers. A keyboard trigger records its physical `code` and exact Ctrl, Alt, Shift, and Meta modifiers. A pointer trigger identifies a supported side button and modifiers. Human-readable strings are formatting output, not identity.

Normalize once at ingress. Preserve distinctions between top-row keys and numpad keys. Reject empty/unknown physical codes and modifier-only input. Treat composition, dead-key input, and AltGraph text entry as typing; do not reinterpret them as app combinations. Do not silently equate Ctrl and Meta.

The historical `key1`/`key2` format is an exception to the physical-key default: it stored `KeyboardEvent.key` characters, including case and shifted symbols. Preserve those imports as a typed migration-only logical-key trigger when conversion to a physical code cannot be proved equivalent. The recorder still creates physical bindings under Q5; this is compatibility data interpreted by the new resolver, not an old dispatcher or a new user-selectable layout mode. Keep the legacy trigger visible/removable/re-recordable in the editor. Diagnostics conservatively mark possible physical/logical overlap when the layout cannot establish exclusivity.

Existing mouse bindings ignore modifiers in the old formatter. Migration must preserve that meaning explicitly, for example with a compatibility `any modifiers` match policy. New recordings may use exact modifiers. Conflict calculation must understand both policies.

Defaults are immutable. Persist explicit per-command overrides separately from defaults: missing override means inherit; an empty override means deliberately unbound. Within one command, adding an identical binding is an idempotent no-op. Across commands, duplicates are accepted.

Do not add sequences, condition expression languages, macros, named profiles, or a command palette under the recommended scope. The reference design informed separation of commands, bindings, and owners; it does not require a registry framework for hypothetical features.

## 5. Deterministic dispatch

Install one managed keyboard ingress and lifecycle per renderer document. It owns keydown, keyup, composition, blur, and visibility cancellation. Pointer ingress shares the resolver where a configured trigger is involved. Book HTML currently lives in this document and requires no extra input transport.

For each event:

1. Apply the window's UI lock. Locked input cannot trigger commands or dismiss the lock.
2. If a binding recorder is active, deliver input exclusively to that recording session.
3. Identify the event path, native interaction needs, active modal path, focused widget, and eligible visible owners.
4. Resolve protected interactions, such as Escape dismissal and native form activation, before general bindings.
5. Normalize the trigger and retrieve candidates from the compiled keymap.
6. Apply context and target policies; select the most specific owner that claims this input.
7. Within that context, consider available commands in stable catalog tie order. Execute at most one. Deduplicate multiple bindings for the same command and owner.
8. Consume the event according to the decision and begin/update an input session if needed.

A context that claims an input but has no available action must not accidentally expose a lower layer's destructive command. Return a blocked/unavailable outcome. A context with no applicable binding can fall through only where its modality contract permits. Modal backgrounds never receive commands through this fallback.

Tie order is explicit catalog metadata, independent of translation, registration time, React render order, object iteration, and binding edit time. Duplicate execution never depends on which component mounted first.

Return outcomes such as handled, unavailable, blocked, unmatched, or failed. Native default prevention happens synchronously from the routing decision. Unmatched input retains normal browser behavior; handled keys must not also scroll, navigate history, or activate a button accidentally.

An asynchronous operation accepts input once. Failure reports through existing logging and UI feedback, without retrying another candidate. Pending destructive/dialog actions reject repeat invocation until the existing operation finishes.

### Context ownership

| Context | Ownership and behavior |
| --- | --- |
| App | The current window's shell; cross-screen commands still obey modal and target policies. |
| Home | Exactly the visible classic/gallery screen and active tab; hidden mounted tabs are ineligible. |
| Gallery details | The visible item's details/list; `dirUp` returns to the grid and restores search focus. |
| Reader | Exactly the active content type and reader instance; inactive mounted readers are ineligible. |
| Reader panel | Open panel and its focused descendants; panel dismissal does not also exit zen or close another layer. |
| Selection | The focused or last-interacted visible list within the active screen, with a deterministic screen default when needed. Never an arbitrary last-mounted list. |
| Search/list widget | The focused widget and its owned popup/list. It may claim navigation keys inside its own input. |
| Settings/modal/menu | The top interactive layer; nested layers have explicit parents. Escape resolves one interaction at a time. |
| UI lock/recorder | Exclusive input ownership; no underlying shortcuts run. |

Scope activity follows authoritative UI state and visibility. DOM connectivity/visibility is a secondary safeguard for stale registrations, not an expensive computed-style scan of every owner per keypress. Portal ownership follows the registration relationship, not only DOM ancestry.

Preserve page-search precedence (overlay, active reader, details, home fallback) through this context model. Remove the parallel numeric page-search priority registry after migrating its owners. Its visibility helper also serves Settings navigation; move that useful operation to an appropriate renderer util and migrate those callers before deleting the hook module.

### Native controls and Escape

Typing in input, textarea, editable content, or injected book forms must not invoke ordinary app character shortcuts. Native select navigation, checkbox/button Space and Enter, and editable selection/copy/paste remain usable. Use the event path and element semantics, including descendants of editable elements.

Context-owned commands can explicitly operate in their own inputs: list navigation, search results, and the existing tab-cycle combinations. A broad `allowInInputs` exception must not allow a newly recorded plain character to steal text. Policy must distinguish editing keys from deliberate command combinations.

Distinguish native select/text-control arrows from configurable navigation in custom list widgets. Preserve the former. Custom lists use their configured list commands and remain operable through standard focused-control activation and pointer interaction; do not secretly reinstall removed bindings as undocumented fallback shortcuts. Protected activation behavior must be described in contextual help and represented in diagnostics where it takes precedence.

Escape cancels recording, dismisses the innermost popup/modal, clears an active search when that widget owns the interaction, clears active selection, closes the current reader panel, or exits zen according to context. A single press performs at most one of these. Settings search retains its clear-query-then-close behavior. Existing native Tab traversal and focus locks remain intact.

## 6. Held input, repeat, and pointer integration

One-shot commands ignore operating-system repeat. Page stepping may opt into repeat. Held scrolling starts once and supplies an explicit release/cancel operation; animation remains in the reader scrolling implementation rather than Redux.

Track input sessions by physical trigger and owner. Releasing an unrelated key does not end another trigger's session. Releasing a required modifier cancels the matching chord session. Multiple equivalent held triggers for one action share one animation session until its final contributing trigger releases. If opposite scroll directions are held, the newest direction is active; releasing it resumes the still-held opposite direction without spawning another loop.

Cancel sessions on blur, hidden document, owner deactivation/unmount, modal/recorder activation, UI lock, keymap replacement, and reader content/type transitions. Cancellation is idempotent. Clear state even if normal keyup never arrives.

Preserve manga's fresh-press requirement at chapter boundaries. Repeated page events may advance pages but cannot silently cross a chapter boundary that currently requires release and a new press.

Side-button commands must work consistently wherever those commands are eligible, including after focusing a child control. Suppress browser back/forward for handled pointer sessions. Ordinary left/right/middle clicks keep their established interaction ownership.

Ctrl+wheel sizing and wheel scroll override must arbitrate before either runs so a sizing gesture cannot also scroll. Existing gesture settings and spatial hit testing remain feature-owned; matching command operations are shared with keyboard and toolbar paths.

Middle-button autoscrolling is currently documented as a native reading interaction; no dedicated middle-button command matcher was found in the audit. Preserve native autoscroll and grab scrolling. Do not introduce an app middle-button dispatcher merely to make the listener inventory appear uniform.

## 7. Reader preservation requirements

| Behavior | Required result |
| --- | --- |
| Manga page movement | Preserve direction-aware LTR/RTL behavior and vertical-mode edge chapter transitions. |
| Manga repeated pages | Preserve repeated stepping and fresh-press chapter crossing. |
| Book continuous mode | Page commands do not introduce chapter switching; explicit chapter commands still work. |
| Book pending navigation | Keyboard scrolling cancels pending continuous navigation as it does today. |
| Sizing and layout | Preserve position capture/restoration, width clamping, proportional pages-per-row adjustment, font sizing, and fit behavior. |
| Fit cycling | Preserve the intended reverse operation explicitly; do not leave an unreachable Shift branch behind exact matching. Provide a separate reverse command if needed, with migration for modified existing bindings. |
| Presets | Reuse existing preset thunks and type-filtered ordering, wrap behavior, missing-current behavior, slot no-ops, autosave semantics, and named feedback. |
| Save preset | Available throughout active reading even when the reader-settings panel is closed; suppress held-repeat saves. |
| Feedback | Preserve immediate reader shortcut feedback and control state updates. |
| Context menu | Target the active/focused owner; a hidden reader cannot open a reader menu. |
| Book find | Separate command invocation from Enter/Shift+Enter match navigation within the find field. |

Preserve the current `navToHome` operation: exit fullscreen, close an active reader through the existing close path, otherwise reload the home window. The keybinding refactor changes its eligibility/ownership, not these side effects. UI zoom commands retain title-bar-overlay and window-button-layout updates.

Do not refactor reader layout, EPUB loading, preset persistence, or library actions beyond the seams needed to share command implementations and preserve these behaviors.

## 8. Duplicate diagnostics and Shortcuts UI

Diagnostics derive from the complete effective keymap and the catalog's possible contexts, not merely the currently open Settings screen. Opening Settings must not make reader conflicts disappear. Transient availability, such as whether an item happens to be selected, is not evidence that two bindings can never collide.

Use the same normalization, trigger-overlap rules, context relationships, and tie order as runtime dispatch. Context overlap is explicit finite metadata; do not infer it by running arbitrary feature callbacks. Test that runtime activity obeys those declared relationships.

For each binding, report:

- Competing command names and contexts.
- Whether the commands can overlap, reuse is harmless, or a protected interaction makes the binding unavailable in a target.
- Which command wins in each overlapping context and why. Do not claim a universal winner when different contexts produce different winners.
- Links to the affected command rows through Settings navigation.

Recalculate after binding add/remove/reset, hydration, accepted cross-window refresh, and catalog changes. Memoize against those inputs; unrelated reading progress must not trigger recompilation. Do not persist diagnostic flags, dismissal state, conflict counts, or redundant warning objects.

The editor should provide searchable groups, context descriptions, current binding chips, recording, explicit remove controls, per-command reset, and reset-all. Stable command row IDs keep Settings search and deep-links working. A conflict filter/summary must not hide warnings on affected rows or make filtered-out competitors inaccessible.

Adding a duplicate succeeds normally. Its warning is inline and remains present; it is not a temporary toast or blocking dialog. Recording suspends command execution, captures keyboard modifiers at keydown, and waits for the input release before returning to normal dispatch. Escape cancels; Tab permits leaving the recorder. Use explicit removal controls so Backspace can be captured without ambiguity in the recording field.

Display save progress/failure through existing UI patterns. Apply edits in the initiating window immediately; if persistence fails, reconcile to the last durable state or keep a clearly marked unsaved edit that can be retried. Never display a failed write as saved. All user-facing copy uses translation catalogs.

## 9. Persistence, migration, and multiple windows

Main owns keymap file loading, validation, migration, serialized edits, and durable writes. Renderer Redux holds serializable effective configuration and save state; reducers perform no filesystem work. Each renderer separately compiles configuration and owns its handlers, contexts, and held sessions.

Use a versioned `shortcuts.json` envelope containing a schema version, revision, and explicit overrides. Do not persist current owners, pressed keys, availability, or diagnostics.

Use typed edit operations (add/remove binding, reset command, reset all) rather than accepting a stale entire renderer snapshot. Main applies an operation to its current canonical document and returns the acknowledged result and revision. Changes to different commands merge; edits to the same command use an expected value/revision precondition and return a visible stale-edit result rather than silently losing a change. Reset-all is explicitly a global operation with a revision check.

Write a validated temporary sibling and atomically replace the destination using the repository's supported filesystem behavior. Confirm success before advancing revision or broadcasting. Failures retain the previous valid document. Reuse suitable main persistence helpers where they provide these guarantees; the current fire-and-forget renderer helper does not.

Under Q7's recommendation, broadcasts update other windows only when Sync Settings is enabled. The initiating window always reconciles its acknowledged edit. With sync disabled, other local bindings remain unchanged; do not accidentally apply a full canonical snapshot just because the user edits one command. Stale-edit recovery must explain and explicitly reload the affected command. New windows load canonical disk state. Enabling sync reconciles to the latest revision.

Initialization must not register shortcuts against an empty keymap and later unexpectedly change behavior. Complete main hydration before exposing the editable keymap; register the runtime once and publish a validated snapshot when ready. Coalesce out-of-order acknowledgements by revision and prevent self-echo/save loops.

### Migration contract

1. Recognize the current array format and older supported shapes. The parent of commit `831a3d2` contains the historical schema in `src/renderer/MainImports.ts`: rows contain `command`, presentation-only `name`, `key1`, and `key2`; empty strings mean unbound. Its shortcut editor stores `event.key`, and the reader matches that character with command-specific modifier behavior. Build fixtures from that evidence rather than guessing physical positions from strings.
2. Back up the exact source bytes before the first rewrite. A backup failure aborts the rewrite and leaves the source intact.
3. Validate row by row and translate known command IDs and key aliases into the new schema. Preserve explicit empty arrays, duplicate bindings across commands, and all valid alternative bindings without truncation.
4. Treat every present legacy command row as an explicit override, even when it equals a default. The old file does not establish whether a user intentionally chose that value. Missing commands inherit current defaults.
5. Preserve unreadable/unknown content for recovery. Unknown commands do not execute; malformed input never silently causes a complete overwrite with defaults. A corrupt file may use defaults in memory with visible recovery status, but writes require a valid recovery path.
6. Deduplicate identical triggers within one command. Multiple conflicting rows for one command require documented deterministic normalization with recovery data; do not arbitrarily discard customization.
7. Validate the result, write once, and make repeated migration a no-op. Runtime only sees the new schema.
8. Treat newer unsupported schema versions as read-only/recovery cases; never downgrade or erase their data.

For historical character rows, combine nonempty alternatives without trimming the literal Space binding, ignore persisted display names, and preserve case/symbol identity. Encode the observed modifier policy as binding data and expand implicit reverse-scroll/fit operations into explicit command mappings where required. Unknown characters remain logical triggers or recoverable inactive data; they are never silently mapped to a US keyboard position. The compatibility reader exists only at ingestion; it does not restore old window listeners or global command arrays.

Required upgrade fixtures: fresh install, current format with custom/default/empty bindings, duplicates, mouse bindings, earlier stable releases, skipped releases, partial files, unknown IDs, malformed rows, interrupted write, and newer unsupported format.

User data compatibility readers and recovery backups are required preservation mechanisms. They are not an excuse to retain the old dispatch hooks, reducer side effects, or fallback registries.

## 10. Electron integration

Native menus and renderer bindings must have one execution authority for each physical input. Editable app actions must not retain a second active accelerator that still fires after rebinding or removal.

Preferred approach: renderer routing owns configurable app shortcuts while it is active, and dispatches typed, allowlisted main actions for the originating window. Menu clicks invoke the same operation. Native editing roles remain owned by Electron/the focused native control. Do not use operating-system global shortcuts for window-local app commands.

Generate native menu binding labels from effective configuration where supported. A label must not secretly register an independent accelerator. Window-specific keymaps when sync is disabled must not become a single process-global mutable accelerator map.

Verify this against the pinned Electron version on supported platforms. Its local type declarations expose `registerAccelerator` for Linux/Windows, with a platform restriction; do not assume that suppressing accelerator registration works identically on macOS. Use an ordinary display label rather than an active accelerator where necessary. Reload/devtools recovery when renderer startup fails needs an explicit native menu path, without reinstating a competing normal-runtime key dispatcher. UI lock semantics must be checked for native menu actions as well as DOM events.

## 11. Diagnostics and performance

Compile/index bindings only when effective configuration changes. Resolve against indexed candidates and active owners; do not scan every component or read the filesystem per event. Keep handlers current without reattaching native listeners on every render. Keep pressed keys and animation state out of Redux.

Development diagnostics should explain a routing result (trigger, eligible contexts, winner, suppression reason) through a testable result or opt-in inspection. Do not introduce per-key production logs or persist typed text. Log failed writes, migration/recovery issues, invalid registrations, and failed command execution through the existing logger.

Maintain compatibility with the repository's React and Electron runtime versions. This refactor does not require a framework upgrade or a third-party hotkey package.

## 12. Acceptance and release gate

- Every existing command and additional hardcoded app action has a catalog entry, protected-interaction classification, or documented removal.
- No legacy matching engine, unused hook, obsolete global, handwritten displayed app binding, or alternate keymap remains in production.
- Reused bindings can be saved. Diagnostics appear immediately, survive Settings reopening through recomputation, and are absent from serialized files.
- Exactly one eligible command executes; hidden lists/readers, nested overlays, and listener order cannot alter the result.
- Inputs, native controls, IME, keyboard-only editing, and Escape/Tab behavior remain usable.
- Reader cases in section 7 pass, including held input cancellation and chapter crossing.
- Pointer actions do not double execute or accidentally invoke browser history/native scrolling.
- Migration preserves recoverable customization across skipped versions and never silently overwrites a corrupt or newer-format file.
- Multi-window edits do not lose unrelated changes, violate Sync Settings, or share transient runtime state.
- Settings search, help, Usage, toolbar/context-menu labels, and translations reflect effective bindings.
- Focused unit/RTL and persistence tests, the repository type check, relevant full suites, and the documented manual native-platform matrix pass before release.

The plan defines the concrete test matrix and deletion audit. It uses the same Q1-Q8 working assumptions; revisions must update both documents before their dependent implementation begins.

## Appendix A. Complete existing command inventory

This table accounts for all 54 catalog IDs at the inspected baseline. Binding defaults remain in the catalog; they are not duplicated here. Policies below describe the target contract. Feature-specific availability and the preservation requirements above still apply.

| Existing command IDs | Owner / operation | Input policy and migration notes |
| --- | --- | --- |
| `navToPage` | Manga page-navigation control | One-shot; use the same operation as the toolbar. |
| `toggleZenMode` | Active manga/book reader | One-shot; retain position preservation. |
| `largeScroll`, `largeScrollReverse` | Active reader, large scroll amount | Held session; use that reader type's setting. |
| `scrollDown`, `scrollUp` | Active reader, small scroll amount | Held session; preserve the active mode's scrolling behavior. |
| `prevPage`, `nextPage` | Active reader navigation | Manga repeat/fresh-press boundary rules; book one-shot edge behavior and continuous-mode restriction. |
| `nextChapter`, `prevChapter` | Active reader chapter navigation | One-shot. Copy legacy bindings to separate Settings-tab commands during migration. |
| `focusPageSearch` | Highest applicable visible search owner | One-shot; no character stealing from editable targets; includes book find. |
| `randomChapter` | Manga chapter navigation | One-shot; retain existing action availability. |
| `bookmark` | Active reader bookmark operation | One-shot; retain domain write and UI feedback. |
| `sizePlus`, `sizeMinus` | Active reader width/size operations | One-shot keyboard policy preserves current reader behavior; pointer sizing invokes the same operation. |
| `readerSettings` | Active reader panel | One-shot toggle/focus operation. |
| `savePreset` | Active reader preset owner | One-shot, available when its panel is closed. |
| `cyclePresetNext`, `cyclePresetPrev` | Active reader preset catalog | One-shot; existing type filtering, wrapping, and feedback. |
| `selectPreset1`, `selectPreset2`, `selectPreset3`, `selectPreset4`, `selectPreset5` | Active reader preset slot | One-shot; absent slots remain unavailable/no-op. Keep stable slot IDs. |
| `showHidePageNumberInZen` | Active reader progress visibility | One-shot; manga page number or book progress according to owner. |
| `cycleFitOptions` | Manga fit mode | One-shot; migrate Shift-modified reverse bindings to explicit reverse operation if the command is split. |
| `selectReaderMode0`, `selectReaderMode1`, `selectReaderMode2` | Manga reading-mode selection | One-shot; retain persisted IDs independent of translated names. |
| `selectPagePerRow1`, `selectPagePerRow2`, `selectPagePerRow2odd` | Manga page grouping | One-shot; retain width adjustment and clamp logic. |
| `fontSizePlus`, `fontSizeMinus` | Book font size | One-shot; retain position/layout handling. |
| `navToHome` | Current window navigation | One-shot; preserve fullscreen exit, reader close, and home reload behavior. |
| `dirUp` | Classic locations or gallery details | One-shot; directory ascent versus return-to-grid are explicit owner implementations. |
| `contextMenu` | Focused visible list/reader owner | One-shot; context and pointer position supplied explicitly. |
| `readerSize_50`, `readerSize_100`, `readerSize_150`, `readerSize_200`, `readerSize_250` | Manga size selection | One-shot; numeric ID suffixes remain compatibility identities. |
| `openSettings` | Current window Settings | One-shot toggle; only its own layer may be closed by this operation. |
| `uiSizeReset`, `uiSizeDown`, `uiSizeUp` | Current window UI scale | Reset one-shot; increment/decrement may repeat to preserve current behavior. Retain title-bar adjustments. |
| `listDown`, `listUp`, `listSelect` | Focused custom list/menu/search widget | Navigation may repeat; selection/activation is one-shot. Native controls keep protected activation. |
| `cycleBar1Prev`, `cycleBar1Next`, `cycleBar2Prev`, `cycleBar2Next` | Current screen's declared bar groups | One-shot, wraps, deliberate combinations work in search inputs; unused bars are ineligible. |
| `deleteSelected` | Active visible selection owner | One-shot; preserve remove semantics/confirmation, suppress concurrent invocation, exclude ineligible chapter lists. |

Additional non-catalog paths and their target disposition:

| Existing input/action | Target disposition |
| --- | --- |
| Native menu new/close window, reload/force reload, developer tools, help | New configurable catalog commands with allowlisted native operations and no competing accelerators. |
| Ctrl/Cmd+A on application lists | Configurable select-all command for the active visible list. Text-field select-all remains native. |
| Escape across search, selection, panels, popups, modals, zen | Protected context-owned dismissal/clear operations; one action per event. |
| Tab, native text editing, form submit, native control activation | Retained protected/native widget interactions, explicitly classified in the listener audit. |
| Book find Enter/Shift+Enter | Field-owned next/previous match operations; shared with find buttons. |
| Settings next/previous tab through chapter keys | New `settingsTabNext` / `settingsTabPrev` commands with migration described above. |
| Ctrl+wheel | Existing sizing gesture feeding reader size operations, exclusive with wheel scrolling. |
| Mouse side buttons | Configurable pointer triggers through the same runtime in every eligible context. |
| Reader click regions | Existing hit testing feeding reader navigation operations. |
| Middle-button autoscroll and grab scrolling | Preserve native/gesture behavior; no invented keyboard command requirement. |
