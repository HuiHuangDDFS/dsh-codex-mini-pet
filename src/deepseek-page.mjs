import { chatSession } from './work-chat-model.mjs';

/** Identify the conversation header's official action, never a dialog action or an arbitrary icon. */
function findConversationShareControl() {
  if (!/^\/a\/[a-zA-Z0-9_-]+\/s\/[a-zA-Z0-9_-]+\/?$/.test(location.pathname)) return null;
  const excluded = '[role="dialog"],[aria-modal="true"],dialog,[role="menu"],[data-dhp-site-sidebar],aside,nav,.ds-modal-wrapper,.ds-modal';
  const candidates = [...new Set([
    ...document.querySelectorAll('button,[role="button"]'),
    // DeepSeek's icon controls may be clickable .ds-icon-button divs with no button role.
    ...document.querySelectorAll('.ds-icon-button'),
  ])];
  const marked = candidates
    .find(element => Object.hasOwn(element.dataset,'dhpSiteShare') && !element.closest(excluded));
  // The stylesheet hides a known header action; retain it across repeated scans and use its original click handler.
  if (marked) return marked;
  const pattern = /\bshare\b|分享/i;
  const controls = candidates.filter(element => {
    if (element.closest(excluded)) return false;
    const label = [...['aria-label','title','data-tooltip-content','data-testid'].map(name => element.getAttribute(name) || ''),element.textContent || ''].join(' ');
    const box = element.getBoundingClientRect();
    return pattern.test(label) && box.width > 0 && box.height > 0 && box.height <= 65 && box.top >= 0 && box.top < 100 && box.right >= innerWidth * .8;
  });
  if (controls.length) return controls[0];
  // DeepSeek can render the official share icon without an accessible label. On a conversation route,
  // the unlabeled icon is the small, rightmost SVG control in the page's top bar.
  return candidates
    .filter(element => {
      if (element.closest(excluded) || !element.querySelector('svg')) return false;
      const box = element.getBoundingClientRect();
      return box.width >= 20 && box.width <= 64 && box.height >= 20 && box.height <= 64 && box.top >= 0 && box.top < 85 && box.right >= innerWidth * .92;
    })
    .sort((a,b) => b.getBoundingClientRect().right-a.getBoundingClientRect().right)[0] || null;
}

/** Presentation-only integration: remove duplicate website navigation, keep its DOM for official actions. */
export function compactDeepSeekChrome(findShareControl = findConversationShareControl) {
  if (location.origin !== 'https://chat.deepseek.com' || /^\/(sign_in|sign_up|forgot_password|mobile_verification)/.test(location.pathname)) return false;
  const currentPath = location.pathname.replace(/\/$/, '');
  const currentConversation = [...document.querySelectorAll('a[href]')].find(a => {
    try { const url = new URL(a.href); return url.origin === location.origin && url.pathname.replace(/\/$/, '') === currentPath; }
    catch { return false; }
  });
  const currentTitle = (currentConversation?.getAttribute('title') || currentConversation?.textContent || '').replace(/\s+/g, ' ').trim();
  const shareButton = findShareControl();
  // Some website headers use plain divs. A short, wide row containing its known share action is also a header.
  for (let parent=shareButton?.parentElement, step=0;parent && step<8;step++,parent=parent.parentElement) {
    const box=parent.getBoundingClientRect();
    if (box.top >= 0 && box.top < 100 && box.height > 0 && box.height <= 100 && box.width >= innerWidth*.5) {
      parent.dataset.dhpSessionHeader=''; break;
    }
  }
  if (!document.getElementById('dhp-deepseek-chrome')) {
    const style = document.createElement('style'); style.id = 'dhp-deepseek-chrome';
    style.textContent = '[data-dhp-site-chrome], [data-dhp-site-sidebar], [data-dhp-session-heading], [data-dhp-site-share]{display:none!important}'; document.head.append(style);
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
  if (currentTitle) {
    const exclusions = 'a,button,[role="button"],[role="dialog"],[aria-modal="true"],dialog,[role="menu"],[data-dhp-site-sidebar],aside,nav,article,[role="article"],[data-message-id],[data-testid*="message"],.ds-modal-wrapper,.ds-modal';
    const inHeader = element => {
      if (element.closest(exclusions)) return false;
      if (element.closest('header,[role="banner"],[data-dhp-session-header]')) return true;
      // The website's conversation title is sometimes rendered in a plain content row with no header role.
      const box = element.getBoundingClientRect();
      return box.top >= 0 && box.top < 85 && box.height > 0 && box.height <= 55;
    };
    // Reuse the hidden title: its zero-sized box must not make the next poll search for another matching text node.
    const markedHeading = [...document.querySelectorAll('[data-dhp-session-heading]')].find(element =>
      inHeader(element) && (element.dataset.dhpSessionHeading === currentPath || element.textContent.replace(/\s+/g,' ').trim() === currentTitle));
    const heading = markedHeading || [...document.querySelectorAll('h1,h2,h3,[role="heading"],div,span,p')]
      .filter(element => {
        if (!inHeader(element)) return false;
        if (element.textContent.replace(/\s+/g, ' ').trim() !== currentTitle) return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.height <= 65 && box.top >= 0 && box.top < 100;
      })
      .sort((a,b) => {
        const semantic = element => /^(H1|H2|H3)$/.test(element.tagName) || element.getAttribute('role') === 'heading';
        if (semantic(a) !== semantic(b)) return semantic(a) ? -1 : 1;
        const aa=a.getBoundingClientRect(), bb=b.getBoundingClientRect(); return aa.width*aa.height-bb.width*bb.height;
      })[0];
    if (heading) heading.dataset.dhpSessionHeading=currentPath;
  }
  if (shareButton) shareButton.dataset.dhpSiteShare='';
  return true;
}
// Pass the serialized finder explicitly so each guest script is self-contained after bundling.
export const COMPACT_CHROME_SCRIPT = `(${compactDeepSeekChrome.toString()})(${findConversationShareControl.toString()})`;

/** Open the website's own share flow from the extension toolbar. */
export function shareConversationOnPage(findShareControl = findConversationShareControl) {
  if (location.origin !== 'https://chat.deepseek.com') return {ok:false,error:'请先打开 DeepSeek 官方聊天页面。'};
  const button = findShareControl();
  if (!button || button.disabled) return {ok:false,error:'暂时找不到官网分享按钮，请确认会话页面已加载。'};
  button.click();
  return {ok:true};
}
export const SHARE_CONVERSATION_SCRIPT = `(${shareConversationOnPage.toString()})(${findConversationShareControl.toString()})`;

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
