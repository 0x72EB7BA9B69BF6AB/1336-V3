/**
 * @fileoverview Web Server Module
 * @description Provides web interface for language selection
 * @version 3.0.0
 * @author ShadowRecon Team
 * @license MIT
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { logger } = require('../../core/logger');

/**
 * Web Server Class
 * Serves the language selection interface
 * @class WebServer
 */
class WebServer {
    /**
     * Creates an instance of WebServer
     * @constructor
     */
    constructor() {
        /** @type {http.Server|null} */
        this.server = null;
        /** @type {number} */
        this.port = 3000;
        /** @type {string} */
        this.publicPath = path.join(__dirname, '../../../public');
        /** @type {string|null} */
        this.selectedLanguage = null;
    }

    /**
     * Initialize the web server
     * @async
     * @returns {Promise<void>}
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                this.server = http.createServer((req, res) => {
                    this.handleRequest(req, res);
                });

                this.server.listen(this.port, () => {
                    logger.info(`Web server started on http://localhost:${this.port}`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        this.port++;
                        this.server.listen(this.port);
                    } else {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle HTTP requests
     * @param {http.IncomingMessage} req - Request object
     * @param {http.ServerResponse} res - Response object
     */
    handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;

        try {
            if (pathname === '/' || pathname === '/index.html') {
                this.serveFile(res, 'index.html', 'text/html');
            } else if (pathname === '/app') {
                this.handleAppRequest(req, res, parsedUrl.query);
            } else {
                this.send404(res);
            }
        } catch (error) {
            logger.error('Error handling request', error.message);
            this.send500(res);
        }
    }

    /**
     * Handle application request with language selection
     * @param {http.IncomingMessage} req - Request object
     * @param {http.ServerResponse} res - Response object
     * @param {Object} query - Query parameters
     */
    handleAppRequest(req, res, query) {
        const lang = query.lang || 'en';
        this.selectedLanguage = lang;
        
        logger.info(`Language selected: ${lang}`);
        
        // Send confirmation page
        const html = `
        <!DOCTYPE html>
        <html lang="${lang}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ShadowRecon - ${this.getLanguageName(lang)}</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .container {
                    text-align: center;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 40px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    max-width: 600px;
                }
                h1 {
                    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin-bottom: 20px;
                }
                .message {
                    font-size: 1.2em;
                    margin-bottom: 30px;
                    line-height: 1.6;
                }
                .btn {
                    padding: 12px 24px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 10px;
                    color: white;
                    text-decoration: none;
                    margin: 10px;
                    display: inline-block;
                    transition: all 0.3s ease;
                }
                .btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: rgba(255, 255, 255, 0.5);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>ShadowRecon</h1>
                <div class="message">
                    ${this.getLocalizedMessage(lang)}
                </div>
                <a href="/" class="btn">${this.getLocalizedText(lang, 'back')}</a>
                <a href="#" class="btn" onclick="startApplication()">${this.getLocalizedText(lang, 'start')}</a>
            </div>
            <script>
                function startApplication() {
                    alert('${this.getLocalizedText(lang, 'starting')}');
                    // Here you would typically start the main application
                    fetch('/start', { method: 'POST', body: JSON.stringify({lang: '${lang}'}), headers: {'Content-Type': 'application/json'} });
                }
            </script>
        </body>
        </html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    /**
     * Get language name for display
     * @param {string} lang - Language code
     * @returns {string} Language name
     */
    getLanguageName(lang) {
        const names = {
            'en': 'English',
            'fr': 'Français',
            'es': 'Español',
            'de': 'Deutsch',
            'it': 'Italiano',
            'pt': 'Português',
            'ru': 'Русский'
        };
        return names[lang] || 'English';
    }

    /**
     * Get localized message
     * @param {string} lang - Language code
     * @returns {string} Localized message
     */
    getLocalizedMessage(lang) {
        const messages = {
            'en': 'Language selection completed. You can now start the application or go back to change your language preference.',
            'fr': 'Sélection de langue terminée. Vous pouvez maintenant démarrer l\'application ou revenir en arrière pour modifier votre préférence de langue.',
            'es': 'Selección de idioma completada. Ahora puedes iniciar la aplicación o volver atrás para cambiar tu preferencia de idioma.',
            'de': 'Sprachauswahl abgeschlossen. Sie können nun die Anwendung starten oder zurückgehen, um Ihre Sprachpräferenz zu ändern.',
            'it': 'Selezione della lingua completata. Ora puoi avviare l\'applicazione o tornare indietro per modificare la tua preferenza linguistica.',
            'pt': 'Seleção de idioma concluída. Agora você pode iniciar o aplicativo ou voltar para alterar sua preferência de idioma.',
            'ru': 'Выбор языка завершен. Теперь вы можете запустить приложение или вернуться назад, чтобы изменить языковые настройки.'
        };
        return messages[lang] || messages['en'];
    }

    /**
     * Get localized text
     * @param {string} lang - Language code
     * @param {string} key - Text key
     * @returns {string} Localized text
     */
    getLocalizedText(lang, key) {
        const texts = {
            'en': {
                'back': 'Back to Language Selection',
                'start': 'Start Application',
                'starting': 'Starting application...'
            },
            'fr': {
                'back': 'Retour à la sélection de langue',
                'start': 'Démarrer l\'application',
                'starting': 'Démarrage de l\'application...'
            },
            'es': {
                'back': 'Volver a la selección de idioma',
                'start': 'Iniciar aplicación',
                'starting': 'Iniciando aplicación...'
            },
            'de': {
                'back': 'Zurück zur Sprachauswahl',
                'start': 'Anwendung starten',
                'starting': 'Anwendung wird gestartet...'
            },
            'it': {
                'back': 'Torna alla selezione della lingua',
                'start': 'Avvia applicazione',
                'starting': 'Avvio dell\'applicazione...'
            },
            'pt': {
                'back': 'Voltar à seleção de idioma',
                'start': 'Iniciar aplicativo',
                'starting': 'Iniciando aplicativo...'
            },
            'ru': {
                'back': 'Назад к выбору языка',
                'start': 'Запустить приложение',
                'starting': 'Запуск приложения...'
            }
        };
        return texts[lang]?.[key] || texts['en'][key] || key;
    }

    /**
     * Serve static file
     * @param {http.ServerResponse} res - Response object
     * @param {string} filename - File name
     * @param {string} contentType - Content type
     */
    serveFile(res, filename, contentType) {
        const filePath = path.join(this.publicPath, filename);
        
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        } else {
            this.send404(res);
        }
    }

    /**
     * Send 404 response
     * @param {http.ServerResponse} res - Response object
     */
    send404(res) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Page Not Found</h1>');
    }

    /**
     * Send 500 response
     * @param {http.ServerResponse} res - Response object
     */
    send500(res) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 - Internal Server Error</h1>');
    }

    /**
     * Get selected language
     * @returns {string|null} Selected language code
     */
    getSelectedLanguage() {
        return this.selectedLanguage;
    }

    /**
     * Stop the web server
     * @async
     * @returns {Promise<void>}
     */
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    logger.info('Web server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = { WebServer };