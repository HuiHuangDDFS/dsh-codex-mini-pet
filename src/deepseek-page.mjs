import { chatSession } from './work-chat-model.mjs';

/** Identify the conversation header's official action, never a dialog action or an arbitrary icon. */
function findConversationShareControl() {
  if (!/^\/a\/[a-zA-Z0-9_-]+\/s\/[a-zA-Z0-9_-]+\/?$/.test(location.pathname)) return null;
  const excluded = '[role="dialog"],[aria-modal="true"],dialog,[role="menu"],[data-dhp-site-sidebar],aside,nav,article,[role="article"],[data-message-id],[data-testid*="message"],.ds-modal-wrapper,.ds-modal';
  const candidates = [...new Set([
    ...document.querySelectorAll('button,[role="button"]'),
    // DeepSeek's icon controls may be clickable .ds-icon-button divs with no button role.
    ...document.querySelectorAll('.ds-icon-button'),
  ])];
  const pattern = /\bshare\b|分享/i;
  const labelOf = element => [...['aria-label','title','data-tooltip-content','data-testid'].map(name => element.getAttribute(name) || ''),element.textContent || ''].join(' ').trim();
  // Observed desktop/mobile share arrows from DeepSeek's public web bundle. Unknown shapes fail closed.
  const shareIcons = [{"viewBox":"0 0 16 16","path":"M7.95889 1.52285C7.95888 0.826234 8.76055 0.467983 9.27669 0.875208L9.37524 0.967191L15.1317 7.18358C15.5582 7.64419 15.5582 8.35614 15.1317 8.81676L9.37524 15.0331C8.87034 15.578 7.95888 15.2205 7.95889 14.4775V10.8207C7.10614 10.8432 6.31361 10.9316 5.45468 11.2515C4.39484 11.6463 3.18248 12.413 1.64676 13.9425C1.4533 14.135 1.18329 14.1696 0.969086 14.0908C0.74748 14.0091 0.547307 13.7879 0.54859 13.4844L0.55516 13.1315C0.618924 11.3494 1.11153 9.29838 2.27656 7.63787C3.45289 5.96147 5.29554 4.71635 7.95889 4.54797V1.52285ZM9.20911 5.13366C9.20899 5.50567 8.9031 5.77687 8.56523 5.77755C5.99383 5.78282 4.33736 6.8762 3.29964 8.35496C2.54519 9.43014 2.10739 10.7283 1.9152 11.9939C3.04749 11.0323 4.0569 10.4385 5.01917 10.0801C6.29638 9.60449 7.4406 9.56343 8.56429 9.56295C8.9178 9.5628 9.20894 9.84909 9.20911 10.2068L9.20817 13.3737L14.1837 8.00017L9.20817 2.62571L9.20911 5.13366Z"},{"viewBox":"0 0 20 20","path":"M9.73047 1.98239C9.73046 1.21153 10.6128 0.810523 11.1895 1.25486L11.3008 1.35544L18.3906 8.83005C18.8698 9.33527 18.8696 10.1273 18.3906 10.6328L11.3008 18.1152C10.735 18.7123 9.73046 18.3118 9.73047 17.4892V12.9765C9.05058 12.9603 8.23982 12.9642 7.26075 13.206C5.95079 13.5297 4.32474 14.294 2.49512 16.1133C2.27349 16.3334 1.96525 16.3697 1.72364 16.2793C1.47489 16.1859 1.24879 15.9363 1.25 15.5937L1.25879 15.167C1.33996 13.0226 1.97201 10.7003 3.34278 8.85642C4.71905 7.00534 6.81702 5.67342 9.73047 5.48728V1.98239ZM11.1504 6.15427C11.1502 6.57441 10.8056 6.88304 10.4209 6.88376C7.60432 6.88909 5.7029 8.06242 4.48243 9.70407C3.57516 10.9245 3.03042 12.426 2.79981 13.9394C4.29988 12.7446 5.69229 12.1304 6.91993 11.8271C8.47348 11.4433 9.75076 11.5693 10.4229 11.5713C10.8512 11.5725 11.1504 11.926 11.1504 12.3017V16.209L17.2881 9.73142L11.1504 3.25974V6.15427Z"}];
  const knownShareIcon = element => {
    const svg = element.querySelector('svg');
    if (!svg) return false;
    const viewBox = (svg.getAttribute('viewBox') || '').trim().replace(/\s+/g,' ');
    const paths = [...svg.querySelectorAll('path')];
    if (paths.length !== 1) return false;
    const path = (paths[0].getAttribute('d') || '').replace(/\s+/g,'');
    return shareIcons.some(icon => icon.viewBox === viewBox && icon.path.replace(/\s+/g,'') === path);
  };
  const hasShareIdentity = element => {
    const label = labelOf(element);
    return pattern.test(label) || (!label && knownShareIcon(element));
  };
  for (const element of candidates) {
    if (Object.hasOwn(element.dataset,'dhpSiteShare') && (element.closest(excluded) || !hasShareIdentity(element))) delete element.dataset.dhpSiteShare;
  }
  const marked = candidates
    .find(element => Object.hasOwn(element.dataset,'dhpSiteShare') && !element.closest(excluded) && hasShareIdentity(element));
  // The stylesheet hides a known header action; retain it across repeated scans and use its original click handler.
  if (marked) return marked;
  const controls = candidates.filter(element => {
    if (element.closest(excluded)) return false;
    const label = labelOf(element);
    const box = element.getBoundingClientRect();
    return pattern.test(label) && box.width > 0 && box.height > 0 && box.height <= 65 && box.top >= 0 && box.top < 100 && box.right >= innerWidth * .8;
  });
  if (controls.length) return controls[0];
  // A top-right position alone cannot distinguish Share from Close, More, or other controls.
  const unlabeled = candidates
    .filter(element => {
      if (element.closest(excluded) || labelOf(element) || !knownShareIcon(element)) return false;
      const box = element.getBoundingClientRect();
      return box.width >= 20 && box.width <= 64 && box.height >= 20 && box.height <= 64 && box.top >= 0 && box.top < 85 && box.right >= innerWidth * .92;
    });
  return unlabeled.length === 1 ? unlabeled[0] : null;
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
  if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return {ok:false,error:'暂时找不到官网分享按钮，请确认会话页面已加载。'};
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
