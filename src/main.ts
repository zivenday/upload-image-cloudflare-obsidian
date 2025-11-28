import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, requestUrl, Setting } from 'obsidian'

interface UploadImageCfSettings {
  enabled: boolean // 是否开启自动上传
  serverUrl: string // 上传服务器地址
  r2Endpoint: string // X-R2-Endpoint
  r2AccessKeyId: string // X-R2-Access-Key-Id
  r2SecretAccessKey: string // X-R2-Secret-Access-Key
  r2Bucket: string // X-R2-Bucket
  baseUrl: string // X-Base-Url
}

const DEFAULT_SETTINGS: UploadImageCfSettings = {
  enabled: true,
  serverUrl: '',
  r2Endpoint: '',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2Bucket: '',
  baseUrl: '',
}

export default class UploadImageCloudflarePlugin extends Plugin {
  settings: UploadImageCfSettings = DEFAULT_SETTINGS
  private statusEl: HTMLElement | null = null
  private uploadingCount = 0

  async onload() {
    await this.loadSettings()

    this.addSettingTab(new UploadImageCfSettingTab(this.app, this))

    // 状态栏显示上传中
    this.statusEl = this.addStatusBarItem()
    this.updateStatusBar()

    // 监听编辑器粘贴事件
    this.registerEvent(
      this.app.workspace.on('editor-paste', async (evt: ClipboardEvent, editor: Editor, view: MarkdownView) => {
        try {
          if (!this.settings.enabled) return
          if (!evt.clipboardData) return

          const files = Array.from(evt.clipboardData.files || []).filter((f) => f.type?.startsWith('image/'))
          if (files.length === 0) return

          // 阻止默认行为（避免保存到本地附件）
          evt.preventDefault()

          for (const file of files) {
            await this.handleImagePaste(editor, file)
          }
        } catch (e) {
          console.error(e)
          new Notice('处理粘贴图片时出错', 5000)
        }
      })
    )

    // 命令：开/关自动上传
    this.addCommand({
      id: 'toggle-auto-upload',
      name: '切换粘贴图片自动上传',
      callback: async () => {
        this.settings.enabled = !this.settings.enabled
        await this.saveSettings()
        new Notice(this.settings.enabled ? '已开启自动上传' : '已关闭自动上传', 2500)
      },
    })
  }

  onunload() {}

  private updateStatusBar() {
    if (!this.statusEl) return
    if (this.uploadingCount > 0) {
      this.statusEl.setText(`上传中(${this.uploadingCount})…`)
    } else {
      this.statusEl.setText('')
    }
  }

  private async handleImagePaste(editor: Editor, file: File) {
    // 插入占位符
    const placeholder = `![${file.name} 上传中…]()`
    const from = editor.getCursor()
    editor.replaceRange(placeholder, from)
    const to = { line: from.line, ch: from.ch + placeholder.length }

    // 计数 +1
    this.uploadingCount += 1
    this.updateStatusBar()

    try {
      const url = await this.uploadToServer(file)
      const finalMd = `![${file.name}](${url})`
      editor.replaceRange(finalMd, from, to)
      new Notice('图片上传成功', 2000)
    } catch (err: any) {
      console.error(err)
      editor.replaceRange('', from, to) // 移除占位符
      const message = err?.message || '上传失败'
      new ErrorModal(this.app, '上传失败', message).open()
    } finally {
      this.uploadingCount -= 1
      if (this.uploadingCount < 0) this.uploadingCount = 0
      this.updateStatusBar()
    }
  }

  private async uploadToServer(file: File): Promise<string> {
    if (!this.settings.serverUrl) {
      throw new Error('请先在设置中填写上传服务器地址')
    }

    const { body, contentType } = await buildMultipartBody({
      fieldName: 'file',
      fileName: file.name || 'pasted-image',
      contentType: file.type || 'application/octet-stream',
      data: await file.arrayBuffer(),
    })

    // 将 Uint8Array 安全转换为 ArrayBuffer（精确 slice）
    const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)

    // 便于调试：打印 multipart 关键信息（不包含敏感内容）
    console.info('[upload-image-cloudflare] multipart', { contentType, bytes: body.byteLength })

    const res = await requestUrl({
      url: this.settings.serverUrl,
      method: 'POST',
      contentType, // 使用 requestUrl 的 contentType 字段设置 Content-Type
      headers: {
        'X-R2-Endpoint': this.settings.r2Endpoint || '',
        'X-R2-Access-Key-Id': this.settings.r2AccessKeyId || '',
        'X-R2-Secret-Access-Key': this.settings.r2SecretAccessKey || '',
        'X-R2-Bucket': this.settings.r2Bucket || '',
        'X-Base-Url': this.settings.baseUrl || '',
        // 可选：某些后端需要明确 Content-Length
        // 'Content-Length': String(body.byteLength),
      },
      body: ab,
      throw: true,
    })

