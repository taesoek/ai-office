import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  askAgent: (agentId: string, agentName: string, agentRole: string, messages: { role: string; content: string }[]) =>
    ipcRenderer.invoke('ask-agent', agentId, agentName, agentRole, messages)
})