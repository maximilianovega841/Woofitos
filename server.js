require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONFIGURACIONES INICIALES
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'html')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// ==========================================
// 2. CONEXIÓN A LA BASE DE DATOS
// ==========================================
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
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
// 3. COMUNICACIÓN SERIAL (SOLO EN DESARROLLO)
// ==========================================
let port = null;
let parser = null;

// Solo cargamos la librería y conectamos si NO estamos en producción (Railway)
if (process.env.NODE_ENV !== 'production') {
    const { SerialPort } = require('serialport');
    const { ReadlineParser } = require('@serialport/parser-readline');
    const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';
    
    try {
        port = new SerialPort({ path: SERIAL_PORT, baudRate: 9600, autoOpen: false });
        port.open((err) => {
            if (err) console.log(`⚠️ Puerto ${SERIAL_PORT} no disponible.`);
            else console.log(`🔌 Arduino conectado en ${SERIAL_PORT}`);
        });
    } catch (e) {
        console.log("No se pudo cargar SerialPort (normal en producción)");
    }
} else {
    console.log('🌍 Servidor en modo PRODUCCIÓN: SerialPort deshabilitado.');
}

// ==========================================
// 4. ENDPOINTS: AUTH Y USUARIOS
// ==========================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Campos incompletos.' });

    const query = 'SELECT * FROM usuarios WHERE username = ? AND password_hash = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en el servidor.' });
        if (results.length > 0) {
            return res.json({ success: true, usuario: { id: results[0].id_usuario, username: results[0].username } });
        }
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    });
});

app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Campos incompletos.' });

    const checkQuery = 'SELECT * FROM usuarios WHERE username = ?';
    db.query(checkQuery, [username], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error de verificación.' });
        if (results.length > 0) return res.status(409).json({ error: 'El usuario ya existe.' });

        const correo = email || `${username}@woofitos.com`;
        const insertQuery = 'INSERT INTO usuarios (username, password_hash, email, fecha_registro) VALUES (?, ?, ?, NOW())';
        db.query(insertQuery, [username, password, correo], (err) => {
            if (err) return res.status(500).json({ error: 'Error al registrar.' });
            res.status(201).json({ success: true });
        });
    });
});

app.put('/api/usuarios/actualizar', (req, res) => {
    const { id_usuario, username, nombre_completo, email, password } = req.body;
    if (!id_usuario) return res.status(400).json({ error: 'Falta el ID.' });

    let query = 'UPDATE usuarios SET username=?, nombre_completo=?, email=? WHERE id_usuario=?';
    let params = [username, nombre_completo, email, id_usuario];

    if (password && password.trim() !== '') {
        query = 'UPDATE usuarios SET username=?, nombre_completo=?, email=?, password_hash=? WHERE id_usuario=?';
        params = [username, nombre_completo, email, password, id_usuario];
    }

    db.query(query, params, (err) => {
        if (err) return res.status(500).json({ error: 'Error al actualizar.' });
        res.json({ success: true });
    });
});

// ==========================================
// 5. ENDPOINTS: DISPOSITIVOS (CORREGIDO)
// ==========================================

// Variable global para órdenes
let ordenesDispensar = {};

// ⚡ LISTAR DISPOSITIVOS PARA EL DASHBOARD
app.get('/api/dispositivos/listar/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;
    const query = 'SELECT * FROM dispositivos WHERE id_usuario = ?';
    db.query(query, [usuario_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener dispositivos' });
        res.json(results);
    });
});

app.post('/api/dispositivos/solicitar-comida', (req, res) => {
    const { id_dispositivo } = req.body;
    if (!id_dispositivo) return res.status(400).json({ error: 'Falta ID.' });
    ordenesDispensar[id_dispositivo] = true;
    res.json({ success: true, mensaje: 'Orden enviada' });
});

app.post('/api/dispositivos/registrar', (req, res) => {
    const arduino_id = req.body.mac;
    if (!arduino_id) return res.send("ERROR:FALTA_ID\n");

    const buscarQuery = 'SELECT * FROM dispositivos WHERE id_dispositivo = ? LIMIT 1';
    db.query(buscarQuery, [arduino_id], (err, results) => {
        if (err) return res.send("ERROR:BD\n");
        if (results.length > 0) {
            return res.send(results[0].vinculado === 1 ? "VINCULADO:OK\n" : `CODE:${results[0].codigo_emparej}\n`);
        } else {
            const nuevoCodigo = Math.floor(100000 + Math.random() * 900000).toString();
            const insertarQuery = 'INSERT INTO dispositivos (id_dispositivo, codigo_emparej, vinculado) VALUES (?, ?, 0)';
            db.query(insertarQuery, [arduino_id, nuevoCodigo], (insErr) => {
                if (insErr) return res.send("ERROR:INSERT\n");
                return res.send(`CODE:${nuevoCodigo}\n`);
            });
        }
    });
});

app.get('/api/dispositivos/verificar', (req, res) => {
    const arduino_id = req.query.mac;
    if (!arduino_id) return res.send("VINCULADO:NO\n");

    const query = 'SELECT vinculado FROM dispositivos WHERE id_dispositivo = ? LIMIT 1';
    db.query(query, [arduino_id], (err, results) => {
        if (err || results.length === 0) return res.send("VINCULADO:NO\n");
        if (results[0].vinculado === 1) {
            if (ordenesDispensar[arduino_id] === true) {
                ordenesDispensar[arduino_id] = false;
                return res.send("ACCION:GIRAR\n"); 
            }
            return res.send("VINCULADO:OK\n");
        } else {
            return res.send("VINCULADO:NO\n");
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Woofitos corriendo en el puerto ${PORT}`);
});