import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY })

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Claude API 호출 처리
ipcMain.handle('ask-agent', async (_event, agentId, agentName, agentRole, messages) => {
  try {
    const systemPrompt = `당신은 AI 소프트웨어 개발 회사의 ${agentRole} 담당 직원 "${agentName}"입니다.
사용자는 CEO이며, 당신에게 프로젝트 관련 지시를 내립니다.
당신의 전문 분야(${agentRole})에 맞게 구체적이고 실용적으로 답변하세요.
답변은 한국어로, 2~4문장으로 간결하게 작성하세요.
친근하지만 전문적인 말투를 사용하세요.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: {role: string, content: string}) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    })

    return { ok: true, text: response.content[0].type === 'text' ? response.content[0].text : '' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    return { ok: false, text: `오류 발생: ${msg}` }
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })