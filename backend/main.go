package main

import (
	"affnet-backend/config"
	"affnet-backend/controllers"
	"affnet-backend/middlewares" // Import folder middleware kamu
	"affnet-backend/services"
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Inisialisasi Database
	config.ConnectDB()

	// 2. Inisialisasi Router Gin
	r := gin.Default()

	// 3. Pasang CORS (Menggunakan library gin-contrib/cors)
	r.Use(middlewares.CORSMiddleware())

	// 4. API Route Grouping
	r.GET("/health", func(c *gin.Context) {
		dbStatus := "connected"
		if config.DB == nil {
			dbStatus = "disconnected"
		}
		c.JSON(200, gin.H{"status": "ok", "database": dbStatus})
	})

	api := r.Group("/api")
	{
		// --- RUTE PUBLIK (Bisa diakses siapa saja, misal untuk Login) ---
		api.GET("/health", func(c *gin.Context) {
			dbStatus := "connected"
			if config.DB == nil {
				dbStatus = "disconnected"
			}
			c.JSON(200, gin.H{"status": "ok", "database": dbStatus})
		})
		api.POST("/login", controllers.Login)
		api.POST("/logout", controllers.Logout)
		api.POST("/hioso-sync", controllers.SyncHiosoOltRedaman)
		api.GET("/hioso-sync", controllers.SyncHiosoOltRedaman)
		api.GET("/hioso-probe", controllers.ProbeHiosoOlt)

		// --- RUTE TERPROTEKSI (Wajib melewati AuthMiddleware/JWT) ---
		protected := api.Group("/")
		protected.Use(middlewares.AuthMiddleware()) // <--- Satpamnya dipasang di sini
		{

			// ODP Management
			protected.POST("/odp", controllers.CreateOdp)
			protected.GET("/odp", controllers.GetAllOdp)
			protected.PUT("/odp/:id", controllers.UpdateOdp)
			protected.DELETE("/odp/:id", controllers.DeleteOdp)

			// ONU Management
			protected.GET("/onu", controllers.GetAllOnu)
			protected.GET("/onu-sync", controllers.SyncOnuFromZabbix)
			protected.PUT("/onu/:mac", controllers.UpdateOnuDetails)
			protected.DELETE("/onu/:id", controllers.DeleteOnu)

			// Infrastructure & Logs
			protected.GET("/zabbix-infra", controllers.GetZabbixInfra)
			protected.GET("/logs", controllers.GetLogs)
			protected.POST("/logs", controllers.CreateLog)
			protected.PUT("/logs/:id/resolve", controllers.ResolveLog)
			protected.POST("/logs/resolve-by-title", controllers.ResolveLogByTitle)
			protected.DELETE("/logs/:id", controllers.DeleteLog)
			protected.DELETE("/logs/resolved", controllers.ClearResolvedLogs)

			protected.GET("/pppoe-active", controllers.GetPPPoEActive)
			protected.GET("/pppoe-summary", controllers.GetPPPoESummary)
			protected.GET("/mikrotik-status", controllers.GetMikroTikStatus)
			protected.POST("/mikrotik-import", controllers.ImportOnuFromMikroTik)
			protected.GET("/onu-redaman/:mac", controllers.GetOnuRedamanRealtime)
			protected.POST("/test-onu-scenario", controllers.TestOnuScenario)
		}
	}

	// 5. Jalankan Background Cron Job untuk Auto-Sync Zabbix, MikroTik & HIOSO OLT
	go func() {
		// Jalankan sekali saat startup
		if count, err := controllers.ExecuteHiosoSyncDirect(); err == nil {
			fmt.Printf("[CRON STARTUP] Sync HIOSO OLT: %d ONU berhasil disinkronkan langsung dari OLT!\n", count)
		}

		// Sync setiap 2 menit
		ticker := time.NewTicker(2 * time.Minute)
		for range ticker.C {
			fmt.Println("[CRON] Menjalankan auto-sync OLT HIOSO, Zabbix & MikroTik...")

			// 1. Sync OLT HIOSO (Ambil redaman fisik real OLT)
			if count, err := controllers.ExecuteHiosoSyncDirect(); err != nil {
				fmt.Printf("[CRON ERROR] Gagal sync OLT HIOSO: %v\n", err)
			} else {
				fmt.Printf("[CRON] Sync OLT HIOSO: %d ONU berhasil disinkronkan.\n", count)
			}

			// 2. Sync Zabbix Infra
			_, errInfra := controllers.FetchAndProcessZabbixInfra()
			if errInfra != nil {
				fmt.Printf("[CRON ERROR] Gagal sync Infra: %v\n", errInfra)
			}

			fmt.Println("[CRON] Auto-sync selesai.")
		}
	}()

	// 6. Jalankan Background Cron Job untuk Pembersihan Log (Retention 30 Hari)
	go func() {
		// Jalankan sekali saat startup
		services.CleanOldLogs()
		
		// Kemudian jalankan setiap 24 jam
		ticker := time.NewTicker(24 * time.Hour)
		for range ticker.C {
			fmt.Println("[CRON] Menjalankan pembersihan log lama...")
			services.CleanOldLogs()
			fmt.Println("[CRON] Pembersihan log selesai.")
		}
	}()

	// 7. Jalankan Server - Baca PORT dari env var (wajib untuk Railway/Cloud)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	r.Run("0.0.0.0:" + port)
}
