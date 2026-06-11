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
// ⚡ PERMITE LEER LOS DATOS TRADICIONALES QUE ENVÍA EL ARDUINO
app.use(express.urlencoded({ extended: true })); 

// Sirve los archivos estáticos del proyecto (html, css, js, img)
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'html')));

// Ruta raíz → redirige al dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// ==========================================
// 2. CONEXIÓN A LA BASE DE DATOS
// ==========================================
const db = mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
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
// 3. COMUNICACIÓN SERIAL (OPCIONAL LOCAL)
// ==========================================
let port   = null;
let parser = null;
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';

try {
    port = new SerialPort({ path: SERIAL_PORT, baudRate: 9600, autoOpen: false });
    port.open((err) => {
        if (err) {
            console.log(`⚠️ Arduino no detectado en ${SERIAL_PORT}. Modo emulación activado.`);
        } else {
            console.log(`🔌 Arduino conectado en ${SERIAL_PORT}`);
            parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
            parser.on('data', (data) => {
                const gramos = parseInt(data.trim());
                if (!isNaN(gramos)) {
                    const query = 'INSERT INTO historial_dispensacion (cantidad_gramos, fecha) VALUES (?, NOW())';
                    db.query(query, [gramos], (err) => {
                        if (err) console.error('❌ Error al guardar dato del Arduino:', err.message);
                    });
                }
            });
        }
    });
} catch (error) {
    console.log('⚠️ SerialPort no disponible. Continuando sin hardware...');
}

// ==========================================
// 4. ENDPOINT: LOGIN
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

// ==========================================
// 5. ENDPOINT: REGISTRO DE USUARIOS
// ==========================================
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

// ==========================================
// 6. ENDPOINT: ACTUALIZAR PERFIL
// ==========================================
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

// --- RUTA ESPECÍFICA PARA EL ARDUINO (Pon esta ANTES de la otra) ---
app.get('/api/dispositivos/verificar', (req, res) => {
    const arduino_id = req.query.mac;
    if (!arduino_id) return res.send("VINCULADO:NO");

    const query = 'SELECT vinculado FROM dispositivos WHERE id_dispositivo = ? LIMIT 1';
    db.query(query, [arduino_id], (err, results) => {
        if (err || results.length === 0) return res.send("VINCULADO:NO");
        
        // Si está vinculado, responde VINCULADO:OK
        if (results[0].vinculado === 1) {
            return res.send("VINCULADO:OK");
        }
        return res.send("VINCULADO:NO");
    });
});

// --- RUTA PARA LA WEB (Dashboard) ---
app.get('/api/dispositivos/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;
    // ... tu código original aquí ...
});

// ==========================================
// ⚡ 8. NUEVA LOGICA INTERACTIVA PARA EL ARDUINO Y EL BOTON
// ==========================================

// Variable global temporal para guardar las órdenes de comida de los botones de la web
let ordenesDispensar = {};

// WEB POST — Ruta que se ejecuta al presionar "Llenar Plato" en la interfaz
app.post('/api/dispositivos/solicitar-comida', (req, res) => {
    const { id_dispositivo } = req.body;
    if (!id_dispositivo) return res.status(400).json({ error: 'Falta ID.' });

    // Activamos la orden de comida para este Arduino
    ordenesDispensar[id_dispositivo] = true;
    console.log(`🐾 Boton presionado: Orden de comida guardada para ${id_dispositivo}`);
    res.json({ success: true, mensaje: 'Orden enviada' });
});


// ARDUINO POST — El Arduino se registra al encender
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

// ARDUINO GET — El Arduino consulta esta ruta constantemente cada 4-5 segundos
app.get('/api/dispositivos/verificar', (req, res) => {
    const arduino_id = req.query.mac;
    if (!arduino_id) return res.send("VINCULADO:NO\n");

    const query = 'SELECT vinculado FROM dispositivos WHERE id_dispositivo = ? LIMIT 1';
    db.query(query, [arduino_id], (err, results) => {
        if (err || results.length === 0) return res.send("VINCULADO:NO\n");

        if (results[0].vinculado === 1) {
            // 🚨 SI EL BOTÓN DE LA WEB FUE PRESIONADO:
            if (ordenesDispensar[arduino_id] === true) {
                ordenesDispensar[arduino_id] = false; // Borramos la orden para que no gire infinitamente
                return res.send("ACCION:GIRAR\n");   // Mandamos la palabra clave al Arduino
            }
            return res.send("VINCULADO:OK\n");
        } else {
            return res.send("VINCULADO:NO\n");
        }
    });
});

// Enciende el servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor Woofitos corriendo en el puerto ${PORT}`);
});