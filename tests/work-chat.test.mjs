import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_PANEL, DEEPSEEK_HOME, chatDestination, chatSession, normalizeChatRows, createWorkChatController } from '../src/work-chat-model.mjs';
import { CHAT_NAVIGATION_SCRIPT, createDeepSeekGuest } from '../src/deepseek-guest.mjs';

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
