# PRD-014: 华硕梅林路由器插件与轻量级网关目标构建规范

> **产品需求编号**: PRD-014  
> **模块名称**: Merlin Router Plugin & Lightweight Gateway Target Build (梅林路由器插件与轻量级网关目标构建)  
> **文档版本**: 1.0.0  
> **状态**: 待审核 (Pending Review)  
> **目标机型/系统**: 华硕 RT-AX86U 及主流梅林固件路由器（ARM64 / ARMv7），兼容 Koolshare / 社区软件中心规范  
> **最后更新**: 2026-09-21  

---

## 1. 需求背景与核心目的

### 1.1 业务与硬件背景
PatchCat 现有完整服务端架构为 **FastAPI + SQLAlchemy 2.0 + PostgreSQL 16 (pgvector)**，在 PC 桌面开发与云端服务器场景下表现优异。但在面向家庭网络中心枢纽——**华硕梅林路由器（如 RT-AX86U 等嵌入式边缘设备）** 时，面临两大刚性物理约束：
1. **内存与运行环境过重**：Python 运行时 + Uvicorn + 数据库生态常驻内存达 150MB~300MB+。路由器总 RAM 多为 512MB~1GB，极易触发 Linux **OOM-Killer** 导致路由器系统崩溃断网；
2. **闪存空间极度有限**：路由器内部 NAND Flash 的可写分区 `/jffs` 往往仅剩 **30MB ~ 60MB**，绝无法塞入 Python 虚拟环境与庞大依赖。

### 1.2 核心破局机遇
- **纯前端 DAG 编排原语（Zero Router Compute）**：PatchCat 的核心画布、状态机、拓扑执行引擎 100% 运行在访客的客户端浏览器端，路由器无需承担任何复杂的 JS/Python 计算，仅需充当**静态文件服务器**；
- **家庭网络总闸道优势**：路由器是内网核心，通常自带科学网络/全局代理。路由器若提供一个轻量反代中继，局域网内的所有电脑、手机访问大模型均**无需额外配置 CORS 跨域或客户端科学上网**。

### 1.3 核心目的
在项目的编译部署流水线中引入**目标构建选项（Build Target Matrix）**：
- **不选 / 默认**：输出原有的标准企业级 Server 架构（FastAPI + Postgres / Docker）；
- **选择梅林目标（`--target=merlin`）**：自动构建纯静态 SPA，交叉编译 **Go 轻量单二进制 Gateway**，并自动封装为符合梅林软件中心规范的 **`patchcat-merlin-arm64.tar.gz` 离线安装包**，实现**低功耗、全天候局域网可用、免配代理、零闪存磨损**的边缘编排中枢。

---

## 2. 目标构建矩阵 (Build Target Matrix)

在工程编译层面解耦，保持前端业务代码零侵入：

| 维度 | Target 1: `standard` (默认标准模式) | Target 2: `merlin` (梅林路由器模式) |
| :--- | :--- | :--- |
| **触发方式** | `npm run build` | `npm run build:merlin` (或传参 `--target=merlin`) |
| **前端产物** | 标准 SPA 静态资源 | 相对路径产物 (`base: './'`)，内嵌至 Go 二进制或独立打包 |
| **后端运行时** | Python 3.11 + FastAPI + Uvicorn | **Go 单文件纯静态二进制 (`patchcat-server`)** |
| **硬件内存占用**| ~150MB - 300MB+ | **~3MB - 8MB (AX86U 内存占用率 < 0.8%)** |
| **数据持久化** | PostgreSQL 16 + pgvector / SQLite | **默认纯客户端存储 (LocalStorage)；可选 SQLite** |
| **分发形式** | Docker 镜像 / Git 源码部署 | **梅林软件中心离线安装包 (`.tar.gz`)** |

---

## 3. 功能设计

### 3.1 编译打包流水线设计 (`scripts/build-target.mjs`)
在 `package.json` 中定义构建入口：
```json
{
  "scripts": {
    "build": "tsc && vite build",
    "build:merlin": "node scripts/build-target.mjs --target=merlin --arch=arm64",
    "build:merlin:armv7": "node scripts/build-target.mjs --target=merlin --arch=arm"
  }
}
```
**梅林模式构建步骤**：
1. **前端编译**：指定 `VITE_BASE_PATH=./` 执行 Vite 打包，生成 `dist/`，修正所有静态资源的绝对路径引用；
2. **Go Gateway 交叉编译**：
   - 目标平台：`GOOS=linux GOARCH=arm64`（默认面向 AX86U 等 64 位平台）或 `GOARCH=arm GOARM=7`；
   - 编译参数：`CGO_ENABLED=0 go build -ldflags="-s -w"`（去除符号表，生成纯静态零系统依赖的单二进制）；
