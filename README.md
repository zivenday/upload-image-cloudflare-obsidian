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

本地开发
1. 安装依赖：`npm i`
2. 开发构建：`npm run dev`
3. 产物文件：`main.js`、`manifest.json`、`styles.css`
4. 调试：将上述产物复制到 `<你的Vault>/.obsidian/plugins/upload-image-cloudflare/`，在 Obsidian → 设置 → 社区插件 中启用。

配置项（设置页）
- 自动上传粘贴图片（默认开启）
- 上传服务器地址（必填）
- R2 相关请求头：Endpoint / Access Key Id / Secret Key / Bucket / Base Url

服务端对接
- 插件会以 `multipart/form-data` 发送 `file` 字段（文件内容），并携带上述 `X-R2-*` 与 `X-Base-Url` 请求头。
- 期望响应：`{ ok: true, url: "https://.../xxx.png" }`。
- 若 `ok` 不为 `true`，或 JSON 不合法，插件将报错。

注意
- 凭据以纯文本存储在插件数据中，请谨慎使用与分发。
- 若遇到 CORS 问题，优先使用 `requestUrl`（已内置）。

