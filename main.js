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
          const message = e instanceof Error ? e.message : String(e);
          new ErrorModal(this.app, "\u8FDE\u901A\u6027\u6D4B\u8BD5\u5931\u8D25", message).open();
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
      const message = err instanceof Error ? err.message : "\u4E0A\u4F20\u5931\u8D25";
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
      data: () => file.arrayBuffer()
    });
    const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    if (this.settings.debug) {
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
    }
    if (res.status >= 400) {
      const snippet = (res.text || "").slice(0, 200);
      throw new Error(`HTTP ${res.status}: ${snippet}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(res.text);
    } catch (e) {
      throw new Error("\u670D\u52A1\u5668\u8FD4\u56DE\u975E JSON \u54CD\u5E94");
    }
    if (!parsed || typeof parsed !== "object") {
      throw new Error("\u670D\u52A1\u5668\u8FD4\u56DE\u683C\u5F0F\u4E0D\u6B63\u786E");
    }
    const data = parsed;
    if (data.ok !== true) {
      const msg = typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : "\u4E0A\u4F20\u5931\u8D25 (ok != true)";
      throw new Error(msg);
    }
    if (typeof data.url !== "string") {
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
    new import_obsidian.Setting(containerEl).setName("Cloudflare r2 \u56FE\u7247\u4E0A\u4F20").setHeading();
    new import_obsidian.Setting(containerEl).setName("\u81EA\u52A8\u4E0A\u4F20\u7C98\u8D34\u56FE\u7247").setDesc("\u542F\u7528\u540E\uFF0C\u7C98\u8D34\u56FE\u7247\u4F1A\u81EA\u52A8\u4E0A\u4F20").addToggle(
      (t) => t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
        this.plugin.settings.enabled = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u4E0A\u4F20\u670D\u52A1\u5668\u5730\u5740").setDesc("\u7528\u4E8E\u63A5\u6536\u4E0A\u4F20\u5E76\u8F6C\u5B58\u5230 r2 \u7684\u670D\u52A1 url").addText(
      (text) => text.setPlaceholder("https://your-upload-server.example.com/upload").setValue(this.plugin.settings.serverUrl).onChange(async (v) => {
        this.plugin.settings.serverUrl = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("R2 \u51ED\u636E\u4E0E\u914D\u7F6E (\u968F\u8BF7\u6C42\u5934\u53D1\u9001)").setHeading();
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
    new import_obsidian.Setting(containerEl).setName("\u7F51\u7EDC\u4E0E\u8C03\u8BD5").setHeading();
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
    new import_obsidian.Setting(containerEl).setName("\u53D1\u9001 content-length \u5934").setDesc("\u67D0\u4E9B\u540E\u7AEF\u9700\u8981\u660E\u786E content-length").addToggle(
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
  const dataBuffer = await args.data();
  const dataBytes = new Uint8Array(dataBuffer);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IEFwcCwgRWRpdG9yLCBNYXJrZG93blZpZXcsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgcmVxdWVzdFVybCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJ1xuXG5pbnRlcmZhY2UgVXBsb2FkSW1hZ2VDZlNldHRpbmdzIHtcbiAgZW5hYmxlZDogYm9vbGVhbiAvLyBcdTY2MkZcdTU0MjZcdTVGMDBcdTU0MkZcdTgxRUFcdTUyQThcdTRFMEFcdTRGMjBcbiAgc2VydmVyVXJsOiBzdHJpbmcgLy8gXHU0RTBBXHU0RjIwXHU2NzBEXHU1MkExXHU1NjY4XHU1NzMwXHU1NzQwXG4gIHIyRW5kcG9pbnQ6IHN0cmluZyAvLyBYLVIyLUVuZHBvaW50XG4gIHIyQWNjZXNzS2V5SWQ6IHN0cmluZyAvLyBYLVIyLUFjY2Vzcy1LZXktSWRcbiAgcjJTZWNyZXRBY2Nlc3NLZXk6IHN0cmluZyAvLyBYLVIyLVNlY3JldC1BY2Nlc3MtS2V5XG4gIHIyQnVja2V0OiBzdHJpbmcgLy8gWC1SMi1CdWNrZXRcbiAgYmFzZVVybDogc3RyaW5nIC8vIFgtQmFzZS1VcmxcbiAgdGltZW91dE1zOiBudW1iZXIgLy8gXHU4QkY3XHU2QzQyXHU4RDg1XHU2NUY2XHVGRjA4XHU2QkVCXHU3OUQyXHVGRjA5XG4gIGRlYnVnOiBib29sZWFuIC8vIFx1OEMwM1x1OEJENVx1NkEyMVx1NUYwRlx1RkYwQ1x1OEY5M1x1NTFGQVx1NjZGNFx1NTkxQVx1NjVFNVx1NUZEN1x1NEUwRVx1OTUxOVx1OEJFRlx1NEZFMVx1NjA2RlxuICBpbmNsdWRlQ29udGVudExlbmd0aDogYm9vbGVhbiAvLyBcdTY2MkZcdTU0MjZcdTY2M0VcdTVGMEZcdTUzRDFcdTkwMDEgQ29udGVudC1MZW5ndGhcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogVXBsb2FkSW1hZ2VDZlNldHRpbmdzID0ge1xuICBlbmFibGVkOiB0cnVlLFxuICBzZXJ2ZXJVcmw6ICcnLFxuICByMkVuZHBvaW50OiAnJyxcbiAgcjJBY2Nlc3NLZXlJZDogJycsXG4gIHIyU2VjcmV0QWNjZXNzS2V5OiAnJyxcbiAgcjJCdWNrZXQ6ICcnLFxuICBiYXNlVXJsOiAnJyxcbiAgdGltZW91dE1zOiAzMDAwMCxcbiAgZGVidWc6IGZhbHNlLFxuICBpbmNsdWRlQ29udGVudExlbmd0aDogZmFsc2UsXG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVwbG9hZEltYWdlQ2xvdWRmbGFyZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBVcGxvYWRJbWFnZUNmU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTXG4gIHByaXZhdGUgc3RhdHVzRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGxcbiAgcHJpdmF0ZSB1cGxvYWRpbmdDb3VudCA9IDBcblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKVxuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBVcGxvYWRJbWFnZUNmU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpXG5cbiAgICAvLyBcdTcyQjZcdTYwMDFcdTY4MEZcdTY2M0VcdTc5M0FcdTRFMEFcdTRGMjBcdTRFMkRcbiAgICB0aGlzLnN0YXR1c0VsID0gdGhpcy5hZGRTdGF0dXNCYXJJdGVtKClcbiAgICB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpXG5cbiAgICAvLyBcdTc2RDFcdTU0MkNcdTdGMTZcdThGOTFcdTU2NjhcdTdDOThcdThEMzRcdTRFOEJcdTRFRjZcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2VkaXRvci1wYXN0ZScsIGFzeW5jIChldnQ6IENsaXBib2FyZEV2ZW50LCBlZGl0b3I6IEVkaXRvciwgdmlldzogTWFya2Rvd25WaWV3KSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKCF0aGlzLnNldHRpbmdzLmVuYWJsZWQpIHJldHVyblxuICAgICAgICAgIGlmICghZXZ0LmNsaXBib2FyZERhdGEpIHJldHVyblxuXG4gICAgICAgICAgY29uc3QgZmlsZXMgPSBBcnJheS5mcm9tKGV2dC5jbGlwYm9hcmREYXRhLmZpbGVzIHx8IFtdKS5maWx0ZXIoKGYpID0+IGYudHlwZT8uc3RhcnRzV2l0aCgnaW1hZ2UvJykpXG4gICAgICAgICAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgICAgICAgICAvLyBcdTk2M0JcdTZCNjJcdTlFRDhcdThCQTRcdTg4NENcdTRFM0FcdUZGMDhcdTkwN0ZcdTUxNERcdTRGRERcdTVCNThcdTUyMzBcdTY3MkNcdTU3MzBcdTk2NDRcdTRFRjZcdUZGMDlcbiAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUltYWdlUGFzdGUoZWRpdG9yLCBmaWxlKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSlcbiAgICAgICAgICBuZXcgTm90aWNlKCdcdTU5MDRcdTc0MDZcdTdDOThcdThEMzRcdTU2RkVcdTcyNDdcdTY1RjZcdTUxRkFcdTk1MTknLCA1MDAwKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIClcblxuICAgIC8vIFx1NTQ3RFx1NEVFNFx1RkYxQVx1NUYwMC9cdTUxNzNcdTgxRUFcdTUyQThcdTRFMEFcdTRGMjBcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICd0b2dnbGUtYXV0by11cGxvYWQnLFxuICAgICAgbmFtZTogJ1x1NTIwN1x1NjM2Mlx1N0M5OFx1OEQzNFx1NTZGRVx1NzI0N1x1ODFFQVx1NTJBOFx1NEUwQVx1NEYyMCcsXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgICB0aGlzLnNldHRpbmdzLmVuYWJsZWQgPSAhdGhpcy5zZXR0aW5ncy5lbmFibGVkXG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKClcbiAgICAgICAgbmV3IE5vdGljZSh0aGlzLnNldHRpbmdzLmVuYWJsZWQgPyAnXHU1REYyXHU1RjAwXHU1NDJGXHU4MUVBXHU1MkE4XHU0RTBBXHU0RjIwJyA6ICdcdTVERjJcdTUxNzNcdTk1RURcdTgxRUFcdTUyQThcdTRFMEFcdTRGMjAnLCAyNTAwKVxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgLy8gXHU1NDdEXHU0RUU0XHVGRjFBXHU2RDRCXHU4QkQ1XHU2NzBEXHU1MkExXHU1NjY4XHU4RkRFXHU5MDFBXHU2MDI3XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAndGVzdC1jb25uZWN0aXZpdHknLFxuICAgICAgbmFtZTogJ1x1NkQ0Qlx1OEJENVx1NjcwRFx1NTJBMVx1NTY2OFx1OEZERVx1OTAxQVx1NjAyNycsXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGluZ1NlcnZlcigpXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpXG4gICAgICAgICAgbmV3IEVycm9yTW9kYWwodGhpcy5hcHAsICdcdThGREVcdTkwMUFcdTYwMjdcdTZENEJcdThCRDVcdTU5MzFcdThEMjUnLCBtZXNzYWdlKS5vcGVuKClcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KVxuICB9XG5cbiAgb251bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgdXBkYXRlU3RhdHVzQmFyKCkge1xuICAgIGlmICghdGhpcy5zdGF0dXNFbCkgcmV0dXJuXG4gICAgaWYgKHRoaXMudXBsb2FkaW5nQ291bnQgPiAwKSB7XG4gICAgICB0aGlzLnN0YXR1c0VsLnNldFRleHQoYFx1NEUwQVx1NEYyMFx1NEUyRCgke3RoaXMudXBsb2FkaW5nQ291bnR9KVx1MjAyNmApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RhdHVzRWwuc2V0VGV4dCgnJylcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUltYWdlUGFzdGUoZWRpdG9yOiBFZGl0b3IsIGZpbGU6IEZpbGUpIHtcbiAgICAvLyBcdTYzRDJcdTUxNjVcdTUzNjBcdTRGNERcdTdCMjZcbiAgICBjb25zdCBwbGFjZWhvbGRlciA9IGAhWyR7ZmlsZS5uYW1lfSBcdTRFMEFcdTRGMjBcdTRFMkRcdTIwMjZdKClgXG4gICAgY29uc3QgZnJvbSA9IGVkaXRvci5nZXRDdXJzb3IoKVxuICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UocGxhY2Vob2xkZXIsIGZyb20pXG4gICAgY29uc3QgdG8gPSB7IGxpbmU6IGZyb20ubGluZSwgY2g6IGZyb20uY2ggKyBwbGFjZWhvbGRlci5sZW5ndGggfVxuXG4gICAgLy8gXHU4QkExXHU2NTcwICsxXG4gICAgdGhpcy51cGxvYWRpbmdDb3VudCArPSAxXG4gICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVybCA9IGF3YWl0IHRoaXMudXBsb2FkVG9TZXJ2ZXIoZmlsZSlcbiAgICAgIGNvbnN0IGZpbmFsTWQgPSBgIVske2ZpbGUubmFtZX1dKCR7dXJsfSlgXG4gICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKGZpbmFsTWQsIGZyb20sIHRvKVxuICAgICAgbmV3IE5vdGljZSgnXHU1NkZFXHU3MjQ3XHU0RTBBXHU0RjIwXHU2MjEwXHU1MjlGJywgMjAwMClcbiAgICB9IGNhdGNoIChlcnI6IHVua25vd24pIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKVxuICAgICAgZWRpdG9yLnJlcGxhY2VSYW5nZSgnJywgZnJvbSwgdG8pIC8vIFx1NzlGQlx1OTY2NFx1NTM2MFx1NEY0RFx1N0IyNlxuICAgICAgY29uc3QgbWVzc2FnZSA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiAnXHU0RTBBXHU0RjIwXHU1OTMxXHU4RDI1J1xuICAgICAgbmV3IEVycm9yTW9kYWwodGhpcy5hcHAsICdcdTRFMEFcdTRGMjBcdTU5MzFcdThEMjUnLCBtZXNzYWdlKS5vcGVuKClcbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy51cGxvYWRpbmdDb3VudCAtPSAxXG4gICAgICBpZiAodGhpcy51cGxvYWRpbmdDb3VudCA8IDApIHRoaXMudXBsb2FkaW5nQ291bnQgPSAwXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB1cGxvYWRUb1NlcnZlcihmaWxlOiBGaWxlKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBpZiAoIXRoaXMuc2V0dGluZ3Muc2VydmVyVXJsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1x1OEJGN1x1NTE0OFx1NTcyOFx1OEJCRVx1N0Y2RVx1NEUyRFx1NTg2Qlx1NTE5OVx1NEUwQVx1NEYyMFx1NjcwRFx1NTJBMVx1NTY2OFx1NTczMFx1NTc0MCcpXG4gICAgfVxuXG4gICAgY29uc3QgeyBib2R5LCBjb250ZW50VHlwZSB9ID0gYXdhaXQgYnVpbGRNdWx0aXBhcnRCb2R5KHtcbiAgICAgIGZpZWxkTmFtZTogJ2ZpbGUnLFxuICAgICAgZmlsZU5hbWU6IGZpbGUubmFtZSB8fCAncGFzdGVkLWltYWdlJyxcbiAgICAgIGNvbnRlbnRUeXBlOiBmaWxlLnR5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXG4gICAgICBkYXRhOiAoKSA9PiBmaWxlLmFycmF5QnVmZmVyKCksXG4gICAgfSlcblxuICAgIC8vIFx1NUMwNiBVaW50OEFycmF5IFx1NUI4OVx1NTE2OFx1OEY2Q1x1NjM2Mlx1NEUzQSBBcnJheUJ1ZmZlclx1RkYwOFx1N0NCRVx1Nzg2RSBzbGljZVx1RkYwOVxuICAgIGNvbnN0IGFiID0gYm9keS5idWZmZXIuc2xpY2UoYm9keS5ieXRlT2Zmc2V0LCBib2R5LmJ5dGVPZmZzZXQgKyBib2R5LmJ5dGVMZW5ndGgpXG5cbiAgICAvLyBcdTRGQkZcdTRFOEVcdThDMDNcdThCRDVcdUZGMUFcdTYyNTNcdTUzNzAgbXVsdGlwYXJ0IFx1NTE3M1x1OTUyRVx1NEZFMVx1NjA2Rlx1RkYwOFx1NEUwRFx1NTMwNVx1NTQyQlx1NjU0Rlx1NjExRlx1NTE4NVx1NUJCOVx1RkYwOVxuICAgIGlmICh0aGlzLnNldHRpbmdzLmRlYnVnKSB7XG4gICAgICAvLyBjb25zb2xlLmluZm8oJ1t1cGxvYWQtaW1hZ2UtY2xvdWRmbGFyZV0gbXVsdGlwYXJ0JywgeyBjb250ZW50VHlwZSwgYnl0ZXM6IGJvZHkuYnl0ZUxlbmd0aCB9KVxuICAgIH1cblxuICAgIGNvbnN0IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAnWC1SMi1FbmRwb2ludCc6IHRoaXMuc2V0dGluZ3MucjJFbmRwb2ludCB8fCAnJyxcbiAgICAgICdYLVIyLUFjY2Vzcy1LZXktSWQnOiB0aGlzLnNldHRpbmdzLnIyQWNjZXNzS2V5SWQgfHwgJycsXG4gICAgICAnWC1SMi1TZWNyZXQtQWNjZXNzLUtleSc6IHRoaXMuc2V0dGluZ3MucjJTZWNyZXRBY2Nlc3NLZXkgfHwgJycsXG4gICAgICAnWC1SMi1CdWNrZXQnOiB0aGlzLnNldHRpbmdzLnIyQnVja2V0IHx8ICcnLFxuICAgICAgJ1gtQmFzZS1VcmwnOiB0aGlzLnNldHRpbmdzLmJhc2VVcmwgfHwgJycsXG4gICAgfVxuICAgIGlmICh0aGlzLnNldHRpbmdzLmluY2x1ZGVDb250ZW50TGVuZ3RoKSB7XG4gICAgICBoZWFkZXJzWydDb250ZW50LUxlbmd0aCddID0gU3RyaW5nKGJvZHkuYnl0ZUxlbmd0aClcbiAgICB9XG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgIHVybDogdGhpcy5zZXR0aW5ncy5zZXJ2ZXJVcmwsXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGNvbnRlbnRUeXBlLCAvLyBcdTRGN0ZcdTc1MjggcmVxdWVzdFVybCBcdTc2ODQgY29udGVudFR5cGUgXHU1QjU3XHU2QkI1XHU4QkJFXHU3RjZFIENvbnRlbnQtVHlwZVxuICAgICAgaGVhZGVycyxcbiAgICAgIGJvZHk6IGFiLFxuICAgICAgdGhyb3c6IGZhbHNlLFxuICAgICAgdGltZW91dDogTWF0aC5tYXgoMTAwMCwgTnVtYmVyKHRoaXMuc2V0dGluZ3MudGltZW91dE1zKSB8fCAzMDAwMCksXG4gICAgfSlcblxuICAgIGlmICh0aGlzLnNldHRpbmdzLmRlYnVnKSB7XG4gICAgICAvLyBjb25zb2xlLmluZm8oJ1t1cGxvYWQtaW1hZ2UtY2xvdWRmbGFyZV0gcmVzcG9uc2UnLCByZXMuc3RhdHVzKVxuICAgIH1cblxuICAgIGlmIChyZXMuc3RhdHVzID49IDQwMCkge1xuICAgICAgY29uc3Qgc25pcHBldCA9IChyZXMudGV4dCB8fCAnJykuc2xpY2UoMCwgMjAwKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQICR7cmVzLnN0YXR1c306ICR7c25pcHBldH1gKVxuICAgIH1cblxuICAgIGxldCBwYXJzZWQ6IHVua25vd25cbiAgICB0cnkge1xuICAgICAgcGFyc2VkID0gSlNPTi5wYXJzZShyZXMudGV4dClcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignXHU2NzBEXHU1MkExXHU1NjY4XHU4RkQ0XHU1NkRFXHU5NzVFIEpTT04gXHU1NENEXHU1RTk0JylcbiAgICB9XG5cbiAgICBpZiAoIXBhcnNlZCB8fCB0eXBlb2YgcGFyc2VkICE9PSAnb2JqZWN0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdcdTY3MERcdTUyQTFcdTU2NjhcdThGRDRcdTU2REVcdTY4M0NcdTVGMEZcdTRFMERcdTZCNjNcdTc4NkUnKVxuICAgIH1cblxuICAgIGNvbnN0IGRhdGEgPSBwYXJzZWQgYXMge1xuICAgICAgb2s/OiB1bmtub3duXG4gICAgICB1cmw/OiB1bmtub3duXG4gICAgICBtZXNzYWdlPzogdW5rbm93blxuICAgICAgZXJyb3I/OiB1bmtub3duXG4gICAgfVxuXG4gICAgaWYgKGRhdGEub2sgIT09IHRydWUpIHtcbiAgICAgIGNvbnN0IG1zZyA9XG4gICAgICAgIHR5cGVvZiBkYXRhLm1lc3NhZ2UgPT09ICdzdHJpbmcnXG4gICAgICAgICAgPyBkYXRhLm1lc3NhZ2VcbiAgICAgICAgICA6IHR5cGVvZiBkYXRhLmVycm9yID09PSAnc3RyaW5nJ1xuICAgICAgICAgID8gZGF0YS5lcnJvclxuICAgICAgICAgIDogJ1x1NEUwQVx1NEYyMFx1NTkzMVx1OEQyNSAob2sgIT0gdHJ1ZSknXG4gICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKVxuICAgIH1cbiAgICBpZiAodHlwZW9mIGRhdGEudXJsICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdcdTU0Q0RcdTVFOTRcdTdGM0FcdTVDMTEgdXJsIFx1NUI1N1x1NkJCNScpXG4gICAgfVxuICAgIHJldHVybiBkYXRhLnVybFxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwaW5nU2VydmVyKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5zZXR0aW5ncy5zZXJ2ZXJVcmwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignXHU4QkY3XHU1MTQ4XHU1NzI4XHU4QkJFXHU3RjZFXHU0RTJEXHU1ODZCXHU1MTk5XHU0RTBBXHU0RjIwXHU2NzBEXHU1MkExXHU1NjY4XHU1NzMwXHU1NzQwJylcbiAgICB9XG4gICAgY29uc3QgdXJsID0gdGhpcy5zZXR0aW5ncy5zZXJ2ZXJVcmxcbiAgICBjb25zdCB0aW1lb3V0ID0gTWF0aC5tYXgoMTAwMCwgTnVtYmVyKHRoaXMuc2V0dGluZ3MudGltZW91dE1zKSB8fCAzMDAwMClcbiAgICBjb25zdCBzdGFydCA9IERhdGUubm93KClcbiAgICBjb25zdCByZXMgPSBhd2FpdCBoZWFkT3JHZXQodXJsLCB0aW1lb3V0KVxuICAgIGNvbnN0IG1zID0gRGF0ZS5ub3coKSAtIHN0YXJ0XG4gICAgaWYgKHJlcy5zdGF0dXMgPj0gNDAwKSB7XG4gICAgICBjb25zdCBzbmlwcGV0ID0gKHJlcy50ZXh0IHx8ICcnKS5zbGljZSgwLCAyMDApXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgJHtyZXMuc3RhdHVzfSAoJHttc31tcyk6ICR7c25pcHBldH1gKVxuICAgIH1cbiAgICBuZXcgTm90aWNlKGBcdThGREVcdTkwMUFcdTYwMjdcdTZCNjNcdTVFMzg6ICR7cmVzLnN0YXR1c30gKCR7bXN9bXMpYCwgMzAwMClcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKVxuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncylcbiAgfVxufVxuXG5jbGFzcyBVcGxvYWRJbWFnZUNmU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IFVwbG9hZEltYWdlQ2xvdWRmbGFyZVBsdWdpblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBVcGxvYWRJbWFnZUNsb3VkZmxhcmVQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbilcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpblxuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzXG4gICAgY29udGFpbmVyRWwuZW1wdHkoKVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoJ0Nsb3VkZmxhcmUgcjIgXHU1NkZFXHU3MjQ3XHU0RTBBXHU0RjIwJykuc2V0SGVhZGluZygpXG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdcdTgxRUFcdTUyQThcdTRFMEFcdTRGMjBcdTdDOThcdThEMzRcdTU2RkVcdTcyNDcnKVxuICAgICAgLnNldERlc2MoJ1x1NTQyRlx1NzUyOFx1NTQwRVx1RkYwQ1x1N0M5OFx1OEQzNFx1NTZGRVx1NzI0N1x1NEYxQVx1ODFFQVx1NTJBOFx1NEUwQVx1NEYyMCcpXG4gICAgICAuYWRkVG9nZ2xlKCh0KSA9PlxuICAgICAgICB0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlZCA9IHZcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKVxuICAgICAgICB9KVxuICAgICAgKVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnXHU0RTBBXHU0RjIwXHU2NzBEXHU1MkExXHU1NjY4XHU1NzMwXHU1NzQwJylcbiAgICAgIC5zZXREZXNjKCdcdTc1MjhcdTRFOEVcdTYzQTVcdTY1MzZcdTRFMEFcdTRGMjBcdTVFNzZcdThGNkNcdTVCNThcdTUyMzAgcjIgXHU3Njg0XHU2NzBEXHU1MkExIHVybCcpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignaHR0cHM6Ly95b3VyLXVwbG9hZC1zZXJ2ZXIuZXhhbXBsZS5jb20vdXBsb2FkJylcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VydmVyVXJsKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VydmVyVXJsID0gdi50cmltKClcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpXG4gICAgICAgICAgfSlcbiAgICAgIClcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKCdSMiBcdTUxRURcdTYzNkVcdTRFMEVcdTkxNERcdTdGNkUgKFx1OTY4Rlx1OEJGN1x1NkM0Mlx1NTkzNFx1NTNEMVx1OTAwMSknKS5zZXRIZWFkaW5nKClcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKCdYLVIyLUVuZHBvaW50JykuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgIHRleHRcbiAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdodHRwczovLzxhY2NvdW50LWlkPi5yMi5jbG91ZGZsYXJlc3RvcmFnZS5jb20nKVxuICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucjJFbmRwb2ludClcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucjJFbmRwb2ludCA9IHYudHJpbSgpXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKClcbiAgICAgICAgfSlcbiAgICApXG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZSgnWC1SMi1BY2Nlc3MtS2V5LUlkJykuYWRkVGV4dCgodGV4dCkgPT4ge1xuICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5yMkFjY2Vzc0tleUlkKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yMkFjY2Vzc0tleUlkID0gdi50cmltKClcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKClcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKCdYLVIyLVNlY3JldC1BY2Nlc3MtS2V5JykuYWRkVGV4dCgodGV4dCkgPT4ge1xuICAgICAgdGV4dC5pbnB1dEVsLnR5cGUgPSAncGFzc3dvcmQnXG4gICAgICB0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnIyU2VjcmV0QWNjZXNzS2V5KS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yMlNlY3JldEFjY2Vzc0tleSA9IHYudHJpbSgpXG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpXG4gICAgICB9KVxuICAgIH0pXG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZSgnWC1SMi1CdWNrZXQnKS5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5yMkJ1Y2tldCkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucjJCdWNrZXQgPSB2LnRyaW0oKVxuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKVxuICAgICAgfSlcbiAgICApXG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZSgnWC1CYXNlLVVybCcpLmFkZFRleHQoKHRleHQpID0+XG4gICAgICB0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmJhc2VVcmwpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmJhc2VVcmwgPSB2LnRyaW0oKVxuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKVxuICAgICAgfSlcbiAgICApXG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZSgnXHU3RjUxXHU3RURDXHU0RTBFXHU4QzAzXHU4QkQ1Jykuc2V0SGVhZGluZygpXG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdcdThCRjdcdTZDNDJcdThEODVcdTY1RjYgKG1zKScpXG4gICAgICAuc2V0RGVzYygnXHU5RUQ4XHU4QkE0IDMwMDAwXHVGRjBDXHU3OUZCXHU1MkE4XHU3QUVGXHU3RjUxXHU3RURDXHU1M0VGXHU5MDAyXHU1RjUzXHU1MkEwXHU1OTI3JylcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCczMDAwMCcpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy50aW1lb3V0TXMgPz8gMzAwMDApKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICAgICAgY29uc3QgbiA9IE51bWJlcih2KVxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MudGltZW91dE1zID0gTnVtYmVyLmlzRmluaXRlKG4pICYmIG4gPiAwID8gTWF0aC5mbG9vcihuKSA6IDMwMDAwXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKVxuICAgICAgICAgIH0pXG4gICAgICApXG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdcdTUzRDFcdTkwMDEgY29udGVudC1sZW5ndGggXHU1OTM0JylcbiAgICAgIC5zZXREZXNjKCdcdTY3RDBcdTRFOUJcdTU0MEVcdTdBRUZcdTk3MDBcdTg5ODFcdTY2MEVcdTc4NkUgY29udGVudC1sZW5ndGgnKVxuICAgICAgLmFkZFRvZ2dsZSgodCkgPT5cbiAgICAgICAgdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmNsdWRlQ29udGVudExlbmd0aCkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmNsdWRlQ29udGVudExlbmd0aCA9IHZcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKVxuICAgICAgICB9KVxuICAgICAgKVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnXHU4QzAzXHU4QkQ1XHU2QTIxXHU1RjBGJylcbiAgICAgIC5zZXREZXNjKCdcdThGOTNcdTUxRkFcdTY2RjRcdTU5MUFcdTY1RTVcdTVGRDdcdTVFNzZcdTY2M0VcdTc5M0FcdThCRTZcdTdFQzZcdTk1MTlcdThCRUYnKVxuICAgICAgLmFkZFRvZ2dsZSgodCkgPT5cbiAgICAgICAgdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWJ1Zykub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWJ1ZyA9IHZcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKVxuICAgICAgICB9KVxuICAgICAgKVxuICB9XG59XG5cbmNsYXNzIEVycm9yTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHRpdGxlVGV4dDogc3RyaW5nLCBwcml2YXRlIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKGFwcClcbiAgfVxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwsIHRpdGxlRWwgfSA9IHRoaXNcbiAgICB0aXRsZUVsLnNldFRleHQodGhpcy50aXRsZVRleHQpXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiB0aGlzLm1lc3NhZ2UgfSlcbiAgfVxufVxuXG4vLyBcdThGREVcdTkwMUFcdTYwMjdcdTZENEJcdThCRDVcbmFzeW5jIGZ1bmN0aW9uIGhlYWRPckdldCh1cmw6IHN0cmluZywgdGltZW91dDogbnVtYmVyKSB7XG4gIC8vIEhFQUQgXHU2NzA5XHU0RTlCXHU2NzBEXHU1MkExXHU0RTBEXHU2NTJGXHU2MzAxXHVGRjBDXHU1OTMxXHU4RDI1XHU1MjE5XHU1NkRFXHU5MDAwIEdFVFxuICBsZXQgcmVzID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiAnSEVBRCcsIHRocm93OiBmYWxzZSwgdGltZW91dCB9KVxuICBpZiAocmVzLnN0YXR1cyA9PT0gNDA1IHx8IHJlcy5zdGF0dXMgPT09IDUwMSkge1xuICAgIHJlcyA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmwsIG1ldGhvZDogJ0dFVCcsIHRocm93OiBmYWxzZSwgdGltZW91dCB9KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gZXNjYXBlUXVvdGVzKHM6IHN0cmluZykge1xuICByZXR1cm4gcy5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJylcbn1cblxuYXN5bmMgZnVuY3Rpb24gYnVpbGRNdWx0aXBhcnRCb2R5KGFyZ3M6IHtcbiAgZmllbGROYW1lOiBzdHJpbmdcbiAgZmlsZU5hbWU6IHN0cmluZ1xuICBjb250ZW50VHlwZTogc3RyaW5nXG4gIGRhdGE6ICgpID0+IFByb21pc2U8QXJyYXlCdWZmZXI+XG59KTogUHJvbWlzZTx7IGJvZHk6IFVpbnQ4QXJyYXk7IGNvbnRlbnRUeXBlOiBzdHJpbmcgfT4ge1xuICBjb25zdCBib3VuZGFyeSA9IGAtLS0tb2JzaWRpYW4tcjItdXBsb2FkLSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygxNikuc2xpY2UoMil9YFxuICBjb25zdCBlbmMgPSBuZXcgVGV4dEVuY29kZXIoKVxuICBjb25zdCBDUkxGID0gJ1xcclxcbidcblxuICBjb25zdCBoZWFkID1cbiAgICBgLS0ke2JvdW5kYXJ5fWAgK1xuICAgIENSTEYgK1xuICAgIGBDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9XCIke2VzY2FwZVF1b3RlcyhhcmdzLmZpZWxkTmFtZSl9XCI7IGZpbGVuYW1lPVwiJHtlc2NhcGVRdW90ZXMoXG4gICAgICBhcmdzLmZpbGVOYW1lXG4gICAgKX1cImAgK1xuICAgIENSTEYgK1xuICAgIGBDb250ZW50LVR5cGU6ICR7YXJncy5jb250ZW50VHlwZX1gICtcbiAgICBDUkxGICtcbiAgICBDUkxGXG4gIGNvbnN0IHRhaWwgPSBDUkxGICsgYC0tJHtib3VuZGFyeX0tLWAgKyBDUkxGXG5cbiAgY29uc3QgaGVhZEJ5dGVzID0gZW5jLmVuY29kZShoZWFkKVxuICBjb25zdCBkYXRhQnVmZmVyID0gYXdhaXQgYXJncy5kYXRhKClcbiAgY29uc3QgZGF0YUJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoZGF0YUJ1ZmZlcilcbiAgY29uc3QgdGFpbEJ5dGVzID0gZW5jLmVuY29kZSh0YWlsKVxuXG4gIGNvbnN0IG1lcmdlZCA9IGNvbmNhdEJ5dGVzKGhlYWRCeXRlcywgZGF0YUJ5dGVzLCB0YWlsQnl0ZXMpXG4gIHJldHVybiB7IGJvZHk6IG1lcmdlZCwgY29udGVudFR5cGU6IGBtdWx0aXBhcnQvZm9ybS1kYXRhOyBib3VuZGFyeT0ke2JvdW5kYXJ5fWAgfVxufVxuXG5mdW5jdGlvbiBjb25jYXRCeXRlcyguLi5wYXJ0czogVWludDhBcnJheVtdKTogVWludDhBcnJheSB7XG4gIGNvbnN0IHRvdGFsID0gcGFydHMucmVkdWNlKChzdW0sIHApID0+IHN1bSArIHAubGVuZ3RoLCAwKVxuICBjb25zdCBvdXQgPSBuZXcgVWludDhBcnJheSh0b3RhbClcbiAgbGV0IG9mZnNldCA9IDBcbiAgZm9yIChjb25zdCBwIG9mIHBhcnRzKSB7XG4gICAgb3V0LnNldChwLCBvZmZzZXQpXG4gICAgb2Zmc2V0ICs9IHAubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBQXdHO0FBZXhHLElBQU0sbUJBQTBDO0FBQUEsRUFDOUMsU0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBQ1gsWUFBWTtBQUFBLEVBQ1osZUFBZTtBQUFBLEVBQ2YsbUJBQW1CO0FBQUEsRUFDbkIsVUFBVTtBQUFBLEVBQ1YsU0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBQ1gsT0FBTztBQUFBLEVBQ1Asc0JBQXNCO0FBQ3hCO0FBRUEsSUFBcUIsOEJBQXJCLGNBQXlELHVCQUFPO0FBQUEsRUFBaEU7QUFBQTtBQUNFLG9CQUFrQztBQUNsQyxTQUFRLFdBQStCO0FBQ3ZDLFNB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
