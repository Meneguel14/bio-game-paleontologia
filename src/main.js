/*
 * ESCAVAÇÃO PALEONTOLÓGICA — Processo Principal (Main Process)
 * main.js — Electron
 *
 * Responsabilidades:
 *   • Criar a janela principal em modo kiosk (tela cheia para totem)
 *   • Ocultar menus e barras de navegação
 *   • Escutar eventos IPC do renderer para gravar dados em CSV
 *   • Bloquear atalhos que permitam sair da aplicação
 */

const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs   = require('fs');

// ─── Caminho do arquivo CSV ─────────────────────────────────────────────────
// O CSV é salvo na mesma pasta do executável (ou do projeto em dev)
const CSV_FILE = path.join(app.getPath('userData'), 'cadastros.csv');

// ─── Cabeçalho do CSV ───────────────────────────────────────────────────────
const CSV_HEADER = 'Nome,Idade,Escola,Etapa,Data/Hora,Pontuação,Tempo\n';

/**
 * Garante que o arquivo CSV exista com cabeçalho.
 * Se já existir, não sobrescreve.
 */
function ensureCSV() {
    if (!fs.existsSync(CSV_FILE)) {
        fs.writeFileSync(CSV_FILE, CSV_HEADER, 'utf-8');
        console.log('[CSV] Arquivo criado em:', CSV_FILE);
    }
}

/**
 * Adiciona uma linha ao CSV.
 * Escapa campos que contenham vírgulas ou aspas.
 */
function appendToCSV(data) {
    const escape = (val) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const line = [
        escape(data.nome),
        escape(data.idade),
        escape(data.escola),
        escape(data.etapa),
        escape(data.dataHora),
        escape(data.pontuacao),
        escape(data.tempo)
    ].join(',') + '\n';

    fs.appendFileSync(CSV_FILE, line, 'utf-8');
    console.log('[CSV] Registro salvo:', data.nome);
}

// ─── Janela Principal ───────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        // Modo Totem: tela cheia sem moldura
        fullscreen: true,
        kiosk: true,
        frame: false,
        autoHideMenuBar: true,
        resizable: false,
        movable: false,
        minimizable: false,
        closable: true,           // Permitimos fechar via atalho especial
        skipTaskbar: true,        // Não aparece na barra de tarefas
        backgroundColor: '#3E2723',

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,     // Segurança: isola contextos
            nodeIntegration: false,     // Segurança: sem acesso direto ao Node
            devTools: false             // Bloqueia DevTools para o usuário final
        }
    });

    // Carrega o jogo
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Remove o menu da aplicação
    mainWindow.setMenu(null);

    // Impede que o usuário navegue para fora
    mainWindow.webContents.on('will-navigate', (event) => {
        event.preventDefault();
    });

    // Impede abertura de novas janelas
    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ─── Ciclo de Vida do App ───────────────────────────────────────────────────
app.whenReady().then(() => {
    ensureCSV();
    createWindow();

    // Atalho secreto para administradores: Ctrl+Shift+Q fecha o kiosk
    globalShortcut.register('CommandOrControl+Shift+Q', () => {
        if (mainWindow) mainWindow.close();
    });

    // Atalho secreto para DevTools em modo desenvolvimento
    // Remover em produção se desejado
    globalShortcut.register('CommandOrControl+Shift+D', () => {
        if (mainWindow) mainWindow.webContents.toggleDevTools();
    });
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// ─── Handlers IPC ───────────────────────────────────────────────────────────

// Recebe dados do cadastro do jogador (disparo no submit do formulário)
ipcMain.on('save-player', (_event, data) => {
    console.log('[IPC] Cadastro recebido:', data.nome);
    // O cadastro é armazenado em memória pelo renderer.
    // A gravação no CSV ocorre apenas no fim da partida, com dados completos.
});

// Recebe dados completos ao finalizar a partida
ipcMain.on('save-game-result', (_event, data) => {
    console.log('[IPC] Resultado da partida recebido:', data.nome, '| Pontos:', data.pontuacao);
    try {
        appendToCSV(data);
    } catch (err) {
        console.error('[CSV] Erro ao gravar:', err);
    }
});
