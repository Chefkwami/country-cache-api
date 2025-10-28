-- create DB (run as a user with CREATE DATABASE privilege)
CREATE DATABASE IF NOT EXISTS country_cache CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;
USE country_cache;

-- Countries table
CREATE TABLE IF NOT EXISTS countries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  capital VARCHAR(200),
  region VARCHAR(100),
  population BIGINT UNSIGNED NOT NULL,
  currency_code VARCHAR(10),
  exchange_rate DOUBLE,
  estimated_gdp DOUBLE,
  flag_url VARCHAR(1000),
  last_refreshed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Metadata table to store global last refresh
CREATE TABLE IF NOT EXISTS metadata (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed default metadata key for last_refreshed_at if missing
INSERT IGNORE INTO metadata (`key`, `value`) VALUES ('last_refreshed_at', NULL);
