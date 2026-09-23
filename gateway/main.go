package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// Version constants
const (
	AppVersion = "0.4.8-merlin"
	AppName    = "PatchCat-Merlin-Gateway"
)

// Default whitelist of authorized upstream AI service domains
var defaultAllowedDomains = []string{
	"generativelanguage.googleapis.com",
	"api.openai.com",
	"api.anthropic.com",
	"api.deepseek.com",
	"api.siliconflow.cn",
	"api.groq.com",
	"openrouter.ai",
	"api.mistral.ai",
	"api.cohere.com",
	"api.together.xyz",
	"api.minimax.chat",
	"api.moonshot.cn",
	"dashscope.aliyuncs.com",
}

// Config defines the configuration schema for the gateway.
type Config struct {
	Server struct {
		Host           string   `json:"host"`
		Port           int      `json:"port"`
		AllowedOrigins []string `json:"allowed_origins"`
	} `json:"server"`
	Proxy struct {
		Enabled        bool     `json:"enabled"`
		TimeoutSeconds int      `json:"timeout_seconds"`
		AllowedDomains []string `json:"allowed_domains"`
	} `json:"proxy"`
	Storage struct {
		Enabled bool   `json:"enabled"`
		DBPath  string `json:"db_path"`
	} `json:"storage"`
	StaticDir string `json:"static_dir"`
}

var (
	configFile string
	config     Config
)

// defaultConfig returns the safe defaults.
// Notice that storage.enabled is STRICTLY false by default to protect router NAND flash.
func defaultConfig() Config {
	var c Config
	c.Server.Host = "0.0.0.0"
	c.Server.Port = 8899
	c.Server.AllowedOrigins = []string{}
	c.Proxy.Enabled = true
	c.Proxy.TimeoutSeconds = 180
	c.Proxy.AllowedDomains = []string{}
	c.Storage.Enabled = false // Strictly false by default
	c.Storage.DBPath = "/tmp/mnt/sda1/patchcat/data.db"
	c.StaticDir = "./dist"
	return c
}

// loadConfig reads config file or creates default one if missing.
func loadConfig(path string) error {
	config = defaultConfig()

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		// Ensure directory exists
		if dir := filepath.Dir(path); dir != "." && dir != "/" {
			_ = os.MkdirAll(dir, 0755)
		}
		// Write default config
		indentData, _ := json.MarshalIndent(config, "", "  ")
		_ = os.WriteFile(path, indentData, 0644)
		log.Printf("[Config] 配置文件未找到，已自动初始化安全默认配置至: %s", path)
		return nil
	} else if err != nil {
		return fmt.Errorf("读取配置文件失败: %w", err)
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("解析配置文件 JSON 失败: %w", err)
	}

	// Double check storage safety
	if config.Storage.Enabled && strings.HasPrefix(config.Storage.DBPath, "/jffs") {
		log.Printf("[Flash Warning] ⚠️ 警告: 集中存储已启用且指向 /jffs 分区 (%s)，强烈建议改至 USB 外置分区以保护闪存寿命！", config.Storage.DBPath)
	}

	return nil
}

// isPrivateOrReservedIP checks if an IP belongs to private, loopback, link-local, or cloud metadata ranges.
func isPrivateOrReservedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return true
	}

	if ip4 := ip.To4(); ip4 != nil {
		if ip4[0] == 10 {
			return true
		}
		if ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31 {
			return true
		}
		if ip4[0] == 192 && ip4[1] == 168 {
			return true
		}
		if ip4[0] == 169 && ip4[1] == 254 {
			return true
		}
		if ip4[0] == 0 {
			return true
		}
		if ip4[0] >= 224 {
			return true
		}
	} else {
		// IPv6 unique local addresses (fc00::/7)
		if len(ip) == 16 && (ip[0]&0xfe) == 0xfc {
			return true
		}
	}
	return false
}

// isAllowedTargetURL validates that targetURL is an http/https URL pointing to a whitelisted AI domain and NOT a private IP.
func isAllowedTargetURL(rawURL string, extraAllowedDomains []string) (*url.URL, error) {
	if strings.TrimSpace(rawURL) == "" {
		return nil, fmt.Errorf("missing target URL")
	}

	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return nil, fmt.Errorf("invalid URL format: %w", err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return nil, fmt.Errorf("invalid scheme '%s': only http and https are permitted", parsed.Scheme)
	}

	hostname := parsed.Hostname()
	if hostname == "" {
		return nil, fmt.Errorf("missing host in target URL")
	}

	lowerHost := strings.ToLower(hostname)
	if lowerHost == "localhost" || strings.HasSuffix(lowerHost, ".local") || strings.HasSuffix(lowerHost, ".internal") {
		return nil, fmt.Errorf("access to internal/local host '%s' is strictly forbidden", hostname)
	}

	// Check if hostname is an IP directly
	if ip := net.ParseIP(hostname); ip != nil {
		if isPrivateOrReservedIP(ip) {
			return nil, fmt.Errorf("access to private/reserved IP '%s' is strictly forbidden (SSRF protection)", hostname)
		}
	}

	// Check domain against allowed whitelist
	allAllowed := append([]string{}, defaultAllowedDomains...)
	allAllowed = append(allAllowed, extraAllowedDomains...)

	matched := false
	for _, domain := range allAllowed {
		cleanDomain := strings.ToLower(strings.TrimSpace(domain))
		if cleanDomain == "" {
			continue
		}
		if lowerHost == cleanDomain || strings.HasSuffix(lowerHost, "."+cleanDomain) {
			matched = true
			break
		}
	}

	if !matched {
		return nil, fmt.Errorf("target host '%s' is not in the allowed upstream AI provider whitelist", hostname)
	}

	return parsed, nil
}

