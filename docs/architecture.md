# Bonsai architecture

Bonsai is a VS Code extension. It hides files and folders in the Explorer so that you see only
what your current task needs. This document is the design reference. It states what the
extension does, how it does it, and why. It does not describe the code line by line.

## 1. Vocabulary

| Term | Meaning |
| --- | --- |
| Category | A named set of glob patterns that says what a file is. Example: `lint`, `ci`, `ai`. |
| Filter | What a button activates. A filter has a base mode and rules. Example: `coding`. |
| Base mode | The starting state of a filter: `showAll` or `hideAll`. |
| Hide rule, show rule | An entry in a filter's `hide` or `show` list. An entry is a glob, a category reference, or a removal. |
| Exclude setting | The VS Code setting `files.exclude`. The Explorer hides every path that matches one of its keys. |
| Generated key | A key that Bonsai writes into the exclude setting. Bonsai tracks and removes its own keys only. |
| Glob entry | A generated key that is a pattern. VS Code evaluates it lazily, one folder listing at a time. |
| Concrete entry | A generated key that is a plain path. The walk found it. |
| Walk | The process that lists folders to compute concrete entries. |
| Leaf folder | A folder that the walk never opens. It is decided as a whole, like a file. Example: `node_modules`. |
| Reach | A pattern reaches a folder when it can match a path below that folder. |
| Conflict folder | A folder that a hide rule and a show rule both reach. Only conflict folders are opened. |
| Plan | The result of the engine for one workspace folder and one filter: the set of generated keys. |
| Clean filter | A local Git filter that strips generated keys from everything Git reads from the working tree. |

## 2. Constraints that shape the design

These facts were verified against the VS Code source and with Git experiments.

1. The built-in Explorer has no filter API. The exclude setting is the only lever. The setting
   also hides files from Quick Open and from search.
2. The Explorer evaluates the exclude setting lazily per folder listing. It never opens a hidden
   folder. A glob entry therefore costs nothing. A plain path such as `src/legacy` is a valid key.
3. The glob dialect supports `*`, `**`, `?`, `{a,b}`, `[abc]`, and `[!abc]`. It has no negation.
   A pattern without a leading `**/` is anchored at the workspace folder root. Matching is case
   insensitive on Windows and macOS, and case sensitive on Linux.
4. Object settings merge deeply across scopes. Arrays do not merge. A workspace array replaces
   the same array from the user scope.
5. The file watcher reports events inside `node_modules` by default.
6. An open editor keeps its file visible in the Explorer, even when a key hides it.
7. VS Code has no local, untracked settings file for a folder workspace. The generated keys land
   in the folder's `.vscode/settings.json`.
8. `git status` reports a file as modified when the file size differs from the size that the
   index recorded. It skips the content check in that case. `git diff`, `git add`, and
   `git commit` run the clean filter and see no change.
9. A clean command that fails or is missing only logs a warning. Git then uses the raw content.
10. ES module extensions run on the desktop extension host only.

## 3. Rule semantics

All patterns are relative to one workspace folder root. A pattern that matches a folder applies
to the whole subtree. This holds for hide rules and for show rules.

Definitions for a path `p`:

- `hiddenByRule(p)`: some hide pattern matches `p` or an ancestor of `p`.
- `shownByRule(p)`: some show pattern matches `p` or an ancestor of `p`.
- `hasVisibleDescendant(p)`: some existing path below `p` is visible. The engine evaluates it
  bottom up, so a folder whose whole content is hidden collapses to one hidden entry.

The base mode decides the order of the rule lists:

| Base mode | Order | Result |
| --- | --- | --- |
| `showAll` | hide first, show last | `hidden(p) = hiddenByRule(p) && !shownByRule(p) && !hasVisibleDescendant(p)` |
| `hideAll` | show first, hide last | `hidden(p) = hiddenByRule(p) \|\| (!shownByRule(p) && !hasVisibleDescendant(p))` |

The last list is final. In `showAll` a show rule rescues a path from a hide rule. In `hideAll`
a hide rule removes a path from a show rule.

The user's own exclude keys always win. Bonsai never writes a `false` value to override a key
that the user or VS Code set.

## 4. The engine

The engine turns a resolved filter into a plan. A plan holds glob entries and concrete entries.
The engine is pure code. It has no import from the `vscode` module. It receives a directory
reader interface, and the tests use an in-memory tree.

### 4.1 Emission per base mode

`showAll` without show rules:

- Every hide pattern becomes a glob entry. No walk. This is the Coding filter in its default form.

`showAll` with show rules:

