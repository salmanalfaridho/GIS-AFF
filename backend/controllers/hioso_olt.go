package controllers

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"affnet-backend/config"
	"affnet-backend/models"

	"github.com/gin-gonic/gin"
)

// HiosoOnuItem represents an ONU record extracted from HIOSO OLT
type HiosoOnuItem struct {
	OnuIndex string `json:"onu_index"`
	Name     string `json:"name"`
	Mac      string `json:"mac"`
	Status   string `json:"status"`
	TxPower  string `json:"tx_power"`
	RxPower  string `json:"rx_power"`
	Distance string `json:"distance"`
}

// HiosoOltClient handles connection to remote HIOSO HA7302CST EPON OLT
type HiosoOltClient struct {
	Host     string
	Username string
	Password string
}

func getHiosoClient() *HiosoOltClient {
	host := os.Getenv("HIOSO_OLT_HOST")
	if host == "" {
		host = "fahrizal.ddns.net:9595"
	}
	user := os.Getenv("HIOSO_OLT_USER")
	if user == "" {
		user = "admin"
	}
	pass := os.Getenv("HIOSO_OLT_PASS")
	if pass == "" {
		pass = "kulo05"
	}
	return &HiosoOltClient{
		Host:     host,
		Username: user,
		Password: pass,
	}
}

// fetchPonOnuTable fetches raw ponOnuTable JS array content from a HIOSO page
// e.g. /onuConfigOnuList.asp?oltponno=0/1/1
func (h *HiosoOltClient) fetchPonOnuTable(ponPort string) ([]HiosoOnuItem, error) {
	client := &http.Client{Timeout: 12 * time.Second}
	authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte(h.Username+":"+h.Password))

	url := fmt.Sprintf("http://%s/onuConfigOnuList.asp?oltponno=%s", h.Host, ponPort)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	bodyStr := string(bodyBytes)

	// Extract ponOnuTable array content between new Array( ... );
	// Format per row (13 fields): 'onuId','name','mac','status','...','...','...','...','...','...','txpower','rxpower','distance'
	// Index:                          0         1      2       3     4     5     6     7     8     9      10         11        12
	reTable := regexp.MustCompile(`(?s)var ponOnuTable\s*=\s*new Array\(\s*(.*?)\s*\);`)
	tableMatch := reTable.FindStringSubmatch(bodyStr)
	if len(tableMatch) < 2 {
		return nil, fmt.Errorf("ponOnuTable not found in %s", url)
	}

	tableData := tableMatch[1]

	// Parse individual ONU rows: each field is 'value' separated by commas
	reRow := regexp.MustCompile(`'([^']*)'`)
	allValues := reRow.FindAllStringSubmatch(tableData, -1)

	var onuList []HiosoOnuItem
	const fieldsPerOnu = 13

	if len(allValues) < fieldsPerOnu {
		return onuList, nil
	}

	for i := 0; i+fieldsPerOnu <= len(allValues); i += fieldsPerOnu {
		onuId := allValues[i+0][1]
		name := allValues[i+1][1]
		mac := strings.ToUpper(allValues[i+2][1])
		status := allValues[i+3][1]
		txPower := allValues[i+10][1]
		rxPower := allValues[i+11][1]
		distance := allValues[i+12][1]

		formattedMac := formatMac(normalizeMac(mac))
		if formattedMac == "" {
			formattedMac = mac
		}

		if rxPower == "--" || rxPower == "-inf" || rxPower == "" {
			continue
		}

		onuList = append(onuList, HiosoOnuItem{
			OnuIndex: onuId,
			Name:     name,
			Mac:      formattedMac,
			Status:   status,
			TxPower:  txPower,
			RxPower:  rxPower,
			Distance: distance,
		})
	}

	return onuList, nil
}

