# dsh-hide-pet

为 DeepSeek Harness 提供可拖动的动画宠物，并重构配套 skill，让宠物管理直接使用本地插件和命令行。

本项目以已知的 Codex/ChatGPT 宠物交互和图集规范为对齐目标。原产品源码不可用，功能差异和验证边界记录在 [功能对齐说明](docs/feature-parity.md)，不将未观察到的内部行为视为已经复刻。

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

宠物在 DeepSeek Harness 的 `shell.overlay` 扩展位中显示。宠物库和显示偏好保存在用户数据目录，不需要修改宿主安装文件。

## 兼容范围

适配基线为本机安装的 DeepSeek Harness `0.2.0-rc.2`，对应提交 `04f392c9ddd144fa426da2045178797da6db6c11`。宿主 `master` 已存在不同版本；其他版本需要按实际扩展接口验证。完整的自动检查和实机检查状态见 [功能对齐说明](docs/feature-parity.md)。

仓库：[HuiHuangDDFS/dsh-hide-pet](https://github.com/HuiHuangDDFS/dsh-hide-pet)。
