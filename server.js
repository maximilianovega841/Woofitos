require('dotenv').config();

const express    = require('express');
const mysql      = require('mysql2'); // Sigue usando el mismo paquete
const cors       = require('cors');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONFIGURACIONES INICIALES
// ==========================================
app.use(cors());
app.use(express.json());

// Sirve los archivos estáticos del proyecto (html, css, js, img)
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'html')));

// Ruta raíz → redirige al dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// ==========================================
// 2. POOL DE CONEXIONES A LA BASE DE DATOS (SOLUCIÓN AL ERROR 4031)
// ==========================================
const db = mysql.createPool({
    host:             process.env.DB_HOST,
    port:             process.env.DB_PORT || 3306,
    user:             process.env.DB_USER,
    password:         process.env.DB_PASSWORD,
    database:         process.env.DB_NAME,
    // Railway necesita SSL en producción
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    
    // Configuraciones de optimización del Pool:
    waitForConnections: true,
    connectionLimit: 10,     // Ajusta según los límites de tu plan en Railway
    maxIdle: 10,            // Máximo de conexiones inactivas retenidas
    idleTimeout: 60000,     // Tiempo para cerrar conexiones inactivas (60 segundos)
    queueLimit: 0
});

// Verificar la salud del pool al arrancar el servidor
db.getConnection((err, connection) => {
    if (err) {
        console.error('\n❌ Error al inicializar el Pool de MySQL:', err.message);
        return;
    }
    console.log('🐬 ¡Pool de conexiones listo y validado con MySQL!');
    connection.release(); // Devuelve la conexión de prueba al pool inmediatamente
});

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

// ==========================================
// 8. ENDPOINTS DE DISPOSITIVOS
// ==========================================

// GET — Listar dispositivos de un usuario
app.get('/api/dispositivos/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;
    console.log(`🔍 [GET] Buscando dispositivos para el usuario ID: ${usuario_id}`);

    const query = `
        SELECT *,
          CASE
            WHEN ultima_conexion IS NOT NULL
             AND ultima_conexion >= NOW() - INTERVAL 2 MINUTE
            THEN 1 ELSE 0
          END AS online
        FROM dispositivos
        WHERE id_usuario = ?
        ORDER BY fecha_vinculacion DESC`;

    db.query(query, [usuario_id], (err, results) => {
        if (err) {
            console.error('❌ [GET] Error SQL en /api/dispositivos:', err.message);
            return res.status(500).json({ error: 'Error al obtener dispositivos.' });
        }
        console.log(`✅ [GET] Dispositivos encontrados: ${results.length}`);
        res.json({ dispositivos: results });
    });
});

// POST — El ESP32 anuncia su código al encender
app.post('/api/dispositivos/anunciar', (req, res) => {
    const { arduino_id, codigo } = req.body;
    console.log(`📢 [POST] /api/dispositivos/anunciar invocado`);
    console.log(`📦 Datos recibidos -> arduino_id: "${arduino_id}", codigo: "${codigo}"`);

    if (!arduino_id || !codigo) {
        console.warn('⚠️ [POST] Intento de anuncio rechazado: Faltan datos (ID o Código vacíos).');
        return res.status(400).json({ error: 'Faltan datos del dispositivo.' });
    }

    const expira = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    const query = `
        INSERT INTO dispositivos (id_dispositivo, codigo_emparej, codigo_expira, vinculado)
        VALUES (?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE codigo_emparej = ?, codigo_expira = ?, vinculado = 0
    `;

    db.query(query, [arduino_id, codigo, expira, codigo, expira], (err, result) => {
        if (err) {
            console.error('❌ [POST] Error SQL en /anunciar:', err.message);
            return res.status(500).json({ error: 'Error al registrar dispositivo.' });
        }
        console.log(`💾 [POST] ¡Base de datos actualizada con éxito! ID: ${arduino_id}, Cód: ${codigo}`);
        res.json({ success: true, mensaje: 'Dispositivo anunciado. Esperando vinculación.' });
    });
});

