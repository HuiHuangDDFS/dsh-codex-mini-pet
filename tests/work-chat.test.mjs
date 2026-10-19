import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAT_PANEL, DEEPSEEK_HOME, chatDestination, chatSession, normalizeChatRows, createWorkChatController, newSessionMode, modeSwitchPosition } from '../src/work-chat-model.mjs';
import { CHAT_NAVIGATION_SCRIPT, createDeepSeekGuest } from '../src/deepseek-guest.mjs';
import { COMPACT_CHROME_SCRIPT, SHARE_CONVERSATION_SCRIPT } from '../src/deepseek-page.mjs';
const shareIconFixtures = JSON.parse(readFileSync(new URL('./fixtures/deepseek-share-icons.json', import.meta.url), 'utf8')).icons;

test('mode chooser appears only on a ready new chat or a blank main work session',()=>{
  const work=(byId,phase='ready',activePanelId=null)=>newSessionMode({activePanelId,sessions:{phase,byId}});
  assert.equal(work({}),'work');
  assert.equal(work({},'pending'),null);
  assert.equal(work({draft:{blank:true,retainedBy:{mainView:1}}}),'work');
  assert.equal(work({old:{blank:false,retainedBy:{mainView:1}},draft:{blank:true,retainedBy:{mainView:0}}}),null);
  assert.equal(work({old:{retainedBy:{mainView:1}}}),null);
  assert.equal(work({},'ready','settings'),null);
  const chat=url=>newSessionMode({activePanelId:CHAT_PANEL,chat:{url,status:'ready',pendingUrl:null}});
  for(const url of [DEEPSEEK_HOME,'https://chat.deepseek.com/a/chat','https://chat.deepseek.com/a/chat/'])assert.equal(chat(url),'chat');
  for(const path of ['/a/chat/s/old','/sign_in','/share/id','/unknown'])assert.equal(chat('https://chat.deepseek.com'+path),null);
  assert.equal(chat('https://example.com/'),null);
  assert.equal(newSessionMode({activePanelId:CHAT_PANEL,chat:{url:DEEPSEEK_HOME,status:'loading'}}),null);
});

test('mode chooser stays hidden during route transitions and follows live website new-session navigation',()=>{
  const controller=createWorkChatController({selectPanel(){}});
  const mode=()=>newSessionMode({activePanelId:CHAT_PANEL,chat:controller.getSnapshot()});
  controller.open(DEEPSEEK_HOME);assert.equal(mode(),null);
  controller.observe({url:DEEPSEEK_HOME});assert.equal(mode(),'chat');
  controller.open('/a/chat/s/old');assert.equal(mode(),null);
  controller.observe({url:DEEPSEEK_HOME});assert.equal(mode(),null);
  controller.observe({url:'https://chat.deepseek.com/a/chat/s/old'});assert.equal(mode(),null);
  controller.observe({url:DEEPSEEK_HOME});assert.equal(mode(),'chat');
  controller.observe({url:'https://chat.deepseek.com/a/chat/s/old'});
  controller.open(DEEPSEEK_HOME);assert.equal(mode(),null);
  controller.observe({url:'https://chat.deepseek.com/a/chat/s/old'});assert.equal(mode(),null);
  controller.observe({url:DEEPSEEK_HOME});assert.equal(mode(),'chat');
  controller.open('/a/chat/s/old');controller.observe({url:'https://chat.deepseek.com/sign_in'});
  assert.equal(mode(),null);assert.equal(controller.getSnapshot().pendingUrl,null);
});

test('shared mode chooser positioning remains centered in the panel after sidebar resizing',()=>{
  for(const rect of [{x:240,y:40,width:1080,height:800},{x:0,y:40,width:1320,height:800},{x:180,y:70,width:520,height:600}]){
    const position=modeSwitchPosition(rect);
    assert.equal(position.left-rect.x,rect.width/2);
    assert.equal(position.top-rect.y,18);
    assert.equal(position.maxWidth,rect.width-32);
  }
  for(const rect of [null,{x:0,y:0,width:0,height:800},{x:0,y:NaN,width:800,height:600}])assert.equal(modeSwitchPosition(rect),null);
});

