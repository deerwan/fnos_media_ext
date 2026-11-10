# fnos_media_ext

零侵入、零内置源、订阅驱动、带完整 Web 配置页的飞牛影视（`trim.media`）在线接入层。

> 配置之后才出现在线能力；停用或卸载，官方影视立即原样恢复。


## 关键约束

- **不内置任何源**：不附带资源站 URL、订阅 URL、示例真实地址或随包站点清单。包内只含协议与格式解析代码。
- **零源是合法默认状态**：干净安装后 `/_ext/healthz` 返回 OK，所有请求纯透传，官方影视功能完全不受影响；零外连、空闲 CPU ≈ 0。订阅自动更新默认关闭，开启后才有一个每 60 秒做内存检查的轻量协程。
- **单一磁盘状态**：仅 `state/config.json`（首次启动时生成，含随机管理令牌；之后只有用户显式保存配置才写盘）。标题、搜索结果、播放清单全部内存态，重启即丢。
- **固定预算**：搜索固定并发与 2.5s 总预算，源数量增加不会延长等待；起播默认 1.5s 并发优选最快线路（`auto_best_source` 可关），失败自动换线。
- **不做**：虚拟媒体库、常驻预热、占位轮询、后台自愈、全站测速、健康画像、去广告指纹、网盘线、插件自更新、账号 ACL。

## 安装

1. 在 fnOS 应用中心 **手动安装 FPK**，选择 `dist/fnos_media_ext-<version>.fpk`，并勾选同意免责声明。
2. 依赖应用「影视 (`trim.media`)」必须处于运行状态；需要 fnOS 1.2.0 及以上。
3. 安装完成后，桌面出现「飞牛影视扩展」图标。此时为纯透传状态，官方影视一切照旧。
4. 打开管理页，在左侧「订阅配置」中粘贴你自己持有的订阅地址，点「拉取配置」。
5. **全量拉取**：订阅里所有可识别的源一次性导入并启用，无需逐个勾选；也可编辑「配置内容」后点「保存并应用」。
6. 需要定期同步时，打开「自动更新」并设置间隔（默认 24 小时），点「保存订阅设置」。

管理页入口：桌面 iframe `/app/fnos-media-ext/`，或浏览器直连 `/v/online-admin`。

## 支持的订阅格式

| 格式 | 来源 | 说明 |
|---|---|---|
| Base58 包装的 `api_site` JSON | Base58 订阅文本（含代理 `format=2`） | 整份 JSON 的 Bitcoin Base58 编码 |
| 明文 `api_site` JSON | 影视聚合工具的配置文件 | 顶层 `cache_time` + `api_site` |
| `sources` 数组 JSON | `sources` 列表订阅 | 每项 `name` / `url` |
| TVBox `sites` | 通用 TVBox 配置 | 仅取苹果 CMS 采集站 |

解析时会剥离订阅中常见的 `?url=` 代理包裹、按规范化接口地址生成稳定 id；带特殊标记的源会登记但**默认禁用**，是否启用完全由用户决定。非 CMS 接口仍然过滤。拉取订阅使用独立连接池、5 秒超时、512 KB 上限与内网地址防护。若订阅地址不可达，可在「配置内容」中粘贴订阅文本后点「保存并应用」，完全不走网络。完整配置备份请使用「关于」页的文件导出 / 导入。


## 元数据（P0 低风险）

只做纯文本映射与清洗，**不新增任何网络请求、不引入 subprocess、不改动播放元数据常量**：

- CMS 返回的简介与分类会清洗 HTML 标签 / 实体并保留段落换行；`vod_time` 更新时间落地到详情。
- 详情页 `genres` 由 `type_name` 拆分，简介不再截断，主演 / 导演 / 更新时间分行展示。
- 搜索卡片简介清洗后放宽到 1000 字（保留上限，避免 TV 端超长文本）。
- `files[].file_name` 后缀按首选线路首集 URL 推导 `m3u8` / `mp4`，不再恒为 `.m3u8`。
- **保持不动**：`duration` / `runtime` / `resolution_type` / `width` / `height` / `bps` / `codec_name` 等仍是兼容常量。真实播放元数据探测属于后续阶段（清单文本解析 + 播放后懒回填），需先评估对官方续播判定的影响。

## 官方元数据借用（阶段 2）

在线条目自动与本地媒体库的刮削结果关联（`proxy/borrow.py`，以 `mode=ro` 只读打开官方 `trimmedia.db`，不写不锁）：

