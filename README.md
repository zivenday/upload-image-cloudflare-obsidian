Cloudflare R2 Image Upload (Obsidian Plugin)

Overview
- Automatically uploads pasted images to your server that writes to Cloudflare R2, and inserts the returned image URL into the editor.
- Sends the image as multipart/form-data (field: `file`).
- Passes the following settings via request headers: `X-R2-Endpoint`, `X-R2-Access-Key-Id`, `X-R2-Secret-Access-Key`, `X-R2-Bucket`, `X-Base-Url`.
- Expects JSON response with `{ ok: true, url: "https://.../xxx.png" }`. On success, inserts `![alt](url)`; otherwise shows an error modal.
- Shows status in the status bar during upload and uses a placeholder in the editor until completed.

Install
- Community Plugins: pending review.
- Manual: download `manifest.json`, `main.js`, `styles.css` from the latest Release and place them under `<YourVault>/.obsidian/plugins/upload-image-cloudflare/`, then enable it in Settings → Community plugins.

Settings
- Auto upload pasted images (on by default).
- Upload server URL (required).
- R2 headers: Endpoint / Access Key Id / Secret Key / Bucket / Base Url.

Server API
- The plugin sends `multipart/form-data` with the `file` field, and includes the above headers.
- Expected response: `{ ok: true, url: "https://.../xxx.png" }`.
- If `ok !== true` or invalid JSON, the plugin shows an error.

Privacy & Security
- Credentials are stored in plain text within plugin data; use with caution.
- Uses Obsidian `requestUrl` to avoid CORS issues where possible.

Requirements
- Obsidian 1.4.0+
- Desktop and mobile both supported (`isDesktopOnly: false`).

Development
1) `npm i`
2) `npm run dev`
3) Build artifacts: `main.js`, `manifest.json`, `styles.css`
4) Copy artifacts to `<YourVault>/.obsidian/plugins/upload-image-cloudflare/` and enable in settings.

License
- MIT

——

Cloudflare R2 图片上传（Obsidian 插件）

功能
- 粘贴图片时，自动向自定义上传服务器发起 POST 请求。
- 以表单 form-data（field: `file`）上传图片内容。
- 将以下配置以请求头发送：
  - `X-R2-Endpoint`
  - `X-R2-Access-Key-Id`
  - `X-R2-Secret-Access-Key`
  - `X-R2-Bucket`
  - `X-Base-Url`
- 解析响应 JSON 中的 `ok` 与 `url` 字段：
  - `ok !== true`：弹出报错弹窗
  - `ok === true`：在编辑器插入 `![alt](url)` Markdown
- 上传中：状态栏显示“上传中(n)…”，并在编辑器插入占位符，完成后替换。

安装
- 社区插件：审核中。
- 手动安装：从 Release 下载 `manifest.json`、`main.js`、`styles.css` 到 `<你的Vault>/.obsidian/plugins/upload-image-cloudflare/`，在 Obsidian → 设置 → 社区插件 中启用。

配置项（设置页）
- 自动上传粘贴图片（默认开启）
- 上传服务器地址（必填）
- R2 相关请求头：Endpoint / Access Key Id / Secret Key / Bucket / Base Url

服务端对接
- 插件会以 `multipart/form-data` 发送 `file` 字段（文件内容），并携带上述 `X-R2-*` 与 `X-Base-Url` 请求头。
- 期望响应：`{ ok: true, url: "https://.../xxx.png" }`。
- 若 `ok` 不为 `true`，或 JSON 不合法，插件将报错。

隐私与安全
- 凭据以纯文本存储在插件数据中，请谨慎使用与分发。
- 若遇到 CORS 问题，已内置使用 `requestUrl`。

环境要求
- Obsidian 1.4.0+
- 桌面与移动端均支持（`isDesktopOnly: false`）。

本地开发
1. 安装依赖：`npm i`
2. 开发构建：`npm run dev`
3. 产物文件：`main.js`、`manifest.json`、`styles.css`
4. 调试：将上述产物复制到 `<你的Vault>/.obsidian/plugins/upload-image-cloudflare/`，在 Obsidian → 设置 → 社区插件 中启用。

开源协议
- MIT