test('chat navigation admits only the official HTTPS origin and history admits only conversation routes', () => {
  for (const url of [null, undefined, '', 'https://evil.example/a/chat/s/123', '//evil.example/', 'javascript:alert(1)', 'http://chat.deepseek.com/', 'https://user:password@chat.deepseek.com/']) assert.equal(chatDestination(url), null);
  assert.equal(chatDestination('/a/chat/s/123#fragment'), 'https://chat.deepseek.com/a/chat/s/123');
  assert.equal(chatSession('/sign_in'), null);
  assert.equal(chatSession('/a/chat/s/123?auth=not-stored').url, 'https://chat.deepseek.com/a/chat/s/123');
  assert.deepEqual(normalizeChatRows([{url:'/a/chat/s/1',title:'  我的\n聊天  '},{url:'/a/chat/s/1',title:'新标题'},{url:'/sign_in',title:'登录'},{url:'https://evil.example/a/chat/s/1',title:'bad'}]),[{id:'chat:1',url:'https://chat.deepseek.com/a/chat/s/1',title:'新标题'}]);
  assert.doesNotThrow(() => new Function(`return ${CHAT_NAVIGATION_SCRIPT}`));
  assert.doesNotMatch(CHAT_NAVIGATION_SCRIPT, /localStorage|sessionStorage|cookie|fetch\(|XMLHttpRequest|\.value/);
});
test('mode changes select real panels, never create a work session; logout clears mirrored labels', () => {
  const panels=[];const controller=createWorkChatController({selectPanel:id=>panels.push(id)});
  assert.equal(controller.getSnapshot().opened,false);
  controller.open();controller.work();
  assert.deepEqual(panels,[CHAT_PANEL,null]);
  controller.observe({url:'https://chat.deepseek.com/a/chat/s/one',title:'DeepSeek',rows:[{url:'/a/chat/s/one',title:'研究计划'}]});
  assert.equal(controller.getSnapshot().title,'研究计划');
  controller.observe({url:'https://chat.deepseek.com/sign_in',rows:[{url:'/a/chat/s/old',title:'old'}]});
  assert.deepEqual(controller.getSnapshot().rows,[]);
  assert.equal(controller.getSnapshot().status,'sign-in');
  assert.throws(()=>controller.open('https://evil.example/'));
});
function fixture(bridgeOverride={}) {
  const released=[], reports=[], reads=[], loads=[];
  let element;
  class Guest extends EventTarget {
    dataset={};attributes={};url='about:blank';
    setAttribute(k,v){this.attributes[k]=v;}
    getURL(){return this.url;}
    loadURL(url){loads.push(url);this.url=url;return Promise.resolve();}
    executeJavaScript(code){reads.push(code);return Promise.resolve({url:this.url,title:'DeepSeek',rows:[]});}
    remove(){this.removed=true;}
    reload(){this.reloaded=true;}
  }
  const bridge={acquire:async()=>({lease:'owned-lease',partition:'host-approved'}),release:async id=>released.push(id),onOpenRequested:()=>()=>{},...bridgeOverride};
  const guest=createDeepSeekGuest({bridge,host:{append:value=>{element=value;}},document:{createElement:()=>new Guest()},report:value=>reports.push(value),observe:()=>{}});
  return {guest,released,reports,reads,loads,get element(){return element;}};
}
test('embedded page uses the host-approved guest lease; metadata reads wait for the official origin',async()=>{
  const f=fixture();await f.guest.start();
  assert.equal(f.element.attributes.partition,'host-approved');
  assert.equal(f.element.attributes.src,'about:blank#owned-lease');
  assert.equal(f.element.attributes.nodeintegration,undefined);
  f.element.dispatchEvent(new Event('dom-ready'));await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.loads,[DEEPSEEK_HOME]);
  await f.guest.scan();assert.equal(f.reads.at(-1),CHAT_NAVIGATION_SCRIPT);
  const count=f.reads.length;f.element.url='https://evil.example/';await f.guest.scan();assert.equal(f.reads.length,count);
  await f.guest.dispose();assert.equal(f.element.removed,true);assert.deepEqual(f.released,['owned-lease']);
  await f.guest.dispose();assert.equal(f.released.length,1);
});
test('a lease acquired after disposal is released; a failed acquisition can be retried',async()=>{
  let resolveLease;const f=fixture({acquire:()=>new Promise(resolve=>{resolveLease=resolve;})});
  f.guest.start();const disposed=f.guest.dispose();resolveLease({lease:'late',partition:'approved'});await disposed;
  assert.deepEqual(f.released,['late']);assert.equal(f.element,undefined);
  let attempts=0;const retry=fixture({acquire:async()=>{if(attempts++===0)throw new Error('temporary');return{lease:'retry',partition:'approved'};}});
  await retry.guest.start();assert.equal(retry.reports.at(-1).status,'error');await retry.guest.start();assert.ok(retry.element);await retry.guest.dispose();
});


