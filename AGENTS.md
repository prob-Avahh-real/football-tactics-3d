# 3D 足球战术模拟器

Three.js 球场战术模拟。从 block-street-pool 误入内容迁出。

## 目标平台

| 平台 | 判定 |
|------|------|
| 移动端 | 适合（Capacitor Android 已 scaffold） |
| 智能硬件 | 不适用 |

## 命令

```bash
npm install
npm test
npm run build          # vite → www/
npm run dev
npm run sync:android   # build + cap sync
npm run apk:debug      # sync + assembleDebug（JDK 17）
```

## Done

- Web：`npm test` 绿且 `npm run build` 产出 `www/`
- Android：`android/` 存在，`capacitor.config.json` 的 `webDir` 为 `www/`，`npm run sync:android` 成功
