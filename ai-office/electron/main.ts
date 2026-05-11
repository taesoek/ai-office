const { app, BrowserWindow, ipcMain } = require('electron')
const { join } = require('path')
const Anthropic = require('@anthropic-ai/sdk')
const { config } = require('dotenv')
const { dialog, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

config({ path: join(__dirname, '../.env') })

const client = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY })

// ─── 사용 모델 설정 ────────────────────────────────────────────────
// 여기서 모델을 바꾸면 전체 앱에 일괄 적용됩니다
// claude-sonnet-4-20250514  → 빠르고 저렴, 일반 작업에 추천
// claude-opus-4-20250514    → 가장 고성능, 복잡한 작업에 추천
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'

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

// ─── 시스템 프롬프트 빌더 ──────────────────────────────────────────
function buildSystemPrompt(agentId, agentName, agentSpecialty, contextSection) {
  const prompts = {
    pm: `당신은 프로젝트 매니저(PM) "${agentName}"입니다. CEO의 파트너로서 프로젝트를 총괄합니다.
현재 팀 상황과 프로젝트 컨텍스트를 바탕으로 전문적으로 답변하세요.
줄바꿈을 적극 활용해 가독성을 높이세요.${contextSection}`,

    designer: `당신은 UI/UX 디자이너 "${agentName}"입니다.
디자인 방향 설명 후 반드시 \`\`\`html 블록으로 시각적 목업을 제공하세요. 최대 60줄 이내.
색상, 레이아웃, UX 포인트를 명확히 설명하세요.${contextSection}`,

    frontend: `당신은 프론트엔드 개발자 "${agentName}"입니다.
코드 요청 시 완전하고 실행 가능한 코드를 제공하세요.
React/TSX → \`\`\`tsx 블록, HTML/CSS/JS → \`\`\`html 블록
한국어 주석 포함, 실제 동작하는 인터랙션 구현${contextSection}`,

    backend: `당신은 백엔드 개발자 "${agentName}"입니다.
Node.js/TypeScript → \`\`\`typescript 블록, Python → \`\`\`python 블록
API 엔드포인트, DB 스키마 명확히 구분, 한국어 주석 포함${contextSection}`,

    writer: `당신은 콘텐츠 작가 "${agentName}"입니다.
## 제목, ### 소제목 형식으로 구조화하여 작성하세요.
가독성 높은 단락, 핵심 포인트는 목록으로 정리하세요.${contextSection}`,

    researcher: `당신은 리서치 분석가 "${agentName}"입니다.
## 리서치 요약 → ### 핵심 발견사항 → ### 상세 분석 → ### 결론 형식으로 작성하세요.
숫자, 데이터, 마크다운 표를 적극 활용하세요.${contextSection}`,

    qa: `당신은 QA 엔지니어 "${agentName}"입니다.
## QA 리포트 형식으로 이슈를 표로 정리하세요.
심각도: 🔴 Critical / 🟡 Warning / 🟢 Minor${contextSection}`,

    marketer: `당신은 마케터 "${agentName}"입니다.
## 마케팅 전략 → ### 타겟 고객 → ### 핵심 메시지 → ### 채널별 전략 → ### 광고 카피 형식으로 작성하세요.${contextSection}`,

    analyst: `당신은 데이터 분석가 "${agentName}"입니다.
## 분석 리포트 → ### 핵심 수치 → ### 트렌드 분석 → ### 인사이트 형식으로 작성하세요.
표, 퍼센트, 비교 수치를 최대한 활용하세요.${contextSection}`,

    lawyer: `당신은 법무 담당자 "${agentName}"입니다.
## 법무 검토 리포트 → ### 리스크 항목(표) → ### 권고 사항 형식으로 작성하세요.
위험도: 🔴 고위험 / 🟡 중위험 / 🟢 저위험${contextSection}`,
  }
  return prompts[agentId] || `당신은 ${agentSpecialty} 전문가 "${agentName}"입니다.
전문 분야에 맞게 구체적이고 실용적으로 답변하세요.${contextSection}`
}

