var co = require('co');
var WebSocketServer = require('ws').Server;
var cookieHelper = require('koa-ws-cookie-helper');

// Protocol
var protocol = require('./jsonrpc');

// Debug output
var debug = require('debug')('koa-ws:server');

/**
 * KoaWebSocketServer object
 * @param app
 * @param options
 */
function KoaWebSocketServer (app, options) {
    // Save ref to app
    this.app = app;

    // Container for options
    this.options = options || {};

    // Container for methods
    this.methods = {};

    // Container for sockets
    this.sockets = {};

    // Session to socket mapping
    this.sessions = {};

    // Callback container for results
    this.awaitingResults = {};
}

KoaWebSocketServer.prototype.listen = function (server) {
    // Create WebSocketServer
    this.server = new WebSocketServer({
        server: server
    });

    // Listen to connection
    this.server.on('connection', this.onConnection.bind(this));
}

/**
 * On new connection
 * @param socket
 */
KoaWebSocketServer.prototype.onConnection = function (socket) {
    var server = this.server;
    var methods = this.methods;
    var sockets = this.sockets;
    var sessions = this.sessions;
    var thumbTimer=null;

    socket.method = function () {
        var cb = null;
        var payload = {
            jsonrpc: '2.0',
            method: arguments[0],
            id: Math.random().toString(36).substr(2, 9) // Generate random id
        };

        if (typeof arguments[1] !== 'function' && typeof arguments[1] !== 'undefined') {
            payload.params = arguments[1];
            if (typeof arguments[2] === 'function') {
                cb = arguments[2];
            }
        } else if (typeof arguments[1] === 'function') {
            cb = arguments[1];
        }

        if (cb) {
            this.awaitingResults[payload.id] = function () {
                cb.apply(this, arguments);
                delete this.awaitingResults[payload.id];
            }.bind(this);
        }

        try {
            debug('→ (%s) %s: %o', payload.id, payload.method, payload.params);
            if (socket.readyState==1){
                socket.send(JSON.stringify(payload));
            }else{
                if (cb) {
                    cb.call(this, {errorMessage:"Socket not ready to send data"});
                }
            }
        } catch (e) {
            console.error('Something went wrong: ', e.stack);
            if (cb) {
                cb.call(this, e);
            }
        }
    }.bind(this);


    socket.error = function (code, message) {
        try {
            var payload = {
                jsonrpc: '2.0',
                error: {
                    code: code,
                    message: message
                },
                id: this.currentId
            };
            if (payload.id) {
                debug('→ (%s) Error %s: %s', payload.id, payload.error.code, payload.error.message);
            } else {
               debug('→ Error %s: %s', payload.id, payload.error.code, payload.error.message);
            }
            socket.send(JSON.stringify(payload));
        }  catch (e) {
            console.error('Something went wrong: ', e.stack);
        }
    };

    socket.on('close', function () {
        if (thumbTimer!=null){
            clearTimeout(thumbTimer);
            thumbTimer=null;
        }
        debug('Client disconnected');
        if (socket.session && Array.isArray(sockets[socket.session.id])) {
            sockets[socket.session.id].splice(
                sockets[socket.session.id].indexOf(socket),
                1
            );
        }
    });

    socket.on('error', function (err) {
        debug('Error occurred:', err);
    });

    socket.on('message', function (message) {
        // If heartbeat, respond
        if (message === '--thump--') {
            debug('← Thump!');
            thumbTimer=setTimeout(function () {
                socket.send('--thump--');
                thumbTimer=null;
            }.bind(this), this.options.heartbeatInterval || 5000);
            return;
        }
        protocol.apply(this, [debug, socket, message]);
    }.bind(this));

    // Let's try and connect the socket to session
    var sessionId = cookieHelper.get(socket, 'koa.sid', this.app.keys);
    if (sessionId) {

        if (this.sessions[sessionId]!=null){
            socket.session = this.sessions[sessionId];
            socket.method('session', socket.session);
        }else if (this.app.sessionStore) {
            var _this = this;
            (co.wrap(function* () {
                socket.session = yield _this.app.sessionStore.get('koa:sess:' + sessionId);
                if (socket.session==null){
                    socket.close();
                }else{
                    _this.sessions[sessionId]=socket.session;
                    socket.method('session', socket.session);
                }
            })());
        }else{
            socket.close();
            return false;
        }

            if (typeof this.sockets[sessionId] === 'undefined') {
                this.sockets[sessionId] = [];
            }
            this.sockets[sessionId].push(socket);

    }else{
        socket.close();
        return false;
    }
    // Send options
    socket.method('options', this.options);
    // Send initial thump
    if (this.options.heartbeat) {
        try {
            socket.send('--thump--');
        }
        catch (e) {
            console.error('Something went wrong: ', e.stack);
        }
    }
}

/**
 * Register a method for server-side
 * @param method
 * @param generator
 * @param expose
 */
KoaWebSocketServer.prototype.register = function (method, generator, expose) {
    if (typeof method === 'object') {
        for (var m in method) {
            this.register(m, method[m]);
        }
    } else if (typeof generator === 'object') {
        for (var m in generator) {
            this.register(method + ':' + m, generator[m]);
        }
    } else if (typeof method === 'string') {
        debug('Registering method: %s', method);
        generator.expose = expose || false;
        this.methods[method] = co.wrap(generator);
    }
};

/**
 * Broadcast to all connected sockets
 * @param method string
 * @param params object
 */
KoaWebSocketServer.prototype.broadcast = function (method, params) {
    if(this.server && this.server.clients) {
        for (var i in this.server.clients) {
            this.server.clients[i].method(method, params, function (err) {
                debug('Could not send message', data, err);
            });
        }
    }
}

module.exports = KoaWebSocketServer;
