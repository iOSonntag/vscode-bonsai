# Release process

## How a release happens

1. Every pull request and every push to `main` runs the CI workflow. It lints, type checks,
   tests, and packages the extension. The package appears as a workflow artifact.
2. Every push to `main` also runs the release workflow. Release Please reads the commit messages
   since the last release. It opens or updates one release pull request. That pull request bumps
   the version in `package.json` and updates `CHANGELOG.md`.
3. When you merge the release pull request, Release Please creates the Git tag and the GitHub
   release. The release workflow then builds the package from that tag, runs all checks again,
   signs a build provenance attestation, and attaches the `.vsix` file to the GitHub release.
4. The publish job runs after that. It waits for the approval rules of its GitHub environment,
   then publishes to the Visual Studio Marketplace. The job holds an OpenID Connect token, so it
   installs no dependency tree. It runs only the publisher CLI, at the exact version that
   `package.json` pins in its dev dependencies.

The extension is published to the Visual Studio Marketplace only. Editors that install from
Open VSX, such as Cursor and Windsurf, are not served.

The first release becomes 0.1.0 when the history contains a `feat:` commit. The manifest file
`.release-please-manifest.json` starts at 0.0.0 and records the last released version from then on.

Commit messages follow the Conventional Commits format. `feat:` bumps the minor version.
`fix:` bumps the patch version. A `!` after the type, or a `BREAKING CHANGE:` footer, bumps the
minor version before 1.0.0 and the major version after it.

The release pull request itself gets no CI run, because GitHub does not start workflows for pull
requests that a workflow token created. The release workflow repeats every check on the tag before
it publishes, so nothing unchecked reaches a registry.

## One-time setup

Do these steps with the GitHub account that owns the repository.

### GitHub

1. Settings, Actions, General, Workflow permissions: enable "Allow GitHub Actions to create and
   approve pull requests". Release Please needs it to open the release pull request.
2. Settings, Environments: create `visual-studio-marketplace`. Add yourself as a required
   reviewer when you want to approve each publish by hand.
3. Settings, Code security: enable Dependabot alerts and the CodeQL default setup.

### Visual Studio Marketplace

The publisher `iOSonntag` exists. No new publisher is needed.

The workflow authenticates with a Personal Access Token in the secret `VSCE_PAT`. The official
docs require a token for "All accessible organizations" with the scope Marketplace, Manage. That
is a global token. Microsoft switches all global tokens off on 2026-12-01. Until then the token
path works. Before that date, switch to one of the two options below.

Token setup:

1. Sign in at `https://dev.azure.com` with the Microsoft account that owns the publisher. Create
   an organization when none exists.
2. Open User settings, then Personal access tokens, then New Token.
3. Name: any. Organization: All accessible organizations. Expiration: the latest date the portal
   allows. Scopes: Custom defined, Show all scopes, Marketplace, Manage. Create the token.
4. Verify it once from the repository root, without storing it:
   `VSCE_PAT=<token> pnpm exec vsce verify-pat iOSonntag`.
5. Store it as the secret `VSCE_PAT` in the `visual-studio-marketplace` environment on GitHub.

Option A, trusted publishing. The `vsce` tool gained `vsce publish --oidc` in July 2026. It
exchanges the workflow's OpenID Connect token for a short-lived Marketplace credential, so no
secret is stored. On 2026-09-07 it is only in the `next` prerelease of `@vscode/vsce`, and the
Marketplace side needs a "trusted publishing policy" for the repository and workflow. When the
publisher management page offers that policy and `@vscode/vsce` 3.9.3 or newer is stable:

1. Create the policy for the repository `iOSonntag/vscode-bonsai`, the workflow `release.yml`,
   and the environment `visual-studio-marketplace`.
2. Update `@vscode/vsce` in `package.json`.
3. In the publish step of `release.yml`, remove the `VSCE_PAT` environment entry and add `--oidc`
   to the `vsce publish` command.