// ─── PM 팀 구성 + 즉시 업무 분배 ────────────────────────────────────
ipcMain.handle('pm-create-team', async (event, pmName, userRequest, projectNote) => {
  try {
    const contextSection = projectNote ? `\n\n[현재 프로젝트 컨텍스트]\n${projectNote}` : ''

    const planResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: `당신은 PM "${pmName}"입니다. CEO의 프로젝트 요청을 분석해 최적의 팀을 구성하고 태스크를 배분하세요.${contextSection}

선택 가능한 에이전트 풀:
- designer (UI 디자이너) — UI/UX, 디자인
- frontend (프론트엔드 개발자) — 화면 개발
- backend (백엔드 개발자) — 서버/API
- writer (콘텐츠 작가) — 글쓰기, 문서
- researcher (리서처) — 시장조사, 분석
- qa (QA 엔지니어) — 품질 검수
- marketer (마케터) — 마케팅, 홍보
- analyst (데이터 분석가) — 데이터 분석
- lawyer (법무 담당자) — 법적 검토

반드시 아래 JSON만 응답 (다른 텍스트 없이):
{
  "pmBriefing": "CEO에게 보내는 브리핑 (팀 구성 이유, 진행 계획, 3-5문장)",
  "projectTitle": "프로젝트 제목",
  "agents": [
    {
      "id": "에이전트 타입 ID",
      "name": "개성 있는 이름 (한국/영어)",
      "emoji": "이모지 하나",
      "color": "#hex",
      "bg": "#hex (어두운 배경색)",
      "specialty": "전문 직무명 (예: UI 디자이너, 프론트엔드 개발자)",
      "task": "구체적인 첫 번째 태스크"
    }
  ]
}`,
      messages: [{ role: 'user', content: userRequest }]
    })

    const rawText = planResponse.content[0].type === 'text' ? planResponse.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { ok: false, error: 'PM 응답 파싱 실패', raw: rawText }

    const plan = JSON.parse(jsonMatch[0])

    event.sender.send('pm-briefing', plan.pmBriefing)
    event.sender.send('agents-created', plan.agents, plan.projectTitle)

    for (const agent of plan.agents) {
      event.sender.send('agent-task-start', agent.name, agent.task)
      const contextForAgent = projectNote ? `\n\n[프로젝트 컨텍스트]\n${projectNote}` : ''
      const systemPrompt = buildSystemPrompt(agent.id, agent.name, agent.specialty || agent.id, contextForAgent)

      let fullText = ''
      const stream = await client.messages.stream({
        model: MODEL,
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `[PM ${pmName} 배정 태스크] ${agent.task}` }]
      })
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text
          event.sender.send('agent-stream-task', agent.name, chunk.delta.text)
        }
      }
      event.sender.send('agent-task-done', agent.name, fullText)
    }

    return { ok: true, plan }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── 일반 에이전트 채팅 ──────────────────────────────────────────────
ipcMain.handle('ask-agent', async (event, agentId, agentName, agentSpecialty, messages, projectNote) => {
  try {
    const contextSection = projectNote ? `\n\n[프로젝트 공유 컨텍스트]\n${projectNote}` : ''
    const systemPrompt = buildSystemPrompt(agentId, agentName, agentSpecialty, contextSection)
    let fullText = ''
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    })
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text
        event.sender.send('agent-stream', chunk.delta.text)
      }
    }
    return { ok: true, text: fullText }
  } catch (e) {
    return { ok: false, text: `오류: ${e.message}` }
  }
})

// ─── PM 일반 채팅 ────────────────────────────────────────────────────
ipcMain.handle('ask-pm', async (event, pmName, messages, projectNote, agentSummary) => {
  try {
    const contextSection = projectNote ? `\n\n[프로젝트 컨텍스트]\n${projectNote}` : ''
    const teamSection = agentSummary ? `\n\n[현재 팀]\n${agentSummary}` : ''
    const systemPrompt = `당신은 프로젝트 매니저(PM) "${pmName}"입니다.
CEO의 파트너로서 프로젝트 전반을 총괄합니다.
현재 팀 상황을 인지하고, 새 프로젝트 요청에는 팀을 구성해 드릴 수 있다고 안내하세요.
줄바꿈을 적극 활용해 가독성을 높이세요.${contextSection}${teamSection}`

    let fullText = ''
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    })
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text
        event.sender.send('agent-stream', chunk.delta.text)
      }
    }
    return { ok: true, text: fullText }
  } catch (e) {
    return { ok: false, text: `오류: ${e.message}` }
  }
})

