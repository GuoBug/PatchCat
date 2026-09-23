package main

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIsPrivateOrReservedIP(t *testing.T) {
	testCases := []struct {
		ip       string
		expected bool
	}{
		// Private / reserved / loopback / link-local
		{"127.0.0.1", true},
		{"127.0.0.2", true},
		{"::1", true},
		{"10.0.0.1", true},
		{"10.254.254.254", true},
		{"172.16.0.1", true},
		{"172.31.255.255", true},
		{"192.168.1.1", true},
		{"192.168.50.1", true},
		{"169.254.169.254", true}, // Cloud metadata
		{"169.254.0.1", true},     // Link-local
		{"0.0.0.0", true},
		{"224.0.0.1", true},       // Multicast
		{"255.255.255.255", true}, // Broadcast

		// Public non-reserved IPs
		{"8.8.8.8", false},
		{"1.1.1.1", false},
		{"142.250.190.46", false}, // Google
	}

	for _, tc := range testCases {
		ip := net.ParseIP(tc.ip)
		if ip == nil {
			t.Fatalf("Failed to parse IP: %s", tc.ip)
		}
		result := isPrivateOrReservedIP(ip)
		if result != tc.expected {
			t.Errorf("isPrivateOrReservedIP(%s) = %v; expected %v", tc.ip, result, tc.expected)
		}
	}
}

func TestIsAllowedTargetURL(t *testing.T) {
	testCases := []struct {
		url       string
		shouldErr bool
		errMsg    string
	}{
		// Valid whitelisted providers
		{"https://api.openai.com/v1/chat/completions", false, ""},
		{"https://generativelanguage.googleapis.com/v1beta/models", false, ""},
		{"https://api.deepseek.com/v1/chat/completions", false, ""},
		{"https://api.siliconflow.cn/v1/chat/completions", false, ""},
		{"https://api.anthropic.com/v1/messages", false, ""},
		{"https://openrouter.ai/api/v1/chat/completions", false, ""},

		// Blocked private IPs and SSRF targets
		{"http://192.168.1.1/admin", true, "strictly forbidden"},
		{"http://127.0.0.1:8899/api/proxy", true, "strictly forbidden"},
		{"http://169.254.169.254/latest/meta-data/", true, "strictly forbidden"},
		{"http://localhost:8080/secret", true, "strictly forbidden"},
		{"http://router.local/", true, "strictly forbidden"},

		// Blocked unlisted external domains (prevent open forward proxy)
		{"https://attacker.evil.com/steal-key", true, "not in the allowed"},
		{"https://example.com/api", true, "not in the allowed"},

		// Invalid schemes
		{"file:///etc/passwd", true, "only http and https"},
		{"javascript:alert(1)", true, "only http and https"},
		{"ftp://ftp.example.com", true, "only http and https"},
		{"", true, "missing target URL"},
	}

	for _, tc := range testCases {
		_, err := isAllowedTargetURL(tc.url, []string{"custom-ai.company.org"})
		if tc.shouldErr && err == nil {
			t.Errorf("isAllowedTargetURL(%q) should have failed, but passed", tc.url)
		}
		if !tc.shouldErr && err != nil {
			t.Errorf("isAllowedTargetURL(%q) failed unexpectedly: %v", tc.url, err)
		}
		if tc.shouldErr && err != nil && tc.errMsg != "" {
			if !strings.Contains(err.Error(), tc.errMsg) {
				t.Errorf("isAllowedTargetURL(%q) error %q does not contain expected %q", tc.url, err.Error(), tc.errMsg)
			}
		}
	}

	// Verify custom allowed domain
	parsedCustom, err := isAllowedTargetURL("https://custom-ai.company.org/v1/chat", []string{"custom-ai.company.org"})
	if err != nil {
		t.Fatalf("custom allowed domain failed: %v", err)
	}
	if parsedCustom.Host != "custom-ai.company.org" {
		t.Errorf("custom allowed domain host mismatch: %s", parsedCustom.Host)
	}
}

