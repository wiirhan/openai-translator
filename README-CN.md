# NextAI Translator macOS 版

一个只保留 macOS 桌面客户端能力的 Tauri 翻译器。

## 当前范围

这个版本只保留以下能力：

- Tauri 桌面前端与原生后端
- macOS 应用打包产物（`.app`、`.dmg`）
- 桌面端共用的翻译、OCR、写作、生词本、设置界面

已从主构建/测试/发布范围移除：

- 浏览器扩展
- userscript 构建
- Safari 扩展工程
- 非 macOS 打包与 CI
- 旧 Electron 打包残留配置

## 开发

安装依赖：

```sh
pnpm install
```

启动 mac 客户端开发环境：

```sh
pnpm dev-tauri
```

仅构建渲染层：

```sh
pnpm build-tauri-renderer
```

构建 macOS 应用：

```sh
pnpm build-tauri
```

运行检查：

```sh
pnpm test
pnpm exec tsc --noEmit
```

## 打包

Tauri 打包目标现在只保留：

- `.app`
- `.dmg`

## macOS 安装说明

从 Releases 下载对应的 macOS 安装包。若被 Gatekeeper 阻止启动，可移除隔离属性：

```sh
sudo xattr -d com.apple.quarantine /Applications/NextAI\ Translator.app
```