test('unchanged website navigation does not republish the sidebar on every poll',()=>{
  const controller=createWorkChatController({selectPanel(){}});
  let changes=0;controller.subscribe(()=>changes++);
  const snapshot={url:DEEPSEEK_HOME,title:'DeepSeek',rows:[{url:'/a/chat/s/id',title:'我的会话'}]};
  controller.observe(snapshot);const first=controller.getSnapshot();controller.observe(structuredClone(snapshot));
  assert.equal(controller.getSnapshot(),first);assert.equal(changes,1);
});

test('returning to Chat preserves in-flight website navigation instead of reloading stale metadata',()=>{
  const controller=createWorkChatController({selectPanel(){}});
  controller.open();
  controller.open('/a/chat/s/new');
  const request=controller.getSnapshot().request;
  // The guest may already be navigating while its last metadata still says home.
  assert.equal(controller.getSnapshot().url,DEEPSEEK_HOME);
  controller.work();controller.open();controller.open();
  assert.equal(controller.getSnapshot().request,request);
  assert.equal(controller.getSnapshot().request.url,'https://chat.deepseek.com/a/chat/s/new');
});

test('a destroyed guest cannot leak an unhandled scan rejection',async()=>{
  const f=fixture();await f.guest.start();
  f.element.dispatchEvent(new Event('dom-ready'));await new Promise(resolve=>setImmediate(resolve));
  f.element.getURL=()=>{throw new Error('destroyed');};
  await assert.doesNotReject(f.guest.scan());
  await f.guest.dispose();
});

function sharePageFixture(buttons = []) {
  const location = { origin:'https://chat.deepseek.com', pathname:'/a/chat/s/test' };
  const document = {
    getElementById: () => ({}),
    querySelectorAll: selector => {
      if (selector === 'button,[role="button"]' || selector === 'button,[role=button]') return buttons.filter(button => button.buttonRole);
      if (selector === '.ds-icon-button') return buttons.filter(button => button.iconControl);
      if (selector === 'button[data-dhp-site-share],[role="button"][data-dhp-site-share]') return buttons.filter(button => Object.hasOwn(button.dataset,'dhpSiteShare'));
      return [];
    },
  };
  return { location, document, buttons, run: script => new Function('document','location','innerWidth','innerHeight',`return ${script}`)(document,location,1200,800) };
}
function shareControl({label='Share',top=30,dialog=false,message=false,marked=false,icon=null,buttonRole=true,iconControl=false,ariaDisabled=false}={}) {
  let clicks=0;
  const svg = {
    getAttribute:name=>name==='viewBox'?(icon?.viewBox || '0 0 16 16'):null,
    querySelectorAll:selector=>selector==='path'?[{getAttribute:name=>name==='d'?(icon?.path || 'M1 1L15 15M15 1L1 15'):null}]:[],
  };
  return {
    buttonRole,iconControl,disabled:false, textContent:label, dataset:marked?{dhpSiteShare:''}:{}, parentElement:null,
    get clicks(){return clicks;},
    getAttribute:name=>name==='aria-label'?label:name==='aria-disabled'&&ariaDisabled?'true':null,
    closest:selector=>(dialog&&selector.includes('[role="dialog"]'))||(message&&selector.includes('article'))?{}:null,
    getBoundingClientRect(){return Object.hasOwn(this.dataset,'dhpSiteShare')?{width:0,height:0,left:0,top:0,right:0}:{width:30,height:30,left:1140,top,right:1170};},
    querySelector:selector=>selector==='svg'?svg:null, click:()=>clicks++,
  };
}

