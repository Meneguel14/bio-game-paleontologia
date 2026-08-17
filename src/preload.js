/*
 * ESCAVAÇÃO PALEONTOLÓGICA — Preload Script
 * preload.js — Ponte segura entre o Renderer e o Main Process
 *
 * Utiliza contextBridge para expor apenas as APIs necessárias
 * ao front-end, sem conceder acesso direto ao Node.js.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * Envia dados do cadastro do jogador para o Main Process.
     * @param {Object} data - { nome, idade, escola, etapa }
     */
    savePlayer: (data) => {
        ipcRenderer.send('save-player', data);
    },

    /**
     * Envia o resultado completo da partida para gravação no CSV.
     * @param {Object} data - { nome, idade, escola, etapa, dataHora, pontuacao, tempo }
     */
    saveGameResult: (data) => {
        ipcRenderer.send('save-game-result', data);
    }
});
