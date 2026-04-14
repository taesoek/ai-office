const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  askAgent: (agentId: any, agentName: any, agentRole: any, messages: any, projectNote: any) =>
    ipcRenderer.invoke('ask-agent', agentId, agentName, agentRole, messages, projectNote),
  saveFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke('save-file', content, defaultName)
})