4. Delete the secret and the token.

Option B, Microsoft Entra workload identity. This is the path the official docs describe. It
needs an Azure subscription. Its behavior for a publisher owned by a personal Microsoft account is
not confirmed anywhere, so test it before the token expires:

1. In Azure, create a resource group and a user-assigned managed identity. Record its client id,
   tenant id, and subscription id.
2. Add a federated credential to the identity. Issuer `https://token.actions.githubusercontent.com`,
   subject `repo:iOSonntag/vscode-bonsai:environment:visual-studio-marketplace`, audience
   `api://AzureADTokenExchange`.
3. Store the three ids as the variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
   `AZURE_SUBSCRIPTION_ID` in the `visual-studio-marketplace` environment.
4. Add an `azure/login` step before the publish step, with those three ids and
   `allow-no-subscriptions: true`. Then run this once in a workflow step to get the identity's
   Marketplace profile id:
   `az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798`
5. In the publisher management page, add a member with that profile id and the Contributor role.
6. In the publish step, remove the `VSCE_PAT` environment entry and add `--azure-credential` to
   the `vsce publish` command.

Publisher verification, optional and later: add the TXT record for a domain you own in the
publisher management page. Microsoft grants the badge after a review, and only after the publisher
has six months of good standing.

## What the extension manifest must provide

The workflows and the Marketplace expect these fields and scripts in `package.json`.

| Field | Value |
| --- | --- |
| `name` | `vscode-bonsai`. The listing URLs and the package file name in the release workflow use it. |
| `displayName` | `Bonsai` |
| `publisher` | `iOSonntag` |
| `version` | Release Please owns this field. Do not bump it by hand. |
| `packageManager` | `pnpm@<version>`. The pnpm action reads it. |
| `engines.vscode` | The lowest VS Code version the extension supports. |
| `repository` | `https://github.com/iOSonntag/vscode-bonsai.git`. The Marketplace rewrites relative README links with it. |
| `bugs`, `homepage`, `license` | The GitHub issues URL, the repository URL, and `MIT`. |
| `icon` | A PNG file of at least 128 by 128 pixels. SVG is rejected. |
| `categories` | Values from the fixed list, for example `Other`. |
| `keywords` | At most 30 entries. |
| `galleryBanner` | `{ "color": "<hex>", "theme": "dark" }` for the listing header. |
| `extensionKind` | `["workspace"]`. The extension must run where the files and Git live. |
| `capabilities.untrustedWorkspaces` | `{ "supported": false }`. The extension writes settings and runs Git. |
| `capabilities.virtualWorkspaces` | `{ "supported": false }`. The extension needs a real file system. |

The `.vscodeignore` file lists what stays out of the package. The CI workflow prints the package
contents in its step summary. Check that list after a change to the repository layout.

| Script | Contract |
| --- | --- |
| `lint` | Runs ESLint. Exit code 1 on a finding. |
| `typecheck` | Runs the TypeScript compiler without emit. |
| `test` | Runs the unit tests without VS Code. |
| `test:integration` | Runs the VS Code integration tests. CI wraps it in `xvfb-run`. |
| `vscode:prepublish` | Builds the production bundle. `vsce package` runs it automatically. |

Dev dependency: `@vscode/vsce`, pinned to an exact version. The publish job reads that version
from `package.json` and runs the CLI with `pnpm dlx`. The build scripts that `pnpm install` may
run are listed in `pnpm-workspace.yaml`.

README and CHANGELOG rules from the Marketplace: image links must be `https://` URLs, SVG images
are rejected unless they come from an approved badge host, and `.env` files never enter a package.

## Manual publish

Only for an emergency. The workflow is the normal path.

```
pnpm exec vsce package --no-dependencies --out vscode-bonsai-<version>.vsix
pnpm exec vsce ls --no-dependencies
VSCE_PAT=<token> pnpm exec vsce publish --packagePath vscode-bonsai-<version>.vsix
```
