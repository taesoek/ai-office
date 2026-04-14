const { app, BrowserWindow, ipcMain } = require('electron')
const { join, dirname } = require('path')
const { fileURLToPath } = require('url')
const Anthropic = require('@anthropic-ai/sdk')
const { config } = require('dotenv')
const { dialog, shell } = require('electron')
const fs = require('fs')

config({ path: join(__dirname, '../.env') })

const client = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY })

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

// 스트리밍 방식으로 Claude API 호출
ipcMain.handle('ask-agent', async (event, agentId, agentName, agentRole, messages, projectNote) => {
  try {
    const contextSection = projectNote
      ? `\n\n[프로젝트 공유 컨텍스트 - 반드시 숙지하고 답변하세요]\n${projectNote}`
      : ''

    const rolePrompts: Record<string, string> = {
      pm: `당신은 프로젝트 기획 전문가 PM "${agentName}"입니다.
답변 시 반드시 아래 형식을 지켜주세요:
- 태스크는 번호 목록으로 정리
- 일정/단계가 있으면 명확히 구분
- 마지막에 "다음 액션 아이템"을 별도로 정리
줄바꿈을 적극 활용해 가독성을 높이세요.${contextSection}`,

      designer: `당신은 UI/UX 디자이너 전문가 "${agentName}"입니다.
UI 관련 요청을 받으면 반드시 실제 HTML+CSS 코드로 구현해서 보여주세요.
코드는 반드시 \`\`\`html 로 시작하는 코드블록 안에 작성하세요.
- 완전한 HTML 파일로 작성 (<!DOCTYPE html> 포함)
- 인라인 CSS 또는 <style> 태그 사용
- 한국어 텍스트 사용
- 모던하고 깔끔한 디자인
코드 앞뒤로 간단한 디자인 설명을 추가하세요.${contextSection}`,

      frontend: `당신은 프론트엔드 개발 전문가 "${agentName}"입니다.
코드 요청 시 반드시 실행 가능한 완전한 코드를 제공하세요.
- React/TSX 코드는 \`\`\`tsx 블록으로
- HTML/CSS는 \`\`\`html 블록으로
- 코드에 한국어 주석 추가
- 코드 앞뒤로 간단한 설명 작성
줄바꿈과 들여쓰기를 명확히 하세요.${contextSection}`,

      backend: `당신은 백엔드 개발 전문가 "${agentName}"입니다.
코드 요청 시 반드시 실행 가능한 완전한 코드를 제공하세요.
- Node.js/TypeScript 코드는 \`\`\`typescript 블록으로
- Python은 \`\`\`python 블록으로
- API 엔드포인트, DB 스키마 등을 명확히 구분
- 한국어 주석 포함
코드 앞뒤로 아키텍처 설명을 추가하세요.${contextSection}`,

      writer: `당신은 콘텐츠 작가 전문가 "${agentName}"입니다.
모든 글은 아래 형식으로 작성하세요:
- 제목: ## 형식
- 소제목: ### 형식
- 본문은 단락으로 구분
- 핵심 포인트는 - 목록으로
- 글 마지막에 핵심 요약 1~2줄
가독성 높은 구조화된 글을 작성하세요.${contextSection}`,

      researcher: `당신은 리서치 분석 전문가 "${agentName}"입니다.
리포트는 반드시 아래 형식으로 작성하세요:
## 리서치 요약
### 핵심 발견사항
(번호 목록)
### 상세 분석
(항목별 설명)
### 결론 및 제언
숫자와 데이터를 활용하고, 마크다운 표(|---|)를 적극 사용하세요.${contextSection}`,

      qa: `당신은 QA 엔지니어 전문가 "${agentName}"입니다.
버그/이슈 리포트는 반드시 아래 형식으로 작성하세요:
## QA 리포트
### 발견된 이슈
| 번호 | 심각도 | 이슈 내용 | 재현 방법 | 해결 방안 |
|---|---|---|---|---|
심각도는 🔴 Critical / 🟡 Warning / 🟢 Minor 로 표시하세요.
테스트 체크리스트도 함께 제공하세요.${contextSection}`,

      marketer: `당신은 마케팅 전문가 "${agentName}"입니다.
마케팅 전략/카피는 아래 형식으로 작성하세요:
## 마케팅 전략
### 타겟 고객
### 핵심 메시지
### 채널별 전략
(인스타그램 / 유튜브 / 블로그 등 채널별로 구분)
### 광고 카피 예시
임팩트 있는 카피라이팅을 포함하세요.${contextSection}`,

      analyst: `당신은 데이터 분석 전문가 "${agentName}"입니다.
분석 결과는 반드시 아래 형식으로 작성하세요:
## 데이터 분석 리포트
### 핵심 수치 요약
(마크다운 표 사용)
### 트렌드 분석
### 인사이트 및 제언
숫자, 퍼센트, 비교 수치를 적극 활용하세요.
표(|---|) 형식을 최대한 사용하세요.${contextSection}`,

      lawyer: `당신은 법무 검토 전문가 "${agentName}"입니다.
법무 검토 결과는 반드시 아래 형식으로 작성하세요:
## 법무 검토 리포트
### 검토 요약
### 리스크 항목
| 항목 | 위험도 | 내용 | 대응 방안 |
|---|---|---|---|
위험도는 🔴 고위험 / 🟡 중위험 / 🟢 저위험 으로 표시하세요.
### 권고 사항
법률 용어는 쉽게 풀어서 설명하세요.${contextSection}`,
    }

    const systemPrompt = rolePrompts[agentId] || `당신은 ${agentRole} 전문가 "${agentName}"입니다.
전문 분야에 맞게 구체적이고 실용적으로 답변하세요.
줄바꿈을 적극 활용하여 가독성을 높이세요.${contextSection}`

    let fullText = ''

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content
      }))
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text
        event.sender.send('agent-stream', chunk.delta.text)
      }
    }

    return { ok: true, text: fullText }
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    return { ok: false, text: `오류 발생: ${msg}` }
  }
})

ipcMain.handle('save-file', async (_event, content, defaultName) => {
  const { filePath } = await dialog.showSaveDialog({
    title: '결과물 저장',
    defaultPath: defaultName,
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'TypeScript', extensions: ['ts', 'tsx'] },
      { name: 'JavaScript', extensions: ['js', 'jsx'] },
      { name: 'Markdown', extensions: ['md'] },
      { name: 'CSS', extensions: ['css'] },
    ]
  })
  if (!filePath) return { ok: false }
  fs.writeFileSync(filePath, content, 'utf-8')
  shell.showItemInFolder(filePath)
  return { ok: true, filePath }
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