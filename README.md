# dsh-hide-pet

为 DeepSeek Harness 提供可拖动的动画宠物，并重构配套 skill，让宠物管理直接使用本地插件和命令行。

本项目根据官方文档及本机 Codex 已发布客户端的只读调查对齐宠物行为，调查清单见 [Codex Pets 调查](docs/codex-pets-audit.md)，实现与验证边界见 [功能对齐说明](docs/feature-parity.md)。

初始角色为 DeepSeek 鲸鱼娘 Q 版与智域。角色来源和图集状态见 [资源说明](docs/assets.md)。

## 使用

安装、命令行和本地宠物包格式见 [使用说明](docs/usage.md)。Node.js 22.19+ 环境可先运行：

```sh
npm ci
npm run build
npm test
node src/cli.mjs preview
```

仓库中的 [dsh-hide-pet skill](skills/dsh-hide-pet/SKILL.md) 负责宠物创建、导入、预览和日常管理，不依赖 ChatGPT 的云端宠物工具。

安装后在 **设置 → 宠物伙伴** 中管理形象。宠物旁提供快速聊天、多会话动态和精简模式，支持 Codex v1/v2 宠物包及保留 ID 的图集替换。宠物在 Harness 的 `shell.overlay` 中显示，设置通过原生 `settings.section` 接入。宠物库和偏好保存在本地，不需要修改宿主安装文件。

当前是应用内伙伴。系统置顶悬浮窗、系统全局热键、实时双向语音和 Codex 云端宠物服务需要额外宿主能力，尚未实现。

## 兼容范围

适配基线为本机安装的 DeepSeek Harness `0.2.0-rc.2`，对应提交 `04f392c9ddd144fa426da2045178797da6db6c11`。宿主 `master` 已存在不同版本；其他版本需要按实际扩展接口验证。完整的自动检查和实机检查状态见 [功能对齐说明](docs/feature-parity.md)。

仓库：[HuiHuangDDFS/dsh-hide-pet](https://github.com/HuiHuangDDFS/dsh-hide-pet)。