// ─── 프로젝트 파일 자동 생성 ────────────────────────────────────────
ipcMain.handle('generate-project-files', async (event, projectTitle, agentOutputs, projectNote) => {
  try {
    // 1. 폴더 선택
    const { filePaths } = await dialog.showOpenDialog({
      title: '프로젝트를 생성할 폴더를 선택하세요',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: '이 폴더에 프로젝트 생성'
    })
    if (!filePaths || filePaths.length === 0) return { ok: false, cancelled: true }

    const baseDir = filePaths[0]
    event.sender.send('project-gen-status', 'planning', 'Claude가 프로젝트 구조를 설계하는 중...')

    // 2. Step1: 메타 정보 + 파일 목록만 먼저 결정 (가벼운 호출)
    const contextSection = projectNote ? `\n[프로젝트 노트]\n${projectNote}` : ''
    // 산출물은 각각 2000자로 잘라서 전달 (토큰 절약)
    const outputsSection = agentOutputs
      .map((o) => `[${o.agentName} / ${o.agentRole}]\n${o.content.slice(0, 2000)}`)
      .join('\n\n---\n\n')

    const planResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: 'You are a software architect. Respond ONLY with valid JSON, no explanation, no markdown.',
      messages: [{
        role: 'user',
        content: `Project: ${projectTitle}\n${contextSection}\nTeam outputs:\n${outputsSection}\n\nReturn ONLY this JSON (no markdown):\n{"projectName":"folder-name","techStack":"tech stack","runInstructions":["npm install","npm start"],"files":["package.json","README.md","src/index.js"]}`
      }]
    })

    const planRaw = planResponse.content[0].type === 'text' ? planResponse.content[0].text.trim() : ''
    let planJson: any
    try {
      // 코드블록 제거 (Haiku가 가끔 ```json 으로 감쌈)
      const cleaned = planRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (!m) throw new Error(`JSON 없음. 응답: ${planRaw.slice(0, 200)}`)
      planJson = JSON.parse(m[0])
      // 필수 필드 보정
      if (!planJson.projectName) planJson.projectName = 'my-project'
      if (!Array.isArray(planJson.files) || planJson.files.length === 0)
        planJson.files = ['package.json', 'README.md', 'src/index.js']
      if (!Array.isArray(planJson.runInstructions))
        planJson.runInstructions = ['npm install', 'npm start']
      if (!planJson.techStack) planJson.techStack = 'Node.js'
    } catch (e) {
      return { ok: false, error: `프로젝트 구조 설계 실패: ${e.message}` }
    }

    const projectDir = path.join(baseDir, planJson.projectName || 'my-project')
    fs.mkdirSync(projectDir, { recursive: true })

    event.sender.send('project-gen-status', 'creating', `📁 ${planJson.projectName} — 파일 ${planJson.files.length}개 생성 시작...`)

    // 3. Step2: 파일별로 개별 생성 (토큰 분산)
    const createdFiles: string[] = []

    for (const filePath of planJson.files) {
      event.sender.send('project-gen-status', 'creating', `✍️ ${filePath} 작성 중...`)

      const ext = filePath.split('.').pop() || ''
      const isReadme = filePath.toLowerCase().includes('readme')
      const isPkg = filePath === 'package.json'

      const fileResponse = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: `당신은 풀스택 개발자입니다. 파일 내용만 출력하세요. 설명이나 마크다운 코드블록 없이 파일 내용 그 자체만.${contextSection}`,
        messages: [{
          role: 'user',
          content: `프로젝트: ${projectTitle}
기술스택: ${planJson.techStack}
전체 파일 목록: ${planJson.files.join(', ')}

팀 산출물 요약:
${outputsSection}

지금 작성할 파일: ${filePath}

${isPkg ? '모든 의존성을 명시하고 scripts도 포함하세요.' : ''}
${isReadme ? '한국어로 작성하고, 실행 방법을 포함하세요.' : ''}
${!isReadme && !isPkg ? '초보 개발자를 위해 한국어 주석을 달아주세요. 완전하고 실행 가능한 코드로 작성하세요.' : ''}

파일 내용만 출력하세요 (마크다운 코드블록 없이):`
        }]
      })

      const fileContent = fileResponse.content[0].type === 'text' ? fileResponse.content[0].text : ''

      // 마크다운 코드블록이 실수로 포함된 경우 제거
      let cleanContent = fileContent
      const codeBlockMatch = fileContent.match(/^```[\w]*\n([\s\S]*?)\n?```\s*$/m)
      if (codeBlockMatch) cleanContent = codeBlockMatch[1]

      const absPath = path.join(projectDir, filePath)
      fs.mkdirSync(path.dirname(absPath), { recursive: true })
      fs.writeFileSync(absPath, cleanContent, 'utf-8')
      createdFiles.push(filePath)

      event.sender.send('project-gen-status', 'creating', `✅ ${filePath}`)
    }

    // 4. 탐색기 오픈
    shell.openPath(projectDir)

    return {
      ok: true,
      projectDir,
      projectName: planJson.projectName,
      techStack: planJson.techStack,
      runInstructions: planJson.runInstructions,
      createdFiles,
      fileCount: createdFiles.length
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── 단일 파일 저장 (기존 유지) ──────────────────────────────────────
ipcMain.handle('save-file', async (_event, content, defaultName) => {
  const { filePath } = await dialog.showSaveDialog({
    title: '결과물 저장',
    defaultPath: defaultName,
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'HTML', extensions: ['html'] },
      { name: 'TypeScript', extensions: ['ts', 'tsx'] },
      { name: 'JavaScript', extensions: ['js', 'jsx'] },
      { name: 'CSS', extensions: ['css'] },
      { name: 'Markdown', extensions: ['md'] },
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