test('chat chrome scripts are self-contained and the official header share action is callable',()=>{
  assert.doesNotThrow(() => new Function(`return ${COMPACT_CHROME_SCRIPT}`));
  assert.doesNotThrow(() => new Function(`return ${SHARE_CONVERSATION_SCRIPT}`));
  assert.match(COMPACT_CHROME_SCRIPT,/data-dhp-session-heading/);
  assert.match(COMPACT_CHROME_SCRIPT,/data-dhp-site-share/);
  const button=shareControl(), page=sharePageFixture([button]);
  assert.deepEqual(page.run(SHARE_CONVERSATION_SCRIPT),{ok:true});assert.equal(button.clicks,1);
  page.location.origin='https://example.com';
  assert.equal(page.run(SHARE_CONVERSATION_SCRIPT).ok,false);assert.equal(button.clicks,1);
});

test('repeated chrome scans keep the hidden header share entry and leave the share dialog untouched',()=>{
  const button=shareControl(), page=sharePageFixture([button]);
  assert.equal(page.run(COMPACT_CHROME_SCRIPT),true);
  assert.equal(Object.hasOwn(button.dataset,'dhpSiteShare'),true);
  assert.equal(button.getBoundingClientRect().width,0);
  // Place the dialog action in the same top-right area: semantics must exclude it even if its geometry matches.
  const modalShare=shareControl({dialog:true});page.buttons.unshift(modalShare);
  assert.equal(page.run(COMPACT_CHROME_SCRIPT),true);
  assert.equal(page.run(COMPACT_CHROME_SCRIPT),true);
  assert.equal(Object.hasOwn(modalShare.dataset,'dhpSiteShare'),false);
  assert.deepEqual(page.run(SHARE_CONVERSATION_SCRIPT),{ok:true});
  assert.equal(button.clicks,1);assert.equal(modalShare.clicks,0);
  button.disabled=true;
  assert.equal(page.run(SHARE_CONVERSATION_SCRIPT).ok,false);assert.equal(button.clicks,1);
});

