# 删除工作区前：用户自行私密备份

用户选择“只列清单，我自己备份”。以下**不上传GitHub**，本轮未复制到工作区外、未删除原文件。仅克隆代码不能恢复它们。

旧根目录`D:\Study\yiqifen`；备份须放到此目录之外，并确认可读。

| 建议 | 原位置（相对旧根目录） | 用途 |
| --- | --- | --- |
| 必须 | `.local-work\ssh\`整个目录，尤其`Codex\codex_ed25519`、`Codex\passphrase.dpapi`、公钥、known_hosts和原脚本 | 服务器SSH身份/口令保护及主机核验。使用原Windows账户读取，不公开。 |
| 必须 | `ai-tour-guide-device\.local-work\web-debug\.env.local` | 当前高德、网页模型、后端等配置。 |
| 按需 | 上述工作树`.local-work\local-knowledge\endpoint.json`、`mcp-local-demo\.env` | 本机MCP与早期演示配置；恢复文件不等于应启动，生产MCP正在运行。 |
| 保留App覆盖安装时必须 | `stopwatch-nav\android\.local\debug.keystore` | 当前App签名；新签名不能覆盖旧App，高德SHA1配置可能要重做。 |
| 若继续原MotoNav实验 | `MotoNav-main\android\standard\keystore\personal.jks`及`keystore.properties` | 原实验App签名及密码配置。 |
| 保留本地行程时 | 工作树`.local-work\travel.sqlite`及`-wal`/`-shm`，其他工作树`.local-work`中的demo-trip数据 | 先停止对应本地后端后备份整组文件，或使用SQLite在线backup；单独复制正在写入的主文件可能漏数据。不要停止错服务或覆盖生产。 |
| 保留个人照片时 | 工作树`.local-work\travel-media`、`photo-creations`及其他个人素材 | 用户数据，不在公开代码中。 |
| 建议 | `stopwatch-custom\stopwatch-device-backup.bin`、`stopwatch-nav\releases\*\device-preflight\` | 设备整片/分区读取可能含小智身份和Wi-Fi，不可公开，也不表示应整片回刷。 |
| 保留所有旧安装包时 | `stopwatch-nav\releases`、`stopwatch-custom\output`与Grok旧bin | Git只包含当前cloud02、overview02回退bin及最后App；其他旧二进制只有源码/记录/摘要，摘要不能恢复bin。 |
| 希望离线编译时 | `stopwatch-custom\.tools`、`esp-idf-v5.5.2`、`MotoNav-main\.tools` | 工具链和缓存可按文档重装，不上传Git。 |
| 自行决定 | `stopwatch-nav.zip`、M5Burner固件、个人附件/截图/原PDF | 非当前代码必需依赖，按历史保留需求决定。 |

## SSH口令

当前私钥口令使用Windows **DPAPI当前用户**加密，`passphrase.dpapi`不是通用跨机口令文件。保留原账户、只删项目时可从备份恢复；重装/换电脑前要在原账户下私密验证迁移，或请管理员添加新电脑公钥。不要在聊天中贴明文口令。根目录`Codex.pub`只有公钥，无法代替私钥登录。

## 服务器数据

线上`/home/jxwu/apps/ai-tour-guide-device/shared/`的配置、travel-data和备份，以及systemd私密环境仍在VPS。本轮不下载游客数据。未来迁移VPS需另做数据库一致性备份和配置迁移；Git分支不是数据库备份，删除本机目录不会删除VPS。

## 删除前核对

1. GitHub分支可独立克隆，LFS模型/APK真实可下载，见归档验证记录。
2. 需要的私密数据已备份到工作区外并验证；不要只放在即将删除的目录内。
3. 将接手提示词的GitHub链接另存，或复制到笔记。
4. 确认仍有SSH登录方式，特别是准备换Windows账户时。
5. 由用户决定删除时间。本轮AI不删除工作区，不声称私密备份已经完成。