// FetchHiosoOnuList connects to HIOSO OLT and fetches all ONUs across all PON ports
func (h *HiosoOltClient) FetchHiosoOnuList() ([]HiosoOnuItem, error) {
	client := &http.Client{Timeout: 12 * time.Second}
	authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte(h.Username+":"+h.Password))

	req, err := http.NewRequest("GET", "http://"+h.Host+"/onuConfigPonList.asp", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gagal terhubung ke HIOSO OLT (%s): %v", h.Host, err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	bodyStr := string(bodyBytes)

	// Parse ponListTable to get all PON port IDs
	rePonList := regexp.MustCompile(`'(0/\d+/\d+)'\s*,\s*'ONU Total=`)
	ponMatches := rePonList.FindAllStringSubmatch(bodyStr, -1)

	ponPorts := []string{}
	for _, m := range ponMatches {
		ponPorts = append(ponPorts, m[1])
	}

	if len(ponPorts) == 0 {
		ponPorts = []string{"0/1/1", "0/1/2"}
	}

	var allOnus []HiosoOnuItem
	var lastErr error

	for _, port := range ponPorts {
		portOnus, err := h.fetchPonOnuTable(port)
		if err != nil {
			lastErr = err
			continue
		}
		allOnus = append(allOnus, portOnus...)
	}

	if len(allOnus) == 0 && lastErr != nil {
		return nil, lastErr
	}

	return allOnus, nil
}

// =====================================================================
// API HANDLER: SYNC REDAMAN DIRECT DARI HIOSO OLT (SMART MATCHING)
// POST or GET /api/hioso-sync
// =====================================================================
func SyncHiosoOltRedaman(c *gin.Context) {
	oltClient := getHiosoClient()
	oltOnus, err := oltClient.FetchHiosoOnuList()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"host":   oltClient.Host,
			"error":  err.Error(),
		})
		return
	}

	// Ambil semua data ONU dari database
	var dbOnus []models.Onu
	if errDB := config.DB.Find(&dbOnus).Error; errDB != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"error":  "Gagal membaca data database ONU",
		})
		return
	}

	var updatedCount int
	updatedDetails := make(map[string]string)

	// SMART MATCHING ENGINE (Multi-Tier)
	for _, dbOnu := range dbOnus {
		var matchedOlt *HiosoOnuItem

		dbMacClean := strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(dbOnu.MacAddress, ":", ""), "-", ""))
		dbCustomerLow := strings.ToLower(strings.TrimSpace(dbOnu.Customer))
		// Ambil username dasar sebelum @ (misal: "rida@kdsr" -> "rida")
		dbUserBase := dbCustomerLow
		if idx := strings.Index(dbCustomerLow, "@"); idx != -1 {
			dbUserBase = dbCustomerLow[:idx]
		}

		for i, oltOnu := range oltOnus {
			oltMacClean := strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(oltOnu.Mac, ":", ""), "-", ""))
			oltNameLow := strings.ToLower(strings.TrimSpace(oltOnu.Name))

			// Tier 1: Exact MAC Match (12 hex digits)
			if dbMacClean != "" && oltMacClean != "" && dbMacClean == oltMacClean {
				matchedOlt = &oltOnus[i]
				break
			}

			// Tier 2: First 5 Octets OUI Match (10 hex digits, e.g. 90869BE75B)
			if len(dbMacClean) >= 10 && len(oltMacClean) >= 10 && dbMacClean[:10] == oltMacClean[:10] {
				matchedOlt = &oltOnus[i]
				break
			}

			// Tier 3: Username Base Match (misal "rida" ada di "rida/kendalsari/...")
			if len(dbUserBase) >= 3 {
				if strings.HasPrefix(oltNameLow, dbUserBase+"/") ||
					strings.HasPrefix(oltNameLow, dbUserBase+" ") ||
					strings.HasPrefix(oltNameLow, dbUserBase+"-") ||
					oltNameLow == dbUserBase ||
					strings.Contains(oltNameLow, "/"+dbUserBase+"/") ||
					strings.Contains(oltNameLow, "/"+dbUserBase) {
					matchedOlt = &oltOnus[i]
					break
				}
			}
		}

		if matchedOlt != nil {
			rxFloat, _ := strconv.ParseFloat(matchedOlt.RxPower, 64)
			status := "Online"
			if matchedOlt.Status == "Down" || matchedOlt.Status == "Offline" {
				status = "Terputus"
			} else if rxFloat <= -26.0 {
				status = "Kritis"
			} else if rxFloat <= -25.0 {
				status = "Warning"
			}

			config.DB.Model(&dbOnu).Updates(map[string]interface{}{
				"rx_power": matchedOlt.RxPower,
				"status":   status,
			})
			updatedCount++
			updatedDetails[dbOnu.Customer] = fmt.Sprintf("Rx: %s dBm (OLT: %s / %s)", matchedOlt.RxPower, matchedOlt.Name, matchedOlt.Mac)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"message":    fmt.Sprintf("Sync Redaman dari HIOSO OLT Selesai: %d ONU berhasil disinkronkan!", updatedCount),
		"host":       oltClient.Host,
		"olt_total":  len(oltOnus),
		"db_total":   len(dbOnus),
		"updated":    updatedCount,
		"details":    updatedDetails,
	})
}

