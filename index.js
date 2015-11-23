/**
 * Created by ocoka on 9/10/15.
 */
var koa = require('koa');
var koaws = require('./koa-ws');
var session = require('koa-generic-session');
var koa_body = require('koa-body');
var koa_validate= require('koa-validate');
var crypto = require('crypto');

var registeredPlayers={};
var roles={
  212:"simple",
  212212:"master"
}
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
app.use(koa_validate());
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
app.ws.register('stat', function () {
  if (this.socket.session.playerName) {
    if (registeredPlayers[this.socket.session.playerName]==null){
        registeredPlayers[this.socket.session.playerName]=this.socket.session.playerRole;
        this.socket.on('close',()=>{
            console.log("Player "+this.session.playerName+" disconnected");
            delete registeredPlayers[this.session.playerName];
            notifyPlayersChanges(this.session.id);
        });
        notifyPlayersChanges(this.session.id);
    }
        this.result(registeredPlayers);
  }else{
    console.log("Unnamed player");
    this.error(403,'You don\'t provide user name');
  }
});

app.use(function* LoginController (next){
    if (this.path=='/login'){
        this.checkBody('playerName').stripLow().trim().notEmpty('Empty player name').len(3,20,"Player name must from 3 up to 20 chars");
        this.checkBody('playerPass').stripLow().trim().notEmpty('Password must be provided').in(Object.keys(roles),'Incorrect password');
        if (this.errors){
          this.body={errors:this.errors.reduce((p,n)=>Object.assign(p,n),{}),result:'error'};
        }else{
          this.session={playerName:this.request.body.playerName,playerRole:roles[this.request.body.playerPass]};
          this.body={result:'success'};
        }
    }else{
        yield(next);
    }
});
app.use(function* RoundController (next){

        yield(next);

});
app.listen(3000);
