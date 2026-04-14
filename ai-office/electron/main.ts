const { app, BrowserWindow, ipcMain } = require('electron')
const { join } = require('path')
const { config } = require('dotenv')
const Anthropic = require('@anthropic-ai/sdk')

config({ path: join(__dirname, '../.env') })

const client = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY })

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false
    }
  })
  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.loadURL('http://localhost:5173')
}

ipcMain.handle('ask-agent', async (_event, _agentId, agentName, agentRole, messages, projectNote) => {
  console.log('projectNote 수신:', projectNote)
  try {
    const contextSection = projectNote
  ? `\n\n[프로젝트 공유 컨텍스트 - 반드시 이 내용을 숙지하고 답변하세요]\n${projectNote}\n\n위 내용은 다른 팀원들이 이미 작업한 내용입니다. 이를 기반으로 답변하세요.`
  : ''

    const systemPrompt = `당신은 AI 소프트웨어 개발 회사의 ${agentRole} 담당 직원 "${agentName}"입니다.
사용자는 CEO이며, 당신에게 프로젝트 관련 지시를 내립니다.
당신의 전문 분야(${agentRole})에 맞게 구체적이고 실용적으로 답변하세요.
답변은 한국어로, 간결하고 명확하게 작성하세요.
친근하지만 전문적인 말투를 사용하세요.${contextSection}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    })

    return { ok: true, text: response.content[0].type === 'text' ? response.content[0].text : '' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    return { ok: false, text: `오류 발생: ${msg}` }
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})