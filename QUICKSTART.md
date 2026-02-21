# Quick Start Guide

## Installation

```bash
npm install
```

## Build the Library

```bash
npm run build
```

This will create:

- `dist/index.js` - CommonJS build
- `dist/index.esm.js` - ES Module build
- `dist/index.d.ts` - TypeScript definitions

## Test Locally

To test this package locally in another project:

```bash
# In this directory
npm link

# In your test project
npm link use-abort
```

## Publish to npm

1. Make sure you're logged in to npm:

   ```bash
   npm login
   ```

2. Publish the package:
   ```bash
   npm publish
   ```

## Development

The main source code is in `src/index.ts`.

To rebuild after changes:

```bash
npm run build
```

## Project Structure

```
use-abort/
├── src/
│   └── index.ts          # Main hook implementation
├── dist/                 # Built files (generated)
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```
