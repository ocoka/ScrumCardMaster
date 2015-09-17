/**
 * Created by ocoka on 9/10/15.
 */
var koa = require('koa');
var koaws = require('./koa-ws');
var session = require('koa-generic-session');
var bodyParser = require('koa-bodyparser');
var crypto = require('crypto');

var registeredUsers={};

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
app.ws.register('round', function* () {
    if (param.name!=null && param.pass!=null){
        if (!registeredUsers[param.name]){
            var sessid=generate_key();
            registeredUsers[name]=sessid;
            this.result({session:sessid});
        }else{
            this.error(352,"User already registered");
        }
    }else{
        this.error(351,"Access denied");
    }
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
            }else{

                var role={'111':"player",'222':"master"}[this.request.body.password];
                if (role==null){
                    this.response.body={result:'error',errors:'Wrong password'};
                }else{
                    this.session.playerName=playerName;
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
    console.log("RoundController request "+this.path);
        yield(next);
    console.log("RoundController response"+this.path);
});
app.listen(3000);