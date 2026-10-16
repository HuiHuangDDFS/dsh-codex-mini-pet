# dsh-hide-pet

为 DeepSeek Harness 提供可拖动的动画宠物，并重构配套 skill，让宠物管理直接使用本地插件和命令行。

本项目根据官方文档及本机 Codex 已发布客户端的只读调查对齐宠物行为，调查清单见 [Codex Pets 调查](docs/codex-pets-audit.md)，实现与验证边界见 [功能对齐说明](docs/feature-parity.md)。

初始角色为 DeepSeek 鲸鱼娘 Q 版与智域。角色来源和图集状态见 [资源说明](docs/assets.md)。

## 使用

安装、命令行和本地宠物包格式见 [使用说明](docs/usage.md)。Node.js 22.19+ 环境可先运行：

当前稳定版为 **1.0.0**。Windows 桌面版提供常驻底栏与独立置顶宠物，修复操作栏无法点击、拖动动画丢失和原生按钮文字不可见。

```sh
npm ci
npm run build
npm test
node src/cli.mjs preview
```

仓库中的 [dsh-hide-pet skill](skills/dsh-hide-pet/SKILL.md) 负责宠物创建、导入、预览和日常管理，不依赖 ChatGPT 的云端宠物工具。

安装后在 **设置 → 宠物伙伴** 中管理形象。宠物旁提供快速聊天、多会话动态和精简模式，支持 Codex v1/v2 宠物包及保留 ID 的图集替换。Windows 桌面版默认使用独立透明置顶窗口，Harness 最小化后仍可见；Web 和其他系统使用 `shell.overlay`。设置通过原生 `settings.section` 接入，按钮、开关和分段选项使用 Harness 原生控件。宠物库和偏好保存在本地，不需要修改宿主安装文件。

Windows 桌面模式提供全局 Ctrl+Alt+Shift+P 快速聊天，可在“外观与行为”关闭桌面置顶，切回应用内显示。独立窗口使用 Windows 自带 WPF，不修改宿主安装文件，随 Harness 完全退出而关闭。实时双向语音与 Codex 云端宠物服务尚未实现。

## 兼容范围

适配基线为本机安装的 DeepSeek Harness `0.2.0-rc.2`，对应提交 `04f392c9ddd144fa426da2045178797da6db6c11`。宿主 `master` 已存在不同版本；其他版本需要按实际扩展接口验证。完整的自动检查和实机检查状态见 [功能对齐说明](docs/feature-parity.md)。

仓库：[HuiHuangDDFS/dsh-hide-pet](https://github.com/HuiHuangDDFS/dsh-hide-pet)。

Windows 上可运行 `npm run test:native` 验证真实鼠标跨区点击、按钮文字、双向跑动帧、动态跳转及窗口生命周期；该检查会短暂移动鼠标并显示测试宠物。
