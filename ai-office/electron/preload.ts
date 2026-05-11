const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // PM 팀 구성 + 업무 분배
  pmCreateTeam: (pmName: string, userRequest: string, projectNote: string) =>
    ipcRenderer.invoke('pm-create-team', pmName, userRequest, projectNote),

  // PM 일반 채팅
  askPm: (pmName: string, messages: any[], projectNote: string, agentSummary: string) =>
    ipcRenderer.invoke('ask-pm', pmName, messages, projectNote, agentSummary),

  // 일반 에이전트 채팅
  askAgent: (agentId: string, agentName: string, agentSpecialty: string, messages: any[], projectNote: string) =>
    ipcRenderer.invoke('ask-agent', agentId, agentName, agentSpecialty, messages, projectNote),

  // 프로젝트 파일 자동 생성
  generateProjectFiles: (projectTitle: string, agentOutputs: any[], projectNote: string) =>
    ipcRenderer.invoke('generate-project-files', projectTitle, agentOutputs, projectNote),

  // 파일 저장
  saveFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke('save-file', content, defaultName),

  // 일반 스트림
  onStream: (cb: (text: string) => void) =>
    ipcRenderer.on('agent-stream', (_e, text) => cb(text)),
  offStream: () =>
    ipcRenderer.removeAllListeners('agent-stream'),

  // PM 브리핑
  onPmBriefing: (cb: (briefing: string) => void) =>
    ipcRenderer.on('pm-briefing', (_e, briefing) => cb(briefing)),
  offPmBriefing: () =>
    ipcRenderer.removeAllListeners('pm-briefing'),

  // 에이전트 생성
  onAgentsCreated: (cb: (agents: any[], projectTitle: string) => void) =>
    ipcRenderer.on('agents-created', (_e, agents, projectTitle) => cb(agents, projectTitle)),
  offAgentsCreated: () =>
    ipcRenderer.removeAllListeners('agents-created'),

  // 에이전트 태스크 스트림
  onAgentStreamTask: (cb: (name: string, chunk: string) => void) =>
    ipcRenderer.on('agent-stream-task', (_e, name, chunk) => cb(name, chunk)),
  offAgentStreamTask: () =>
    ipcRenderer.removeAllListeners('agent-stream-task'),

  // 태스크 시작/완료
  onAgentTaskStart: (cb: (name: string, task: string) => void) =>
    ipcRenderer.on('agent-task-start', (_e, name, task) => cb(name, task)),
  onAgentTaskDone: (cb: (name: string, text: string) => void) =>
    ipcRenderer.on('agent-task-done', (_e, name, text) => cb(name, text)),
  offAgentTask: () => {
    ipcRenderer.removeAllListeners('agent-task-start')
    ipcRenderer.removeAllListeners('agent-task-done')
  },

  // 프로젝트 생성 진행 상태
  onProjectGenStatus: (cb: (stage: string, message: string) => void) =>
    ipcRenderer.on('project-gen-status', (_e, stage, message) => cb(stage, message)),
  offProjectGenStatus: () =>
    ipcRenderer.removeAllListeners('project-gen-status'),
})