test('repeated chrome scans hide only the header title when a message has the same text',()=>{
  const button=shareControl(), page=sharePageFixture([button]);
  const header={dataset:{},parentElement:null,getBoundingClientRect:()=>({left:0,top:0,width:1200,height:64})};
  button.parentElement=header;
  const title={
    dataset:{},textContent:'A shared title',tagName:'H1',getAttribute:()=>null,
    closest:selector=>selector.startsWith('header,')?header:null,
    getBoundingClientRect(){return Object.hasOwn(this.dataset,'dhpSessionHeading')?{width:0,height:0,left:0,top:0}:{left:500,top:25,width:180,height:24};},
  };
  const message={
    dataset:{},textContent:title.textContent,tagName:'P',getAttribute:()=>null,
    closest:selector=>selector.includes('article')?{}:null,
    getBoundingClientRect:()=>({left:500,top:30,width:180,height:24}),
  };
  const anchor={href:'https://chat.deepseek.com/a/chat/s/test',getAttribute:()=>title.textContent};
  const query=page.document.querySelectorAll;
  page.document.querySelectorAll=selector=>selector==='a[href]'?[anchor]:
    selector==='[data-dhp-session-heading]'?[title,message].filter(node=>Object.hasOwn(node.dataset,'dhpSessionHeading')):
    selector==='h1,h2,h3,[role="heading"],div,span,p'?[title,message]:query(selector);
  assert.equal(page.run(COMPACT_CHROME_SCRIPT),true);
  assert.equal(Object.hasOwn(header.dataset,'dhpSessionHeader'),true);
  assert.equal(title.dataset.dhpSessionHeading,page.location.pathname);
  assert.equal(title.getBoundingClientRect().width,0);
  assert.equal(page.run(COMPACT_CHROME_SCRIPT),true);
  assert.equal(page.run(COMPACT_CHROME_SCRIPT),true);
  assert.equal(Object.hasOwn(message.dataset,'dhpSessionHeading'),false);
});

test('missing share entry fails without clicking an unrelated icon, dialog action, or message action',()=>{
  const close=shareControl({label:'Close'}), modalShare=shareControl({dialog:true}), messageShare=shareControl({top:250});
  const page=sharePageFixture([close,modalShare,messageShare]);
  const result=page.run(SHARE_CONVERSATION_SCRIPT);
  assert.equal(result.ok,false);assert.match(result.error,/暂时找不到官网分享按钮/);
  assert.equal(page.run(COMPACT_CHROME_SCRIPT),true);
  for(const control of page.buttons){assert.equal(control.clicks,0);assert.equal(Object.hasOwn(control.dataset,'dhpSiteShare'),false);}
  const home=sharePageFixture([shareControl()]);home.location.pathname='/';
  assert.equal(home.run(SHARE_CONVERSATION_SCRIPT).ok,false);assert.equal(home.buttons[0].clicks,0);
});

test('unlabeled official desktop and mobile share SVGs survive repeated scans without a button role',()=>{
  for (const icon of shareIconFixtures) {
    const share=shareControl({label:'',icon,buttonRole:false,iconControl:true});
    const close=shareControl({label:'Close',icon}), unknown=shareControl({label:''});
    const page=sharePageFixture([close,unknown,share]);
    assert.equal(page.run(COMPACT_CHROME_SCRIPT),true);
    assert.equal(page.run(COMPACT_CHROME_SCRIPT),true);
    assert.equal(Object.hasOwn(share.dataset,'dhpSiteShare'),true);
    assert.equal(Object.hasOwn(close.dataset,'dhpSiteShare'),false);
    assert.equal(Object.hasOwn(unknown.dataset,'dhpSiteShare'),false);
    assert.deepEqual(page.run(SHARE_CONVERSATION_SCRIPT),{ok:true});
    assert.equal(share.clicks,1);assert.equal(close.clicks,0);assert.equal(unknown.clicks,0);
  }
  const labeled=shareControl({label:'分享',buttonRole:false,iconControl:true});
  assert.deepEqual(sharePageFixture([labeled]).run(SHARE_CONVERSATION_SCRIPT),{ok:true});
  assert.equal(labeled.clicks,1);
});

test('unknown SVGs and conflicting labels cannot become share actions even with stale markers',()=>{
  for (const control of [shareControl({label:''}),shareControl({label:'Close',icon:shareIconFixtures[0]}),shareControl({label:'',marked:true}),shareControl({label:'Close',marked:true})]) {
    const page=sharePageFixture([control]);
    assert.equal(page.run(SHARE_CONVERSATION_SCRIPT).ok,false);
    page.run(COMPACT_CHROME_SCRIPT);
    assert.equal(control.clicks,0);
    assert.equal(Object.hasOwn(control.dataset,'dhpSiteShare'),false);
    assert.equal(page.run(SHARE_CONVERSATION_SCRIPT).ok,false);
  }
});