- 匹配规则：规范化标题（忽略标点 / 全半角 / 繁简差异的模糊比对）+ 年份 ±1；未命中静默回退 CMS 数据
- 命中后详情页获得：横版高清背景图（`backdrops` + 真实宽高）、官方 logo、简介、评分、时长、IMDb ID（详情页自动出现 IMDb 链接）、官方分类 ID（客户端渲染成中文分类）
- 演职人员接口 `person/list` 优先返回官方刮削数据（带头像与饰演角色）；未命中回退 CMS 演职人员拆分
- 官方图片为相对路径，客户端统一拼 `/v/api/v1/sys/img` 前缀访问，无需拷贝文件
- 开关：`borrow_official`（默认开启；仅读本地库，无任何网络请求）
- `deploy/db_probe.py` 可只读输出官方库结构与分类映射，用于诊断与字段核对
- 保持不动：`duration` / `resolution_type` 等播放元数据仍为兼容常量（真实探测属后续阶段）


## 架构

```
proxy/
  app.py           FastAPI 主应用：具名路由 + 兜底透传
  supervise.py     UDS 原子换名接管、健康检查、退出回滚
  upstream.py      官方后端 Unix Socket 透传（JSON / 流式）
  config.py        唯一磁盘状态与热加载
  subscription.py  订阅解析、归一化、SSRF 防护
  cms.py           苹果 CMS 搜索与内存标题库
  fake.py          官方响应伪造与 TV 端严格字段规整
  hls.py           m3u8 改写、分片与海报代理
  admin_api.py     管理 REST 接口 + 订阅全量拉取与定时刷新
  webui_gateway.py 桌面 iframe 网关
  static/          Web 配置页构建产物（单 JS + 单 CSS）
web/               Vite + React + TypeScript 源码
deploy/            systemd 单元与安装 / 卸载 / 依赖脚本
packaging/fpk/     FPK 骨架与 build.sh
```

请求链：`nginx /v → /var/run/trim_media.sock → uvicorn`；具名路由命中在线条目时伪造响应，其余请求原样转发 `trim_media_upstream.sock`。管理页走独立桌面网关，不进入媒体链路。

管理 API 写操作校验管理页下发的令牌（HttpOnly Cookie 或 `X-Admin-Token` 请求头），令牌不出现在 URL 与访问日志中。

## 构建

```bash
# 前端（产物需复制到 proxy/static）
cd web && npm install && npm run build
cp -a dist/. ../proxy/static/

# FPK（需要 fnpack，macOS 版会放在 .tools/fnpack）
bash packaging/fpk/build.sh --fnpack .tools/fnpack

# 可选：不含离线 Python wheelhouse 的精简包（安装时需联网装依赖）
bash packaging/fpk/build.sh --slim --fnpack .tools/fnpack
```

`wheelhouse/` 提供离线 Python 依赖（fastapi / uvicorn / httpx），是 FPK 体积的主要来源；`--slim` 会去掉它，改由 `deploy/bootstrap_deps.sh` 在线安装。

应用图标由 `tools/generate_icon.py` 用纯标准库绘制（深墨青圆角方 + 薄荷绿几何 F + 接入圆环），不复用任何第三方或旧项目素材。运行 `python3 tools/generate_icon.py` 会同时生成 FPK 根目录图标、桌面 `app/ui/images/icon_*.png`，以及管理页左上角使用的 `web/public/app-icon.png`。

## 测试

```bash
.venv/bin/python -m unittest discover -s tests -v
```

## 已知限制

- 官方客户端字段契约依据 `trim.media 0.9.8` 逆向整理，未在全部机型与版本上实测；升级官方应用后可能需要重新适配。
- 本项目不解析需爬虫 / jar / 安卓运行时的异构源，只支持苹果 CMS 采集接口；清单与图片代理仅允许公网目标（回环 / 链路本地地址被拦截），内网自建源的海报与分片代理不可用。
- 起播清单失败会自动在候选线路间换线；播放中途失败仍需手动切换线路，不做后台自愈。
- 性能数值是设计目标，未在 fnOS 真机压测。

## 免责声明

本项目是开源免费的技术研究 / 个人媒体库工具，仅在你自己的 NAS 上运行。它本身不提供、不存储、不分发任何影视、图片、字幕或播放地址，也不内置任何资源站、订阅地址或资源数据库。本项目不提供、不推荐、不解答任何资源站点的名称、地址或获取方法；接口由使用者自行配置并自行核实合法性。仅供学习交流与个人合法播放自有或已获授权内容使用，请勿商用或传播侵权内容，由此产生的法律责任由使用者自行承担。

## 致谢

本项目的设计参考了以下项目的思路，一并致谢（排名不分先后）：

- `fnmedia-ext` —— 飞牛影视在线扩展
- `fnos_music_ext` —— 飞牛音乐扩展
- `MoonTV` / `LunaTV` / `LibreTV` 
- `LunaTV-config` —— 聚合源订阅格式的参照

同时感谢飞牛 fnOS 开发者社区提供的 FPK 打包规范与接口资料。