3. **插件装配与归档**：
   - 整合 `config.json.js`、`webs/Module_patchcat.asp`、`scripts/*.sh`、`bin/patchcat-server`；
   - 自动生成 `patchcat-merlin-arm64.tar.gz`。

---

### 3.2 轻量 Gateway 功能规格 (`gateway/main.go`)

Go Gateway 仅作为路由器的**轻量静态托管器 + 网络中继枢纽**，不承载复杂业务状态：

1. **静态 Web 服务**：
   - 监听配置文件中指定的端口（默认 `8899`）；
   - 对外分发 PatchCat 前端单页应用。
2. **LLM CORS / 流式反向代理 (`/api/proxy`)**：
   - 接收前端发来的模型推理请求（携带目标 `target-url` 与鉴权 Header）；
   - 由路由器直接向外部大模型服务（OpenAI、Claude、SiliconFlow、DeepSeek 等）发起真实请求并透明中继 SSE 流；
   - **价值**：彻底消除浏览器端报 `CORS Header Missing` 的困扰，利用路由器底层网络通道免去各客户端重复配置网络环境。
3. **集中持久化（严格设为可选配置，默认关闭）**：
   - 提供极简 RESTful CRUD 接口（兼容 `storage-adapter.ts`）；
   - **默认状态必须为 `false`**（仅前端 LocalStorage 存储，保护闪存）。

---

### 3.3 配置文件规范 (`/jffs/configs/patchcat/config.json`)

配置文件位于路由器持久化可写目录 `/jffs/configs/patchcat/`，服务启动时加载，不存在则以默认安全值初始化：

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8899
  },
  "proxy": {
    "enabled": true,
    "timeout_seconds": 120
  },
  "storage": {
    "enabled": false,
    "db_path": "/tmp/mnt/sda1/patchcat/data.db"
  }
}
```

---

### 3.4 梅林管理后台 UI 与脚本体系

#### 1. 管理后台页面 (`webs/Module_patchcat.asp`)
集成于华硕梅林原生 Web 管理后台（`http://192.168.50.1`）的“软件中心”：
- **服务状态展示**：显示 PatchCat Gateway 运行状态（运行中 PID / 已停止）、内存占用、监听端口；
- **服务开关**：【开启 / 关闭】插件；
- **服务端口配置**：自定义内网访问端口（默认 `8899`，支持修改并写入配置文件）；
- **核心操作直达**：醒目的 **【打开 PatchCat 画布】** 按钮，点击后自动在新标签页打开 `http://<当前路由器IP>:<配置端口>`；
- **集中持久化存储开关（含强警告）**：
  - 复选框：`[ ] 启用路由器数据持久化 (多设备跨端同步)`
  - 存储路径输入框：默认建议填写外挂 U盘/硬盘路径（如 `/tmp/mnt/sda1/patchcat/data.db`）；
- **外网访问控制**：`[ ] 允许通过 WAN 访问 (自动放行防火墙对应端口)`。

#### 2. 生命周期与系统脚本 (`scripts/`)
- `patchcat_install.sh`：解压文件至 `/jffs/koolshare/`，配置可执行权限 `chmod +x`，注册自启到梅林 `post-mount` / 软件中心启动入口；
- `patchcat_uninstall.sh`：优雅停止进程、释放 iptables 防火墙端口、清理相关文件；
- `patchcat_start.sh`：读取 dbus 端口配置并同步至 `config.json`，在后台以 daemon 形式拉起 `patchcat-server`，若勾选 WAN 访问则调用 `iptables -I INPUT -p tcp --dport 8899 -j ACCEPT`；
- `patchcat_stop.sh`：通过 `killall patchcat-server` 终止进程，注销 iptables 规则。

---

### 3.5 终端用户访问形态

路由器服务启动后，局域网终端用户有三种直达形态：
1. **IP + 端口直接访问（主力高频）**：
   - 局域网内任意手机/电脑/平板浏览器输入：`http://192.168.50.1:8899` 或 `http://router.asus.com:8899`；
