/* Dedicated browser worker: uses the same room engine as Render. */
'use strict';
self.window=self;
importScripts('match-plans.js?v=audio22','config.js?v=match-modes3','shotgun-pellets.js','shooting-spread.js?v=armory20','melee-rules.js','server/room-core.js?v=match-modes3');
self.module={exports:{}};
importScripts('server/hit-registry.js');
const registry=self.module.exports;
delete self.module;
const rooms=new Map(),peers=new Map();
let core=null,room=null,timer=null;
const forbidden=new Set(['create','join','resume','leave','start','host_opt','host_signal','host_input','host_output','host_abort','host_finish']);
function send(peer,data){if(!peer||peer.closed)return false;postMessage({type:'output',to:peer.id,data});return true;}
function remove(peer){if(!peer||peer.closed)return;peer.closed=true;peers.delete(peer.id);room?.players.delete(peer.id);if(room)core.broadcastLobby(room);}
fetch('server/weapons.json?v=armory20').then(r=>{if(!r.ok)throw Error('catalog unavailable');return r.json();}).then(catalog=>{
  core=createRoomCore({rooms,send,close:remove,crypto:self.crypto,catalog,ground:AscentGround,
    ShotgunPellets,ShootingSpread,MeleeRules,...registry,
    sendSnapshot(r,state){for(const p of r.players.values())send(p.client,state);}
  });
  postMessage({type:'ready'});
}).catch(()=>postMessage({type:'failed'}));
onmessage=ev=>{
  const m=ev.data;
  if(!core)return;
  if(m.type==='init'&&!room){
    const l=m.room;room={code:l.code,map:l.map,mode:l.mode,host:l.host,winRounds:l.winRounds,players:new Map(),
      started:false,hostMode:true,hostRun:l.hostRun,phase:'waiting',round:1,scores:{attack:0,defense:0},until:0,spike:null,halfDefused:false};
    rooms.set(l.code,room);
    l.players.forEach((u,i)=>{
      const c={id:u.id,room,closed:false,lastMessage:0};
      peers.set(u.id,c);
      const p={id:u.id,client:c,name:u.name,team:u.team,credits:800,direct:true};
      core.spawn(p,i,l.map);room.players.set(u.id,p);
    });
    core.start(room);core.broadcastState(room);
    timer=setInterval(()=>{if(room?.started)core.step(room,Date.now());else{clearInterval(timer);timer=null;postMessage({type:'finished'});}},100);
  }else if(m.type==='input'&&room?.started&&m.data&&typeof m.data.type==='string'&&!forbidden.has(m.data.type)){
    const c=peers.get(m.from);if(c&&!c.closed)core.receive(c,m.data);
  }else if(m.type==='left')remove(peers.get(m.id));
};
