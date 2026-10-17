# 本地命令与数据

先用 `dsh-codex-mini-pet --help` 确认所安装版本的参数。以下命令与宿主的 `pet_*` 工具共享数据层。

```text
dsh-codex-mini-pet list
dsh-codex-mini-pet select <id>
dsh-codex-mini-pet update <id> --name <名称> --description <描述>
dsh-codex-mini-pet replace <id> --file <新图集路径>
dsh-codex-mini-pet delete <id>
dsh-codex-mini-pet validate --file <图集路径>
dsh-codex-mini-pet import <宠物包目录或ZIP>
dsh-codex-mini-pet export <id> <新ZIP文件路径>
dsh-codex-mini-pet preferences --visible true --scale 0.72 --reduced-motion false
dsh-codex-mini-pet preferences --follow-pointer true
dsh-codex-mini-pet preferences --mode mini --visibility-behavior on-demand
dsh-codex-mini-pet reset --scope size
dsh-codex-mini-pet reset --scope position
dsh-codex-mini-pet preview <id>
dsh-codex-mini-pet preview --file <图集路径> --port 5058
```

命令默认输出 JSON，接受 `--json`。错误包含实际原因并使用非零退出码；校验图集时还要确认返回的 `ok: true`。

所有命令可使用 `--data-dir <目录>` 指定独立宠物库。默认目录为 `$DSH_HOME/hide-pet`；未设置 `DSH_HOME` 时为用户主目录下的 `.dsh/hide-pet`。CLI 与宿主需要指向同一目录才能共享选择和偏好。

缩放范围为 0.35–1.5，`followPointer` 控制指针跟随。拖动位置由前端保存，命令行不提供位置坐标参数。修改名称或描述不会替换图集。内置宠物可改显示名称和描述，可隐藏，不能删除。

`preview` 启动本地预览服务；使用返回的地址观看，结束后停止服务。`--file` 可直接预览尚未导入的图集。不要把预览服务启动成功当作美术质量通过，也不要把它当成宿主安装验证。

## 宠物包

目录中放置一个 `pet.json` 和对应图集。ZIP 包也包含这两个文件。最小清单：

```json
{
  "name": "我的伙伴",
  "description": "角色的简短介绍",
  "spriteVersion": 2,
  "spritesheet": "spritesheet.png"
}
```

图集路径为包内文件名，不能指向包外。名称不超过 64 字，描述不超过 500 字。图集要求见 [atlas.md](atlas.md)。

也支持 Codex 清单的 `displayName`、`spriteVersionNumber`、`spritesheetPath`，以及旧版 `avatar.json`。Codex 清单缺少版本时按 v1，缺少图集路径时按 `spritesheet.webp`；本项目 `name` 清单默认 `spritesheet.png`。导出包含两种字段别名。

导入时会校验图集并创建新的稳定 ID，不能用包里的旧 ID 直接覆盖现有宠物。导入不会自动选择；要启用时继续调用 `select`，选中时会退出精简模式。替换现有自定义图集前先导出备份，再使用 `replace`，可从 v1 升级为 v2，原 ID、名称、描述及全部显示偏好保持不变。校验失败不改变已安装图集。内置图集不可替换。

`reset --scope size|position|all` 分别重置大小、位置或全部显示偏好；只有 `all` 会恢复默认选择。`visibilityBehavior` 为 `always` 或 `on-demand`，后者在点击伙伴和设置窗口以外区域时收起；`visible` 控制整个伙伴，`mode` 为 `pet` 或 `mini`。界面管理入口是“设置 → 宠物伙伴”（桌面版先打开左下角“更多”），应用内 Ctrl+Alt+Shift+P 唤出聊天（macOS 对应 Command+Option+Shift+P）。若宿主仍有默认按键冲突，命令保留为未绑定项，可在快捷键设置中分配，宠物本身继续运行。

读取命令返回的实际 ID、偏好和输出路径后再报告成功。导出包含角色元数据和图集，可用于本地备份与迁移；目标 ZIP 必须尚不存在，命令不会覆盖原文件。不包含云端账户或跨设备同步服务。

Windows 桌面版 0.3.2+：`preferences --surface desktop` 使用独立置顶窗口，`preferences --surface app` 切回应用内。`pet_set_preferences` 同样接受 `surface`。桌面与应用内位置分别保存；重置位置会清除两者。
