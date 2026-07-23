# Roadmap — football-tactics-3d

## Done

- [x] Web MVP：选队 / 阵型 / 比赛循环 / 换人
- [x] 仓基建：`.gitignore`、README、首提、真实 `npm test`
- [x] 模拟：属性进公式、职责跑位、同名位置错开、客队独立阵型
- [x] 交互：OrbitControls；开球冻结；界外/角球；简化越位
- [x] Android：Capacitor scaffold（`com.skat.footballtactics3d`，`webDir: www`）
- [x] CI：仓库内 `.github/workflows/ci.yml`（test + build + cap sync）

## Next

- [ ] 真机 APK 冒烟（`npm run apk:debug`，JDK 17）与沉浸式全屏抛光
- [ ] 传球路线可视化 / 阵型热区 overlay
- [ ] 更完整定位球（任意球、点球）与体力随时间衰减 UI
- [ ] 可选：并入 monorepo `capacitor-smoke` 矩阵做跨仓门禁

## Out of scope

- 智能硬件（见 `AGENTS.md`）
- 完整 FIFA/FM 级比赛引擎
