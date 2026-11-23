"""Exercise the actual keydown/keyup handlers with a small browser harness."""
from pathlib import Path
from playwright.sync_api import sync_playwright
src = (Path(__file__).resolve().parents[1] / 'index.html').read_text()
start = src.index("      window.addEventListener('keydown', (e) => {")
end = src.index("      window.addEventListener('pointermove', (e) => {", start)
handlers = src[start:end]
script = '''(() => {
  let keys={}, isKeyboardFiring=false, isSpikeKeyHeld=false;
  let player={alive:true}, matchState={inMatch:true}, roomState={allowCheats:false};
  let shots=0, zooms=0; function attemptFire(){shots++};
  const getActiveWeapon=()=>({auto:false});
  window.__keyboardTest=()=>({shots,held:isKeyboardFiring,spike:isSpikeKeyHeld,zooms});
  window.triggerJump=()=>{}; window.triggerReload=()=>{};
  window.switchWeaponSlot=()=>{}; window.toggleAscentDoor=()=>{};
  window.toggleShop=()=>{}; window.toggleCheatPanel=()=>{};
  window.cycleSpectator=()=>{}; window.toggleScope=()=>{zooms++};
''' + handlers + '\n})();'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=b.new_page()
    page.goto('about:blank')
    page.evaluate(script)
    page.keyboard.down('c')
    assert page.evaluate('window.__keyboardTest()') == {'shots':1,'held':True,'spike':False,'zooms':0}
    page.keyboard.down('c')
    assert page.evaluate('window.__keyboardTest().shots') == 1, 'holding C must not double fire single shots'
    page.keyboard.up('c')
    assert page.evaluate('window.__keyboardTest().held') is False
    page.keyboard.down('c')
    assert page.evaluate('window.__keyboardTest().shots') == 2
    page.keyboard.up('c')
    page.keyboard.down('f')
    assert page.evaluate('window.__keyboardTest().spike') is True, 'existing F function must remain unchanged'
    assert page.evaluate('window.__keyboardTest().shots') == 2
    page.keyboard.up('f')
    assert page.evaluate('window.__keyboardTest().spike') is False
    page.keyboard.down('x')
    assert page.evaluate('window.__keyboardTest().zooms') == 1, 'X should toggle zoom once'
    page.keyboard.down('x')
    assert page.evaluate('window.__keyboardTest().zooms') == 1, 'holding X must not repeatedly toggle zoom'
    page.keyboard.up('x')
    page.keyboard.down('x')
    assert page.evaluate('window.__keyboardTest().zooms') == 2
    page.keyboard.up('x')
    print('keyboard X zoom / C fire / F spike regression OK')
    b.close()