test('share icons in dialogs or messages are excluded even at the top of the viewport',()=>{
  for (const options of [{dialog:true},{message:true}]) {
    for (const label of ['','Share']) {
      const control=shareControl({...options,label,icon:shareIconFixtures[0]});
      const page=sharePageFixture([control]);
      assert.equal(page.run(SHARE_CONVERSATION_SCRIPT).ok,false);
      page.run(COMPACT_CHROME_SCRIPT);
      assert.equal(Object.hasOwn(control.dataset,'dhpSiteShare'),false);
      assert.equal(control.clicks,0);
    }
  }
});

test('multiple unlabeled share-shaped controls remain ambiguous instead of selecting the rightmost icon',()=>{
  const controls=shareIconFixtures.map(icon=>shareControl({label:'',icon}));
  const page=sharePageFixture(controls);
  assert.equal(page.run(SHARE_CONVERSATION_SCRIPT).ok,false);
  page.run(COMPACT_CHROME_SCRIPT);
  for (const control of controls) {
    assert.equal(Object.hasOwn(control.dataset,'dhpSiteShare'),false);
    assert.equal(control.clicks,0);
  }
});

test('an aria-disabled roleless share control cannot be activated',()=>{
  const control=shareControl({label:'',icon:shareIconFixtures[0],buttonRole:false,iconControl:true,ariaDisabled:true});
  const page=sharePageFixture([control]);
  page.run(COMPACT_CHROME_SCRIPT);
  assert.equal(page.run(SHARE_CONVERSATION_SCRIPT).ok,false);
  assert.equal(control.clicks,0);
});

test('guest share action invokes the official website control only after it is ready',async()=>{
  const f=fixture();await f.guest.start();
  await assert.rejects(f.guest.share(),/等待 DeepSeek 网页加载完成/);
  f.element.dispatchEvent(new Event('dom-ready'));await new Promise(resolve=>setImmediate(resolve));
  const execute=f.element.executeJavaScript.bind(f.element);let invoked=false;
  f.element.executeJavaScript=code=>code===SHARE_CONVERSATION_SCRIPT?(invoked=true,Promise.resolve({ok:true})):execute(code);
  assert.deepEqual(await f.guest.share(),{ok:true});assert.equal(invoked,true);
  await f.guest.dispose();
});

test('route transitions keep sidebar rows until navigation is ready, including confirmed empty history',()=>{
  const controller=createWorkChatController({selectPanel(){}});
  controller.observe({url:DEEPSEEK_HOME,rows:[{url:'/a/chat/s/one',title:'Keep me'}]});
  const rows=controller.getSnapshot().rows;
  controller.observe({url:'https://chat.deepseek.com/a/chat/s/one',rows:[],navigationReady:false});
  assert.equal(controller.getSnapshot().rows,rows);
  controller.observe({url:DEEPSEEK_HOME,rows:[],navigationReady:true});
  assert.deepEqual(controller.getSnapshot().rows,[]);
});

test('existing conversations use the official link handler without reloading the guest',async()=>{
  const {conversationNavigationScript}=await import('../src/deepseek-page.mjs');
  const actions=[];
  const script=conversationNavigationScript('/a/chat/s/other');
  const link={href:'https://chat.deepseek.com/a/chat/s/other',click:()=>actions.push('official-router')};
  assert.equal(new Function('document','location',`return ${script}`)({querySelectorAll:()=>[link]},{origin:'https://chat.deepseek.com'}),true);
  assert.deepEqual(actions,['official-router']);
  const f=fixture();await f.guest.start();f.element.dispatchEvent(new Event('dom-ready'));await new Promise(resolve=>setImmediate(resolve));
  const execute=f.element.executeJavaScript.bind(f.element);
  f.element.executeJavaScript=code=>code===script?Promise.resolve(true):execute(code);
  f.guest.navigate('/a/chat/s/other');await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.loads,[DEEPSEEK_HOME]);
  assert.equal(conversationNavigationScript('https://evil.example/a/chat/s/other'),null);
  await f.guest.dispose();
});

