# NextAI Translator for macOS

A macOS-only desktop translator built with Tauri.

## Scope

This fork keeps only the macOS client experience:

- Tauri desktop renderer and native backend
- macOS app bundle outputs (`.app`, `.dmg`)
- Shared translation, vocabulary, OCR, writing, and settings UI used by the desktop app

Removed from active build/test/release scope:

- Browser extensions
- Userscript build
- Safari extension project
- Non-macOS packaging and CI
- Legacy Electron-related packaging metadata

## Development

Install dependencies:

```sh
pnpm install
```

Run the mac client in development:

```sh
pnpm dev-tauri
```

Build the renderer only:

```sh
pnpm build-tauri-renderer
```

Build the macOS app:

```sh
pnpm build-tauri
```

Run tests:

```sh
pnpm test
pnpm exec tsc --noEmit
```

## Packaging

The Tauri bundle is now limited to macOS targets:

- `.app`
- `.dmg`

## macOS installation notes

Download the corresponding macOS package from Releases, install it, and if Gatekeeper blocks launch, remove quarantine:

```sh
sudo xattr -d com.apple.quarantine /Applications/NextAI\ Translator.app
```
