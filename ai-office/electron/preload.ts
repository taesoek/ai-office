const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  askAgent: (agentId: any, agentName: any, agentRole: any, messages: any, projectNote: any) =>
    ipcRenderer.invoke('ask-agent', agentId, agentName, agentRole, messages, projectNote),
  saveFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke('save-file', content, defaultName),
  onStream: (callback: (text: string) => void) => {
    ipcRenderer.on('agent-stream', (_event, text) => callback(text))
  },
  offStream: () => {
    ipcRenderer.removeAllListeners('agent-stream')
  },
  pmDistribute: (pmNickname: string, userRequest: string, agents: any[], projectNote: string) =>
    ipcRenderer.invoke('pm-distribute', pmNickname, userRequest, agents, projectNote),
  runAgentTask: (agentId: string, agentNickname: string, agentSpecialty: string, task: string, projectNote: string) =>
    ipcRenderer.invoke('run-agent-task', agentId, agentNickname, agentSpecialty, task, projectNote),
  onStreamTask: (callback: (nickname: string, text: string) => void) => {
    ipcRenderer.on('agent-stream-task', (_event, nickname, text) => callback(nickname, text))
  },
  offStreamTask: () => {
    ipcRenderer.removeAllListeners('agent-stream-task')
  }
})