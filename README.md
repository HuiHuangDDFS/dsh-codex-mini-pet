<div align="center">

<img src="assets/pets/deepseek/preview.png" alt="deepseek 默认伙伴" width="120">
<img src="assets/pets/whale-girl/preview.png" alt="深蓝鲸娘" width="120">
<img src="assets/pets/zhiyu/preview.png" alt="智域" width="120">

# dsh-codex-mini-pet

**把 Codex 中熟悉、连贯的工作习惯带到 DeepSeek Harness。**

[![版本](https://img.shields.io/github/v/tag/HuiHuangDDFS/dsh-codex-mini-pet?label=version&style=flat-square)](https://github.com/HuiHuangDDFS/dsh-codex-mini-pet/tags)
[![下载](https://img.shields.io/github/downloads/HuiHuangDDFS/dsh-codex-mini-pet/total?label=downloads&style=flat-square)](https://github.com/HuiHuangDDFS/dsh-codex-mini-pet/releases/latest)
[![代码许可](https://img.shields.io/badge/code-MIT-263146?style=flat-square)](LICENSE)
[![验证](https://github.com/HuiHuangDDFS/dsh-codex-mini-pet/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/HuiHuangDDFS/dsh-codex-mini-pet/actions/workflows/verify.yml)
![适配版本](https://img.shields.io/badge/dsh-0.2.1--rc.2-2f6f4f?style=flat-square)
![桌面置顶](https://img.shields.io/badge/desktop-Windows-4b6fff?style=flat-square)

> **v2.0.5：聊天、项目工作与桌面伙伴，在一个 Harness 里自然衔接。**
>
> 聊天连接 DeepSeek 官方网页，工作继续使用 Harness 原生的工作区、会话、模型与工具。
> 本版修复分享入口误识别：无标签按钮校验官网分享图形，找不到时停止操作；保留高清默认伙伴 `deepseek`、桌面快捷聊天、任务动态与完成提醒。

*Bring familiar Codex workflows to DeepSeek Harness — with chat, project work, and animated companions.*

[下载最新版](https://github.com/HuiHuangDDFS/dsh-codex-mini-pet/releases/latest) · [功能亮点](#亮点) · [界面预览](#你会看到什么) · [安装](#安装) · [使用说明](#使用说明) · [常见问题](#常见问题)

</div>

---

## 亮点

- **想聊就聊，做事就切到工作**——顶部切换聊天 / 工作，聊天内嵌 DeepSeek 官网，工作使用 Harness 原生项目、模型和工具。切换模式保留当前聊天网页及未发送的草稿。
- **聊天历史就在工作区下方**——统一入口新建、搜索标题、重命名和删除聊天。标题与操作行固定在列表顶部，可展开 / 收起；“…”再次点击即可关闭。
- **切换更稳，列表不跟着重载**——已加载会话通过官网原有路由切换，切换期间保留左侧列表与区域高度；连续点击时避免旧导航覆盖新选择。

- **中文默认，也可用英语**——在「外观与行为 → 语言」中切换，设置页与桌面聊天即时更新，草稿和会话选择保留。

- **Harness 在后台，伙伴也在桌面上**——Windows 桌面版使用独立透明置顶窗口，主窗口最小化后仍可见；完全退出 Harness 时一起关闭。
- **三个内置伙伴**——新增基于设定图生成的蓝发鲸鱼女仆风 Q 版 `deepseek`，使用重绘后的 2 倍高清图集，保留「深蓝鲸娘」和「智域」。新安装默认选择 `deepseek`，升级保留已有选择。
- **会跑、会打招呼，也会看向鼠标**——支持九类动作与十六方向注视；左右拖动时播放对应方向的跑步动画，松开后恢复任务状态。
- **靠近时展开**——鼠标接近伙伴后柔和显示「聊一聊」和「动态」，离开后延迟收起；打开面板时保留操作栏，精简模式始终保留入口。
- **从伙伴旁开始聊天**——选择工作区、新建会话或继续未归档会话，普通消息在后台提交；“在主会话编辑”才唤起 Harness 并聚焦输入栏。Windows 桌面模式支持全局 **Ctrl+Alt+Shift+P**。
- **面板跟着伙伴走**——聊天、动态和完成气泡随伙伴重新定位，靠近屏幕边缘时向内展开；拖动时保留聊天草稿和所选会话。
- **留意多个任务**——显示运行、等待回应、错误及未读完成状态，点击动态打开对应原生会话；确认和审批仍在原生会话中处理。
- **融入 Harness 原生设置**——管理入口就在「设置 → codex-mini-pet」，使用宿主的按钮、开关、输入框与分段控件，支持浅色和深色主题。
- **带上你自己的角色**——兼容 Codex v1/v2 宠物包、PNG/WebP、`pet.json` 与旧版 `avatar.json`；支持 ZIP 导入导出，以及保留宠物 ID 的图集替换。
- **本地管理，配套 skill**——宠物库和偏好保存在本机；提供 `pet_*` 工具、`/pet` 命令和独立 CLI，配套技能可指导创建、校验与导入。

## 你会看到什么

### 聊天与工作

在主界面顶部选择「聊天」或「工作」。聊天会话名称显示在页眉左上角，分享入口位于页眉工具区；网页内重复的导航、会话标题和分享按钮隐藏，使用 Harness 左侧聊天列表进行操作。点击分享会打开官网分享弹窗，后续操作仍由你在官网界面确认。

<img src="docs/images/chat-mode.png" alt="聊天模式：在 Harness 内使用 DeepSeek 官方聊天首页，顶部可切换工作模式" width="100%">

<img src="docs/images/work-mode.png" alt="工作模式：Harness 原生新会话、工作区选择、模型输入栏与高清默认伙伴" width="100%">

| 入口 | 适合做什么 | 会话与服务 |
| --- | --- | --- |
| **聊天** | 日常问答、讨论想法、继续官网聊天 | DeepSeek 官方网页；历史位于工作区下方 |
| **工作** | 处理项目、编写代码、使用文件和工具 | Harness 原生工作区、会话与已配置模型 |
| **伙伴旁的「聊一聊」** | 主窗口在后台时给工作会话发消息 | 发送到选定的 Harness 工作区及未归档会话 |

### 为什么把它们放在一起

- **少切窗口**：官网聊天与项目工作在 Harness 内切换，项目会话和网页聊天分别展示。
- **保留熟悉的能力**：官网负责聊天生成及历史管理，Harness 负责项目、上下文、工具与审批。
- **任务进行时也能离开主窗口**：Windows 桌面伙伴提供快捷回复、任务动态和完成提醒。
- **一个插件维护**：双模式和宠物一起安装，原有宠物库、偏好与工作会话继续使用。

### 登录与历史同步

聊天使用 DeepSeek 官网登录状态，目前需要在内嵌网页手动登录。Harness 尚未提供可验证的聊天登录复用接口；本功能不会读取或复制 Harness 的登录凭据。当前宿主的网页登录状态在本次应用运行期间保留，完整退出后可能需要重新登录。

聊天列表同步官网当前已加载的会话导航，搜索范围为这些标题。重命名和删除通过官网原有界面完成，删除需要在官网弹窗确认；官网结构调整后可能需要更新适配。

### 桌面上的伙伴

<div align="center">
  <img src="docs/images/desktop-pet.png" alt="DeepSeek Harness 桌面模式中的高清默认伙伴 deepseek" width="220">
</div>

拖动形象调整位置，点击形象打招呼；鼠标靠近后，底栏出现“聊一聊”和“动态”，再次点击同一入口即可收起。右键可打开伙伴设置、隐藏伙伴或切回应用内显示。截图展示默认伙伴 `deepseek` 在桌面上的实际效果。

### Harness 原生设置

桌面版：**左下角「更多」→ 设置 → codex-mini-pet**。Web 版直接进入「设置 → codex-mini-pet」。

<img src="docs/images/settings-pets.png" alt="Harness 原生宠物伙伴设置页，展示角色预览、外观与行为、动作和导入选项" width="100%">

新安装默认选中 `deepseek`；设置页可预览和切换内置伙伴，调整桌面行为，并导入自定义图集。

| 页面 | 可以做什么 |
| --- | --- |
| 伙伴 | 选择形象、显示或收起、导出 ZIP，编辑自定义伙伴信息、替换图集 |
| 外观与行为 | 中文 / English 界面语言、桌面置顶、大小、精简模式、显示方式、目光跟随、减少动态效果、重置位置 |
| 动作 | 逐项预览九类动作和十六个注视方向 |
| 导入 | 导入宠物 ZIP 或透明 PNG/WebP 动作图，并检查图集结构 |

## 安装

当前版本为 **2.0.5**，已在 DeepSeek Harness **0.2.1-rc.2** 上验证可用。官网聊天需要桌面宿主的内嵌浏览器能力，已在 Windows 桌面版验证。独立桌面置顶伙伴适用于 Windows；Web 及其他系统使用应用内伙伴。

### 1. 获取安装包

打开 [最新 Release](https://github.com/HuiHuangDDFS/dsh-codex-mini-pet/releases/latest)，在 **Assets** 下载 [`dsh-codex-mini-pet-2.0.5.tgz`](https://github.com/HuiHuangDDFS/dsh-codex-mini-pet/releases/download/v2.0.5/dsh-codex-mini-pet-2.0.5.tgz)。发布包已包含构建结果，直接安装即可。

也可以从源码构建，需要 **Node.js 22.19+** 和 npm：

```sh
git clone https://github.com/HuiHuangDDFS/dsh-codex-mini-pet.git
cd dsh-codex-mini-pet
npm ci
npm run build
npm pack
```

仓库根目录会生成 `dsh-codex-mini-pet-2.0.5.tgz`。固定版本源码可从 [v2.0.5 标签](https://github.com/HuiHuangDDFS/dsh-codex-mini-pet/tree/v2.0.5) 获取；GitHub 自动生成的 Source code ZIP 仍需构建。

### 2. 安装到 Harness

**桌面版**

在 Harness 的「设置 → 插件管理器」中安装本地 `.tgz`，确认插件已启用，然后重新启动 Harness。

也可使用**桌面安装包自带的 CLI**。先启动过桌面应用以初始化 profile，再完全退出应用；以下为 Windows PowerShell 示例：

```powershell
$harnessDir = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'
$petPackage = (Resolve-Path .\dsh-codex-mini-pet-2.0.5.tgz).Path
& "$harnessDir\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add $petPackage
```

如果 Harness 安装在其他位置，修改 `$harnessDir`。若使用了自定义 `DSH_HOME`，安装时应与桌面应用保持一致。

**纯 Web profile**

```sh
dsh plugin --profile web add /绝对路径/dsh-codex-mini-pet-2.0.5.tgz
```

将 `web` 替换成实际使用的 profile 名称，安装后重新启动相应的 Harness 服务。升级时按相同步骤安装新版 `.tgz`，已有宠物库和偏好保留。

请安装打包后的 `.tgz`，不要将源码目录作为桌面 profile 的链接依赖，也不要创建 junction。插件通过宿主的 bundle 机制加载，不需要修改 `app.asar` 或覆盖 Harness 安装文件。

从 **1.3.1 及更早版本**升级时，先在插件管理器卸载旧版宠物插件，再安装新名称的安装包，避免同时启用两份插件。宠物库和偏好保留，无需重新导入。

### 3. 安装配套 skill（可选）

将仓库中的 [`skills/dsh-codex-mini-pet`](skills/dsh-codex-mini-pet/SKILL.md) 文件夹复制到以下任一位置：

| 范围 | 位置 |
| --- | --- |
| 当前项目 | `<项目目录>/.dsh/skills/dsh-codex-mini-pet` |
| 当前用户 | `~/.dsh/skills/dsh-codex-mini-pet`，自定义数据目录时为 `$DSH_HOME/skills/dsh-codex-mini-pet` |

重新加载技能后，以 Harness 实际发现的技能列表确认。技能用于指导角色创建、图集校验、导入和管理；图像生成仍需要当前环境提供相应能力。显示内置伙伴不需要安装 skill。

## 使用说明

### 选择与调整伙伴

进入「设置 → codex-mini-pet」选择 `deepseek`、深蓝鲸娘或智域。在「外观与行为」中调整大小、目光跟随和减少动态效果；关闭「桌面置顶」即可切回应用内显示。

`deepseek` 在界面与桌面上使用高清素材，图集逐帧保留完整发尖、尾巴、双脚和透明留白。导出 ZIP 时使用标准 v2 图集，保持 Codex 宠物包兼容性。

**精简模式**收起角色形象、保留聊天和动态；**隐藏伙伴**收起整个窗口。可在设置中再次显示，或输入 `/pet show`。

### 聊一聊

点击底栏「聊一聊」，或在 Windows 桌面置顶模式下按 **Ctrl+Alt+Shift+P**。

- 桌面快捷聊天可直接选择工作区及其未归档会话，也可新建会话；默认使用 Harness 当前会话所在工作区。使用前请在 Harness 添加工作区并配置可用模型。
- 应用内聊天栏还可选择工作区或已有会话作为发送目标。
- **发送**：普通文字直接提交到所选会话，Harness 保持后台，不切换主界面的会话。
- **在主会话编辑**：唤起 Harness，打开目标会话并将文字插入原生输入栏，保留已有草稿。需要文件、`@` 上下文、技能或命令时，在这里补充后由你发送。
- **拖动与收起**：桌面面板保持打开并随伙伴移动；再次点击入口、点击关闭按钮或按 Esc 收起，保留尚未发送的文字。

聊天沿用 Harness 的会话与模型配置。伙伴本身不提供模型服务，也不会替你确认审批。

### 查看任务动态

「动态」按需要回应、遇到问题、完成待查看、运行中的顺序展示任务。Windows 桌面栏点击任务打开原生会话；应用内动态栏另提供回复、停止、收起提醒和静音等操作。

查看、收起动态只操作伙伴面板；点击具体任务才唤起对应主会话。聊天与动态从伙伴侧边展开并随其移动。新任务完成后，伙伴朝向屏幕内侧的上角会出现短暂气泡，点击即可查看对应会话；启动时不会重复提醒旧任务。

### 在对话中管理

插件提供 `/pet` 命令：

| 命令 | 作用 |
| --- | --- |
| `/pet show` / `/pet hide` | 显示 / 隐藏伙伴 |
| `/pet mini` | 切换为精简模式 |
| `/pet list` | 列出宠物 |
| `/pet select deepseek` | 选择新默认伙伴 deepseek |
| `/pet select zhiyu` | 选择智域 |
| `/pet select whale-girl` | 选择深蓝鲸娘 |
| `/pet reset position` | 重置位置 |
| `/pet reset size` | 重置大小 |

也可以让 Harness 执行「列出宠物并选择智域」「把宠物缩小一点」等请求，模型通过插件提供的 `pet_*` 工具操作本地宠物库。

### 导入自己的角色

在设置的「导入」页选择 ZIP、PNG 或 WebP。v2 图集尺寸为 **1536 × 2288**，8 列、11 行，每格 192 × 208，包含九组动作和十六个注视方向。

导入会创建新的宠物 ID；更新已有自定义伙伴时使用「替换图集」，保留原 ID、名称和显示偏好。导出 ZIP 可用于备份和迁移。结构校验通过后，仍需在「动作」页检查画面与播放效果。

完整格式和命令见 [图集说明](skills/dsh-codex-mini-pet/references/atlas.md) 与 [CLI 参考](skills/dsh-codex-mini-pet/references/commands.md)。

## 常见问题

**安装后设置里没有「codex-mini-pet」？**

确认安装到了正在使用的 profile，插件已启用，且安装后重启过 Harness。只把 npm 包放入目录，不代表宿主已经激活对应 bundle。具体步骤见 [使用说明](docs/usage.md)。

**命令行提示 `desktop` profile 由 Electron 管理？**

普通 CLI 可能没有桌面 profile 的管理权限。改用应用内插件管理器，或完全退出桌面应用后使用安装包自带的 `resources/runtime/cli/bin/dsh.cmd`。

**最小化后宠物不见了？**

独立置顶窗口仅在 Windows 桌面宿主中启用。确认「外观与行为 → 桌面置顶」和「显示伙伴」均已开启；桌面窗口启动失败时会回到应用内显示。完全退出 Harness 后伙伴关闭是正常行为。

**快捷键没有反应？**

Windows 桌面置顶模式使用固定全局 Ctrl+Alt+Shift+P，其他软件占用该组合时可直接点击底栏。应用内快捷键可在 Harness 快捷键设置中调整，默认按键冲突不会阻止插件启动。

**聊天提示先选择工作区，或发送失败？**

先在 Harness 主窗口选择工作区，并确认所选模型可以正常对话。含 `@`、技能或命令的内容请转入主会话编辑；发送错误会保留在伙伴中供你处理。

**官网聊天可以自动使用 Harness 的登录账号吗？**

目前需要在内嵌网页手动登录同一账号。插件不读取或复制 Harness 的登录凭据；完整退出应用后，官网可能要求重新登录。

**为什么搜索不到所有官网历史？**

左侧列表同步的是官网当前已加载的会话标题，并非独立拉取完整历史。可先在官网加载目标会话后同步；重命名和删除沿用官网原有操作，删除仍有确认弹窗。

**支持 macOS / Linux 的独立桌面宠物吗？**

独立置顶窗口使用 Windows 自带 WPF；其他平台提供应用内显示。实时双向语音、Codex 云端宠物服务、透明像素点击穿透和多显示器吸附尚未实现；多屏混合 DPI 尚未实机验证。

## 数据与隐私

宠物库、选中角色与显示偏好保存在 **`$DSH_HOME/hide-pet`**，默认是 **`~/.dsh/hide-pet`**。ZIP 导出包含角色元数据与图集，可用于本地迁移；本项目不提供云端宠物同步。

Windows 桌面窗口通过私有标准输入输出通道连接插件，不另开网络监听。插件的 HTTP 资源与操作复用 Harness 的连接准入检查。

聊天模式的消息由 DeepSeek 官方网页处理，遵循官网的账号与数据规则。插件仅在内存中同步已加载的会话地址与标题，不另存网页消息正文，不读取官网的 Cookie 或登录存储。

通过伙伴旁「聊一聊」发送的工作消息由 Harness 和你选择的模型服务处理，适用该服务的数据规则；本地保存宠物并不改变模型请求的发送方式。

## 开发与验证

在源码目录运行：

```sh
npm ci
npm run check
npm test
npm run build
npm run preview
```

`npm run preview` 启动独立本地预览，适合查看角色和动作；它不等于插件已安装到 Harness。

Windows 上还可运行真实鼠标交互检查：

```sh
npm run test:native
```

该检查会短暂显示测试宠物并移动鼠标，验证跨区点击、按钮文字、聊天输入焦点、动态跳转、左右拖动动画、显示模式切换及进程退出。

自动测试覆盖会话路由、切换竞态、列表保持、官网分享与会话管理适配、新默认宠物和原有宠物功能；Windows 宿主已实测双模式切换、草稿保留和官网重命名，并确认新伙伴在设置页正常显示。CI 在 Windows/Linux 上执行语法检查、测试、构建和打包验证，结果见页面顶部状态徽章。适配基线、验证边界与更新记录见 [功能对齐说明](docs/feature-parity.md) 和 [CHANGELOG](CHANGELOG.md)。其他 Harness 版本需按实际接口验证。

## 许可证与致谢

代码使用 [MIT](LICENSE) 许可证。角色美术的来源与许可单独记录，见 [资源说明](docs/assets.md)、[鲸娘来源](assets/pets/whale-girl/provenance.md) 和 [智域来源](assets/pets/zhiyu/provenance.md)。

这是独立社区插件，与 DeepSeek、OpenAI 无隶属或背书关系。Codex 宠物行为的参考与实现范围见 [功能调查](docs/codex-pets-audit.md)。

README 的版式与章节组织参考了 [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model)。
