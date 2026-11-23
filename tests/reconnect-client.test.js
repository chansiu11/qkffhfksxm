'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
class SocketMock {
  static OPEN=1;
  static instances=[];
  constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];SocketMock.instances.push(this);}
  send(str){this.sent.push(JSON.parse(str));}
  close(){this.readyState=3;this.onclose?.({code:1006});}
  open(){this.readyState=1;this.onopen?.();}
}
function appStub(){return {
  roomState:{},matchState:{inMatch:true},bots:[],
  scene:{remove(){}},player:{},
  syncCheatPermissionUI(){},openWaitingLobby(){},openEntryScreen(){this.matchState.inMatch=false;this.entryCount=(this.entryCount||0)+1;},
  launchAscentMatchImmediate(){this.launches=(this.launches||0)+1;},
  updateHUD(){},
};}
test('client auto-resumes during temporary outage without resetting live play, measures real RTT',async()=>{
  SocketMock.instances.length=0;
  const a=appStub();
  const dom={getElementById:()=>null};
  const context={window:{GAME_SERVER_URL:'https://example.test',addEventListener(){}},document:dom,WebSocket:SocketMock,
    console,performance,setTimeout,clearTimeout,setInterval:(fn,ms)=>0,clearInterval:()=>{},Map,Math,JSON};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','multiplayer-client.js'),'utf8'),context);
  const mp=context.window.MP;
  mp.install(a);
  mp.connect('create','21',5);
  const s1=SocketMock.instances.at(-1);
  s1.open();
  assert.equal(s1.sent[0].type,'create');
  const id='player-abc'; const token='f'.repeat(48);
  const room={code:'21',host:id,winRounds:5,players:[{id,team:'attack',name:'Player'}]};
  mp.receive({type:'joined',id,token,team:'attack',room});
  assert.equal(mp.token,token);
  mp.started=true;
  a.matchState.inMatch=true;
  s1.close();
  assert(mp.reconnecting && mp.active,'transient disconnect must not abandon game');
  assert(a.matchState.inMatch,'disconnect must not exit current match');
  mp.scheduleReconnect(0);
  await new Promise(resolve=>setTimeout(resolve,20));
  const s2=SocketMock.instances.at(-1);
  assert.notEqual(s1,s2);
  s2.open();
  assert.equal(s2.sent[0].type,'resume');
  assert.equal(s2.sent[0].token,token);
  mp.receive({type:'resumed',id,token,team:'attack',started:true,room});
  assert(mp.active && mp.started && !mp.reconnecting);
  assert.equal(a.launches || 0,0,'resumed game must not restart or erase weapons');
  assert(a.matchState.inMatch);
  mp.pingSent.set(5,performance.now()-75);
  mp.receive({type:'pong',seq:5});
  assert(mp.rtt>=70 && mp.rtt<250,'real measured ping must be used');
  mp.disconnect();
  assert(!mp.active);
  assert.equal(s2.sent.at(-1).type,'leave');
});