func TestIsAllowedOrigin(t *testing.T) {
	testCases := []struct {
		origin   string
		expected bool
	}{
		// Allowed loopback and router LAN
		{"http://localhost:3000", true},
		{"http://localhost:8899", true},
		{"http://127.0.0.1:8899", true},
		{"http://192.168.50.1:8899", true},
		{"http://192.168.1.100:8899", true},
		{"http://router.asus.com:8899", true},
		{"https://myrouter.asuscomm.com:8899", true},

		// Disallowed remote origins
		{"https://malicious-site.com", false},
		{"https://evil-attacker.io", false},
		{"http://phishing.example.com", false},
		{"", false},
	}

	for _, tc := range testCases {
		res := isAllowedOrigin(tc.origin, []string{"https://my-custom-domain.org"})
		if res != tc.expected {
			t.Errorf("isAllowedOrigin(%q) = %v; expected %v", tc.origin, res, tc.expected)
		}
	}

	// Custom origin check
	if !isAllowedOrigin("https://my-custom-domain.org", []string{"https://my-custom-domain.org"}) {
		t.Errorf("isAllowedOrigin custom domain should be allowed")
	}
}

func TestCorsMiddleware(t *testing.T) {
	handler := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	// Case 1: Allowed origin gets Access-Control-Allow-Origin header matching its origin
	reqAllowed := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	reqAllowed.Header.Set("Origin", "http://localhost:8899")
	recAllowed := httptest.NewRecorder()
	handler.ServeHTTP(recAllowed, reqAllowed)

	if recAllowed.Header().Get("Access-Control-Allow-Origin") != "http://localhost:8899" {
		t.Errorf("Expected CORS header for allowed origin, got: %q", recAllowed.Header().Get("Access-Control-Allow-Origin"))
	}
	if recAllowed.Header().Get("Access-Control-Allow-Origin") == "*" {
		t.Errorf("CORS should never return wildcard *")
	}

	// Case 2: Disallowed origin does NOT receive Access-Control-Allow-Origin
	reqDisallowed := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	reqDisallowed.Header.Set("Origin", "https://evil.com")
	recDisallowed := httptest.NewRecorder()
	handler.ServeHTTP(recDisallowed, reqDisallowed)

	if recDisallowed.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("Disallowed origin must NOT receive Access-Control-Allow-Origin header")
	}

	// Case 3: Disallowed origin OPTIONS preflight returns 403 Forbidden
	reqOptions := httptest.NewRequest(http.MethodOptions, "/api/proxy", nil)
	reqOptions.Header.Set("Origin", "https://evil.com")
	recOptions := httptest.NewRecorder()
	handler.ServeHTTP(recOptions, reqOptions)

	if recOptions.Code != http.StatusForbidden {
		t.Errorf("OPTIONS from disallowed origin expected 403, got %d", recOptions.Code)
	}
}

func TestHealthEndpoint(t *testing.T) {
	config = defaultConfig()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	rec := httptest.NewRecorder()

	handleHealth(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Health check returned status %d, expected 200", rec.Code)
	}

	var status map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatalf("Failed to parse health response: %v", err)
	}

	if status["status"] != "ok" {
		t.Errorf("Expected status 'ok', got %v", status["status"])
	}
	if status["service"] != AppName {
		t.Errorf("Expected service %q, got %v", AppName, status["service"])
	}
}

func TestProxySSRFSafety(t *testing.T) {
	config = defaultConfig()

	// Test SSRF attempt to internal router address
	req := httptest.NewRequest(http.MethodPost, "/api/proxy", strings.NewReader(`{"messages":[]}`))
	req.Header.Set("X-Target-URL", "http://192.168.1.1/api/token")
	req.Header.Set("Authorization", "Bearer sensitive-secret-key")
	rec := httptest.NewRecorder()

	handleProxy(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("SSRF to private IP expected 403 Forbidden, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Target URL blocked") {
		t.Errorf("Expected blocking message in body, got: %s", rec.Body.String())
	}
}
