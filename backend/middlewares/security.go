package middlewares

import (
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func getJwtSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "affnet_super_secret_jwt_2024"
	}
	return []byte(secret)
}

// =====================================================================
// 1. CORS MIDDLEWARE
// =====================================================================
// 1. Middleware untuk CORS
func CORSMiddleware() gin.HandlerFunc {
	return cors.New(cors.Config{
		// GANTI MENJADI INI:
        AllowOriginFunc: func(origin string) bool {
            return true // Mengizinkan semua IP / Domain masuk (Dinamis)
        },
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}

// =====================================================================
// 2. AUTH MIDDLEWARE (VALIDASI JWT TOKEN)
// =====================================================================
// 2. Middleware untuk Validasi Token (JWT)
// Pastikan nama fungsinya "AuthMiddleware" dengan huruf A besar
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Ambil token dari cookie atau Authorization Header
		tokenString, err := c.Cookie("token")
		if err != nil || tokenString == "" {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Silakan login terlebih dahulu"})
			c.Abort()
			return
		}

		// Parse token
		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			return getJwtSecret(), nil
		})

		// Cek validitas
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesi tidak valid atau telah berakhir"})
			c.Abort()
			return
		}

		// Lanjut ke proses berikutnya
		c.Next()
	}
}