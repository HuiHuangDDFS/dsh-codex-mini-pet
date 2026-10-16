import React from 'react';

let kit = {};
export function setNativeUi(value) { kit = value || {}; }

export function UiButton({ className = '', variant, ...props }) {
  const selected = variant || (className.split(' ').includes('primary') ? 'primary' : 'outline');
  if (kit.Button) return <kit.Button {...props} size="sm" variant={selected} className={className.includes('danger') ? 'dhp-action-danger' : undefined} />;
  return <button {...props} className={className || `dhp-button ${selected}`} />;
}
export function UiInput(props) { return kit.Input ? <kit.Input {...props} /> : <input {...props} />; }
export function UiSwitch(props) {
  if (kit.Switch) return <kit.Switch {...props} />;
  return <input type="checkbox" aria-label={props.label} checked={props.checked} disabled={props.disabled} onChange={event => props.onChange(event.target.checked)} />;
}
export function UiTabs({ value, onChange }) {
  const items = [{ value: 'library', label: '伙伴' }, { value: 'settings', label: '外观与行为' }, { value: 'motion', label: '动作' }, { value: 'import', label: '导入' }];
  if (kit.SegmentedTabs) return <kit.SegmentedTabs items={items} value={value} onChange={onChange} label="宠物伙伴设置" />;
  return <div role="tablist" aria-label="宠物伙伴设置">{items.map(item => <button key={item.value} role="tab" aria-selected={value === item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

export const settingsCss = `
.dhp-root.dhp-settings{position:relative;inset:auto;pointer-events:auto;width:100%;min-width:0;height:auto;font:inherit;color:var(--dsw-alias-label-primary);background:transparent}
.dhp-settings .dhp-panel{position:static;width:100%;max-width:760px;max-height:none;overflow:visible;border:0;border-radius:0;box-shadow:none;animation:none;background:transparent}
.dhp-settings .dhp-head{padding:0 0 20px;align-items:center;gap:16px}.dhp-settings .dhp-head h2{font-size:16px;font-weight:500;line-height:24px;letter-spacing:0;margin:0}.dhp-settings .dhp-head p{font-size:12px;line-height:18px;margin:5px 0 0;color:var(--dsw-alias-label-secondary)}
.dhp-settings .dhp-tabs{display:block;margin:0 0 20px;padding:0;background:none;border-radius:0}.dhp-settings .dhp-tabs>div{width:100%}.dhp-settings .dhp-tabs button{font-size:13px;line-height:20px;flex:initial;box-shadow:none}
.dhp-settings .dhp-body{padding:0 0 20px}.dhp-settings .dhp-grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.dhp-settings .dhp-card{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg,12px);padding:8px 12px 12px;background:transparent;box-shadow:none}.dhp-settings .dhp-card:hover{background:var(--dsw-alias-interactive-bg-hover)}.dhp-settings .dhp-card[aria-pressed=true]{border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);box-shadow:none}.dhp-settings .dhp-art-stage{height:106px;background:none}.dhp-settings .dhp-card-name{font-size:13px;font-weight:500;margin:3px 0}.dhp-settings .dhp-card-note{font-size:11px;line-height:16px}.dhp-settings .dhp-check{width:17px;height:17px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-size:10px;right:8px;top:8px}.dhp-settings .dhp-selected{margin-top:20px;padding-top:16px;border-color:var(--dsw-alias-border-l2)}.dhp-settings .dhp-detail-title{font-size:14px;font-weight:500}.dhp-settings .dhp-detail-note{font-size:12px;line-height:18px;margin:4px 0 14px}.dhp-settings .dhp-actions{gap:8px}.dhp-settings .dhp-footer{font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin-top:16px}.dhp-settings .dhp-status{font-size:11px;margin-top:12px}.dhp-settings .dhp-tag{background:var(--dsw-alias-interactive-bg-hover);font-size:10px}.dhp-settings .dhp-field{font-size:13px;gap:8px;margin:16px 0}.dhp-settings .dhp-field input[type=text]{font:inherit}.dhp-setting-row{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);font-size:14px;line-height:20px}.dhp-setting-row p{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin:4px 0 0}.dhp-setting-row [role=switch]{flex-shrink:0}.dhp-action-danger{color:var(--dsw-alias-state-error-primary)!important}.dhp-settings .dhp-upload{padding:20px 16px;background:transparent;border:.5px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg,12px)}.dhp-settings .dhp-preview{background:none}.dhp-settings .dhp-animation-grid button,.dhp-settings .dhp-direction-grid button{font-size:12px;border-radius:var(--dsw-radius-sm,8px);border:.5px solid var(--dsw-alias-border-l3);background:transparent}.dhp-settings .dhp-animation-grid button[aria-pressed=true],.dhp-settings .dhp-direction-grid button[aria-pressed=true]{color:var(--dsw-alias-label-primary);border-color:currentColor;background:var(--dsw-alias-interactive-bg-hover)}
`;