// POST — El usuario vincula un dispositivo con su código
app.post('/api/dispositivos/vincular', (req, res) => {
    const { usuario_id, codigo, nombre_mascota } = req.body;
    console.log(`🔗 [POST] /api/dispositivos/vincular invocado por usuario: ${usuario_id} con código: ${codigo}`);

    if (!usuario_id || !codigo) {
        console.warn('⚠️ [POST] Intento de vinculación rechazado: Falta usuario_id o codigo.');
        return res.status(400).json({ error: 'Faltan datos para vincular.' });
    }

    const codigoUpper = codigo.toUpperCase().trim();

    const buscar = `
        SELECT * FROM dispositivos
        WHERE codigo_emparej = ?
        AND (codigo_expira IS NULL OR codigo_expira > NOW())
        AND (vinculado = 0 OR vinculado IS NULL)
        LIMIT 1
    `;

    db.query(buscar, [codigoUpper], (err, results) => {
        if (err) {
            console.error('❌ [POST] Error SQL al buscar dispositivo para vincular:', err.message);
            return res.status(500).json({ error: 'Error al buscar dispositivo.' });
        }
        if (results.length === 0) {
            console.warn(`⚠️ [POST] Intento de vinculación fallido: Código "${codigoUpper}" incorrecto o expirado.`);
            return res.status(404).json({ error: 'Código incorrecto o expirado.' });
        }

        const disp   = results[0];
        const nombre = nombre_mascota || 'Mi Woofito';

        const actualizar = `
            UPDATE dispositivos
            SET id_usuario = ?, nombre_mascota = ?, vinculado = 1,
                fecha_vinculacion = NOW(), codigo_emparej = NULL, codigo_expira = NULL
            WHERE id_dispositivo = ?
        `;

        db.query(actualizar, [usuario_id, nombre, disp.id_dispositivo], (err2) => {
            if (err2) {
                console.error('❌ [POST] Error SQL al actualizar tabla dispositivos en vinculación:', err2.message);
                return res.status(500).json({ error: 'Error al vincular dispositivo.' });
            }

            console.log(`🎉 [POST] Dispositivo ${disp.id_dispositivo} vinculado exitosamente a mascota: ${nombre}`);
            
            db.query(
                'INSERT IGNORE INTO monitoreo_tanques (id_dispositivo) VALUES (?)',
                [disp.id_dispositivo]
            );

            res.json({ success: true, mensaje: '¡Dispositivo vinculado!', id_dispositivo: disp.id_dispositivo });
        });
    });
});

// ==========================================
// 9. ENDPOINT: VERIFICAR ESTADO DE VINCULACIÓN
// ==========================================
app.get('/api/dispositivos/estado/:arduino_id', (req, res) => {
    const { arduino_id } = req.params;
    const query = 'SELECT vinculado, id_usuario FROM dispositivos WHERE id_dispositivo = ?';
    db.query(query, [arduino_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al verificar estado.' });
        if (results.length === 0)
            return res.status(404).json({ vinculado: false, mensaje: 'Dispositivo no encontrado.' });
        const disp = results[0];
        res.json({
            vinculado: disp.vinculado === 1,
            id_usuario: disp.id_usuario
        });
    });
});

// ==========================================
// 10. ENDPOINT: REGISTRAR DISPENSACIÓN
// ==========================================
app.post('/api/historial/registrar', (req, res) => {
    const { id_dispositivo, tipo_accion, detalle } = req.body;
    if (!id_dispositivo || !tipo_accion)
        return res.status(400).json({ error: 'Faltan datos.' });

    const query = 'INSERT INTO historial_dispensacion (id_dispositivo, tipo_accion, detalle) VALUES (?, ?, ?)';
    db.query(query, [id_dispositivo, tipo_accion, detalle || ''], (err) => {
        if (err) return res.status(500).json({ error: 'Error al registrar dispensación.' });
        res.json({ success: true });
    });
});

// ==========================================
// 11. ENDPOINT: HEARTBEAT
// ==========================================
app.post('/api/dispositivos/heartbeat', (req, res) => {
    const { arduino_id } = req.body;
    if (!arduino_id) return res.status(400).json({ error: 'Falta arduino_id.' });

    const query = 'UPDATE dispositivos SET ultima_conexion = NOW() WHERE id_dispositivo = ?';
    db.query(query, [arduino_id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error al actualizar heartbeat.' });
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'Dispositivo no encontrado.' });
        res.json({ success: true, timestamp: new Date().toISOString() });
    });
});

// ==========================================
// 12. ENDPOINT: ACTUALIZAR SENSORES
// ==========================================
app.post('/api/sensores/actualizar', (req, res) => {
    const { id_dispositivo, nivel_comida, nivel_agua } = req.body;
    if (!id_dispositivo) return res.status(400).json({ error: 'Falta id_dispositivo.' });

    const query = `
        INSERT INTO monitoreo_tanques (id_dispositivo, nivel_comida, nivel_agua)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            nivel_comida = VALUES(nivel_comida),
            nivel_agua   = VALUES(nivel_agua),
            ultima_actualizacion = NOW()`;
    db.query(query, [id_dispositivo, nivel_comida || 0, nivel_agua || 0], (err) => {
        if (err) return res.status(500).json({ error: 'Error al actualizar sensores.' });
        res.json({ success: true });
    });
});