- The walk opens conflict folders only.
- In a conflict folder, a child that a show rule matches is visible. Its subtree is covered.
- A child that a hide rule matches becomes a concrete entry. When it is a folder that a show
  rule reaches, the walk opens it instead. When nothing below it is rescued, it collapses back
  to one concrete entry.
- A child folder that only hide rules reach gets residual glob entries. A residual glob is the
  hide pattern rebased at that folder, for example `src/vendor/**/*.log`. The folder is not opened.
- A child folder that no rule reaches is left alone.

`hideAll`:

- Every hide pattern becomes a glob entry. Hide runs last, so a glob is final.
- The walk opens folders that a show rule reaches.
- A child that a show rule matches is visible. Its subtree is covered.
- A child folder that a show rule reaches is opened. When nothing below it is visible, the folder
  collapses to one concrete entry.
- Every other child becomes a concrete entry.

### 4.2 What bounds the walk

1. Leaf folders are never opened. The engine decides a leaf folder as a whole. Show rules do not
   apply inside a leaf folder. Residual hide globs still apply inside it. The list is the setting
   `bonsai.leafFolders`. Each item is a glob that matches the folder name at any depth.
2. Children that the baseline exclude setting already hides are skipped. The baseline is the
   effective exclude setting minus the generated keys.
3. Default patterns anchor at the root when the convention is root-only. `.github` reaches one
   folder. `**/.github` reaches every folder.
4. A budget stops the walk. The setting `bonsai.maxWalkEntries` holds the limit. When the walk
   hits the limit, Bonsai applies the partial plan and shows a warning once.
5. Symbolic links are never followed.

A concrete entry is a path, but VS Code reads every key as a glob. The engine therefore escapes
`[`, `]`, `*`, `?`, `{`, and `}` in every path segment as a single-character class, for example
`app/[[]id[]]` for the folder `app/[id]`. The same applies to the folder part of a residual glob.

### 4.3 Reach and residual analysis

Brace alternatives are expanded at parse time, so every compiled pattern is brace free. A
pattern is a list of segments. A `**` segment matches zero or more whole path segments.

- `matches(pattern, path)`: the standard segment match.
- `reaches(pattern, folder)`: the pattern can match a path strictly below the folder. The matcher
  consumes the folder segments and checks whether a non-empty remainder exists.
- `residuals(pattern, folder)`: the set of remainders after the folder segments are consumed.
  Each remainder, prefixed with the folder path, is a residual glob.

The matcher is Bonsai's own code, written for the VS Code dialect. A general glob library does
not offer reach or residual analysis, and a second dialect would be a second source of truth.

### 4.4 Runtime behavior

- A filter change, a configuration change, a workspace folder change, or a file event triggers a
  recompute. File events are debounced. Events below a leaf folder are dropped before the debounce.
- A new trigger cancels a walk in progress.
- Bonsai caches the last plan per workspace folder and filter. On start it applies the cached plan
  at once and recomputes in the background.
- The desktop directory reader uses Node's `readdir` with file types. That avoids a stat call per
  entry. A `workspace.fs` reader exists for other URI schemes.
- Multi-root workspaces get one plan and one write target per workspace folder. Every entry is
  relative to its folder, so the target is always the folder scope.

## 5. Configuration

### 5.1 Settings

| Setting | Type | Purpose |
| --- | --- | --- |
| `bonsai.filters` | object keyed by filter id | Filters. Built-in ones can be extended or disabled. |
| `bonsai.categories` | object keyed by category id | Categories. Built-in ones can be extended. |
| `bonsai.leafFolders` | string[] | Folder name globs that the walk never opens. |
| `bonsai.coding.hidePackageManifests` | boolean, default `false` | Adds the `manifests` category to the Coding filter's hide list. |
| `bonsai.git.cleanFilter` | `"ask"`, `"always"`, `"never"` | Whether Bonsai installs the local Git clean filter. |
| `bonsai.statusBar.enabled` | boolean, default `true` | Shows the active filter in the status bar. |
| `bonsai.maxWalkEntries` | number, default `50000` | The walk budget per workspace folder. |

### 5.2 Shapes

```jsonc
"bonsai.categories": {
  "lint": {
    "label": "Lint config",
    "patterns": ["**/eslint.config.*", "**/.eslintrc*", "**/biome.json*"]
  },
  "config": {
    "label": "All config",
    "patterns": ["category:lint", "category:format", "category:ci"]
  }
},
"bonsai.filters": {
  "coding": {
    "label": "Coding",
    "base": "showAll",
    "hide": ["category:lint", "category:ci", "**/*.log"],
    "show": ["eslint.config.ts"]
  },
  "coding-strict": {
    "label": "Coding (strict)",
    "extends": "coding",
    "hide": ["category:manifests"]
  },
  "ai": {
    "label": "AI",
    "base": "hideAll",
    "show": ["category:ai"],
    "hide": ["**/.claude/cache"]
  }
}
```