2. **梅林后台一键直达**：
   - 访问路由器管理后台 -> 软件中心 -> PatchCat -> 点击【打开 PatchCat 画布】直达全屏；
3. **远程外网访问（按需选用）**：
   - 方式 A：通过 Tailscale / ZeroTier 虚拟局域网 IP 直连访问；
   - 方式 B：通过华硕 DDNS (`xxx.asuscomm.com:8899`) 直连访问（需在后台勾选开启 WAN 端口放行）。

---

## 4. 关键限制与安全规约（核心警示）

### 4.1 闪存防写穿警告 (Flash Wear-out Warning)

> [!CAUTION] 
> **闪存寿命保护强规约 (Flash Lifetime Protection)**
> 
> 1. **物理限制**：路由器内置 NAND Flash 擦写寿命极为宝贵，且 `/jffs` 空间极其狭小。PatchCat 具备**自动草稿保护（Shadow Draft）**与实时运行状态记录机制，如果将数据库频繁写入内置 `/jffs` 分区，极短时间内就会加剧闪存磨损，严重时会导致固件损坏甚至硬件变砖。
> 2. **工程默认值规约**：
>    - 编译与运行时配置中，`storage.enabled` **必须无条件默认为 `false`**；
>    - 默认状态下，所有工作流保存与执行日志**100% 保存在客户端各自浏览器的 LocalStorage / IndexedDB**中。路由器仅作为只读静态分发和纯内存网络代理，**磁盘写入量恒为 0 字节**。
> 3. **UI 强交互警告**：
>    - 在梅林 Web 配置界面（`Module_patchcat.asp`）与 PatchCat 前端存储设置界面中，一旦用户尝试勾选“启用集中存储”，必须弹出强警示对话框：
>      > ⚠️ **闪存寿命警告**：频繁的工作流自动保存会持续向路由器闪存写入数据。强烈建议插入 USB 移动硬盘/U盘，并将存储路径指定到外挂分区（如 `/tmp/mnt/sda1/...`），严禁长期直接保存在内置 `/jffs` 分区！

### 4.2 内存与进程守护限制
- Go Gateway 必须严格控制依赖，禁止引入重型三方库，基准空闲驻留内存须维持在 **5MB 以内**；
- 当检测到路由器总可用内存低于 50MB 时，代理服务应拒绝新建耗费内存的长链接，防止触发系统 OOM 重启。

### 4.3 网络安全与鉴权
- 代理接口 `/api/proxy` 仅允许转发合规的公网 AI 接口及局域网 Ollama 服务，防范 SSRF 内网漫游漏洞；
- 若用户开启公网 WAN 访问，前端界面或 Gateway 需提供基础的访问密钥（Token / Basic Auth）验证机制，避免接口被公网扫描滥用。

---

## 5. 实现阶段与演进规划

### 阶段一：前端构建适配与相对路径兼容 (Phase 1)
- 检查并修正 `index.html` 中的绝对路径引用（如 favicon、全局资源等）；
- 验证 `VITE_BASE_PATH=./` 打包后在不同子路径与本地文件系统下的无损运行。

### 阶段二：Go 轻量 Gateway 原型与编译脚本 (Phase 2)
- 编写 `gateway/main.go`：实现静态资源托管（嵌入或静态分发）与 `/api/proxy` 流式代理；
- 编写 `scripts/build-target.mjs`，增加 `--target=merlin` 编译开关，跑通针对 `linux/arm64` 的交叉编译。

### 阶段三：梅林插件规范封装与脚本编写 (Phase 3)
- 编写 `webs/Module_patchcat.asp` 后台管理配置页（含闪存防写穿警告、端口配置、一键跳转按钮）；
- 编写梅林安装、卸载、启动、停止四个标准 Shell 脚本，打通 `dbus` 与配置文件的双向同步；
- 输出标准 `.tar.gz` 离线安装包。

### 阶段四：真机部署与极限验证 (Phase 4 - AX86U 验证)
- 在华硕 RT-AX86U (ARM64) 梅林固件真机上进行“离线安装包”上传安装测试；
- 验证局域网多设备打开画布速度、端口自定义生效情况；
- 验证通过路由器 `/api/proxy` 代理调用外部大模型（OpenAI/Claude 等）的 SSE 流式响应稳定性；
- 验证内存常驻指标（确保 < 10MB）与零闪存写入表现。
