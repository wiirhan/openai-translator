clean:
	rm -rf dist

change-version:
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" src-tauri/tauri.conf.json

change-package-version:
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" package.json

build-tauri:
	pnpm run build-tauri-renderer
	pnpm tauri build
