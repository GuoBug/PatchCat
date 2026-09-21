<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="X-UA-Compatible" content="IE=Edge"/>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta HTTP-EQUIV="Pragma" CONTENT="no-cache"/>
<meta HTTP-EQUIV="Expires" CONTENT="-1"/>
<link rel="shortcut icon" href="images/favicon.png"/>
<link rel="icon" href="images/favicon.png"/>
<title>软件中心 - PatchCat AI 编排网关</title>
<link rel="stylesheet" type="text/css" href="index_style.css"/>
<link rel="stylesheet" type="text/css" href="form_style.css"/>
<style type="text/css">
  body {
    background-color: #21272d !important;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .patchcat-container {
    width: 760px;
    margin: 20px auto;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }
  .patchcat-header {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    padding: 18px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #334155;
  }
  .patchcat-title {
    font-size: 18px;
    font-weight: 700;
    color: #f8fafc;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .patchcat-body {
    padding: 24px;
  }
  .patchcat-hero-card {
    background: #1e293b;
    border-radius: 10px;
    padding: 20px;
    margin-bottom: 24px;
    border: 1px solid #334155;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .btn-open-canvas {
    display: inline-block;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #ffffff !important;
    font-size: 16px;
    font-weight: bold;
    padding: 12px 28px;
    border-radius: 8px;
    text-decoration: none;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    transition: all 0.2s ease;
    cursor: pointer;
    border: none;
    white-space: nowrap;
  }
  .btn-open-canvas:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
    transform: translateY(-1px);
  }
  .btn-return {
    background: #334155;
    color: #cbd5e1 !important;
    font-size: 13px;
    padding: 6px 14px;
    border-radius: 6px;
    text-decoration: none;
    border: 1px solid #475569;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .btn-return:hover {
    background: #475569;
    color: #fff !important;
  }
  .form-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  .form-table th {
    width: 220px;
    padding: 14px;
    text-align: left;
    font-weight: 600;
    color: #94a3b8;
    background: #182234;
    border-bottom: 1px solid #283548;
    font-size: 13px;
  }
  .form-table td {
    padding: 14px;
    background: #111827;
    border-bottom: 1px solid #1f2937;
    font-size: 13px;
    color: #e2e8f0;
  }
  .flash-warning-box {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid #ef4444;
    color: #fca5a5;
    padding: 12px;
    border-radius: 8px;
    margin-top: 10px;
    font-size: 12px;
    line-height: 1.6;
    display: none;
  }
  .input-text {
    background: #1e293b;
    border: 1px solid #475569;
    color: #fff;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 13px;
  }
  .btn-apply {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: #fff;
    font-size: 14px;
    font-weight: bold;
    padding: 10px 32px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  }
  .btn-apply:hover {
    background: #1d4ed8;
  }
</style>
<script type="text/javascript" src="/js/jquery.js"></script>
<script type="text/javascript">
function return_softcenter() {
    if (window.history && window.history.length > 1) {
        window.history.back();
    } else {
        location.href = "/Module_Softcenter.asp";
    }
}

function open_canvas() {
    var host = window.location.hostname;
    var port = "8899";
    try {
        var p = document.getElementById("patchcat_port");
        if (p && p.value) port = p.value;
    } catch(e) {}

    var url = "http://" + host + ":" + port;
    window.open(url, "_blank");
}

function on_storage_change() {
    var cb = document.getElementById("patchcat_storage_enable");
    var tr = document.getElementById("storage_path_tr");
    var warn = document.getElementById("flash_warning");
    if (!cb) return;

    if (cb.checked) {
        var ok = confirm("⚠️【闪存防写穿警告】\n\n开启集中存储后，自动保存会直接向路由器闪存写入数据。\n若直接保存在 /jffs 分区，将极大加速内置闪存磨损！\n\n强烈建议配置到外接 USB 存储（如 /tmp/mnt/sda1/...）。\n\n是否确认开启？");
        if (!ok) {
            cb.checked = false;
            if (tr) tr.style.display = "none";
            if (warn) warn.style.display = "none";
            return;
        }
        if (tr) tr.style.display = "";
        if (warn) warn.style.display = "block";
    } else {
        if (tr) tr.style.display = "none";
        if (warn) warn.style.display = "none";
    }
}

