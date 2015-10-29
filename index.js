/**
 * Created by ocoka on 9/10/15.
 */
var koa = require('koa');
var koaws = require('./koa-ws');
var session = require('koa-generic-session');
var koa_body = require('koa-body');
var crypto = require('crypto');

var registeredPlayers={};
function generate_key() {
    var sha = crypto.createHash('sha256');
    sha.update(Math.random().toString());
    return sha.digest('hex');
}

var app = koa();
app.use(session({
    cookie:{
        path: '/',
        httpOnly: true,
        maxage: null,
        rewrite: true,
        signed: false
    }
}));

app.use(koaws(app, {
    heartbeat: false,
    heartbeatInterval: 5000
}));
app.use(koa_body());
function notifyPlayersChanges(excludedPlayer){
    for (var ses in app.ws.sockets){
        if (ses!=excludedPlayer){
            var sockets=app.ws.sockets[ses];
            if (sockets.length>0){
                sockets[0].method('stat',registeredPlayers);
            }
        }
    }
}
/*app.ws.register('stat', function () {
  if (this.socket.session.name) {
    if (registeredPlayers[this.socket.session.name]==null){
        registeredPlayers[this.socket.session.name]=this.socket.session.role;
        this.socket.on('close',()=>{
            console.log("Player "+this.session.name+" disconnected");
            delete registeredPlayers[this.session.name];
            notifyPlayersChanges(this.session.id);
        });
        notifyPlayersChanges(this.session.id);
    }
        this.result(registeredPlayers);
  }else{
    console.log("Unnamed player");
    this.error(403,'You don\'t provide user name');
  }
});*/

app.use(function* LoginController (next){
    if (this.path=='/login'){
        this.checkBody('playerName').stripLow().trim().notEmpty('Empty player name').len(3,20,"Player name must from 3 up to 20 chars");
        this.checkBody('password').stripLow().trim().notEmpty('Password must be provided').in(['111','222'],'Incorrect password');
        if (this.errors){
          this.body={errors:this.errors,succes:false};
        }else{
          this.body={succes:true};
        }
    }else{
        yield(next);
    }
});
app.use(function* RoundController (next){

        yield(next);

});
app.listen(3000);
