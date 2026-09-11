---
name: extend-rules
description: Fix the shipped Bonsai rules after a field report, then release the fix to the Visual Studio Marketplace. Use when the user says that a file or folder shows up in a filter where it does not belong, that a file is hidden where it should stay visible, that a category misses a pattern, or when the user invokes /extend-rules. Sets the session into extend-rules mode - every next message is the next report.
---

# Extend rules

A field report says that the shipped rules miss a file, or hide a file that should stay visible. You fix the rules, prove the fix with a test, and release it. One report gives one commit and one release. Several files in one message go into one commit.

The release path is fully automatic. Do not ask for permission at a step. Stop only when a check, a workflow run, or a precondition fails. Then report the output and wait.

## 1. The report

When the message holds no report, ask one question and wait:

> Which file or folder shows up where it does not belong? Name it, and the filter or category when you know it.

A report can hold:

- One or more file or folder names, for example `pint.json` or `.phpunit.cache`.
- A path into a real project. List that folder with `ls -A` to see the file and its neighbors.
- A screenshot of the Explorer, or a pasted directory listing.
- The filter and the category. When they are missing, decide them yourself.

Find out what each file is before you place it. When you do not know the name, search the web for the tool that writes it. When the report stays unclear, ask one short question and wait.

## 2. Find the place for the rule

Read `src/defaults/categories/index.ts` for the category ids. Open the candidate files. Every category is one file in `src/defaults/categories/`, with an `id`, a `label`, and a `patterns` list.

| Situation | Change |
| --- | --- |
| A category fits | Add the pattern to that file, next to the entries of related tools, or at the end. |
| No category fits | Add a file with a new category. Register it in `src/defaults/categories/index.ts`, in the right id list in `src/defaults/filters.ts`, in the composite of `src/defaults/index.ts`, and in the README list of built-in ids. |
| The file is a generated folder that can grow large | Add the pattern to the category and the folder name to `src/defaults/leafFolders.ts`. Example: `.sst` sits in the `cache` category and in the leaf folders. |
| A pattern hides a file that should stay visible | Narrow the pattern. Split it into the exact names the tool uses. Check every filter that references the category. |

Rules for a pattern:

- Use the VS Code glob dialect: `*`, `**`, `?`, `{a,b}`, `[abc]`, and `[!abc]`. There is no negation.
- Anchor the pattern at the root when the tool keeps its file at the project root only. Example: `artisan`, `.trivyignore`.
- Start with `**/` when the file can sit in a sub package or in any folder. Example: `**/eslint.config.*`, `**/__pycache__`.
- Keep the pattern as narrow as the names the tool uses. Write `**/phpstan.neon` and `**/phpstan.neon.dist`, not `**/phpstan*`.
- Grep `src/defaults` for the name before you add it. A wider pattern can cover it already. `**/.env.*` covers `.env.production`.
- One pattern per line, single quotes, and a trailing comma, as in the file.

## 3. The test

Open `src/defaults/defaults.test.ts`. The test `hide the items from the field report in the Coding filter` holds the `expectedPatterns` list. Add every new pattern to it. For a narrowed pattern, add the old pattern to a `not.toContain` assertion.

For a new category, add one representative pattern of it to the same list. That proves that the filter references the category.

## 4. Local checks

Run both. Fix every finding at its cause.

```
pnpm run check
pnpm run test
```

Do not disable a rule, skip a test, or widen a type. When a failure stays, stop and report the output.

## 5. Commit

Preconditions. Stop and report when one fails:

- The branch is `main`.
- `git fetch origin` and `git status --short --branch` show `main` at or ahead of `origin/main`. When it is behind, run `git pull --ff-only origin main` first.
- The active `gh` account has push access to `iOSonntag/vscode-bonsai`. Check with `gh auth status`.

Stage only the files you changed. Other uncommitted changes in the checkout are not yours. Leave them alone.

The message follows the previous rule fixes. The type is always `fix:`, also for a new category. The title names the items and the filter. The body states what the field report showed, in one to three sentences. End the message with the co-author line that the session prescribes.

```
fix: hide the Pint config and the PHPUnit cache in Coding

A Laravel project showed pint.json and a .phpunit.cache folder next to
the source code. The format and cache categories gain both.
```

When the fix keeps a file visible, the title starts with `fix: keep`.

## 6. Push and release

Push to `main`:

```
git push origin main
```

Wait for the CI run on the pushed commit. A run appears a few seconds after the push. When the list is empty, run it again.

```
SHA="$(git rev-parse HEAD)"
gh run list --workflow=ci.yml --branch main --limit 5 --json databaseId,headSha --jq ".[] | select(.headSha == \"$SHA\") | .databaseId"
gh run watch <id> --exit-status
```

The release workflow runs on the same push. It opens or updates the release pull request. Wait for that run in the same way, with `--workflow=release.yml`. Merge nothing before it is finished, because the pull request body must already list your commit.

Find the release pull request and read its body. The body lists every unreleased commit. Its title holds the new version.

```
gh pr list --state open --label "autorelease: pending" --json number,title,body
```

Merge it with a squash. Everything on `main` is releasable. When the body lists commits other than yours, note them for the report.

```
gh pr merge <number> --squash
MERGE_SHA="$(gh pr view <number> --json mergeCommit --jq .mergeCommit.oid)"
```

The merge pushes to `main` and starts the release workflow once more. That run creates the tag, builds the package, and publishes it. Find it by the merge commit and wait for it. It takes a few minutes.

```
gh run list --workflow=release.yml --branch main --limit 5 --json databaseId,headSha --jq ".[] | select(.headSha == \"$MERGE_SHA\") | .databaseId"
gh run watch <id> --exit-status
```

Confirm the result. The version is the one from the pull request title.

```
gh release view v<version> --json tagName,url,assets --jq '{tagName, url, assets: [.assets[].name]}'
pnpm exec vsce show iOSonntag.vscode-bonsai --json | jq -r '.versions[0].version'
git pull --ff-only origin main
```

The Marketplace listing can lag a few minutes behind the publish job. When it still shows the old version, say so in the report. Do not loop on it.

When a workflow run fails, show the failed step with `gh run view <id> --log-failed`. Report it and stop. Do not rerun it, do not force push, and do not bypass a check.

## 7. The report

One short message:

- The category and the patterns that changed.
- The version that was released, with the GitHub release URL.
- The other commits that went out with it, when there were any.
- The Marketplace state as you saw it.

Then wait for the next report.

## The mode persists

After the first report the session stays in extend-rules mode. Every next message is the next report, with the same steps.

- A clear instruction to do something else: do it, then return to the mode.
- "stop", "done", or "exit": end the mode.
