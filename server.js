const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); // Nos permite entender datos en formato JSON (como usuarios y contraseñas)

// Configuración de la conexión a MySQL usando las variables del archivo .env
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Intentar conectar con la base de datos
db.connect((err) => {
    if (err) {
        console.error('❌ Error al conectar a la base de datos de XAMPP:', err);
        return;
    }
    console.log('✅ ¡Conectado con éxito a la base de datos woofitos_db en XAMPP!');
});

// ==========================================
// 1. RUTA PARA REGISTRAR UN NUEVO USUARIO
// ==========================================
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;

    // Validación rápida por si mandan datos vacíos
    if (!username || !email || !password) {
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    // Consulta SQL para insertar el usuario
    // Nota: En producción usaríamos un hash para la contraseña, pero para la escuela/prototipo la guardaremos directa para no complicarnos de más ahorita
    const query = 'INSERT INTO usuarios (username, email, password_hash) VALUES (?, ?, ?)';
    
    db.query(query, [username, email, password], (err, result) => {
        if (err) {
            // Si el código de error es por un dato duplicado (el correo o el usuario ya existen)
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: "El nombre de usuario o el correo ya están registrados." });
            }
            console.error(err);
            return res.status(500).json({ error: "Error interno al registrar el usuario." });
        }
        res.status(201).json({ mensaje: "¡Usuario registrado con éxito!" });
    });
});

// ==========================================
// 2. RUTA PARA INICIAR SESIÓN (LOGIN)
// ==========================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Usuario y contraseña requeridos." });
    }

    // Buscamos si existe el usuario en la base de datos
    const query = 'SELECT * FROM usuarios WHERE username = ? AND password_hash = ?';
    
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error en el servidor al intentar loguear." });
        }

        // Si la base de datos nos regresa un arreglo vacío, significa que los datos no coinciden
        if (results.length === 0) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
        }

        // Si coincide, le mandamos los datos básicos del usuario a la página web
        const usuarioLogueado = results[0];
        res.json({
            mensaje: "¡Inicio de sesión exitoso!",
            usuario: {
                id: usuarioLogueado.id_usuario,
                username: usuarioLogueado.username
            }
        });
    });
});

// Ruta de prueba rápida en el navegador
app.get('/api/status', (req, res) => {
    res.json({ estado: "El servidor nativo de Woofitos está corriendo perfectamente." });
});

// Encender el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});