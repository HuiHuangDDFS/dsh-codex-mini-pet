# 使用说明

插件提供 DeepSeek Harness 工具和独立命令行 `dsh-codex-mini-pet`。

## 构建与安装

需要 Node.js 22.19 或更新版本。在仓库目录中运行：

```sh
npm ci
npm run build
npm test
npm pack
```

也可从 [最新 Release](https://github.com/HuiHuangDDFS/dsh-codex-mini-pet/releases/latest) 下载已构建的安装包。桌面版在“设置 → 插件管理器”中安装本地 `dsh-codex-mini-pet-2.0.2.tgz`。宿主的 `plugin_manager` / `install_bundle` 也是官方插件管理入口。新安装的 bundle 默认启用；已存在但被禁用的同名 bundle 需要在管理器中启用。

普通 Web profile 可使用 `dsh plugin --profile <实际profile名称> add <本地tgz>`。桌面 profile 需先用桌面应用初始化并完全退出，再用安装包自带的 `resources/runtime/cli/bin/dsh.cmd plugin --profile desktop add <本地tgz>` 安装；普通开源 CLI 不具有桌面配置管理权限。也可使用应用内插件管理器。使用打包后的 tgz；Windows 宿主包管理器在将源码目录链接替换为安装包时可能影响链接目标，不要把源码目录作为宿主的链接依赖。

插件包通过 `dsh.bundle.patch` 声明宿主组件，并立即加载客户端 overlay；单独安装 npm 依赖不代表宿主已经激活插件。无需编辑宿主 `app.asar` 或替换安装文件。实机状态见 [功能对齐说明](feature-parity.md)。0.2.0 曾因桌面快捷键冲突导致启动失败，桌面用户应使用 0.2.1 或更新版本。

## 命令行与本地宠物包

在源码仓库中，可直接运行：

```sh
node src/cli.mjs list
node src/cli.mjs preview
```

安装后的命令名为 `dsh-codex-mini-pet`。完整命令、偏好参数、默认数据目录和 `pet.json` 包格式集中在 [命令参考](../skills/dsh-codex-mini-pet/references/commands.md)；图集要求见 [格式说明](../skills/dsh-codex-mini-pet/references/atlas.md)。所有普通命令默认返回 JSON，`preview` 会持续运行本地服务。

可使用 `--data-dir <目录>` 隔离试验宠物库。导入会产生新 ID；修改名称不会更改 ID。导出为 ZIP 且不覆盖已有文件，适合本地备份和迁移。

## 聊天 / 工作双模式

2.0 在主界面顶部提供「聊天 / 工作」切换。「工作」保留 Harness 原生工作区、会话、模型和上下文；「聊天」在桌面宿主的内嵌浏览器中显示 `https://chat.deepseek.com/`。首次使用需要手动登录官网，当前不自动复用 Harness 的账号凭据；完整退出应用后可能需要重新登录。

网页聊天列表位于工作区下方，提供新聊天、标题搜索、同步、重命名和删除入口。删除由官网显示确认弹窗。标题行固定在滚动区域之外，点击标题可收起 / 展开；“…”再次点击可关闭菜单。搜索范围为官网当前已加载的导航标题。

切换聊天 / 工作保留网页和未发送草稿；已加载会话通过官网原有路由切换，切换期间保留左侧列表与区域高度。官网结构变化后，历史管理适配可能需要更新。

伙伴旁的「聊一聊」继续向 Harness 工作会话发送消息，与官网聊天列表分别管理。官网聊天能力已在 Windows 桌面宿主验证；普通 Web profile 不具备桌面内嵌浏览器桥接能力。

## 模型工具

宿主公开 `pet_list`、`pet_select`、`pet_update`、`pet_replace`、`pet_delete`、`pet_import`、`pet_export`、`pet_validate`、`pet_set_preferences`、`pet_reset_preferences`。调用参数以运行中的工具定义为准。示例请求：“列出宠物并选择智域”“把宠物缩小一点”“隐藏宠物”“导出当前宠物到指定 ZIP 文件”。

宿主命令为 `/pet`，可使用 `show`、`hide`、`mini`、`list`、`select <id>`、`reset [size|position|all]`；不带参数时切换显示状态。

## 原生设置与日常操作

桌面版打开左下角“更多 → 设置”（也可按 Ctrl+,），Web 版直接打开“设置”，再选左栏“codex-mini-pet”。在此选择形象、导入/导出、替换自定义图集、改名与描述、查看动作和调整偏好。界面没有独立的右下角“伙伴”管理按钮。创建和旧版升级按钮会在当前工作区准备一条主会话草稿，由你发送；需要安装配套 skill。

宠物旁“聊一聊”可在指定工作区新建会话，或向未归档会话发送完整文字。普通发送在后台完成；“在主会话编辑”会唤起 Harness 并转入原生输入栏，再添加文件、`@`、技能或其他上下文。主输入栏已有内容会保留。

“动态”显示多个会话的运行、等待回应、错误和未读完成状态，可打开、回复、停止、收起单条提醒或静音某个会话。需要审批或回答时，“前往处理”打开对应原生会话。静音按浏览器来源保存在本机，可用“恢复提醒”清除。

精简模式仅保留聊天与动态；隐藏会收起整个伙伴。按需显示在点击外部区域时收起。Ctrl+Alt+Shift+P 在 Harness 窗口内唤出并聚焦快速聊天；快捷键可由宿主快捷键设置管理。Windows 桌面置顶模式另提供固定的全局 Ctrl+Alt+Shift+P，热键被其他程序占用时可点击伙伴操作栏。Windows 桌面版默认独立置顶，主窗口最小化后仍可见；右键可打开设置、隐藏伙伴或切回应用内。完全退出 Harness 时关闭伙伴窗口。应用内拖动移动形象，也可方向键微调，Shift 加速，Enter 保存，Esc 还原。

“设置 → codex-mini-pet → 外观与行为”的“桌面置顶”开关控制 `surface: desktop | app`；CLI 可使用 `preferences --surface desktop` 或 `preferences --surface app`。Web 和非 Windows 平台保留应用内显示。桌面窗口启动失败时自动保留应用内伙伴。

## skill

仓库的 `skills/dsh-codex-mini-pet` 是可独立安装的技能目录。项目范围安装时，将它复制到目标项目的 `.dsh/skills/dsh-codex-mini-pet` 或 `.agents/skills/dsh-codex-mini-pet`。本机适配版本以当前目录最近的 Git 项目根为搜索根，没有 Git 时使用当前目录；不会逐层扫描每个父目录。

用户范围可放入 `$DSH_HOME/skills/dsh-codex-mini-pet`，默认是 `~/.dsh/skills/dsh-codex-mini-pet`；另一个用户搜索根为 `$DSH_AGENTS_HOME/skills`，默认 `~/.agents/skills`。以宿主的技能发现结果确认已加载。

该 skill 优先使用宿主工具，缺少工具时可使用已安装的同名命令行。它不要求 ChatGPT Library、Pets MCP 或云端上传会话。

鼠标靠近伙伴时操作栏渐显，离开后延迟收起；精简模式始终保留入口。再次点击“聊一聊”或“动态”可收起面板。桌面拖动按移动方向播放左右跑动，打开的面板及完成气泡同步重新定位；松开后恢复任务状态，减少动态效果时保留静态姿态。


## 界面语言

进入「设置 → codex-mini-pet → 外观与行为 → 语言」，选择简体中文（默认）或 English。切换立即生效并保存在本机，桌面聊天草稿和当前会话保持不变。

设置首页按「Mini 与虚拟宠物」组织：顶部预览与显示开关，下方卡片切换伙伴；选择「无」进入精简模式。「管理当前伙伴」中可导出及维护自定义形象。

仓库名称为 `dsh-codex-mini-pet`，Harness 展示名称为 `codex-mini-pet`。安装包与技能统一使用新名称；本地数据目录继续沿用旧版，无需重新导入宠物。

精简模式下，按住操作栏最左侧的「⠿」手柄拖动；聊天和动态按钮仍用于打开、收起面板。应用内也可聚焦手柄后按方向键移动，Shift 加快。
