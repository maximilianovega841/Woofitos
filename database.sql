-- ================================================
-- WOOFITOS — Script de base de datos
-- Ejecutar en Railway > MySQL > Query
-- ================================================

CREATE DATABASE IF NOT EXISTS woofitos_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE woofitos_db;

-- ── Tabla de usuarios ──
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario      INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    email           VARCHAR(100) NOT NULL UNIQUE,
    nombre_completo VARCHAR(100) DEFAULT NULL,
    fecha_registro  DATETIME     DEFAULT NOW()
);

-- ── Tabla de historial de dispensación ──
CREATE TABLE IF NOT EXISTS historial_dispensacion (
    id_historial    INT AUTO_INCREMENT PRIMARY KEY,
    cantidad_gramos INT      NOT NULL,
    fecha           DATETIME DEFAULT NOW()
);

-- ── Usuario de prueba (contraseña: admin123) ──
INSERT IGNORE INTO usuarios (username, password_hash, email)
VALUES ('admin', 'admin123', 'admin@woofitos.com');
