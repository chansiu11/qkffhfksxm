"""Visual DOM smoke test for original 2D weapon artwork; requires no network/CDN."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text()
css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
js = (root / 'weapon-viewmodels.js').read_text()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for viewport in [{'width':1440,'height':900},{'width':390,'height':844}]:
        page = browser.new_page(viewport=viewport)
        page.set_content(f'<html><style>{css}</style><body><div id="fps-weapon-sprite-layer"></div></body></html>')
        page.add_script_tag(content=js)
        page.evaluate('''() => {class Group{constructor(){this.children=[];}}
            window.sprite=window.WeaponViewmodels.create({Group});
            window.sprite.setWeapon('vandal');
            window.sprite.update(.016,{alive:true,vel:{x:0,z:0},isScoped:false},{inMatch:true});}''')
        assert page.locator('#fps-weapon-sprite-layer.weapon-visible svg').count() == 1
        assert page.locator('#fps-weapon-sprite-layer text').text_content().find('VANDAL') != -1
        page.wait_for_timeout(160)
        assert page.evaluate("getComputedStyle(document.querySelector('#fps-weapon-sprite-layer')).opacity") == '1'
        page.evaluate('''() => {window.sprite.setWeapon('knife');window.sprite.update(.016,
            {alive:true,vel:{x:0,z:0},isScoped:false},{inMatch:true});}''')
        assert page.locator('#art-blade').count() == 1
        assert page.locator('#art-mag').count() == 0
        page.evaluate('''() => window.sprite.update(.016,
            {alive:true,vel:{x:0,z:0},isScoped:false},{inMatch:false})''')
        page.wait_for_timeout(180)
        assert page.evaluate("getComputedStyle(document.querySelector('#fps-weapon-sprite-layer')).opacity") == '0'
        page.close()
    browser.close()
    print('2D weapon visual smoke passed at desktop and mobile sizes')