function apply_rule() {
    var form = document.getElementById("patchcat_form");
    if (!form) return;

    var port = document.getElementById("patchcat_port").value;
    if (!port || isNaN(port) || port < 1024 || port > 65535) {
        alert("端口必须在 1024 到 65535 之间！");
        return;
    }

    // 提交到华硕梅林原生 applydb.cgi
    try {
        document.getElementById("action_mode").value = ' Apply ';
        document.getElementById("SystemCmd").value = "patchcat_config.sh";
        form.submit();
    } catch(e) {
        console.error("Form submit error:", e);
    }

    // 异步兼容调用
    var enableVal = document.getElementById("rb_enable_1").checked ? "1" : "0";
    var wanVal = document.getElementById("patchcat_wan").checked ? "1" : "0";
    var storVal = document.getElementById("patchcat_storage_enable").checked ? "1" : "0";
    var storPath = document.getElementById("patchcat_storage_path").value;

    var postData = {
        "patchcat_enable": enableVal,
        "patchcat_port": port,
        "patchcat_wan": wanVal,
        "patchcat_storage_enable": storVal,
        "patchcat_storage_path": storPath
    };

    try {
        $.ajax({
            type: "POST",
            url: "/_api/patchcat",
            data: JSON.stringify({"id": parseInt(Math.random() * 100000000), "method": "patchcat_config.sh", "params": [postData], "fields": postData}),
            dataType: "json"
        });
    } catch(err) {}

    alert("设置已保存并提交路由器处理！\n网关将在后台同步更新。");
}

// 页面加载完成后安全初始化
window.onload = function() {
    // 异步获取并回填参数（兼容模式）
    try {
        $.ajax({
            type: "GET",
            url: "/_api/patchcat",
            dataType: "json",
            success: function(data) {
                if (data && data.result && data.result[0]) {
                    var conf = data.result[0];
                    if (conf.patchcat_enable === "1") {
                        document.getElementById("rb_enable_1").checked = true;
                    } else {
                        document.getElementById("rb_enable_0").checked = true;
                    }
                    if (conf.patchcat_port) document.getElementById("patchcat_port").value = conf.patchcat_port;
                    if (conf.patchcat_wan === "1") document.getElementById("patchcat_wan").checked = true;
                    if (conf.patchcat_storage_enable === "1") {
                        document.getElementById("patchcat_storage_enable").checked = true;
                        on_storage_change();
                    }
                    if (conf.patchcat_storage_path) document.getElementById("patchcat_storage_path").value = conf.patchcat_storage_path;
                }
            }
        });
    } catch(e) {}
};
</script>
</head>
<body>
<iframe name="hidden_frame" id="hidden_frame" style="display:none;" width="0" height="0"></iframe>