Entry syntax, for every `patterns`, `hide`, and `show` list:

| Entry | Meaning |
| --- | --- |
| `**/*.log` | A glob in the VS Code dialect. |
| `category:lint` | Every pattern of the category `lint`, resolved recursively. |
| `!**/*.log` | Removes the pattern `**/*.log` from everything before it in the list, also when a category contributed it. |
| `!category:lint` | Removes the reference and the patterns of the category from everything before it in the list. |

A list is applied top to bottom. A removal drops what came before it, and a later entry can add
the same thing again. A filter with `extends` starts from the parent's base mode and lists. Its
own lists add to the parent's lists. A filter has `enabled: false` to disappear from the pickers.
The `all` filter is implicit: it has no rules and removes every generated key.

### 5.3 Layering

Bonsai merges four layers in this order: shipped defaults, user settings, workspace settings,
workspace folder settings. Bonsai reads each layer through `inspect()` and merges itself, because
VS Code would replace a list instead of adding to it. Lists add up in layer order. A removal entry
drops an inherited entry at the point where it appears. Scalar fields such as `label` and `base`
take the last layer that sets them.

Category references and `extends` form a graph. A cycle is a configuration error. Bonsai reports
configuration errors in the output channel and in the status bar, and it falls back to the last
valid configuration for the affected part.

Every layer is external input. A schema validates it at the boundary. Inside the boundary the
types are trusted.

### 5.4 Shipped defaults

The defaults live in TypeScript modules, one file per category. The compiler checks them and the
unit tests cover them. The `package.json` contribution carries the JSON schema for the settings,
so VS Code validates and completes user input. The default value of `bonsai.filters` and
`bonsai.categories` in `package.json` is an empty object. User settings hold changes only.

Built-in filters:

| Id | Label | Base | Content |
| --- | --- | --- | --- |
| `all` | All | none | Implicit. No rules. |
| `coding` | Coding | `showAll` | Hides every config category except package manifests, and hides outputs, caches, logs, dependency folders, and AI files. |
| `codingWithoutTests` | Coding excluding tests | extends `coding` | Also hides the `testCode` category: test folders and test files. |
| `setup` | Project setup | `hideAll` | Shows every config category, AI included. Hides outputs, caches, logs, and dependency folders last. |
| `ai` | AI | `hideAll` | Shows the `ai` category. |

The AI category ships verified entries only. Entries without a confirmation from official
documentation stay in the research notes and not in the defaults. Generic names never become
default patterns, because a wrong default hides a real project file.

## 6. Storage

| Data | Location | Reason |
| --- | --- | --- |
| Filters, categories, leaf folders, options | `bonsai.*` settings, any scope | User-editable, schema-validated, visible in the Settings UI. |
| Shipped defaults | TypeScript modules | Type-checked, tested, no JSON drift. |
| Active filter id per workspace | Extension workspace state | Untracked, survives restarts. |
| Generated keys per workspace folder | Extension workspace state, and a state file in the Git directory | The clean script reads the file. Bonsai reconciles both on start. |
| Cached plan per workspace folder and filter | Extension workspace state | Instant apply on start. |
| Clean script copy and Node path | Extension global storage, and the local Git config | The global storage path is stable across extension updates. |
| Per-repository answers such as "never install" | Extension global state, keyed by Git directory | One repository can be open in several workspaces. |
| The generated keys | The folder's `.vscode/settings.json` | The only place the Explorer reads. |

Reconciliation on start: Bonsai reads its managed key list, removes stale generated keys that a
crash left behind, applies the cached plan of the active filter, and recomputes.

Write-back loop guard: Bonsai records the keys it expects before it writes, and it compares every
exclude setting change with that expectation. Its own echo changes nothing. When something else
removes generated keys, for example a Git checkout, or when the user's own keys change, Bonsai
applies the plan again. The user's own keys are never touched. Writes are serialized per folder,
and a superseded computation never writes.

Bonsai keeps the generated keys in the settings file while VS Code is closed. A command clears
them on demand.

## 7. Git integration

### 7.1 Clean filter

Bonsai installs a local Git clean filter once per repository, after one prompt. The setting
`bonsai.git.cleanFilter` can skip the prompt in either direction. The installation writes:

1. One line into `.git/info/attributes`: the settings file path with `filter=bonsai`. For a
   worktree, the path comes from `git rev-parse --git-path`.