// isAllowedOrigin checks if the origin is safe to allow CORS.
func isAllowedOrigin(origin string, extraAllowedOrigins []string) bool {
	if origin == "" {
		return false
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())

	// Loopback / localhost
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}

	// Standard router LAN subnets & ASUS router names
	if strings.HasPrefix(host, "192.168.") || strings.HasPrefix(host, "10.") || host == "router.asus.com" || strings.HasSuffix(host, ".asuscomm.com") {
		return true
	}
	if strings.HasPrefix(host, "172.") {
		parts := strings.Split(host, ".")
		if len(parts) >= 2 {
			var secondOctet int
			if _, err := fmt.Sscanf(parts[1], "%d", &secondOctet); err == nil && secondOctet >= 16 && secondOctet <= 31 {
				return true
			}
		}
	}

	// User-configured extra origins
	for _, allowed := range extraAllowedOrigins {
		allowed = strings.TrimSpace(allowed)
		if allowed == "" {
			continue
		}
		if strings.EqualFold(origin, allowed) {
			return true
		}
		if parsedAllowed, err := url.Parse(allowed); err == nil {
			if strings.EqualFold(host, strings.ToLower(parsedAllowed.Hostname())) {
				return true
			}
		}
	}

	return false
}

// corsMiddleware injects explicit, origin-checked CORS headers (rejects wildcard *).
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := isAllowedOrigin(origin, config.Server.AllowedOrigins)

		// Set CORS headers only when Origin is present AND explicitly permitted
		if origin != "" && allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Target-URL, X-Goog-Api-Key, Accept")
			w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type")
			w.Header().Set("Vary", "Origin")
		}

		if r.Method == http.MethodOptions {
			if origin != "" && !allowed {
				http.Error(w, `{"error": "Forbidden: CORS origin not allowed"}`, http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// handleHealth returns basic gateway status and diagnostics.
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	status := map[string]interface{}{
		"status":          "ok",
		"service":         AppName,
		"version":         AppVersion,
		"proxy_enabled":   config.Proxy.Enabled,
		"storage_enabled": config.Storage.Enabled,
		"timestamp":       time.Now().Unix(),
	}
	_ = json.NewEncoder(w).Encode(status)
}

// handleProxy forwards LLM chat completion requests to upstream LLM APIs with strict SSRF & header filtering.
func handleProxy(w http.ResponseWriter, r *http.Request) {
	if !config.Proxy.Enabled {
		http.Error(w, `{"error": "Proxy is disabled in gateway configuration"}`, http.StatusForbidden)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "Method not allowed, use POST"}`, http.StatusMethodNotAllowed)
		return
	}

	// 1. Resolve Target Upstream URL
	targetURL := r.Header.Get("X-Target-URL")
	if targetURL == "" {
		targetURL = r.URL.Query().Get("target_url")
	}

	if targetURL == "" {
		http.Error(w, `{"error": "Missing X-Target-URL header or target_url query parameter"}`, http.StatusBadRequest)
		return
	}

	// Strict SSRF and Whitelist validation
	targetParsed, err := isAllowedTargetURL(targetURL, config.Proxy.AllowedDomains)
	if err != nil {
		log.Printf("[Security Warning] 🛑 SSRF/Target blocked: %v (Remote: %s)", err, r.RemoteAddr)
		http.Error(w, fmt.Sprintf(`{"error": "Target URL blocked by security policy: %v"}`, err), http.StatusForbidden)
		return
	}

	// 2. Read incoming request body (Max 10MB to avoid memory exhaustion DoS)
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Failed to read request body or exceeded 10MB limit: %v"}`, err), http.StatusRequestEntityTooLarge)
		return
	}
	_ = r.Body.Close()

	// 3. Construct upstream request with timeout context
	timeout := time.Duration(config.Proxy.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 180 * time.Second
	}
	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetParsed.String(), bytes.NewReader(bodyBytes))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Failed to create upstream request: %v"}`, err), http.StatusInternalServerError)
		return
	}

	// Whitelisted safe headers only — prevents arbitrary/dangerous header forwarding
	allowedHeaders := map[string]bool{
		"authorization":   true,
		"x-goog-api-key":  true,
		"content-type":    true,
		"accept":          true,
		"user-agent":      true,
		"accept-encoding": true,
	}

	for k, v := range r.Header {
		lowerK := strings.ToLower(k)
		if !allowedHeaders[lowerK] {
			continue
		}
		for _, val := range v {
			req.Header.Add(k, val)
		}
	}

	// Ensure Host header matches upstream destination
	req.Host = targetParsed.Host

	// 4. Send request via HTTP Client
	client := &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Disallow redirects to prevent open-redirect SSRF bypasses
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Upstream connection error: %v"}`, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// 5. Copy upstream headers to client
	for k, v := range resp.Header {
		for _, val := range v {
			w.Header().Add(k, val)
		}
	}
	w.WriteHeader(resp.StatusCode)

	// 6. Stream response with immediate flushes (crucial for SSE stream)
	flusher, isFlusher := w.(http.Flusher)
	buf := make([]byte, 4096)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			_, writeErr := w.Write(buf[:n])
			if writeErr != nil {
				break
			}
			if isFlusher {
				flusher.Flush()
			}
		}
		if readErr != nil {
			break
		}
	}
}

