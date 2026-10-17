import { chatSession } from './work-chat-model.mjs';

/** Presentation-only integration: remove duplicate website navigation, keep its DOM for official actions. */
export function compactDeepSeekChrome() {
  if (location.origin !== 'https://chat.deepseek.com' || /^\/(sign_in|sign_up|forgot_password|mobile_verification)/.test(location.pathname)) return false;
  if (!document.getElementById('dhp-deepseek-chrome')) {
    const style = document.createElement('style'); style.id = 'dhp-deepseek-chrome';
    style.textContent = '[data-dhp-site-chrome], [data-dhp-site-sidebar]{display:none!important}'; document.head.append(style);
  }
  const buttons = [...document.querySelectorAll('button,[role=button]')].filter(element => {
    const box = element.getBoundingClientRect(); return box.width > 0 && box.left < 260 && box.top >= 0 && box.top < 65 && box.height < 65;
  });
  for (const button of buttons) {
    let parent = button.parentElement;
    for (let step=0; parent && step<4; step++,parent=parent.parentElement) {
      const box=parent.getBoundingClientRect(), count=parent.querySelectorAll('button,[role=button]').length;
      if (box.width >= 80 && box.width <= 320 && box.height > 0 && box.height <= 65 && count >= 2 && count <= 4 && !parent.querySelector('input,textarea,[contenteditable=true]')) { parent.dataset.dhpSiteChrome=''; break; }
    }
  }
  for (const svg of document.querySelectorAll('svg')) {
    const box=svg.getBoundingClientRect();
    if (box.left >= 0 && box.left < 45 && box.top >= 0 && box.top < 65 && box.width >= 24 && box.width <= 60 && box.height >= 20 && box.height <= 60) {
      const link=svg.closest('a'); (link && link.getBoundingClientRect().width <= 90 ? link : svg).dataset.dhpSiteChrome='';
    }
  }
  const anchor=[...document.querySelectorAll('a[href]')].find(a=>/^\/a\/[^/]+\/s\/[^/]+\/?$/.test(new URL(a.href).pathname));
  let parent=anchor?.parentElement;
  for (let step=0;parent && step<12;step++,parent=parent.parentElement) {
    const box=parent.getBoundingClientRect();
    if (box.left >= 0 && box.left < 45 && box.width >= 180 && box.width <= 360 && box.height >= innerHeight*.55) {
      parent.dataset.dhpSiteSidebar=''; break;
    }
  }
  return true;
}
export const COMPACT_CHROME_SCRIPT = `(${compactDeepSeekChrome.toString()})()`;

/** Let the official router change conversations without reloading the guest document. */
export function conversationNavigationScript(value) {
  const session=chatSession(value);
  if (!session) return null;
  return `(() => { if (location.origin !== 'https://chat.deepseek.com') return false; const path=${JSON.stringify(new URL(session.url).pathname)}; const link=Array.from(document.querySelectorAll('a[href]')).find(a=>new URL(a.href).origin===location.origin && new URL(a.href).pathname.replace(/\\/$/,'')===path); if (!link) return false; link.click(); return true; })()`;
}

/** Uses the site's rendered controls and original confirmation, never its credentials or private API. */
async function manageOnPage(request) {
  if (location.origin !== 'https://chat.deepseek.com') return {ok:false,error:'请先打开 DeepSeek 官方聊天页面。'};
  const wait = async find => { const until=Date.now()+6000; do { const value=find(); if(value)return value; await new Promise(resolve=>setTimeout(resolve,60)); } while(Date.now()<until); return null; };
  if (document.querySelector('[role="dialog"],.ds-modal-wrapper')) return {ok:false,error:'请先完成或关闭网页中的对话框。'};
  const anchor=[...document.querySelectorAll('a[href]')].find(a=>new URL(a.href).origin===location.origin && new URL(a.href).pathname.replace(/\/$/,'')===request.path);
  if (!anchor) return {ok:false,error:'这条会话尚未在网页中加载，请先打开它后重试。'};
  const menuButton=anchor.querySelector('.ds-icon-button,button,[role=button]');
  if (!menuButton) return {ok:false,error:'网页的会话菜单暂不可用，请刷新后重试。'};
  const previousInputs=new Set(document.querySelectorAll('input'));
  menuButton.click();
  const labels=request.action==='rename' ? /^(重命名|Rename)$/i : /^(删除|删除会话|Delete|Delete chat)$/i;
  const option=await wait(()=>[...document.querySelectorAll('[role="menu"] .ds-dropdown-menu-option')].find(element=>labels.test((element.querySelector('.ds-dropdown-menu-option__label')?.textContent || '').trim())));
  if (!option) return {ok:false,error:'未找到官网的会话操作，请在网页中操作后重试。'};
  option.click();
  if (request.action==='delete') {
    const confirmation=await wait(()=>document.querySelector('[role="dialog"],.ds-modal-wrapper,.ds-modal'));
    return confirmation ? {ok:true,confirmationRequired:true} : {ok:false,error:'官网未显示删除确认，请在网页中确认状态。'};
  }
  const field=await wait(()=>[...document.querySelectorAll('input')].find(input=>!previousInputs.has(input) && input.maxLength===1024));
  if (!field) return {ok:false,error:'未找到官网的重命名输入框，请刷新后重试。'};
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
  if (!setter) return {ok:false,error:'网页输入框暂不可用。'};
  setter.call(field,request.title); field.dispatchEvent(new Event('input',{bubbles:true})); field.dispatchEvent(new Event('change',{bubbles:true}));
  field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
  const updated=await wait(()=>[...document.querySelectorAll('a[href]')].find(a=>new URL(a.href).origin===location.origin && new URL(a.href).pathname.replace(/\/$/,'')===request.path && (a.getAttribute('title') || a.textContent || '').trim()===request.title));
  return updated ? {ok:true,renamed:true} : {ok:false,error:'尚未确认重命名结果，请检查官网提示。'};
}
export function managementScript(row,action,title) {
  const session=chatSession(row?.url);
  if (!session || !['rename','delete'].includes(action)) throw new Error('会话操作无效。');
  if (action==='rename' && (typeof title!=='string' || !title.trim() || title.trim().length>160)) throw new Error('会话名称需要 1–160 个字。');
  return `(${manageOnPage.toString()})(${JSON.stringify({path:new URL(session.url).pathname,action,...action==='rename'?{title:title.trim()}:{}})})`;
}
