# 3D 足球战术模拟器

Three.js 球场战术模拟：选队 → 阵型/首发 → 观看比赛。从 `block-street-pool` 误入内容迁出。

## 命令

```bash
npm install
npm run dev      # http://localhost:3000
npm test
npm run build    # → www/
```

Android（Capacitor）：

```bash
npm run sync:android   # build + cap sync
npm run apk:debug      # sync + assembleDebug（需 JDK 17）
```

## 玩法

1. **选队** — 6 支英超风俱乐部之一（客队随机）
2. **战术** — 阵型（4-3-3 / 4-4-2 / 3-5-2 / 4-2-3-1）与 11 首发
3. **开始比赛** — 上下半场、暂停、换人（最多 3 次）；中场可改战术
4. **相机** — 拖拽旋转、滚轮缩放

比赛推进会参考球员速度/射门/防守，阵型同名位置会横向错开。

## 结构

| 路径 | 作用 |
|------|------|
| `public/` | Vite 根：UI + Three.js 入口 |
| `lib/` | 阵型与比赛纯逻辑（可单测） |
| `www/` | `npm run build` 产物 |
| `android/` | Capacitor Android（`com.skat.footballtactics3d`） |

## Done

- Web：`npm test` 绿且 `npm run build` 产出 `www/`
- Android：`npm run sync:android` 成功（APK 用 `npm run apk:debug`，需 JDK 17）
