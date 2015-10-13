/**
 * Created by ocoka on 9/10/15.
 */
var koa = require('koa');
var koaws = require('./koa-ws');
var session = require('koa-generic-session');
var bodyParser = require('koa-bodyparser');
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
app.use(bodyParser());
app.ws.register('stat', function* () {
    if (registeredPlayers[this.socket.session.name]==null){
        registeredPlayers[this.socket.session.name]=this.socket.session.role;
        this.socket.on('close',function(){
            console.log("Player "+this.session.name+" disconnected");
            delete registeredPlayers[this.session.name];
        });
        for (var ses in app.ws.sockets){
            if (ses!=this.session.id){
                var sockets=app.ws.sockets[ses];
                sockets[0].method('stat',registeredPlayers);
            }
        }
    }
        this.result(registeredPlayers);
});

app.use(function* LoginController (next){
    if (this.path=='/login'){
        if (this.request.body.playerName==null ||
            this.request.body.playerName.length<1 ||
            this.request.body.password==null ||
            this.request.body.password.length<1){
            this.response.body={result:'error',errors:'Invalid player name or password'};
        }else{
            var playerName=this.request.body.playerName;
            if (playerName.length>16){
                this.response.body={result:'error',errors:'Player name too long'};
            }else if(!(/^[а-яa-z][а-яa-z\-_ ]*$/i.test(playerName))){
                this.response.body={result:'error',errors:'Player name contains invalid characters'};
            }else if(registeredPlayers[playerName]!=null){
                this.response.body={result:'error',errors:'Player already registered'};
            }else{

                var role={'111':"player",'222':"master"}[this.request.body.password];
                if (role==null){
                    this.response.body={result:'error',errors:'Wrong password'};
                }else{
                    this.session.name=playerName;
                    this.session.role=role;
                    this.response.body={result:'success'};
                }

            }

        }
    }else{
        yield(next);
    }
});
app.use(function* RoundController (next){

        yield(next);

});
app.listen(3000);