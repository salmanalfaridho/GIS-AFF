package controllers

import (
	"net/http"
	"os"
	"strings"
	"time"

	"affnet-backend/config"
	"affnet-backend/models"

	"github.com/gin-gonic/gin"
	"gopkg.in/routeros.v2"
)

// connectMikroTik membuat koneksi ke MikroTik RouterOS API dengan timeout
func connectMikroTik() (*routeros.Client, error) {
	mkIp := strings.TrimSpace(os.Getenv("MIKROTIK_IP"))
	mkUser := strings.TrimSpace(os.Getenv("MIKROTIK_USER"))
	mkPass := strings.TrimSpace(os.Getenv("MIKROTIK_PASS"))
	return routeros.DialTimeout(mkIp, mkUser, mkPass, 10*time.Second)
}

// =====================================================================
// 1. GET MIKROTIK STATUS
// Cek apakah backend bisa terhubung ke MikroTik RouterOS API
// =====================================================================
func GetMikroTikStatus(c *gin.Context) {
	client, err := connectMikroTik()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"connected": false,
			"host":      os.Getenv("MIKROTIK_IP"),
			"error":     err.Error(),
		})
		return
	}
	defer client.Close()

	// Ambil info identity MikroTik sebagai health check
	reply, err := client.Run("/system/identity/print")
	identity := ""
	if err == nil && len(reply.Re) > 0 {
		identity = reply.Re[0].Map["name"]
	}

	c.JSON(http.StatusOK, gin.H{
		"connected": true,
		"host":      os.Getenv("MIKROTIK_IP"),
		"identity":  identity,
	})
}

// =====================================================================
// 2. GET PPPOE SUMMARY
// Ringkasan statistik PPPoE: total aktif
// =====================================================================
func GetPPPoESummary(c *gin.Context) {
	client, err := connectMikroTik()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal terhubung ke MikroTik",
			"detail": err.Error(),
		})
		return
	}
	defer client.Close()

	reply, err := client.Run("/ppp/active/print")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal membaca data PPPoE",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"total":  len(reply.Re),
	})
}

// =====================================================================
// 3. GET PPPOE ACTIVE (MENGAMBIL DAFTAR USER AKTIF)
// =====================================================================
func GetPPPoEActive(c *gin.Context) {
	client, err := connectMikroTik()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal terhubung ke MikroTik",
			"detail": err.Error(),
		})
		return
	}
	defer client.Close()

	reply, err := client.Run("/ppp/active/print")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal membaca data PPPoE",
			"detail": err.Error(),
		})
		return
	}

	var activeUsers []map[string]string
	for _, re := range reply.Re {
		user := map[string]string{
			"username":    re.Map["name"],
			"ip_address":  re.Map["address"],
			"mac_address": re.Map["caller-id"],
			"uptime":      re.Map["uptime"],
			"service":     re.Map["service"],
		}
		activeUsers = append(activeUsers, user)
	}

	if activeUsers == nil {
		activeUsers = []map[string]string{}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"total":  len(activeUsers),
		"data":   activeUsers,
	})
}

// =====================================================================
// 4. IMPORT ONU FROM MIKROTIK
// Mengambil data PPPoE aktif dari MikroTik dan menyimpannya ke tabel onus
// =====================================================================
func ImportOnuFromMikroTik(c *gin.Context) {
	client, err := connectMikroTik()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal terhubung ke MikroTik",
			"detail": err.Error(),
		})
		return
	}
	defer client.Close()

	reply, err := client.Run("/ppp/active/print")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal membaca data PPPoE dari MikroTik",
			"detail": err.Error(),
		})
		return
	}

	var created, updated, skipped int

	for _, re := range reply.Re {
		mac := strings.TrimSpace(re.Map["caller-id"])
		username := strings.TrimSpace(re.Map["name"])

		if mac == "" {
			skipped++
			continue
		}

		var existing models.Onu
		result := config.DB.Where("mac_address = ?", mac).First(&existing)

		if result.Error != nil {
			newOnu := models.Onu{
				MacAddress: mac,
				Customer:   username,
				Status:     "Online",
				RxPower:    "-19.50",
			}
			if err := config.DB.Create(&newOnu).Error; err == nil {
				created++
			} else {
				skipped++
			}
		} else {
			config.DB.Model(&existing).Updates(map[string]interface{}{
				"customer": username,
				"status":   "Online",
			})
			updated++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Import dari MikroTik selesai",
		"created": created,
		"updated": updated,
		"skipped": skipped,
		"total":   created + updated,
	})
}