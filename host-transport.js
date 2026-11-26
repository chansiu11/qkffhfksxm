/* Optional trusted-room host transport; no credentials or IPs are persisted. */
(function(){
'use strict';
const CONTROL=new Set(['create','join','resume','leave','host_opt','host_signal','host_input','host_output','host_abort','host_finish','host_alive']);
function make(mp){
  let room=null,worker=null,workerReady=false,mode=false,enabled=false,epoch=0,lastWorkerAt=0;
  const links=new Map(),early=[];
  let invitationDismissed=false,requestWasOn=false,withdrawing=false;
  const privacyNotice='신뢰하는 참가자끼리만 직접 연결하세요. WebRTC 연결에서는 상대방에게 네트워크 주소가 노출될 수 있습니다. 방장이 경기를 제어하며 연결이 끊기면 경기가 재시작될 수 있습니다.';
  let diagnostics=null,reading=false,lastRead=0,lastProbeRoute=null;
  const workerProbes=new Map();
  function noteWorkerProbe(from,data){
    if(data?.type!=='ping'||!Number.isFinite(data.seq))return;
    workerProbes.set(from+':'+data.seq,performance.now());
    while(workerProbes.size>32)workerProbes.delete(workerProbes.keys().next().value);
  }
  function annotateWorkerProbe(to,data){
    if(data?.type!=='pong')return data;
    const key=to+':'+data.seq,start=workerProbes.get(key);
    workerProbes.delete(key);
    return start===undefined?data:{...data,workerRttMs:Math.round(performance.now()-start)};
  }
  function selectedPair(stats){
    let pair=null;
    for(const r of stats.values()){
      if(r.type==='transport'&&r.selectedCandidatePairId){
        const candidate=stats.get(r.selectedCandidatePairId);
        if(candidate&&candidate.state==='succeeded'){pair=candidate;break;}
      }
    }
    if(!pair)for(const r of stats.values()){
      if(r.type==='candidate-pair'&&r.state==='succeeded'&&(r.selected||r.nominated)){pair=r;break;}
    }
    if(!pair)return null;
    const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId);
    return {rtt:Number.isFinite(pair.currentRoundTripTime)?Math.round(pair.currentRoundTripTime*1000):null,
      path:local?.candidateType==='relay'||remote?.candidateType==='relay'?'TURN':local?.candidateType==='host'&&remote?.candidateType==='host'?'HOST/HOST':'ICE',
      protocol:local?.protocol||null};
  }
  async function sampleDiagnostics(){
    const now=performance.now();
    if(reading||now-lastRead<1400)return;
    lastRead=now;
    const link=mode&&!isHost()?links.get(room?.host):null;
    if(!link||link.dc?.readyState!=='open'){diagnostics=null;return;}
    const generation=epoch;
    reading=true;
    try{
      const info=selectedPair(await link.pc.getStats());
      if(generation===epoch&&mode&&links.get(room?.host)===link)
        diagnostics={...info,queued:link.dc.bufferedAmount,at:performance.now()};
    }catch(_){diagnostics=null;}
    finally{reading=false;}
  }
  const raw=m=>mp.rawSend(m);
  function clearLink(id){const l=links.get(id);if(!l)return;links.delete(id);try{l.pc.close();}catch(_){}}
  function stopWorker(){workerProbes.clear();if(worker)worker.terminate();worker=null;workerReady=false;}
  function reset(){epoch++;invitationDismissed=false;requestWasOn=false;withdrawing=false;diagnostics=null;lastProbeRoute=null;mode=false;enabled=false;room=null;early.length=0;for(const id of [...links.keys()])clearLink(id);stopWorker();}
  function hostRequested(){return !!room?.players.find(p=>p.id===room.host)?.direct;}
  function report(){
    const requested=hostRequested(),host=isHost(),total=room?.players.length||0;
    const agreed=room?.players.filter(p=>p.direct).length||0;
    const open=[...links.values()].filter(l=>l.dc?.readyState==='open').length;
    const el=document.getElementById('host-transport-status');
    if(el)el.textContent=mode?'방장 호스트 연결':requested?
      '직접 연결 동의 '+agreed+'/'+total+(host?' · 연결 '+(open+(workerReady&&enabled?1:0))+'/'+total:''):'Render 서버 연결';
    const cb=document.getElementById('host-transport-opt');
    if(cb){cb.checked=enabled;cb.disabled=!room||!!room.started||(!host&&!requested);}
    const label=document.getElementById('host-transport-label');
    if(label)label.textContent=host?'방 전체에 직접 연결 요청 (참가자별 동의 필요)':'직접 연결에 동의';
    const invite=document.getElementById('host-consent-invite');
    if(invite)invite.hidden=!room||!!room.started||host||!requested||enabled||invitationDismissed;
    const detail=document.getElementById('host-consent-detail');
    if(detail)detail.textContent=requested&&!host&&!enabled&&invitationDismissed?'직접 연결에 동의하지 않았습니다. 원하면 위 옵션으로 동의할 수 있습니다.':requested&&host?'모든 참가자의 동의 및 연결 준비가 필요합니다.':'';
  }
  function setEnabled(value,explicitConsent=false){
    if(mode||!room||room.started)return false;
    if(value&&!isHost()&&!hostRequested()){report();return false;}
    if(value&&!explicitConsent&&!window.confirm(privacyNotice+' 동의하시겠습니까?')){report();return false;}
    if(value&&(!window.RTCPeerConnection||!window.Worker)){mp.status('이 브라우저에서는 직접 연결을 사용할 수 없습니다.',true);report();return false;}
    if(!raw({type:'host_opt',enabled:!!value})){report();return false;}
    enabled=!!value;
    if(!isHost())invitationDismissed=true;
    if(!enabled){for(const id of [...links.keys()])clearLink(id);stopWorker();}
    report();return true;
  }
  function respondToInvitation(accepted){
    if(!room||room.started||isHost()||!hostRequested()||enabled)return;
    if(accepted){setEnabled(true,true);}
    else{invitationDismissed=true;report();}
  }
  function getWorker(){
    if(worker)return;
    try{worker=new Worker('host-runtime.js?v=round-wait2');}catch(_){return;}
    worker.onmessage=e=>{
      const m=e.data;lastWorkerAt=performance.now();
      if(m.type==='ready'){workerReady=true;report();}
      else if(m.type==='failed'){stopWorker();if(mode)raw({type:'host_abort'});}
      else if(m.type==='output'&&mode){const data=annotateWorkerProbe(m.to,m.data);if(m.to===mp.myId)mp.receive(data);else route(m.to,{kind:'output',data});}
      else if(m.type==='finished'&&mode){raw({type:'host_finish'});mode=false;stopWorker();report();}
    };
    worker.onerror=()=>{stopWorker();if(mode)raw({type:'host_abort'});};
  }
  function isHost(){return room?.host===mp.myId;}
  function route(to,packet){
    const link=links.get(to),dc=link?.dc;
    packet={...packet,run:room?.hostRun};
    const encoded=JSON.stringify(packet);
    if(dc?.readyState==='open'&&dc.bufferedAmount<32768){try{dc.send(encoded);if(packet.data?.type==='ping')lastProbeRoute='P2P';return true;}catch(_){}}
    if(packet.data?.type==='ping')lastProbeRoute='RELAY';
    if(packet.kind==='input')return raw({type:'host_input',run:packet.run,data:packet.data});
    return raw({type:'host_output',run:packet.run,to,data:packet.data});
  }
  function deliver(from,packet){
    if(!packet||!packet.data||typeof packet.data.type!=='string')return;
    if(!mode){if(packet.kind==='output'&&early.length<64)early.push([from,packet]);return;}
    if(packet.run!==room?.hostRun)return;
    if(packet.kind==='input'&&isHost()&&room.players.some(p=>p.id===from)&&!CONTROL.has(packet.data.type)){
      noteWorkerProbe(from,packet.data);
      worker?.postMessage({type:'input',from,data:packet.data});
    }else if(packet.kind==='output'&&!isHost()&&from===room.host&&!CONTROL.has(packet.data.type)&&!['host_begin','host_fallback','hello','joined','resumed','resume_failed'].includes(packet.data.type))mp.receive(packet.data);
  }
  function attach(link,dc){
    link.dc=dc;
    dc.onopen=report;dc.onclose=report;
    dc.onmessage=e=>{if(typeof e.data!=='string'||e.data.length>65536)return;try{deliver(link.id,JSON.parse(e.data));}catch(_){}};
  }
  function createLink(id,offer){
    if(links.has(id))return links.get(id);
    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    const link={id,pc,dc:null,ice:[],chain:Promise.resolve()};links.set(id,link);
    pc.onicecandidate=e=>{if(e.candidate&&links.get(id)===link)raw({type:'host_signal',to:id,signal:{kind:'ice',candidate:e.candidate.toJSON()}});};
    pc.ondatachannel=e=>{if(links.get(id)===link)attach(link,e.channel);};
    pc.onconnectionstatechange=report;
    if(offer){
      attach(link,pc.createDataChannel('room',{ordered:true}));
      link.chain=link.chain.then(async()=>{await pc.setLocalDescription(await pc.createOffer());raw({type:'host_signal',to:id,signal:{kind:'offer',sdp:pc.localDescription.toJSON()}});}).catch(()=>clearLink(id));
    }
    return link;
  }
  function update(lobby){
    if(room&&room.code!==lobby.code)reset();
    const oldHost=room?.host;
    room=lobby;
    if(mode&&!room.hostMode)fallback();
    if(oldHost&&oldHost!==room.host&&!mode){for(const id of [...links.keys()])clearLink(id);stopWorker();}
    const me=room.players.find(p=>p.id===mp.myId);
    const requested=hostRequested(),hostChanged=!!oldHost&&oldHost!==room.host;
    if(hostChanged||requested!==requestWasOn)invitationDismissed=false;
    requestWasOn=requested;
    enabled=!!me?.direct;
    // A previous consent is not transferable to a different host.
    if(!room.started&&enabled&&!isHost()&&(!requested||hostChanged||withdrawing)){
      if(!withdrawing){withdrawing=raw({type:'host_opt',enabled:false});}
      enabled=false;for(const id of [...links.keys()])clearLink(id);stopWorker();
      report();return;
    }
    if(!me?.direct)withdrawing=false;
    if(!enabled||!window.RTCPeerConnection){report();return;}
    const eligible=room.players.filter(p=>p.id!==mp.myId&&p.direct&&(isHost()||p.id===room.host));
    for(const id of [...links.keys()])if(!eligible.some(p=>p.id===id))clearLink(id);
    if(isHost()&&!room.started){getWorker();for(const p of eligible)if(!links.has(p.id))try{createLink(p.id,true);}catch(_){}}
    report();
  }
  function signal(m){
    if(!enabled||!room||!room.players.some(p=>p.id===m.from&&p.direct)||(m.from!==room.host&&!isHost()))return;
    let l;try{l=links.get(m.from)||createLink(m.from,false);}catch(_){return;}
    const s=m.signal;
    l.chain=l.chain.then(async()=>{
      if(s.kind==='ice'){
        if(l.pc.remoteDescription)await l.pc.addIceCandidate(s.candidate);else l.ice.push(s.candidate);
      }else if(s.kind==='offer'||s.kind==='answer'){
        if((s.kind==='offer'&&isHost())||(s.kind==='answer'&&!isHost()))return;
        await l.pc.setRemoteDescription(s.sdp);
        for(const c of l.ice.splice(0))await l.pc.addIceCandidate(c);
        if(s.kind==='offer'){await l.pc.setLocalDescription(await l.pc.createAnswer());raw({type:'host_signal',to:m.from,signal:{kind:'answer',sdp:l.pc.localDescription.toJSON()}});}
      }
    }).catch(()=>clearLink(m.from));
  }
  function begin(lobby){
    room=lobby;mode=true;diagnostics=null;lastProbeRoute=null;mp.rtt=null;mp.jitter=0;mp.pingSent.clear();report();
    if(isHost()){
      if(!workerReady){raw({type:'host_abort'});return;}
      worker.postMessage({type:'init',room:lobby});
    }else for(const [from,p] of early.splice(0))deliver(from,p);
  }
  function fallback(){diagnostics=null;lastProbeRoute=null;mode=false;early.length=0;stopWorker();mp.rtt=null;mp.jitter=0;mp.pingSent.clear();report();}
  function send(m){
    if(m.type==='start'&&!mode&&isHost()){
      const ready=[...links.values()].filter(l=>l.dc?.readyState==='open').map(l=>l.id);
      if(hostRequested()){
        const allAgreed=room.players.every(p=>p.direct&&p.online!==false);
        const allReady=enabled&&workerReady&&room.players.every(p=>p.id===mp.myId||ready.includes(p.id));
        if(!allAgreed||!allReady){
          if(!window.confirm('아직 모든 참가자의 동의 또는 연결 준비가 완료되지 않았습니다. Render 서버로 시작하시겠습니까? 취소를 누르면 대기실에 남습니다.'))return false;
          return raw({...m,hostReady:false,ready:[]});
        }
      }
      return raw({...m,hostReady:enabled&&workerReady,ready});
    }
    if(!mode||CONTROL.has(m.type))return raw(m);
    if(isHost()){if(!worker)return false;if(m.type==='ping'&&performance.now()-lastWorkerAt<3000)raw({type:'host_alive',run:room.hostRun});noteWorkerProbe(mp.myId,m);worker.postMessage({type:'input',from:mp.myId,data:m});return true;}
    return route(room.host,{kind:'input',data:m});
  }
  return {reset,update,signal,begin,fallback,send,setEnabled,respondToInvitation,sampleDiagnostics,
    get diagnostics(){return mode&&diagnostics&&performance.now()-diagnostics.at<6000?{...diagnostics,probeRoute:lastProbeRoute}:null;},
    get probeRoute(){return mode?lastProbeRoute:null;},
    relayInput:m=>deliver(m.from,{kind:'input',run:m.run,data:m.data}),
    relayOutput:m=>deliver(room?.host,{kind:'output',run:m.run,data:m.data}),
    left:id=>{clearLink(id);worker?.postMessage({type:'left',id});},
    get active(){return mode;},get label(){return mode?(isHost()?'HOST':links.get(room?.host)?.dc?.readyState==='open'?'P2P':'RELAY'):'RENDER';}};
}
window.createHostTransport=make;
})();
