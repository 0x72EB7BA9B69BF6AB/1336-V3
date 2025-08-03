/**
 * @fileoverview Web Server Module
 * @description Provides web interface with navigation for Home, Login, and Registration
 * @version 3.0.0
 * @author ShadowRecon Team
 * @license MIT
 */

const express = require('express');
const path = require('path');
const { logger } = require('../../core/logger');

/**
 * Web Server class to provide web interface
 * @class WebServer
 */
class WebServer {
    /**
     * Creates an instance of WebServer
     * @constructor
     */
    constructor() {
        /** @type {express.Application} */
        this.app = express();
        /** @type {number} */
        this.port = process.env.PORT || 3000;
        /** @type {Object|null} */
        this.server = null;
    }

    /**
     * Initialize the web server
     * @async
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Set view engine
            this.app.set('view engine', 'ejs');
            this.app.set('views', path.join(__dirname, 'views'));

            // Static files
            this.app.use('/static', express.static(path.join(__dirname, 'public')));

            // Body parser
            this.app.use(express.urlencoded({ extended: true }));
            this.app.use(express.json());

            // Setup routes
            this.setupRoutes();

            logger.info('Web server initialized');
        } catch (error) {
            logger.error('Failed to initialize web server', error.message);
            throw error;
        }
    }

    /**
     * Setup application routes
     * @private
     */
    setupRoutes() {
        // Home page route
        this.app.get('/', (req, res) => {
            res.render('home', { 
                title: 'ShadowRecon - Accueil',
                currentPage: 'home'
            });
        });

        // Login page route
        this.app.get('/connexion', (req, res) => {
            res.render('login', { 
                title: 'ShadowRecon - Connexion',
                currentPage: 'login'
            });
        });

        // Registration page route
        this.app.get('/inscription', (req, res) => {
            res.render('register', { 
                title: 'ShadowRecon - Inscription',
                currentPage: 'register'
            });
        });

        // Handle login form submission
        this.app.post('/connexion', (req, res) => {
            const { username } = req.body;
            logger.info('Login attempt', { username });
            
            // For demo purposes - redirect back to home
            res.redirect('/?message=Connexion%20réussie');
        });

        // Handle registration form submission
        this.app.post('/inscription', (req, res) => {
            const { username, email } = req.body;
            logger.info('Registration attempt', { username, email });
            
            // For demo purposes - redirect back to home
            res.redirect('/?message=Inscription%20réussie');
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).render('404', { 
                title: 'Page non trouvée',
                currentPage: 'error'
            });
        });
    }

    /**
     * Start the web server
     * @async
     * @returns {Promise<void>}
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    logger.info(`Web server started on port ${this.port}`);
                    resolve();
                });
            } catch (error) {
                logger.error('Failed to start web server', error.message);
                reject(error);
            }
        });
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

    /**
     * Get server URL
     * @returns {string}
     */
    getUrl() {
        return `http://localhost:${this.port}`;
    }
}

module.exports = { WebServer };