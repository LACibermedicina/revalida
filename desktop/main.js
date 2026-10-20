// Revalida Prático — versão desktop (Electron). Abre o MESMO app web do seu servidor, com câmera/microfone liberados só para ele.
import { app, BrowserWindow, Menu, session, shell, ipcMain } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarServidor, mesmaOrigem } from './src-servidor.js';
import { montarMenu, comandoValido } from './src-menu.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const arqConfig = () => join(app.getPath('userData'), 'servidor.json');
const lerServidor = () => { try { const r = validarServidor(JSON.parse(readFileSync(arqConfig(), 'utf8')).url); return r.ok ? r : null; } catch { return null; } };
let janela; let origem = null;

function abrir() {
  const s = lerServidor();
  origem = s?.origem ?? null;
  if (s) janela.loadURL(s.url); else janela.loadFile(join(aqui, 'config.html'));
}

app.whenReady().then(() => {
  janela = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 640, title: 'Revalida Prático',
    webPreferences: { preload: join(aqui, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  // Câmera/microfone só para o servidor configurado (e para a tela local de configuração: nenhum).
  session.defaultSession.setPermissionRequestHandler((wc, permissao, cb, detalhes) => {
    cb(permissao === 'media' && origem !== null && mesmaOrigem(detalhes.requestingUrl, origem));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permissao, origemPedido) => permissao === 'media' && origem !== null && mesmaOrigem(origemPedido, origem));

  // não navega para fora do servidor; links externos abrem no navegador do sistema (só https)
  janela.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  janela.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:') && !(origem && mesmaOrigem(url, origem))) e.preventDefault(); });

  ipcMain.handle('salvar-servidor', (ev, url) => {
    const r = validarServidor(url);
    if (!r.ok) return r;
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(arqConfig(), JSON.stringify({ url: r.url }));
    abrir();
    return { ok: true };
  });

  const montar = () => Menu.setApplicationMenu(Menu.buildFromTemplate(montarMenu({
    servidorAtivo: () => origem !== null,
    enviar: (c) => { if (comandoValido(c)) janela.webContents.send('comando', c); },
    trocarServidor: () => { origem = null; montar(); janela.loadFile(join(aqui, 'config.html')); },
    recarregar: () => janela.reload(),
  })));
  janela.webContents.on('did-finish-load', montar);   // itens de estação só ficam ativos com um servidor aberto
  montar();
  abrir();
});
app.on('window-all-closed', () => app.quit());