<div class="patchcat-container">
    <!-- 头部导航 -->
    <div class="patchcat-header">
        <div class="patchcat-title">
            <span style="font-size:24px;">🐱</span>
            <span>PatchCat AI 编排网关</span>
            <span style="font-size:11px; background:#1e293b; color:#10b981; padding:2px 8px; border-radius:12px; border:1px solid #334155;">v0.4.7 for AX86U</span>
        </div>
        <div>
            <button type="button" class="btn-return" onclick="return_softcenter();">⬅ 返回软件中心</button>
        </div>
    </div>

    <!-- 主体区域 -->
    <div class="patchcat-body">
        <!-- 核心直达卡片 -->
        <div class="patchcat-hero-card">
            <div style="padding-right: 20px;">
                <div style="font-size:18px; font-weight:700; color:#fff; margin-bottom:8px;">
                    ✨ PatchCat Web 画布已就绪
                </div>
                <div style="font-size:13px; color:#94a3b8; line-height:1.6;">
                    工业级 Prompt 拓扑流编排平台。核心执行引擎与 DAG 画布完全运行在客户端浏览器中。<br/>
                    • <b>局域网访问地址</b>：<a href="javascript:void(0);" onclick="open_canvas();" style="color:#10b981; font-weight:bold; text-decoration:underline;">http://&lt;路由器IP&gt;:8899</a><br/>
                    • <b>路由器网关核心</b>：已集成轻量反向代理，可借助路由器网络环境直接加速调用全球大模型。
                </div>
            </div>
            <div>
                <button type="button" class="btn-open-canvas" onclick="open_canvas();">🚀 打开 PatchCat 画布</button>
            </div>
        </div>

        <!-- 配置表单 -->
        <form id="patchcat_form" name="form" method="POST" action="/applydb.cgi?p=patchcat_" target="hidden_frame">
            <input type="hidden" name="action_mode" id="action_mode" value=" Apply "/>
            <input type="hidden" name="SystemCmd" id="SystemCmd" value="patchcat_config.sh"/>

            <table class="form-table">
                <tr>
                    <th>开启 PatchCat 网关</th>
                    <td>
                        <label style="margin-right:16px; cursor:pointer;"><input type="radio" name="patchcat_enable" id="rb_enable_1" value="1" checked="checked"/> 开启</label>
                        <label style="cursor:pointer;"><input type="radio" name="patchcat_enable" id="rb_enable_0" value="0"/> 关闭</label>
                    </td>
                </tr>
                <tr>
                    <th>独立访问端口</th>
                    <td>
                        <input type="text" maxlength="5" class="input-text" style="width:100px;" name="patchcat_port" id="patchcat_port" value="8899" />
                        <span style="color:#64748b; margin-left:10px;">默认 8899。在局域网输入 http://&lt;路由器IP&gt;:8899 访问</span>
                    </td>
                </tr>
                <tr>
                    <th>公网 WAN 访问</th>
                    <td>
                        <label style="cursor:pointer;"><input type="checkbox" name="patchcat_wan" id="patchcat_wan" value="1" /> 允许外网直接访问（自动在 iptables 放行该端口）</label>
                    </td>
                </tr>
                <tr>
                    <th>路由器持久化存储</th>
                    <td>
                        <label style="cursor:pointer;"><input type="checkbox" name="patchcat_storage_enable" id="patchcat_storage_enable" value="1" onchange="on_storage_change();" /> 启用集中存储（多设备跨端同步，默认关闭以保护闪存）</label>
                        <div id="flash_warning" class="flash-warning-box">
                            <strong>⚠️ 闪存寿命与防写穿警告：</strong><br/>
                            默认关闭状态下，所有工作流编辑与自动草稿仅保存在客户端浏览器，路由器<b>零磁盘写入</b>。<br/>
                            若勾选此项，请务必将路径配置到外挂 USB 存储（如 <code>/tmp/mnt/sda1/...</code>），<b>严禁直接保存在内置 /jffs 分区</b>！
                        </div>
                    </td>
                </tr>
                <tr id="storage_path_tr" style="display:none;">
                    <th>SQLite 数据库路径</th>
                    <td>
                        <input type="text" class="input-text" style="width:320px;" name="patchcat_storage_path" id="patchcat_storage_path" value="/tmp/mnt/sda1/patchcat/data.db" />
                    </td>
                </tr>
            </table>

            <div style="text-align:center; margin-top:20px;">
                <button type="button" class="btn-apply" onclick="apply_rule();">应用本页面设置</button>
            </div>
        </form>

        <div style="margin-top:24px; padding-top:16px; border-top:1px solid #1f2937; color:#64748b; font-size:12px; line-height:1.6;">
            • <b>纯前端离线编排</b>：PatchCat 核心数据与 DAG 图编排 100% 本地运行，路由器不承担任何复杂计算。<br/>
            • <b>开源项目主页</b>：<a href="https://github.com/GuoBug/PatchCat" target="_blank" style="color:#38bdf8;">https://github.com/GuoBug/PatchCat</a>
        </div>
    </div>
</div>
</body>
</html>
