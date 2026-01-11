package utils

import (
	"strings"
)

// ParsedUserAgent contains extracted device/browser info
type ParsedUserAgent struct {
	DeviceType    string // mobile, tablet, desktop
	BrowserFamily string // chrome, safari, firefox, edge, etc.
	OSFamily      string // iOS, Android, Windows, macOS, Linux
}

// ParseUserAgent extracts device and browser information from a user agent string
func ParseUserAgent(userAgent string) *ParsedUserAgent {
	ua := strings.ToLower(userAgent)

	result := &ParsedUserAgent{
		DeviceType:    detectDeviceType(ua),
		BrowserFamily: detectBrowser(ua),
		OSFamily:      detectOS(ua),
	}

	return result
}

// detectDeviceType determines if the device is mobile, tablet, or desktop
func detectDeviceType(ua string) string {
	// Check for tablets first (before mobile, as tablets often contain mobile keywords)
	tabletKeywords := []string{"ipad", "tablet", "playbook", "silk"}
	for _, keyword := range tabletKeywords {
		if strings.Contains(ua, keyword) {
			return "tablet"
		}
	}

	// Check for mobile devices
	mobileKeywords := []string{
		"mobile", "android", "iphone", "ipod", "blackberry",
		"windows phone", "opera mini", "opera mobi", "iemobile",
	}
	for _, keyword := range mobileKeywords {
		if strings.Contains(ua, keyword) {
			// Android without "mobile" is usually a tablet
			if strings.Contains(ua, "android") && !strings.Contains(ua, "mobile") {
				return "tablet"
			}
			return "mobile"
		}
	}

	return "desktop"
}

// detectBrowser identifies the browser family
func detectBrowser(ua string) string {
	// Order matters - check more specific browsers first
	switch {
	case strings.Contains(ua, "edg/") || strings.Contains(ua, "edge/"):
		return "edge"
	case strings.Contains(ua, "opr/") || strings.Contains(ua, "opera"):
		return "opera"
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "chromium"):
		return "chrome"
	case strings.Contains(ua, "chromium"):
		return "chromium"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		return "safari"
	case strings.Contains(ua, "firefox"):
		return "firefox"
	case strings.Contains(ua, "msie") || strings.Contains(ua, "trident"):
		return "ie"
	default:
		return "other"
	}
}

// detectOS identifies the operating system family
func detectOS(ua string) string {
	switch {
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad") || strings.Contains(ua, "ipod"):
		return "iOS"
	case strings.Contains(ua, "android"):
		return "Android"
	case strings.Contains(ua, "windows"):
		return "Windows"
	case strings.Contains(ua, "mac os") || strings.Contains(ua, "macintosh"):
		return "macOS"
	case strings.Contains(ua, "linux"):
		return "Linux"
	case strings.Contains(ua, "cros"):
		return "ChromeOS"
	default:
		return "other"
	}
}
