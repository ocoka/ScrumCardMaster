var fs = require('fs');
var path = require('path');
var objectAssign = require('object-assign');
var debug = require('debug')('koa-ws:middleware');

var KoaWebSocketServer = require('./server');

module.exports = function (app, passedOptions) {
    // Default options
    var options = {
        heartbeat: true,
        heartbeatInterval: 5000
    };
    // Override with passed options
    objectAssign(options, passedOptions || {});

    var oldListen = app.listen;
    app.listen = function () {
        debug('Attaching server...')
        app.server = oldListen.apply(app, arguments);
        app.ws.listen(app.server);
        return app;
    };

    app.ws = app.io = new KoaWebSocketServer(app, options);

    return function* (next) {
        if (this.session && this.sessionId) {
            app.sessionStore=this.sessionStore;
            if (typeof app.ws.sockets[this.sessionId] === 'undefined') {
                app.ws.sockets[this.sessionId] = [];
            }
            this.session.id=this.sessionId;
            app.ws.sessions[this.sessionId] = this.session;
            this.sockets = app.ws.sockets[this.sessionId];
        }

        yield next;
    };
};