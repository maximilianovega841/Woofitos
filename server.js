require('dotenv').config();

const express    = require('express');
const mysql      = require('mysql2');
const cors       = require('cors');
const path       = require('path');
const { SerialPort }     = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app  = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONFIGURACIONES INICIALES
// ==========================================
app.use(cors());
app.use(express.json());

// Sirve los archivos estáticos del proyecto (html, css, js, img)
app.use(express.static(path.join(__dirname)));

// ==========================================
// 2. CONEXIÓN A LA BASE DE DATOS
//    Lee las variables del .env (local) o
//    de las variables de entorno de Railway
// ==========================================
const db = mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // Railway necesita SSL en producción
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

db.connect((err) => {
    if (err) {
        console.error('\n❌ Error al conectar a la base de datos:', err.message);
        return;
    }
    console.log('🐬 ¡Conexión exitosa a la base de datos MySQL!');
});

// ==========================================
// 3. COMUNICACIÓN SERIAL CON ARDUINO (OPCIONAL)
// ==========================================
let port   = null;
let parser = null;

const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';

try {
    port = new SerialPort({ path: SERIAL_PORT, baudRate: 9600, autoOpen: false });

    port.open((err) => {
        if (err) {
            console.log(`⚠️  Arduino no detectado en ${SERIAL_PORT}. Modo emulación activado.`);
        } else {
            console.log(`🔌 Arduino conectado en ${SERIAL_PORT}`);
            parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
            parser.on('data', (data) => {
                const gramos = parseInt(data.trim());
                if (!isNaN(gramos)) {
                    console.log(`🐾 Arduino reporta: ${gramos}g`);
                    const query = 'INSERT INTO historial_dispensacion (cantidad_gramos, fecha) VALUES (?, NOW())';
                    db.query(query, [gramos], (err) => {
                        if (err) console.error('❌ Error al guardar dato del Arduino:', err.message);
                        else      console.log('💾 Dato guardado en MySQL.');
                    });
                }
            });
        }
    });
} catch (error) {
    console.log('⚠️  SerialPort no disponible. Continuando sin hardware...');
}

// ==========================================
// 4. ENDPOINT: LOGIN
// ==========================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: 'Por favor, llena ambos campos.' });

    const query = 'SELECT * FROM usuarios WHERE username = ? AND password_hash = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('❌ Error en LOGIN SQL:', err);
            return res.status(500).json({ error: 'Error en el servidor.' });
        }
        if (results.length > 0) {
            const u = results[0];
            return res.json({
                success: true,
                mensaje: '¡Acceso concedido!',
                usuario: { id: u.id_usuario, username: u.username }
            });
        }
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    });
});

// ==========================================
// 5. ENDPOINT: REGISTRO
// ==========================================
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: 'Por favor, llena todos los campos.' });

    const checkQuery = 'SELECT * FROM usuarios WHERE username = ?';
    db.query(checkQuery, [username], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al verificar usuario.' });
        if (results.length > 0)
            return res.status(409).json({ error: 'El nombre de usuario ya está en uso.' });

        const correo      = email || `${username}@woofitos.com`;
        const insertQuery = 'INSERT INTO usuarios (username, password_hash, email, fecha_registro) VALUES (?, ?, ?, NOW())';
        db.query(insertQuery, [username, password, correo], (err) => {
            if (err) return res.status(500).json({ error: 'Error al registrar usuario.' });
            res.status(201).json({ success: true, mensaje: '¡Usuario registrado!' });
        });
    });
});

// ==========================================
// 6. ENDPOINT: ACTUALIZAR PERFIL
// ==========================================
app.put('/api/usuarios/actualizar', (req, res) => {
    const { id_usuario, username, nombre_completo, email, password } = req.body;
    if (!id_usuario) return res.status(400).json({ error: 'Falta el ID de usuario.' });

    let query, params;
    if (password && password.trim() !== '') {
        query  = 'UPDATE usuarios SET username=?, nombre_completo=?, email=?, password_hash=? WHERE id_usuario=?';
        params = [username, nombre_completo, email, password, id_usuario];
    } else {
        query  = 'UPDATE usuarios SET username=?, nombre_completo=?, email=? WHERE id_usuario=?';
        params = [username, nombre_completo, email, id_usuario];
    }

    db.query(query, params, (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY')
                return res.status(409).json({ error: 'El usuario o correo ya está en uso.' });
            return res.status(500).json({ error: 'Error al actualizar perfil.' });
        }
        res.json({ success: true, mensaje: '¡Perfil actualizado!', usuario: { id_usuario, username, nombre_completo, email } });
    });
});

// ==========================================
// 7. ENCENDER EL SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor Woofitos corriendo en http://localhost:${PORT}`);
});