2. `filter.bonsai.clean` into `.git/config`: the absolute Node path, the absolute script path, and
   the state file path, each quoted. `filter.bonsai.required` stays unset, so a broken command
   never blocks Git.
3. The state file `bonsai/managed-keys.json` inside the Git directory, keyed by the settings file
   path relative to the repository root. An entry also records whether Bonsai created the
   `files.exclude` property itself. The clean script then removes the whole property when no key
   remains, so a commit never gains an empty object.

Git substitutes `%f` with the path in single quotes. The command therefore passes `%f` without
quotes of its own, and the script strips wrapping quotes anyway.

The clean script is a separate bundle. It parses JSON with comments, removes the managed keys from
the `files.exclude` object, and prints the rest unchanged. It has no dependency at runtime. The
smudge side is not configured, so a checkout writes the committed content.

Node resolution: Bonsai uses the `node` binary on the PATH of the extension host, stored as an
absolute path. When there is none, it uses the editor's own runtime through
`ELECTRON_RUN_AS_NODE`. On every activation Bonsai checks that the configured command still runs,
and repairs the configuration when it does not.

### 7.2 Ghost "M"

After each write of the settings file, Bonsai runs the clean script in-process on the file and
hashes the result. It reads the mode and the object id of the index entry for the file, and only
when the path has exactly one entry at stage zero. When the hashes are equal, it rewrites the index
entry with the same mode and object id through `git update-index --cacheinfo`. That resets the
recorded size and time and can never stage content, not even when the installed filter is broken.
When the hashes differ, Bonsai does nothing, because the user changed the file.

### 7.3 A new settings file

When the folder has no `.vscode/settings.json`, Bonsai creates one through the VS Code settings
API. Bonsai never hides that file from Git. It shows as untracked until the user commits or
ignores it. The clean filter strips the generated keys when the user commits it.

### 7.4 Limits

- A Git client that does not call the `git` binary bypasses the filter. JetBrains IDEs can use an
  embedded Git implementation for some operations. VS Code, GitHub Desktop, and lazygit call the
  binary.
- The uninstall command removes the attributes line, the config entries, and the state file.

## 8. User interface

- Explorer title icon. It opens a Quick Pick with the filters.
- Status bar item with the active filter. A click opens the same Quick Pick.
- No section inside the Explorer. VS Code appends a contributed section after its own sections and
  offers no way to order it, so a button bar there always landed at the bottom.
- Commands: select filter, cycle filter, apply filter with an id argument, one command per built-in
  filter, refresh, clear generated keys, install, check, and uninstall the Git filter, show output.
- No default keybindings. The per-filter commands exist so that a user can bind keys.
- A context key holds the active filter id for `when` clauses.
- An output channel logs every plan, every write, and every Git call.

## 9. Module layout

```
src/
  extension.ts            composition root: activate and deactivate, wiring only
  rules/                  pure engine: glob matcher, reach and residual analysis,
                          entry parsing, filter resolution, plan computation
  defaults/               shipped categories (one file each), filters, leaf folders
  configuration/          read all scopes, validate with a schema, merge layers, emit changes
  explorer/               directory readers, exclude writer with managed keys, filter session
                          (triggers, debounce, cancellation, cache), reconciliation
  git/                    repository detection, clean filter install, check, uninstall,
                          safe add; cleanScript/ is the separate bundle entry
  ui/                     commands, quick pick, status bar, explorer title icon, context keys
test/integration/         @vscode/test-cli tests with a fixture workspace
```

Rules:

- `src/rules` and `src/defaults` import nothing from `vscode`. A lint rule enforces it.
- Settings are validated with the mini build of zod, which keeps the bundle small.
- Unit tests sit next to the code as `*.test.ts` and run with vitest.
- Integration tests run in a real VS Code and cover the exclude writer, the reconciliation, and
  the activation.
- Two bundle entries: the extension as an ES module, and the clean script as a CommonJS file for
  any Node runtime.

## 10. Toolchain

- pnpm, strict TypeScript, ES module output, esbuild.
- vitest for unit tests, `@vscode/test-cli` and `@vscode/test-electron` for integration tests.
- ESLint with a flat config and ESLint Stylistic. Allman braces. No Prettier.
- `@vscode/vsce` for packaging.
- Minimum VS Code version 1.100, the first version with ES module extension support.
- Scripts: `check` (lint and type check), `test` (unit), `test:integration`, `build`, `package`.
  CI is out of scope for this document.

## 11. Out of scope for version 1

- A ripgrep-based accelerator for `**/` show rules in `hideAll` filters.
- Incremental recompute per changed folder.
- Sibling conditions in rule entries.
- The web extension host.
- Per-filter leaf folder overrides.
