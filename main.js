"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => UploadImageCloudflarePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  enabled: true,
  serverUrl: "",
  r2Endpoint: "",
  r2AccessKeyId: "",
  r2SecretAccessKey: "",
  r2Bucket: "",
  baseUrl: "",
  timeoutMs: 3e4,
  debug: false,
  includeContentLength: false
};
var UploadImageCloudflarePlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.statusEl = null;
    this.uploadingCount = 0;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new UploadImageCfSettingTab(this.app, this));
    this.statusEl = this.addStatusBarItem();
    this.updateStatusBar();
    this.registerEvent(
      this.app.workspace.on("editor-paste", async (evt, editor, view) => {
        try {
          if (!this.settings.enabled) return;
          if (!evt.clipboardData) return;
          const files = Array.from(evt.clipboardData.files || []).filter((f) => {
            var _a;
            return (_a = f.type) == null ? void 0 : _a.startsWith("image/");
          });
          if (files.length === 0) return;
          evt.preventDefault();
          for (const file of files) {
            await this.handleImagePaste(editor, file);
          }
        } catch (e) {
          console.error(e);
          new import_obsidian.Notice("\u5904\u7406\u7C98\u8D34\u56FE\u7247\u65F6\u51FA\u9519", 5e3);
        }
      })
    );
    this.addCommand({
      id: "toggle-auto-upload",
      name: "\u5207\u6362\u7C98\u8D34\u56FE\u7247\u81EA\u52A8\u4E0A\u4F20",
      callback: async () => {
        this.settings.enabled = !this.settings.enabled;
        await this.saveSettings();
        new import_obsidian.Notice(this.settings.enabled ? "\u5DF2\u5F00\u542F\u81EA\u52A8\u4E0A\u4F20" : "\u5DF2\u5173\u95ED\u81EA\u52A8\u4E0A\u4F20", 2500);
      }
    });
    this.addCommand({
      id: "test-connectivity",
      name: "\u6D4B\u8BD5\u670D\u52A1\u5668\u8FDE\u901A\u6027",
      callback: async () => {
        try {
          await this.pingServer();
        } catch (e) {
          new ErrorModal(this.app, "\u8FDE\u901A\u6027\u6D4B\u8BD5\u5931\u8D25", (e == null ? void 0 : e.message) || String(e)).open();
        }
      }
    });
  }
  onunload() {
  }
  updateStatusBar() {
    if (!this.statusEl) return;
    if (this.uploadingCount > 0) {
      this.statusEl.setText(`\u4E0A\u4F20\u4E2D(${this.uploadingCount})\u2026`);
    } else {
      this.statusEl.setText("");
    }
  }
  async handleImagePaste(editor, file) {
    const placeholder = `![${file.name} \u4E0A\u4F20\u4E2D\u2026]()`;
    const from = editor.getCursor();
    editor.replaceRange(placeholder, from);
    const to = { line: from.line, ch: from.ch + placeholder.length };
    this.uploadingCount += 1;
    this.updateStatusBar();
    try {
      const url = await this.uploadToServer(file);
      const finalMd = `![${file.name}](${url})`;
      editor.replaceRange(finalMd, from, to);
      new import_obsidian.Notice("\u56FE\u7247\u4E0A\u4F20\u6210\u529F", 2e3);
    } catch (err) {
      console.error(err);
      editor.replaceRange("", from, to);
      const message = (err == null ? void 0 : err.message) || "\u4E0A\u4F20\u5931\u8D25";
      new ErrorModal(this.app, "\u4E0A\u4F20\u5931\u8D25", message).open();
    } finally {
      this.uploadingCount -= 1;
      if (this.uploadingCount < 0) this.uploadingCount = 0;
      this.updateStatusBar();
    }
  }
  async uploadToServer(file) {
    if (!this.settings.serverUrl) {
      throw new Error("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199\u4E0A\u4F20\u670D\u52A1\u5668\u5730\u5740");
    }
    const { body, contentType } = await buildMultipartBody({
      fieldName: "file",
      fileName: file.name || "pasted-image",
      contentType: file.type || "application/octet-stream",
      data: await file.arrayBuffer()
    });
    const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    if (this.settings.debug) {
      console.info("[upload-image-cloudflare] multipart", { contentType, bytes: body.byteLength });
    }
    const headers = {
      "X-R2-Endpoint": this.settings.r2Endpoint || "",
      "X-R2-Access-Key-Id": this.settings.r2AccessKeyId || "",
      "X-R2-Secret-Access-Key": this.settings.r2SecretAccessKey || "",
      "X-R2-Bucket": this.settings.r2Bucket || "",
      "X-Base-Url": this.settings.baseUrl || ""
    };
    if (this.settings.includeContentLength) {
      headers["Content-Length"] = String(body.byteLength);
    }
    const res = await (0, import_obsidian.requestUrl)({
      url: this.settings.serverUrl,
      method: "POST",
      contentType,
      // 使用 requestUrl 的 contentType 字段设置 Content-Type
      headers,
      body: ab,
      throw: false,
      timeout: Math.max(1e3, Number(this.settings.timeoutMs) || 3e4)
    });
    if (this.settings.debug) {
      console.info("[upload-image-cloudflare] response", res.status);
    }
    if (res.status >= 400) {
      const snippet = (res.text || "").slice(0, 200);
      throw new Error(`HTTP ${res.status}: ${snippet}`);
    }
    let data = null;
    try {
      data = JSON.parse(res.text);
    } catch (_) {
      throw new Error("\u670D\u52A1\u5668\u8FD4\u56DE\u975E JSON \u54CD\u5E94");
    }
    if (!data || data.ok !== true) {
      const msg = (data == null ? void 0 : data.message) || (data == null ? void 0 : data.error) || "\u4E0A\u4F20\u5931\u8D25 (ok != true)";
      throw new Error(String(msg));
    }
    if (!data.url || typeof data.url !== "string") {
      throw new Error("\u54CD\u5E94\u7F3A\u5C11 url \u5B57\u6BB5");
    }
    return data.url;
  }
  async pingServer() {
    if (!this.settings.serverUrl) {
      throw new Error("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199\u4E0A\u4F20\u670D\u52A1\u5668\u5730\u5740");
    }
    const url = this.settings.serverUrl;
    const timeout = Math.max(1e3, Number(this.settings.timeoutMs) || 3e4);
    const start = Date.now();
    const res = await headOrGet(url, timeout);
    const ms = Date.now() - start;
    if (res.status >= 400) {
      const snippet = (res.text || "").slice(0, 200);
      throw new Error(`HTTP ${res.status} (${ms}ms): ${snippet}`);
    }
    new import_obsidian.Notice(`\u8FDE\u901A\u6027\u6B63\u5E38: ${res.status} (${ms}ms)`, 3e3);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var UploadImageCfSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Cloudflare R2 \u56FE\u7247\u4E0A\u4F20" });
    new import_obsidian.Setting(containerEl).setName("\u81EA\u52A8\u4E0A\u4F20\u7C98\u8D34\u56FE\u7247").setDesc("\u542F\u7528\u540E\uFF0C\u7C98\u8D34\u56FE\u7247\u4F1A\u81EA\u52A8\u4E0A\u4F20").addToggle(
      (t) => t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
        this.plugin.settings.enabled = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u4E0A\u4F20\u670D\u52A1\u5668\u5730\u5740").setDesc("\u7528\u4E8E\u63A5\u6536\u4E0A\u4F20\u5E76\u8F6C\u5B58\u5230 R2 \u7684\u670D\u52A1 URL").addText(
      (text) => text.setPlaceholder("https://your-upload-server.example.com/upload").setValue(this.plugin.settings.serverUrl).onChange(async (v) => {
        this.plugin.settings.serverUrl = v.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "R2 \u51ED\u636E\u4E0E\u914D\u7F6E (\u968F\u8BF7\u6C42\u5934\u53D1\u9001)" });
    new import_obsidian.Setting(containerEl).setName("X-R2-Endpoint").addText(
      (text) => text.setPlaceholder("https://<account-id>.r2.cloudflarestorage.com").setValue(this.plugin.settings.r2Endpoint).onChange(async (v) => {
        this.plugin.settings.r2Endpoint = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("X-R2-Access-Key-Id").addText((text) => {
      text.setValue(this.plugin.settings.r2AccessKeyId).onChange(async (v) => {
        this.plugin.settings.r2AccessKeyId = v.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("X-R2-Secret-Access-Key").addText((text) => {
      text.inputEl.type = "password";
      text.setValue(this.plugin.settings.r2SecretAccessKey).onChange(async (v) => {
        this.plugin.settings.r2SecretAccessKey = v.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("X-R2-Bucket").addText(
      (text) => text.setValue(this.plugin.settings.r2Bucket).onChange(async (v) => {
        this.plugin.settings.r2Bucket = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("X-Base-Url").addText(
      (text) => text.setValue(this.plugin.settings.baseUrl).onChange(async (v) => {
        this.plugin.settings.baseUrl = v.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u7F51\u7EDC\u4E0E\u8C03\u8BD5" });
    new import_obsidian.Setting(containerEl).setName("\u8BF7\u6C42\u8D85\u65F6 (ms)").setDesc("\u9ED8\u8BA4 30000\uFF0C\u79FB\u52A8\u7AEF\u7F51\u7EDC\u53EF\u9002\u5F53\u52A0\u5927").addText(
      (text) => {
        var _a;
        return text.setPlaceholder("30000").setValue(String((_a = this.plugin.settings.timeoutMs) != null ? _a : 3e4)).onChange(async (v) => {
          const n = Number(v);
          this.plugin.settings.timeoutMs = Number.isFinite(n) && n > 0 ? Math.floor(n) : 3e4;
          await this.plugin.saveSettings();
        });
      }
    );
    new import_obsidian.Setting(containerEl).setName("\u53D1\u9001 Content-Length \u5934").setDesc("\u67D0\u4E9B\u540E\u7AEF\u9700\u8981\u660E\u786E Content-Length").addToggle(
      (t) => t.setValue(this.plugin.settings.includeContentLength).onChange(async (v) => {
        this.plugin.settings.includeContentLength = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u8C03\u8BD5\u6A21\u5F0F").setDesc("\u8F93\u51FA\u66F4\u591A\u65E5\u5FD7\u5E76\u663E\u793A\u8BE6\u7EC6\u9519\u8BEF").addToggle(
      (t) => t.setValue(this.plugin.settings.debug).onChange(async (v) => {
        this.plugin.settings.debug = v;
        await this.plugin.saveSettings();
      })
    );
  }
};
var ErrorModal = class extends import_obsidian.Modal {
  constructor(app, titleText, message) {
    super(app);
    this.titleText = titleText;
    this.message = message;
  }
  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.titleText);
    contentEl.createEl("p", { text: this.message });
  }
};
async function headOrGet(url, timeout) {
  let res = await (0, import_obsidian.requestUrl)({ url, method: "HEAD", throw: false, timeout });
  if (res.status === 405 || res.status === 501) {
    res = await (0, import_obsidian.requestUrl)({ url, method: "GET", throw: false, timeout });
  }
  return res;
}
function escapeQuotes(s) {
  return s.replace(/"/g, '\\"');
}
async function buildMultipartBody(args) {
  const boundary = `----obsidian-r2-upload-${Math.random().toString(16).slice(2)}`;
  const enc = new TextEncoder();
  const CRLF = "\r\n";
  const head = `--${boundary}` + CRLF + `Content-Disposition: form-data; name="${escapeQuotes(args.fieldName)}"; filename="${escapeQuotes(
    args.fileName
  )}"` + CRLF + `Content-Type: ${args.contentType}` + CRLF + CRLF;
  const tail = CRLF + `--${boundary}--` + CRLF;
  const headBytes = enc.encode(head);
  const dataBytes = new Uint8Array(args.data);
  const tailBytes = enc.encode(tail);
  const merged = concatBytes(headBytes, dataBytes, tailBytes);
  return { body: merged, contentType: `multipart/form-data; boundary=${boundary}` };
}
function concatBytes(...parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IEFwcCwgRWRpdG9yLCBNYXJrZG93blZpZXcsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgcmVxdWVzdFVybCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJ1xuXG5pbnRlcmZhY2UgVXBsb2FkSW1hZ2VDZlNldHRpbmdzIHtcbiAgZW5hYmxlZDogYm9vbGVhbiAvLyBcdTY2MkZcdTU0MjZcdTVGMDBcdTU0MkZcdTgxRUFcdTUyQThcdTRFMEFcdTRGMjBcbiAgc2VydmVyVXJsOiBzdHJpbmcgLy8gXHU0RTBBXHU0RjIwXHU2NzBEXHU1MkExXHU1NjY4XHU1NzMwXHU1NzQwXG4gIHIyRW5kcG9pbnQ6IHN0cmluZyAvLyBYLVIyLUVuZHBvaW50XG4gIHIyQWNjZXNzS2V5SWQ6IHN0cmluZyAvLyBYLVIyLUFjY2Vzcy1LZXktSWRcbiAgcjJTZWNyZXRBY2Nlc3NLZXk6IHN0cmluZyAvLyBYLVIyLVNlY3JldC1BY2Nlc3MtS2V5XG4gIHIyQnVja2V0OiBzdHJpbmcgLy8gWC1SMi1CdWNrZXRcbiAgYmFzZVVybDogc3RyaW5nIC8vIFgtQmFzZS1VcmxcbiAgdGltZW91dE1zOiBudW1iZXIgLy8gXHU4QkY3XHU2QzQyXHU4RDg1XHU2NUY2XHVGRjA4XHU2QkVCXHU3OUQyXHVGRjA5XG4gIGRlYnVnOiBib29sZWFuIC8vIFx1OEMwM1x1OEJENVx1NkEyMVx1NUYwRlx1RkYwQ1x1OEY5M1x1NTFGQVx1NjZGNFx1NTkxQVx1NjVFNVx1NUZEN1x1NEUwRVx1OTUxOVx1OEJFRlx1NEZFMVx1NjA2RlxuICBpbmNsdWRlQ29udGVudExlbmd0aDogYm9vbGVhbiAvLyBcdTY2MkZcdTU0MjZcdTY2M0VcdTVGMEZcdTUzRDFcdTkwMDEgQ29udGVudC1MZW5ndGhcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogVXBsb2FkSW1hZ2VDZlNldHRpbmdzID0ge1xuICBlbmFibGVkOiB0cnVlLFxuICBzZXJ2ZXJVcmw6ICcnLFxuICByMkVuZHBvaW50OiAnJyxcbiAgcjJBY2Nlc3NLZXlJZDogJycsXG4gIHIyU2VjcmV0QWNjZXNzS2V5OiAnJyxcbiAgcjJCdWNrZXQ6ICcnLFxuICBiYXNlVXJsOiAnJyxcbiAgdGltZW91dE1zOiAzMDAwMCxcbiAgZGVidWc6IGZhbHNlLFxuICBpbmNsdWRlQ29udGVudExlbmd0aDogZmFsc2UsXG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVwbG9hZEltYWdlQ2xvdWRmbGFyZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBVcGxvYWRJbWFnZUNmU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTXG4gIHByaXZhdGUgc3RhdHVzRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGxcbiAgcHJpdmF0ZSB1cGxvYWRpbmdDb3VudCA9IDBcblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKVxuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBVcGxvYWRJbWFnZUNmU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpXG5cbiAgICAvLyBcdTcyQjZcdTYwMDFcdTY4MEZcdTY2M0VcdTc5M0FcdTRFMEFcdTRGMjBcdTRFMkRcbiAgICB0aGlzLnN0YXR1c0VsID0gdGhpcy5hZGRTdGF0dXNCYXJJdGVtKClcbiAgICB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpXG5cbiAgICAvLyBcdTc2RDFcdTU0MkNcdTdGMTZcdThGOTFcdTU2NjhcdTdDOThcdThEMzRcdTRFOEJcdTRFRjZcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2VkaXRvci1wYXN0ZScsIGFzeW5jIChldnQ6IENsaXBib2FyZEV2ZW50LCBlZGl0b3I6IEVkaXRvciwgdmlldzogTWFya2Rvd25WaWV3KSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKCF0aGlzLnNldHRpbmdzLmVuYWJsZWQpIHJldHVyblxuICAgICAgICAgIGlmICghZXZ0LmNsaXBib2FyZERhdGEpIHJldHVyblxuXG4gICAgICAgICAgY29uc3QgZmlsZXMgPSBBcnJheS5mcm9tKGV2dC5jbGlwYm9hcmREYXRhLmZpbGVzIHx8IFtdKS5maWx0ZXIoKGYpID0+IGYudHlwZT8uc3RhcnRzV2l0aCgnaW1hZ2UvJykpXG4gICAgICAgICAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgICAgICAgICAvLyBcdTk2M0JcdTZCNjJcdTlFRDhcdThCQTRcdTg4NENcdTRFM0FcdUZGMDhcdTkwN0ZcdTUxNERcdTRGRERcdTVCNThcdTUyMzBcdTY3MkNcdTU3MzBcdTk2NDRcdTRFRjZcdUZGMDlcbiAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUltYWdlUGFzdGUoZWRpdG9yLCBmaWxlKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSlcbiAgICAgICAgICBuZXcgTm90aWNlKCdcdTU5MDRcdTc0MDZcdTdDOThcdThEMzRcdTU2RkVcdTcyNDdcdTY1RjZcdTUxRkFcdTk1MTknLCA1MDAwKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIClcblxuICAgIC8vIFx1NTQ3RFx1NEVFNFx1RkYxQVx1NUYwMC9cdTUxNzNcdTgxRUFcdTUyQThcdTRFMEFcdTRGMjBcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICd0b2dnbGUtYXV0by11cGxvYWQnLFxuICAgICAgbmFtZTogJ1x1NTIwN1x1NjM2Mlx1N0M5OFx1OEQzNFx1NTZGRVx1NzI0N1x1ODFFQVx1NTJBOFx1NEUwQVx1NEYyMCcsXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgICB0aGlzLnNldHRpbmdzLmVuYWJsZWQgPSAhdGhpcy5zZXR0aW5ncy5lbmFibGVkXG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKClcbiAgICAgICAgbmV3IE5vdGljZSh0aGlzLnNldHRpbmdzLmVuYWJsZWQgPyAnXHU1REYyXHU1RjAwXHU1NDJGXHU4MUVBXHU1MkE4XHU0RTBBXHU0RjIwJyA6ICdcdTVERjJcdTUxNzNcdTk1RURcdTgxRUFcdTUyQThcdTRFMEFcdTRGMjAnLCAyNTAwKVxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgLy8gXHU1NDdEXHU0RUU0XHVGRjFBXHU2RDRCXHU4QkQ1XHU2NzBEXHU1MkExXHU1NjY4XHU4RkRFXHU5MDFBXHU2MDI3XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAndGVzdC1jb25uZWN0aXZpdHknLFxuICAgICAgbmFtZTogJ1x1NkQ0Qlx1OEJENVx1NjcwRFx1NTJBMVx1NTY2OFx1OEZERVx1OTAxQVx1NjAyNycsXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGluZ1NlcnZlcigpXG4gICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgIG5ldyBFcnJvck1vZGFsKHRoaXMuYXBwLCAnXHU4RkRFXHU5MDFBXHU2MDI3XHU2RDRCXHU4QkQ1XHU1OTMxXHU4RDI1JywgZT8ubWVzc2FnZSB8fCBTdHJpbmcoZSkpLm9wZW4oKVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pXG4gIH1cblxuICBvbnVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSB1cGRhdGVTdGF0dXNCYXIoKSB7XG4gICAgaWYgKCF0aGlzLnN0YXR1c0VsKSByZXR1cm5cbiAgICBpZiAodGhpcy51cGxvYWRpbmdDb3VudCA+IDApIHtcbiAgICAgIHRoaXMuc3RhdHVzRWwuc2V0VGV4dChgXHU0RTBBXHU0RjIwXHU0RTJEKCR7dGhpcy51cGxvYWRpbmdDb3VudH0pXHUyMDI2YClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zdGF0dXNFbC5zZXRUZXh0KCcnKVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlSW1hZ2VQYXN0ZShlZGl0b3I6IEVkaXRvciwgZmlsZTogRmlsZSkge1xuICAgIC8vIFx1NjNEMlx1NTE2NVx1NTM2MFx1NEY0RFx1N0IyNlxuICAgIGNvbnN0IHBsYWNlaG9sZGVyID0gYCFbJHtmaWxlLm5hbWV9IFx1NEUwQVx1NEYyMFx1NEUyRFx1MjAyNl0oKWBcbiAgICBjb25zdCBmcm9tID0gZWRpdG9yLmdldEN1cnNvcigpXG4gICAgZWRpdG9yLnJlcGxhY2VSYW5nZShwbGFjZWhvbGRlciwgZnJvbSlcbiAgICBjb25zdCB0byA9IHsgbGluZTogZnJvbS5saW5lLCBjaDogZnJvbS5jaCArIHBsYWNlaG9sZGVyLmxlbmd0aCB9XG5cbiAgICAvLyBcdThCQTFcdTY1NzAgKzFcbiAgICB0aGlzLnVwbG9hZGluZ0NvdW50ICs9IDFcbiAgICB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpXG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgdXJsID0gYXdhaXQgdGhpcy51cGxvYWRUb1NlcnZlcihmaWxlKVxuICAgICAgY29uc3QgZmluYWxNZCA9IGAhWyR7ZmlsZS5uYW1lfV0oJHt1cmx9KWBcbiAgICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UoZmluYWxNZCwgZnJvbSwgdG8pXG4gICAgICBuZXcgTm90aWNlKCdcdTU2RkVcdTcyNDdcdTRFMEFcdTRGMjBcdTYyMTBcdTUyOUYnLCAyMDAwKVxuICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICBjb25zb2xlLmVycm9yKGVycilcbiAgICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UoJycsIGZyb20sIHRvKSAvLyBcdTc5RkJcdTk2NjRcdTUzNjBcdTRGNERcdTdCMjZcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnI/Lm1lc3NhZ2UgfHwgJ1x1NEUwQVx1NEYyMFx1NTkzMVx1OEQyNSdcbiAgICAgIG5ldyBFcnJvck1vZGFsKHRoaXMuYXBwLCAnXHU0RTBBXHU0RjIwXHU1OTMxXHU4RDI1JywgbWVzc2FnZSkub3BlbigpXG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMudXBsb2FkaW5nQ291bnQgLT0gMVxuICAgICAgaWYgKHRoaXMudXBsb2FkaW5nQ291bnQgPCAwKSB0aGlzLnVwbG9hZGluZ0NvdW50ID0gMFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgdXBsb2FkVG9TZXJ2ZXIoZmlsZTogRmlsZSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLnNlcnZlclVybCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdcdThCRjdcdTUxNDhcdTU3MjhcdThCQkVcdTdGNkVcdTRFMkRcdTU4NkJcdTUxOTlcdTRFMEFcdTRGMjBcdTY3MERcdTUyQTFcdTU2NjhcdTU3MzBcdTU3NDAnKVxuICAgIH1cblxuICAgIGNvbnN0IHsgYm9keSwgY29udGVudFR5cGUgfSA9IGF3YWl0IGJ1aWxkTXVsdGlwYXJ0Qm9keSh7XG4gICAgICBmaWVsZE5hbWU6ICdmaWxlJyxcbiAgICAgIGZpbGVOYW1lOiBmaWxlLm5hbWUgfHwgJ3Bhc3RlZC1pbWFnZScsXG4gICAgICBjb250ZW50VHlwZTogZmlsZS50eXBlIHx8ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nLFxuICAgICAgZGF0YTogYXdhaXQgZmlsZS5hcnJheUJ1ZmZlcigpLFxuICAgIH0pXG5cbiAgICAvLyBcdTVDMDYgVWludDhBcnJheSBcdTVCODlcdTUxNjhcdThGNkNcdTYzNjJcdTRFM0EgQXJyYXlCdWZmZXJcdUZGMDhcdTdDQkVcdTc4NkUgc2xpY2VcdUZGMDlcbiAgICBjb25zdCBhYiA9IGJvZHkuYnVmZmVyLnNsaWNlKGJvZHkuYnl0ZU9mZnNldCwgYm9keS5ieXRlT2Zmc2V0ICsgYm9keS5ieXRlTGVuZ3RoKVxuXG4gICAgLy8gXHU0RkJGXHU0RThFXHU4QzAzXHU4QkQ1XHVGRjFBXHU2MjUzXHU1MzcwIG11bHRpcGFydCBcdTUxNzNcdTk1MkVcdTRGRTFcdTYwNkZcdUZGMDhcdTRFMERcdTUzMDVcdTU0MkJcdTY1NEZcdTYxMUZcdTUxODVcdTVCQjlcdUZGMDlcbiAgICBpZiAodGhpcy5zZXR0aW5ncy5kZWJ1Zykge1xuICAgICAgY29uc29sZS5pbmZvKCdbdXBsb2FkLWltYWdlLWNsb3VkZmxhcmVdIG11bHRpcGFydCcsIHsgY29udGVudFR5cGUsIGJ5dGVzOiBib2R5LmJ5dGVMZW5ndGggfSlcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgJ1gtUjItRW5kcG9pbnQnOiB0aGlzLnNldHRpbmdzLnIyRW5kcG9pbnQgfHwgJycsXG4gICAgICAnWC1SMi1BY2Nlc3MtS2V5LUlkJzogdGhpcy5zZXR0aW5ncy5yMkFjY2Vzc0tleUlkIHx8ICcnLFxuICAgICAgJ1gtUjItU2VjcmV0LUFjY2Vzcy1LZXknOiB0aGlzLnNldHRpbmdzLnIyU2VjcmV0QWNjZXNzS2V5IHx8ICcnLFxuICAgICAgJ1gtUjItQnVja2V0JzogdGhpcy5zZXR0aW5ncy5yMkJ1Y2tldCB8fCAnJyxcbiAgICAgICdYLUJhc2UtVXJsJzogdGhpcy5zZXR0aW5ncy5iYXNlVXJsIHx8ICcnLFxuICAgIH1cbiAgICBpZiAodGhpcy5zZXR0aW5ncy5pbmNsdWRlQ29udGVudExlbmd0aCkge1xuICAgICAgaGVhZGVyc1snQ29udGVudC1MZW5ndGgnXSA9IFN0cmluZyhib2R5LmJ5dGVMZW5ndGgpXG4gICAgfVxuXG4gICAgY29uc3QgcmVzID0gYXdhaXQgcmVxdWVzdFVybCh7XG4gICAgICB1cmw6IHRoaXMuc2V0dGluZ3Muc2VydmVyVXJsLFxuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBjb250ZW50VHlwZSwgLy8gXHU0RjdGXHU3NTI4IHJlcXVlc3RVcmwgXHU3Njg0IGNvbnRlbnRUeXBlIFx1NUI1N1x1NkJCNVx1OEJCRVx1N0Y2RSBDb250ZW50LVR5cGVcbiAgICAgIGhlYWRlcnMsXG4gICAgICBib2R5OiBhYixcbiAgICAgIHRocm93OiBmYWxzZSxcbiAgICAgIHRpbWVvdXQ6IE1hdGgubWF4KDEwMDAsIE51bWJlcih0aGlzLnNldHRpbmdzLnRpbWVvdXRNcykgfHwgMzAwMDApLFxuICAgIH0pXG5cbiAgICBpZiAodGhpcy5zZXR0aW5ncy5kZWJ1Zykge1xuICAgICAgY29uc29sZS5pbmZvKCdbdXBsb2FkLWltYWdlLWNsb3VkZmxhcmVdIHJlc3BvbnNlJywgcmVzLnN0YXR1cylcbiAgICB9XG5cbiAgICBpZiAocmVzLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgIGNvbnN0IHNuaXBwZXQgPSAocmVzLnRleHQgfHwgJycpLnNsaWNlKDAsIDIwMClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCAke3Jlcy5zdGF0dXN9OiAke3NuaXBwZXR9YClcbiAgICB9XG5cbiAgICBsZXQgZGF0YTogYW55ID0gbnVsbFxuICAgIHRyeSB7XG4gICAgICBkYXRhID0gSlNPTi5wYXJzZShyZXMudGV4dClcbiAgICB9IGNhdGNoIChfKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1x1NjcwRFx1NTJBMVx1NTY2OFx1OEZENFx1NTZERVx1OTc1RSBKU09OIFx1NTRDRFx1NUU5NCcpXG4gICAgfVxuXG4gICAgaWYgKCFkYXRhIHx8IGRhdGEub2sgIT09IHRydWUpIHtcbiAgICAgIGNvbnN0IG1zZyA9IGRhdGE/Lm1lc3NhZ2UgfHwgZGF0YT8uZXJyb3IgfHwgJ1x1NEUwQVx1NEYyMFx1NTkzMVx1OEQyNSAob2sgIT0gdHJ1ZSknXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoU3RyaW5nKG1zZykpXG4gICAgfVxuICAgIGlmICghZGF0YS51cmwgfHwgdHlwZW9mIGRhdGEudXJsICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdcdTU0Q0RcdTVFOTRcdTdGM0FcdTVDMTEgdXJsIFx1NUI1N1x1NkJCNScpXG4gICAgfVxuICAgIHJldHVybiBkYXRhLnVybCBhcyBzdHJpbmdcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcGluZ1NlcnZlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXRoaXMuc2V0dGluZ3Muc2VydmVyVXJsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1x1OEJGN1x1NTE0OFx1NTcyOFx1OEJCRVx1N0Y2RVx1NEUyRFx1NTg2Qlx1NTE5OVx1NEUwQVx1NEYyMFx1NjcwRFx1NTJBMVx1NTY2OFx1NTczMFx1NTc0MCcpXG4gICAgfVxuICAgIGNvbnN0IHVybCA9IHRoaXMuc2V0dGluZ3Muc2VydmVyVXJsXG4gICAgY29uc3QgdGltZW91dCA9IE1hdGgubWF4KDEwMDAsIE51bWJlcih0aGlzLnNldHRpbmdzLnRpbWVvdXRNcykgfHwgMzAwMDApXG4gICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpXG4gICAgY29uc3QgcmVzID0gYXdhaXQgaGVhZE9yR2V0KHVybCwgdGltZW91dClcbiAgICBjb25zdCBtcyA9IERhdGUubm93KCkgLSBzdGFydFxuICAgIGlmIChyZXMuc3RhdHVzID49IDQwMCkge1xuICAgICAgY29uc3Qgc25pcHBldCA9IChyZXMudGV4dCB8fCAnJykuc2xpY2UoMCwgMjAwKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQICR7cmVzLnN0YXR1c30gKCR7bXN9bXMpOiAke3NuaXBwZXR9YClcbiAgICB9XG4gICAgbmV3IE5vdGljZShgXHU4RkRFXHU5MDFBXHU2MDI3XHU2QjYzXHU1RTM4OiAke3Jlcy5zdGF0dXN9ICgke21zfW1zKWAsIDMwMDApXG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSlcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpXG4gIH1cbn1cblxuY2xhc3MgVXBsb2FkSW1hZ2VDZlNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgcGx1Z2luOiBVcGxvYWRJbWFnZUNsb3VkZmxhcmVQbHVnaW5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogVXBsb2FkSW1hZ2VDbG91ZGZsYXJlUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pXG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW5cbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpc1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KClcblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0Nsb3VkZmxhcmUgUjIgXHU1NkZFXHU3MjQ3XHU0RTBBXHU0RjIwJyB9KVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnXHU4MUVBXHU1MkE4XHU0RTBBXHU0RjIwXHU3Qzk4XHU4RDM0XHU1NkZFXHU3MjQ3JylcbiAgICAgIC5zZXREZXNjKCdcdTU0MkZcdTc1MjhcdTU0MEVcdUZGMENcdTdDOThcdThEMzRcdTU2RkVcdTcyNDdcdTRGMUFcdTgxRUFcdTUyQThcdTRFMEFcdTRGMjAnKVxuICAgICAgLmFkZFRvZ2dsZSgodCkgPT5cbiAgICAgICAgdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVkKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZWQgPSB2XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKClcbiAgICAgICAgfSlcbiAgICAgIClcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1x1NEUwQVx1NEYyMFx1NjcwRFx1NTJBMVx1NTY2OFx1NTczMFx1NTc0MCcpXG4gICAgICAuc2V0RGVzYygnXHU3NTI4XHU0RThFXHU2M0E1XHU2NTM2XHU0RTBBXHU0RjIwXHU1RTc2XHU4RjZDXHU1QjU4XHU1MjMwIFIyIFx1NzY4NFx1NjcwRFx1NTJBMSBVUkwnKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ2h0dHBzOi8veW91ci11cGxvYWQtc2VydmVyLmV4YW1wbGUuY29tL3VwbG9hZCcpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNlcnZlclVybClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNlcnZlclVybCA9IHYudHJpbSgpXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKVxuICAgICAgICAgIH0pXG4gICAgICApXG5cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdSMiBcdTUxRURcdTYzNkVcdTRFMEVcdTkxNERcdTdGNkUgKFx1OTY4Rlx1OEJGN1x1NkM0Mlx1NTkzNFx1NTNEMVx1OTAwMSknIH0pXG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZSgnWC1SMi1FbmRwb2ludCcpLmFkZFRleHQoKHRleHQpID0+XG4gICAgICB0ZXh0XG4gICAgICAgIC5zZXRQbGFjZWhvbGRlcignaHR0cHM6Ly88YWNjb3VudC1pZD4ucjIuY2xvdWRmbGFyZXN0b3JhZ2UuY29tJylcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnIyRW5kcG9pbnQpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnIyRW5kcG9pbnQgPSB2LnRyaW0oKVxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpXG4gICAgICAgIH0pXG4gICAgKVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoJ1gtUjItQWNjZXNzLUtleS1JZCcpLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucjJBY2Nlc3NLZXlJZCkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucjJBY2Nlc3NLZXlJZCA9IHYudHJpbSgpXG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpXG4gICAgICB9KVxuICAgIH0pXG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZSgnWC1SMi1TZWNyZXQtQWNjZXNzLUtleScpLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgIHRleHQuaW5wdXRFbC50eXBlID0gJ3Bhc3N3b3JkJ1xuICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5yMlNlY3JldEFjY2Vzc0tleSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucjJTZWNyZXRBY2Nlc3NLZXkgPSB2LnRyaW0oKVxuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoJ1gtUjItQnVja2V0JykuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucjJCdWNrZXQpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnIyQnVja2V0ID0gdi50cmltKClcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKClcbiAgICAgIH0pXG4gICAgKVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoJ1gtQmFzZS1VcmwnKS5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5iYXNlVXJsKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5iYXNlVXJsID0gdi50cmltKClcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKClcbiAgICAgIH0pXG4gICAgKVxuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnXHU3RjUxXHU3RURDXHU0RTBFXHU4QzAzXHU4QkQ1JyB9KVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnXHU4QkY3XHU2QzQyXHU4RDg1XHU2NUY2IChtcyknKVxuICAgICAgLnNldERlc2MoJ1x1OUVEOFx1OEJBNCAzMDAwMFx1RkYwQ1x1NzlGQlx1NTJBOFx1N0FFRlx1N0Y1MVx1N0VEQ1x1NTNFRlx1OTAwMlx1NUY1M1x1NTJBMFx1NTkyNycpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignMzAwMDAnKVxuICAgICAgICAgIC5zZXRWYWx1ZShTdHJpbmcodGhpcy5wbHVnaW4uc2V0dGluZ3MudGltZW91dE1zID8/IDMwMDAwKSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG4gPSBOdW1iZXIodilcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnRpbWVvdXRNcyA9IE51bWJlci5pc0Zpbml0ZShuKSAmJiBuID4gMCA/IE1hdGguZmxvb3IobikgOiAzMDAwMFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKClcbiAgICAgICAgICB9KVxuICAgICAgKVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnXHU1M0QxXHU5MDAxIENvbnRlbnQtTGVuZ3RoIFx1NTkzNCcpXG4gICAgICAuc2V0RGVzYygnXHU2N0QwXHU0RTlCXHU1NDBFXHU3QUVGXHU5NzAwXHU4OTgxXHU2NjBFXHU3ODZFIENvbnRlbnQtTGVuZ3RoJylcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+XG4gICAgICAgIHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5jbHVkZUNvbnRlbnRMZW5ndGgpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5jbHVkZUNvbnRlbnRMZW5ndGggPSB2XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKClcbiAgICAgICAgfSlcbiAgICAgIClcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1x1OEMwM1x1OEJENVx1NkEyMVx1NUYwRicpXG4gICAgICAuc2V0RGVzYygnXHU4RjkzXHU1MUZBXHU2NkY0XHU1OTFBXHU2NUU1XHU1RkQ3XHU1RTc2XHU2NjNFXHU3OTNBXHU4QkU2XHU3RUM2XHU5NTE5XHU4QkVGJylcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+XG4gICAgICAgIHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVidWcpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVidWcgPSB2XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKClcbiAgICAgICAgfSlcbiAgICAgIClcbiAgfVxufVxuXG5jbGFzcyBFcnJvck1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSB0aXRsZVRleHQ6IHN0cmluZywgcHJpdmF0ZSBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihhcHApXG4gIH1cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsLCB0aXRsZUVsIH0gPSB0aGlzXG4gICAgdGl0bGVFbC5zZXRUZXh0KHRoaXMudGl0bGVUZXh0KVxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogdGhpcy5tZXNzYWdlIH0pXG4gIH1cbn1cblxuLy8gXHU4RkRFXHU5MDFBXHU2MDI3XHU2RDRCXHU4QkQ1XG5hc3luYyBmdW5jdGlvbiBoZWFkT3JHZXQodXJsOiBzdHJpbmcsIHRpbWVvdXQ6IG51bWJlcikge1xuICAvLyBIRUFEIFx1NjcwOVx1NEU5Qlx1NjcwRFx1NTJBMVx1NEUwRFx1NjUyRlx1NjMwMVx1RkYwQ1x1NTkzMVx1OEQyNVx1NTIxOVx1NTZERVx1OTAwMCBHRVRcbiAgbGV0IHJlcyA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmwsIG1ldGhvZDogJ0hFQUQnLCB0aHJvdzogZmFsc2UsIHRpbWVvdXQgfSlcbiAgaWYgKHJlcy5zdGF0dXMgPT09IDQwNSB8fCByZXMuc3RhdHVzID09PSA1MDEpIHtcbiAgICByZXMgPSBhd2FpdCByZXF1ZXN0VXJsKHsgdXJsLCBtZXRob2Q6ICdHRVQnLCB0aHJvdzogZmFsc2UsIHRpbWVvdXQgfSlcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGVzY2FwZVF1b3RlcyhzOiBzdHJpbmcpIHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1aWxkTXVsdGlwYXJ0Qm9keShhcmdzOiB7XG4gIGZpZWxkTmFtZTogc3RyaW5nXG4gIGZpbGVOYW1lOiBzdHJpbmdcbiAgY29udGVudFR5cGU6IHN0cmluZ1xuICBkYXRhOiBBcnJheUJ1ZmZlclxufSk6IFByb21pc2U8eyBib2R5OiBVaW50OEFycmF5OyBjb250ZW50VHlwZTogc3RyaW5nIH0+IHtcbiAgY29uc3QgYm91bmRhcnkgPSBgLS0tLW9ic2lkaWFuLXIyLXVwbG9hZC0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMTYpLnNsaWNlKDIpfWBcbiAgY29uc3QgZW5jID0gbmV3IFRleHRFbmNvZGVyKClcbiAgY29uc3QgQ1JMRiA9ICdcXHJcXG4nXG5cbiAgY29uc3QgaGVhZCA9XG4gICAgYC0tJHtib3VuZGFyeX1gICtcbiAgICBDUkxGICtcbiAgICBgQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPVwiJHtlc2NhcGVRdW90ZXMoYXJncy5maWVsZE5hbWUpfVwiOyBmaWxlbmFtZT1cIiR7ZXNjYXBlUXVvdGVzKFxuICAgICAgYXJncy5maWxlTmFtZVxuICAgICl9XCJgICtcbiAgICBDUkxGICtcbiAgICBgQ29udGVudC1UeXBlOiAke2FyZ3MuY29udGVudFR5cGV9YCArXG4gICAgQ1JMRiArXG4gICAgQ1JMRlxuICBjb25zdCB0YWlsID0gQ1JMRiArIGAtLSR7Ym91bmRhcnl9LS1gICsgQ1JMRlxuXG4gIGNvbnN0IGhlYWRCeXRlcyA9IGVuYy5lbmNvZGUoaGVhZClcbiAgY29uc3QgZGF0YUJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoYXJncy5kYXRhKVxuICBjb25zdCB0YWlsQnl0ZXMgPSBlbmMuZW5jb2RlKHRhaWwpXG5cbiAgY29uc3QgbWVyZ2VkID0gY29uY2F0Qnl0ZXMoaGVhZEJ5dGVzLCBkYXRhQnl0ZXMsIHRhaWxCeXRlcylcbiAgcmV0dXJuIHsgYm9keTogbWVyZ2VkLCBjb250ZW50VHlwZTogYG11bHRpcGFydC9mb3JtLWRhdGE7IGJvdW5kYXJ5PSR7Ym91bmRhcnl9YCB9XG59XG5cbmZ1bmN0aW9uIGNvbmNhdEJ5dGVzKC4uLnBhcnRzOiBVaW50OEFycmF5W10pOiBVaW50OEFycmF5IHtcbiAgY29uc3QgdG90YWwgPSBwYXJ0cy5yZWR1Y2UoKHN1bSwgcCkgPT4gc3VtICsgcC5sZW5ndGgsIDApXG4gIGNvbnN0IG91dCA9IG5ldyBVaW50OEFycmF5KHRvdGFsKVxuICBsZXQgb2Zmc2V0ID0gMFxuICBmb3IgKGNvbnN0IHAgb2YgcGFydHMpIHtcbiAgICBvdXQuc2V0KHAsIG9mZnNl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
