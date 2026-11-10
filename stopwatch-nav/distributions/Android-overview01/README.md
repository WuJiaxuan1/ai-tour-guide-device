# 最后使用的 Android 测试安装包

`maple-map-P8-overview-test01.apk`：版本 `8.3.26-p8-overview01`，包名 `com.qixia.stopwatchnav`。原工作区已有的APK原样归档，没有重新编译或重新签名。SHA256见本目录 `checksums.json`。

文件使用 Git LFS 保存。克隆后运行 `git lfs install` 和 `git lfs pull`，确认文件约55MB，而不是只有几行文本的LFS指针。源码位于 `stopwatch-nav/android/`。

用于P8手机热点/局域网地图与全路线总览。overview02回退固件在相邻 `P9-cloud02/` 的 restore-overview02 文件中。当前网页＋服务器方案不需要此App。

Android高德Key绑定包名和签名证书SHA1。原debug.keystore须私下备份；新电脑生成不同签名时，无法直接覆盖旧App，高德控制台也要重新登记签名。API Key仍在手机App中自行填写。不要把签名私钥或API Key提交GitHub。