// spaFileServer serves static files or falls back to index.html for SPA routing.
func spaFileServer(staticDir string) http.Handler {
	fs := http.Dir(staticDir)
	fileServer := http.FileServer(fs)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := filepath.Clean(r.URL.Path)
		filePath := filepath.Join(staticDir, cleanPath)

		// Check if the requested file exists
		info, err := os.Stat(filePath)
		if err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fall back to index.html for SPA routes
		indexPath := filepath.Join(staticDir, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			http.ServeFile(w, r, indexPath)
			return
		}

		http.NotFound(w, r)
	})
}

func main() {
	flag.StringVar(&configFile, "config", "/jffs/configs/patchcat/config.json", "Path to config.json file")
	flag.IntVar(&config.Server.Port, "port", 0, "Override server port")
	flag.StringVar(&config.StaticDir, "static", "", "Override static web directory")
	flag.Parse()

	// Try local path if running in dev mode
	if _, err := os.Stat(configFile); os.IsNotExist(err) && !strings.HasPrefix(configFile, "/jffs") {
		if _, errLocal := os.Stat("config.json"); errLocal == nil {
			configFile = "config.json"
		}
	}

	if err := loadConfig(configFile); err != nil {
		log.Fatalf("[FATAL] 加载配置失败: %v", err)
	}

	// Allow command-line overrides
	if flag.Lookup("port").Value.String() != "0" {
		var overridePort int
		fmt.Sscanf(flag.Lookup("port").Value.String(), "%d", &overridePort)
		if overridePort > 0 {
			config.Server.Port = overridePort
		}
	}
	if config.StaticDir == "" || config.StaticDir == "./dist" {
		// Detect router default static path
		if _, err := os.Stat("/jffs/koolshare/patchcat/dist"); err == nil {
			config.StaticDir = "/jffs/koolshare/patchcat/dist"
		} else {
			config.StaticDir = "./dist"
		}
	}

	mux := http.NewServeMux()

	// API Endpoints
	mux.HandleFunc("/api/v1/health", handleHealth)
	mux.HandleFunc("/api/proxy", handleProxy)
	mux.HandleFunc("/api/proxy/v1/chat/completions", handleProxy)

	// Workflows placeholder for storage warning
	mux.HandleFunc("/api/v1/workflows", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !config.Storage.Enabled {
			w.WriteHeader(http.StatusNotImplemented)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"detail": "路由器集中持久化已关闭（保护闪存模式）。请在前端设置中使用 LocalStorage 本地存储模式。",
			})
			return
		}
		// Future embedded sqlite handler here
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode([]interface{}{})
	})

	// Static Web Server
	mux.Handle("/", spaFileServer(config.StaticDir))

	listenAddr := fmt.Sprintf("%s:%d", config.Server.Host, config.Server.Port)
	server := &http.Server{
		Addr:         listenAddr,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: time.Duration(config.Proxy.TimeoutSeconds+10) * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown handling
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("==========================================================")
		log.Printf(" 🐱 %s %s 启动成功！", AppName, AppVersion)
		log.Printf(" 👉 监听地址: http://%s", listenAddr)
		log.Printf(" 👉 静态目录: %s", config.StaticDir)
		log.Printf(" 👉 流式代理: %v (/api/proxy)", config.Proxy.Enabled)
		log.Printf(" 👉 集中存储: %v (默认关闭以保护路由器闪存)", config.Storage.Enabled)
		log.Printf("==========================================================")

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] 服务异常终止: %v", err)
		}
	}()

	<-stopChan
	log.Printf("[INFO] 正在安全优雅关闭 PatchCat Gateway...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	log.Printf("[INFO] 服务已完全退出。")
}
