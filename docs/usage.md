# 使用说明

插件提供 DeepSeek Harness 工具和独立命令行 `dsh-hide-pet`。

## 构建与安装

需要 Node.js 22.19 或更新版本。在仓库目录中运行：

```sh
npm ci
npm run build
npm test
npm pack
```

桌面版在“设置 → 插件管理器”中安装生成的本地 `dsh-hide-pet-0.1.0.tgz`。宿主的 `plugin_manager` / `install_bundle` 也是官方插件管理入口。新安装的 bundle 默认启用；已存在但被禁用的同名 bundle 需要在管理器中启用。

普通 Web profile 可使用 `dsh plugin --profile <实际profile名称> add <本地tgz>`，由宿主同步依赖并启用 bundle。桌面 profile 有专用保护，使用上述桌面管理入口。使用打包后的 tgz；本次发现 Windows 宿主包管理器在将源码目录链接替换为安装包时会影响链接目标，因此不要把源码目录作为宿主的链接依赖。

插件包通过 `dsh.bundle.patch` 声明宿主组件，并立即加载客户端 overlay；单独安装 npm 依赖不代表宿主已经激活插件。无需编辑宿主 `app.asar` 或替换安装文件。当前未把插件自动安装到正在使用的宿主中；实机状态见 [功能对齐说明](feature-parity.md)。

## 命令行与本地宠物包

在源码仓库中，可直接运行：

```sh
node src/cli.mjs list
node src/cli.mjs preview
```

安装后的命令名为 `dsh-hide-pet`。完整命令、偏好参数、默认数据目录和 `pet.json` 包格式集中在 [命令参考](../skills/dsh-hide-pet/references/commands.md)；图集要求见 [格式说明](../skills/dsh-hide-pet/references/atlas.md)。所有普通命令默认返回 JSON，`preview` 会持续运行本地服务。

可使用 `--data-dir <目录>` 隔离试验宠物库。导入会产生新 ID；修改名称不会更改 ID。导出为 ZIP 且不覆盖已有文件，适合本地备份和迁移。

## 模型工具

宿主公开 `pet_list`、`pet_select`、`pet_update`、`pet_delete`、`pet_import`、`pet_export`、`pet_validate`、`pet_set_preferences`。调用参数以运行中的工具定义为准。示例请求：“列出宠物并选择智域”“把宠物缩小一点”“隐藏宠物”“导出当前宠物到指定 ZIP 文件”。

宿主命令为 `/pet`，可使用 `show`、`hide`、`list` 或 `select <id>`；不带参数时切换显示状态。

## skill

仓库的 `skills/dsh-hide-pet` 是可独立安装的技能目录。项目范围安装时，将它复制到目标项目的 `.dsh/skills/dsh-hide-pet` 或 `.agents/skills/dsh-hide-pet`。本机适配版本以当前目录最近的 Git 项目根为搜索根，没有 Git 时使用当前目录；不会逐层扫描每个父目录。

用户范围可放入 `$DSH_HOME/skills/dsh-hide-pet`，默认是 `~/.dsh/skills/dsh-hide-pet`；另一个用户搜索根为 `$DSH_AGENTS_HOME/skills`，默认 `~/.agents/skills`。以宿主的技能发现结果确认已加载。

该 skill 优先使用宿主工具，缺少工具时可使用已安装的同名命令行。它不要求 ChatGPT Library、Pets MCP 或云端上传会话。