test('rapid conversation selections cannot let an older fallback override the latest route',async()=>{
  const {conversationNavigationScript}=await import('../src/deepseek-page.mjs');
  const f=fixture();await f.guest.start();f.element.dispatchEvent(new Event('dom-ready'));await new Promise(resolve=>setImmediate(resolve));
  let resolveOlder;
  const older=conversationNavigationScript('/a/chat/s/older'), newer=conversationNavigationScript('/a/chat/s/newer');
  const execute=f.element.executeJavaScript.bind(f.element);
  f.element.executeJavaScript=code=>code===older?new Promise(resolve=>{resolveOlder=resolve;}):code===newer?Promise.resolve(true):execute(code);
  f.guest.navigate('/a/chat/s/older');f.guest.navigate('/a/chat/s/newer');
  await new Promise(resolve=>setImmediate(resolve));resolveOlder(false);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.loads,[DEEPSEEK_HOME]);
  await f.guest.dispose();
});

test('website delete integration opens its own confirmation and never confirms deletion',async()=>{
  const {managementScript}=await import('../src/deepseek-page.mjs');
  const actions=[];let open=false;
  const anchor={href:'https://chat.deepseek.com/a/chat/s/test',querySelector:()=>({click:()=>actions.push('open-menu')})};
  const option={querySelector:()=>({textContent:'删除'}),click:()=>{actions.push('choose-delete');open=true;}};
  const confirmation={click:()=>actions.push('confirm-delete')};
  const document={querySelector:()=>open?confirmation:null,querySelectorAll:selector=>selector==='a[href]'?[anchor]:selector==='input'?[]:[option]};
  const script=managementScript({url:anchor.href},'delete');
  const result=await new Function('document','location',`return ${script}`)(document,{origin:'https://chat.deepseek.com'});
  assert.deepEqual(result,{ok:true,confirmationRequired:true});assert.deepEqual(actions,['open-menu','choose-delete']);
  assert.doesNotMatch(script,/localStorage|sessionStorage|cookie|fetch\(|XMLHttpRequest/);
  assert.throws(()=>managementScript({url:'https://evil.example/a/chat/s/a'},'delete'));
  assert.throws(()=>managementScript({url:anchor.href},'delete-all'));
  assert.throws(()=>managementScript({url:anchor.href},'rename','  '));
});

test('rename uses the website input handler and confirms its updated navigation title',async()=>{
  const {managementScript}=await import('../src/deepseek-page.mjs');
  let renaming=false;const actions=[];
  const anchor={href:'https://chat.deepseek.com/a/chat/s/test',textContent:'Old',getAttribute:()=>null,querySelector:()=>({click:()=>actions.push('menu')})};
  class Input {maxLength=1024;get value(){return this.text;}set value(value){this.text=value;}dispatchEvent(event){if(event.key==='Enter'){anchor.textContent=this.value;renaming=false;}}}
  class Key extends Event {constructor(type,options){super(type,options);this.key=options.key;}}
  const input=new Input();const option={querySelector:()=>({textContent:'Rename'}),click:()=>{renaming=true;actions.push('rename');}};
  const document={querySelector:()=>null,querySelectorAll:selector=>selector==='a[href]'?[anchor]:selector==='input'?(renaming?[input]:[]):[option]};
  const script=managementScript({url:anchor.href},'rename','New title');
  const result=await new Function('document','location','HTMLInputElement','KeyboardEvent',`return ${script}`)(document,{origin:'https://chat.deepseek.com'},Input,Key);
  assert.deepEqual(result,{ok:true,renamed:true});assert.equal(anchor.textContent,'New title');assert.deepEqual(actions,['menu','rename']);
});
