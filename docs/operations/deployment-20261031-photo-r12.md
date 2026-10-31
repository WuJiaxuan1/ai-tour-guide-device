# photo-r12：照片模块恢复初始演示

2026-10-31 21:34 CST已上线0.5.2-20261031-photo-r12。用户明确认为照片排版不满足贴纸画风，要求回退初始版本、不再改进。本次只回退照片模块，不恢复整站旧版本。

- 恢复原有、未改动的JournalPage：我的路线 → 专属手账，选图仅本地预览，动画结束显示固定纪念卡journal-result.png并可下载；已有说明明确为固定卡，不假称AI生成。
- 移除photo-r10新增顶部/手机更多菜单入口，原“照片创作”入口恢复为“专属手账”。
- photo_craft_available=false、photo_craft_mode=local_demo；/api/v1/photos及其子路径POST返回410 PHOTO_CREATION_DISABLED，旧网页不能继续上传或生成。已有作品读取/下载/删除接口保留，数据库和图片文件未删除。
- PhotoStudioPage/renderer等实现作为停用历史留存，未被页面入口引用。不得未经用户新授权恢复、改进或接入模型。
- 行程、定位、回忆、沉浸式、小智MCP和配对不回退。保留shared/travel-data，备份before-photo-r12.sqlite；仅重启qixia-guide.service，Nginx不改动。
- 本地62后端+36前端测试与构建通过，Linux62项通过；预发布、公网各8项检查通过（新资源、初始页面内容、固定图片校验、健康、能力关闭、旧客户端上传/制作关闭、测试身份没有新增照片/行程）。
- URL https://43.160.252.245/?v=photo-r12 ，JS index-Dklwdpot.js，CSS index-CoXqW1vl.css。紧急技术回滚可指向photo-r11，但那会恢复用户已拒绝功能，正常后续部署应保持本次决定。
- 累计源码补丁和合并说明已同步，无Git提交/推送。