// ExecuteHiosoSyncDirect menjalankan proses sync OLT HIOSO secara langsung (dipanggil oleh API / CRON)
func ExecuteHiosoSyncDirect() (int, error) {
	oltClient := getHiosoClient()
	oltOnus, err := oltClient.FetchHiosoOnuList()
	if err != nil {
		return 0, err
	}

	var dbOnus []models.Onu
	if errDB := config.DB.Find(&dbOnus).Error; errDB != nil {
		return 0, errDB
	}

	var updatedCount int
	for _, dbOnu := range dbOnus {
		var matchedOlt *HiosoOnuItem
		dbMacClean := strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(dbOnu.MacAddress, ":", ""), "-", ""))
		dbCustomerLow := strings.ToLower(strings.TrimSpace(dbOnu.Customer))
		dbUserBase := dbCustomerLow
		if idx := strings.Index(dbCustomerLow, "@"); idx != -1 {
			dbUserBase = dbCustomerLow[:idx]
		}

		for i, oltOnu := range oltOnus {
			oltMacClean := strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(oltOnu.Mac, ":", ""), "-", ""))
			oltNameLow := strings.ToLower(strings.TrimSpace(oltOnu.Name))

			// Tier 1: Exact MAC
			if dbMacClean != "" && oltMacClean != "" && dbMacClean == oltMacClean {
				matchedOlt = &oltOnus[i]
				break
			}
			// Tier 2: OUI Prefix (first 5 bytes)
			if len(dbMacClean) >= 10 && len(oltMacClean) >= 10 && dbMacClean[:10] == oltMacClean[:10] {
				matchedOlt = &oltOnus[i]
				break
			}
			// Tier 3: Username Base
			if len(dbUserBase) >= 3 {
				if strings.HasPrefix(oltNameLow, dbUserBase+"/") ||
					strings.HasPrefix(oltNameLow, dbUserBase+" ") ||
					strings.HasPrefix(oltNameLow, dbUserBase+"-") ||
					oltNameLow == dbUserBase ||
					strings.Contains(oltNameLow, "/"+dbUserBase+"/") ||
					strings.Contains(oltNameLow, "/"+dbUserBase) {
					matchedOlt = &oltOnus[i]
					break
				}
			}
		}

		if matchedOlt != nil {
			rxFloat, _ := strconv.ParseFloat(matchedOlt.RxPower, 64)
			status := "Online"
			if matchedOlt.Status == "Down" || matchedOlt.Status == "Offline" {
				status = "Terputus"
			} else if rxFloat <= -26.0 {
				status = "Kritis"
			} else if rxFloat <= -25.0 {
				status = "Warning"
			}

			config.DB.Model(&dbOnu).Updates(map[string]interface{}{
				"rx_power": matchedOlt.RxPower,
				"status":   status,
			})
			updatedCount++
		}
	}
	return updatedCount, nil
}

// =====================================================================
// API HANDLER: PROBE ENDPOINTS HIOSO OLT (DIAGNOSTIK)
// GET /api/hioso-probe
// =====================================================================
func ProbeHiosoOlt(c *gin.Context) {
	oltClient := getHiosoClient()
	oltOnus, err := oltClient.FetchHiosoOnuList()

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "error",
			"host":   oltClient.Host,
			"error":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"host":       oltClient.Host,
		"data_count": len(oltOnus),
		"data":       oltOnus,
	})
}
