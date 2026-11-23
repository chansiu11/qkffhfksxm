"""Verify that the actual transparent weapon photo is projected as ONE paper plane.
Uses isolated Chromium DOM; no CDN, no network or game server dependency."""
from pathlib import Path
import base64
import re
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text()
css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
js = (root / 'weapon-viewmodels.js').read_text()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for vp in [{'width':1440,'height':900},{'width':390,'height':844}]:
        page = browser.new_page(viewport=vp)
        page.set_content(f'<html><style>{css}</style><body><div id="fps-weapon-sprite-layer"></div></body></html>')
        page.add_script_tag(content=js)
        page.evaluate('''() => {class Group{constructor(){this.children=[];}}
            window.sprite=window.WeaponViewmodels.create({Group});
            window.sprite.setWeapon('vandal');
            window.sprite.update(.016,{alive:true,vel:{x:0,z:0},isScoped:false},{inMatch:true});}''')
        img=page.locator('#fps-weapon-sprite-layer.weapon-visible img.fps-paper-weapon')
        assert img.count()==1
        b64=base64.b64encode((root/'assets/weapons/vandal.webp').read_bytes()).decode()
        img.evaluate('(el,s)=>{el.src="data:image/webp;base64,"+s}',b64)
        page.wait_for_timeout(80)
        assert img.evaluate('(el)=>el.complete&&el.naturalWidth>0')
        r=page.evaluate('''() => {
          const image=document.querySelector('.fps-paper-weapon'),api=window.WeaponViewmodels;
          const tip=window.sprite.getMuzzleScreenPosition();
          const m=new DOMMatrix(getComputedStyle(image).transform);
          const [sw,sh]=[image.naturalWidth,image.naturalHeight];
          const p=new DOMPoint(0,api.muzzleEdgeY.vandal*sh,0,1).matrixTransform(m);
          const s={x:p.x/p.w,y:p.y/p.w};
          return {tip,s,width:sw,moreThan2D:Math.abs(m.m14)>0.0001};
        }''')
        assert abs(r['tip']['x']-r['s']['x'])<1.5,(vp,r)
        assert abs(r['tip']['y']-r['s']['y'])<1.5,(vp,r)
        assert r['moreThan2D']
        assert page.evaluate("getComputedStyle(document.getElementById('fps-weapon-sprite-layer')).opacity") == '1'
        page.evaluate('''() => {window.sprite.setWeapon('knife');window.sprite.update(.016,
            {alive:true,vel:{x:0,z:0},isScoped:false},{inMatch:true});}''')
        assert page.locator('#fps-weapon-sprite-layer img[src="assets/weapons/knife.webp"]').count()==1
        assert page.locator('#fps-weapon-sprite-layer svg').count()==0
        assert page.locator('#art-mag').count()==0
        page.evaluate('''() => window.sprite.update(.016,
            {alive:true,vel:{x:0,z:0},isScoped:false},{inMatch:false})''')
        page.wait_for_timeout(180)
        assert page.evaluate("getComputedStyle(document.getElementById('fps-weapon-sprite-layer')).opacity") == '0'
        page.close()
    browser.close()
    print('Perspective paper muzzle & weapon-only UI smoke passed on desktop and mobile')