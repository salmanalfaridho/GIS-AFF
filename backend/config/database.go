package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"affnet-backend/models" // <--- Import folder models kita

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func ConnectDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dbHost := os.Getenv("DB_HOST")
		if dbHost != "" {
			dbUser := os.Getenv("DB_USER")
			dbPass := os.Getenv("DB_PASSWORD")
			dbName := os.Getenv("DB_NAME")
			dbPort := os.Getenv("DB_PORT")
			if dbPort == "" {
				dbPort = "5432"
			}
			dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=require TimeZone=Asia/Jakarta", dbHost, dbUser, dbPass, dbName, dbPort)
		} else {
			// Fallback ke konfigurasi lokal Docker
			dsn = "host=db user=affnet_user password=affnet_secret dbname=affnet_db port=5432 sslmode=disable TimeZone=Asia/Jakarta"
		}
	}

	log.Println("🔌 Menghubungkan ke database PostgreSQL...")

	var database *gorm.DB
	var err error

	for attempts := 1; attempts <= 5; attempts++ {
		database, err = gorm.Open(postgres.New(postgres.Config{
			DSN:                  dsn,
			PreferSimpleProtocol: true, // Wajib untuk Supabase PgBouncer Pooler (port 6543)
		}), &gorm.Config{
			PrepareStmt:            false,
			SkipDefaultTransaction: true,
			Logger:                 logger.Default.LogMode(logger.Warn),
		})

		if err == nil {
			sqlDB, errPing := database.DB()
			if errPing == nil {
				if errPing = sqlDB.Ping(); errPing == nil {
					break
				}
			}
			err = errPing
		}

		log.Printf("⚠️ Percobaan koneksi database ke-%d gagal: %v. Mencoba lagi...\n", attempts, err)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Printf("❌ Gagal terhubung ke PostgreSQL: %v\n", err)
		return
	}

	// AutoMigrate sekarang merujuk ke struktur yang BENAR di folder models
	err = database.AutoMigrate(&models.Odp{}, &models.Onu{}, &models.User{}, &models.Log{}, &models.Infra{})
	if err != nil {
		log.Printf("⚠️ Peringatan migrasi tabel: %v\n", err)
	}

	DB = database
	log.Println("🚀 Database PostgreSQL Berhasil Terhubung & Tabel ODP, ONU, User Siap!")

	// --- SEEDER USER ADMIN DEFAULT ---
	var count int64
	DB.Model(&models.User{}).Count(&count)
	
	// Kalau tabel user masih kosong (count == 0), buatkan akun admin
	if count == 0 {
		admin := models.User{
			Username: "admin",
			Password: "affdata2024", // Akan otomatis di-hash oleh fitur BeforeSave di model
			Role:     "admin",
		}
		
		if err := DB.Create(&admin).Error; err != nil {
			log.Println("⚠️ Gagal menjalankan seeder admin:", err)
		} else {
			log.Println("✅ Seeder berhasil: Akun 'admin' (password: affdata2024) telah dibuat!")
		}
	}
}