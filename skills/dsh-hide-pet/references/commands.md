# 本地命令与数据

先用 `dsh-hide-pet --help` 确认所安装版本的参数。以下命令与宿主的 `pet_*` 工具共享数据层。

```text
dsh-hide-pet list
dsh-hide-pet select <id>
dsh-hide-pet update <id> --name <名称> --description <描述>
dsh-hide-pet delete <id>
dsh-hide-pet validate --file <图集路径>
dsh-hide-pet import <宠物包目录或ZIP>
dsh-hide-pet export <id> <新ZIP文件路径>
dsh-hide-pet preferences --visible true --scale 0.72 --reduced-motion false
dsh-hide-pet preferences --follow-pointer true
dsh-hide-pet preview <id>
dsh-hide-pet preview --file <图集路径> --port 5058
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

导入时会校验图集并创建新的稳定 ID，不能用包里的旧 ID 直接覆盖现有宠物。导入不会自动选择；要启用时继续调用 `select`。替换画面时先导出原宠物，将新图集作为新宠物导入并预览，再按用户意图选择新 ID、删除旧自定义项。不要擅自删除旧宠物。

读取命令返回的实际 ID、偏好和输出路径后再报告成功。导出包含角色元数据和图集，可用于本地备份与迁移；目标 ZIP 必须尚不存在，命令不会覆盖原文件。不包含云端账户或跨设备同步服务。
