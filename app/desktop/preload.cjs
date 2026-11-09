const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rv', { salvarServidor: (url) => ipcRenderer.invoke('salvar-servidor', url) });
// A tela web (a mesma do navegador) escuta os comandos do menu nativo. Devolve a função que cancela a escuta.
contextBridge.exposeInMainWorld('revalidaDesktop', {
  aoComando(cb) {
    const ouvinte = (_ev, c) => cb(c);
    ipcRenderer.on('comando', ouvinte);
    return () => ipcRenderer.removeListener('comando', ouvinte);
  },
});