    console.info('[upload-image-cloudflare] response', res.status)

    let data: any = null
    try {
      data = JSON.parse(res.text)
    } catch (_) {
      throw new Error('服务器返回非 JSON 响应')
    }

    if (!data || data.ok !== true) {
      const msg = data?.message || data?.error || '上传失败 (ok != true)'
      throw new Error(String(msg))
    }
    if (!data.url || typeof data.url !== 'string') {
      throw new Error('响应缺少 url 字段')
    }
    return data.url as string
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}

class UploadImageCfSettingTab extends PluginSettingTab {
  plugin: UploadImageCloudflarePlugin
  constructor(app: App, plugin: UploadImageCloudflarePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Cloudflare R2 图片上传' })

    new Setting(containerEl)
      .setName('自动上传粘贴图片')
      .setDesc('启用后，粘贴图片会自动上传')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
          this.plugin.settings.enabled = v
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('上传服务器地址')
      .setDesc('用于接收上传并转存到 R2 的服务 URL')
      .addText((text) =>
        text
          .setPlaceholder('https://your-upload-server.example.com/upload')
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (v) => {
            this.plugin.settings.serverUrl = v.trim()
            await this.plugin.saveSettings()
          })
      )

    containerEl.createEl('h3', { text: 'R2 凭据与配置 (随请求头发送)' })

    new Setting(containerEl).setName('X-R2-Endpoint').addText((text) =>
      text
        .setPlaceholder('https://<account-id>.r2.cloudflarestorage.com')
        .setValue(this.plugin.settings.r2Endpoint)
        .onChange(async (v) => {
          this.plugin.settings.r2Endpoint = v.trim()
          await this.plugin.saveSettings()
        })
    )

    new Setting(containerEl).setName('X-R2-Access-Key-Id').addText((text) => {
      text.setValue(this.plugin.settings.r2AccessKeyId).onChange(async (v) => {
        this.plugin.settings.r2AccessKeyId = v.trim()
        await this.plugin.saveSettings()
      })
    })

    new Setting(containerEl).setName('X-R2-Secret-Access-Key').addText((text) => {
      text.inputEl.type = 'password'
      text.setValue(this.plugin.settings.r2SecretAccessKey).onChange(async (v) => {
        this.plugin.settings.r2SecretAccessKey = v.trim()
        await this.plugin.saveSettings()
      })
    })

    new Setting(containerEl).setName('X-R2-Bucket').addText((text) =>
      text.setValue(this.plugin.settings.r2Bucket).onChange(async (v) => {
        this.plugin.settings.r2Bucket = v.trim()
        await this.plugin.saveSettings()
      })
    )

    new Setting(containerEl).setName('X-Base-Url').addText((text) =>
      text.setValue(this.plugin.settings.baseUrl).onChange(async (v) => {
        this.plugin.settings.baseUrl = v.trim()
        await this.plugin.saveSettings()
      })
    )
  }
}

class ErrorModal extends Modal {
  constructor(app: App, private titleText: string, private message: string) {
    super(app)
  }
  onOpen(): void {
    const { contentEl, titleEl } = this
    titleEl.setText(this.titleText)
    contentEl.createEl('p', { text: this.message })
  }
}

function escapeQuotes(s: string) {
  return s.replace(/"/g, '\\"')
}

async function buildMultipartBody(args: {
  fieldName: string
  fileName: string
  contentType: string
  data: ArrayBuffer
}): Promise<{ body: Uint8Array; contentType: string }> {
  const boundary = `----obsidian-r2-upload-${Math.random().toString(16).slice(2)}`
  const enc = new TextEncoder()
  const CRLF = '\r\n'

  const head =
    `--${boundary}` +
    CRLF +
    `Content-Disposition: form-data; name="${escapeQuotes(args.fieldName)}"; filename="${escapeQuotes(
      args.fileName
    )}"` +
    CRLF +
    `Content-Type: ${args.contentType}` +
    CRLF +
    CRLF
  const tail = CRLF + `--${boundary}--` + CRLF

  const headBytes = enc.encode(head)
  const dataBytes = new Uint8Array(args.data)
  const tailBytes = enc.encode(tail)

  const merged = concatBytes(headBytes, dataBytes, tailBytes)
  return { body: merged, contentType: `multipart/form-data; boundary=${boundary}` }
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}
