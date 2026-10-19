# Contributing

This repository owns the source and automation for the `gojocodes-all` GitHub
profile. Pull requests should keep the profile readable, preserve the generated
SVG accessibility metadata, and avoid committing generated output or tokens.

## Requirements

- Node.js 24
- The npm version bundled with Node.js

The project has no third-party runtime or development packages, so dependency
installation is not required. If you use nvm, select the repository version
before running commands:

```bash
nvm use
```

## Validate changes

Run the same entry point used by both GitHub Actions workflows:

```bash
npm run validate
```

This syntax-checks the generator and test sources, then runs the complete
dependency-free Node.js test suite. Add focused tests whenever calculation,
rendering, workflow, or publishing behavior changes.

## Generate profile cards locally

The scheduled workflow is the source of truth for published assets. To inspect
generated cards locally on a POSIX shell, provide the account name and read the
token without saving it in the repository or shell history:

```bash
export GITHUB_USERNAME=gojocodes-all
read -r -s -p "GitHub token: " GITHUB_TOKEN
export GITHUB_TOKEN
npm run generate
unset GITHUB_TOKEN
```

The six SVG files are written to the ignored `dist/` directory. Do not commit
that directory; the publishing workflow deploys it to the `output` branch.

## Workflow contract

- Pull requests receive read-only validation.
- Pushes to `main`, manual dispatches, and the schedule validate before they
  generate and publish profile assets.
- Workflow actions stay pinned to reviewed commit SHAs.
- The checked-in `.nvmrc` is the single Node.js version source for local and CI
  validation.
