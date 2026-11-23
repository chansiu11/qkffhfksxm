'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function newClient() {
  const gun={id:'operator',slot:'primary',mag:0,reserve:10,magSize:5,fireRate:1.15,recoilPitch:0.08};
  const player={primary:gun,secondary:{id:'classic'},activeSlot:'primary',alive:true,reloading:false,
    yaw:0,pitch:0,footY:0,pos:{x:1,y:1.65,z:3},lastShotTime:0};
  let startedReload=0,stoppedReload=0;
  const api={player,roomState:{},matchState:{inMatch:true},bots:[],scene:{remove(){}},
    getActiveWeapon:()=>gun,
    viewmodel:{beginReload(){startedReload++},stopReload(){stoppedReload++},fire(){}},
    sfx:{playGunshot(){},playKnifeSlash(){}},muzzleFlashMesh:{material:{opacity:0}},
    gunGroup:{position:{z:0}},drawLocalShot(){},updateHUD(){},syncCheatPermissionUI(){}};
  const window={addEventListener(){},GAME_SERVER_URL:'https://example.test'};
  const context={window,document:{getElementById:()=>null},WebSocket:{OPEN:1},
    console,performance,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},Map,Math,JSON};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','multiplayer-client.js'),'utf8'),context);
  context.window.MP.install(api);
  return {mp:context.window.MP,api,gun,player,context,started:()=>startedReload,stopped:()=>stoppedReload};
}
test('reload completion updates the correct gun and clears the firing lock',()=>{
  const c=newClient(),{mp,gun,player}=c;
  player.pendingReloadWeapon='operator';player.reloading=true;
  mp.receive({type:'reload_started',weapon:'operator',remainingMs:1100});
  assert(player.reloading);assert.equal(c.started(),1);
  mp.receive({type:'inventory',weapon:'operator',mag:3,reserve:7});
  assert(player.reloading,'a generic equip/snapshot inventory event must not cancel reload');
  mp.receive({type:'reload_done',weapon:'operator',mag:5,reserve:5});
  assert.equal(gun.mag,5);assert.equal(gun.reserve,5);
  assert.equal(player.reloading,false);assert.equal(player.pendingReloadWeapon,null);
  assert.equal(c.stopped(),1);
});
test('reload cancellation on weapon switch releases lock without modifying unrelated ammo',()=>{
  const c=newClient();c.player.pendingReloadWeapon='operator';c.player.reloading=true;
  c.mp.receive({type:'reload_cancelled',weapon:'operator',reason:'switched'});
  assert.equal(c.player.reloading,false);
  assert.equal(c.gun.mag,0);
});
test('shot sends latest position before bullet and rewound rendering timestamp',()=>{
  const c=newClient();let packets=[];
  c.gun.mag=2;c.mp.started=true;c.mp.state={phase:'combat',serverAt:123456789};
  c.mp.send=x=>{packets.push(x);return true;};
  c.player.lastShotTime=-9999;
  c.mp.fire();
  assert.equal(packets[0].type,'move');
  assert.equal(packets[1].type,'shoot');
  assert.equal(packets[1].seenAt,123456789);
  assert.equal(packets[1].from[0],c.player.pos.x);
  assert.equal(c.gun.mag,1);
});

test('out-of-sync reload refusal unlocks input rather than trapping the player',()=>{
  const c=newClient();
  c.player.pendingReloadWeapon='operator';c.player.reloading=true;
  c.player.reloadId=9;c.player.reloadServerConfirmed=false;
  c.mp.receive({type:'reload_cancelled',requestId:9,weapon:'classic',reason:'weapon_mismatch'});
  assert.equal(c.player.reloading,false);
  assert.equal(c.player.pendingReloadWeapon,null);
  assert.equal(c.stopped(),1);
});

test('a reload-start ack is not allowed to re-lock an old weapon after switching',()=>{
  const c=newClient();
  c.player.reloadId=15;c.player.reloading=false;c.player.pendingReloadWeapon=null;
  c.mp.receive({type:'reload_started',weapon:'operator',requestId:12,remainingMs:900});
  assert.equal(c.player.reloading,false);
  assert.equal(c.started(),0);
});