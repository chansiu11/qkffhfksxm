from pathlib import Path
from playwright.sync_api import sync_playwright
import re
repo=Path(__file__).resolve().parents[1];src=(repo/'index.html').read_text();css=(repo/'menu.css').read_text()
start=src.index('      /* --- FLOATING LEFT-HALF JOYSTICK + INDEPENDENT RIGHT-HALF AIM --- */');end=src.index('      // Bind Instant Tactical Buttons (ADS, JUMP, CROUCH, RELOAD, WALK, DOOR)',start)
script=src[start:end]
html=re.sub(r'<script\b[^>]*>.*?</script>','',src,flags=re.S).replace('<link rel="stylesheet" href="menu.css" />',f'<style>{css}</style>')
html=html.replace('</head>','''<style>
.hidden {display:none!important} #mobile-controls{position:fixed;inset:0;z-index:28;pointer-events:none}
#mob-rfire-btn{position:fixed;right:15px;bottom:30px;width:96px;height:96px}
#mob-lfire-btn{position:fixed;left:15px;top:140px;width:70px;height:70px}
</style></head>''')
for size in [(390,844),(820,1180),(1280,720)]:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':size[0],'height':size[1]},has_touch=True)
  page.route('**/*', lambda route: route.abort())
  page.set_content(html, wait_until='domcontentloaded', timeout=10000)
  page.locator('#mobile-controls').evaluate('e=>e.classList.remove("hidden")')
  wrapped='''(()=>{
let player={alive:true,yaw:0,pitch:0,isScoped:false};
let matchState={inMatch:true};let isMouseFiring=false,isRightTouchFiring=false,isLeftTouchFiring=false;
let shotCount=0;let gun={auto:false};
function getActiveWeapon(){return gun;}
function attemptFire(){shotCount++;}
window.cycleSpectator=()=>{};
''' + script + '''\nwindow.__mock={read:()=>({yaw:player.yaw,pitch:player.pitch,shots:shotCount,joystick: {...joyState},isRightTouchFiring,isLeftTouchFiring}),setAuto:(v)=>{gun.auto=v},clearShots:()=>{shotCount=0}};
})();'''
  page.evaluate(wrapped)
  bounds=page.evaluate('''()=>{let a=document.querySelector('#touch-move-zone').getBoundingClientRect(),b=document.querySelector('#touch-look-zone').getBoundingClientRect();return {left:[a.left,a.right],right:[b.left,b.right]}}''')
  assert abs(bounds['left'][1]-size[0]/2)<1,bounds
  assert abs(bounds['right'][0]-size[0]/2)<1,bounds
  def pointer(el,kind,xy,pid=1):
   page.locator(el).evaluate('''(node,a)=>node.dispatchEvent(new PointerEvent(a.kind,{pointerId:a.pid,pointerType:'touch',bubbles:true,clientX:a.x,clientY:a.y,isPrimary:true}))''',{'kind':kind,'pid':pid,'x':xy[0],'y':xy[1]})
  pointer('#touch-move-zone','pointerdown',(size[0]*0.27,420))
  assert page.locator('#joy-zone').evaluate('e=>e.classList.contains("active-joystick")')
  js=page.evaluate('window.__mock.read()')
  assert js['joystick']['dx']==0 and js['joystick']['dy']==0,js
  pointer('#touch-move-zone','pointermove',(size[0]*0.27+40,420-30))
  js=page.evaluate('window.__mock.read()')
  assert js['joystick']['dx']>0.5 and js['joystick']['dy']<-.5,js
  pointer('#touch-look-zone','pointerdown',(size[0]*0.75,450),2)
  pointer('#touch-look-zone','pointermove',(size[0]*0.75+20,445),2)
  js=page.evaluate('window.__mock.read()')
  assert js['yaw']<0,js
  pointer('#touch-look-zone','pointerup',(size[0]*0.75+20,445),2)
  pointer('#touch-move-zone','pointerup',(size[0]*0.27+40,390))
  assert not page.locator('#joy-zone').evaluate('e=>e.classList.contains("active-joystick")')
  # Semiautomatic: hold, drag on fire button to aim, then release exactly one shot.
  yaw1=page.evaluate('window.__mock.read().yaw')
  pointer('#mob-rfire-btn','pointerdown',(size[0]-40,700),3)
  pointer('#mob-rfire-btn','pointermove',(size[0]-60,680),3)
  js=page.evaluate('window.__mock.read()')
  assert js['shots']==0,js
  assert js['yaw']>yaw1,js
  pointer('#mob-rfire-btn','pointerup',(size[0]-60,680),3)
  assert page.evaluate('window.__mock.read().shots')==1
  pointer('#mob-rfire-btn','pointerup',(size[0]-60,680),3)
  assert page.evaluate('window.__mock.read().shots')==1
  # Cancelled press is not a shot.
  pointer('#mob-rfire-btn','pointerdown',(size[0]-40,700),4)
  pointer('#mob-rfire-btn','pointercancel',(size[0]-40,700),4)
  assert page.evaluate('window.__mock.read().shots')==1
  # L-FIRE uses same behavior.
  pointer('#mob-lfire-btn','pointerdown',(40,170),5)
  assert page.evaluate('window.__mock.read().shots')==1
  pointer('#mob-lfire-btn','pointerup',(40,170),5)
  assert page.evaluate('window.__mock.read().shots')==2
  print('touch input OK',size,bounds)
  browser.close()