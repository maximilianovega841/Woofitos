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
// ⚡ AGREGA ESTA LÍNEA AQUÍ ⚡ (Permite que Express entienda el texto que manda el Arduino)
app.use(express.urlencoded({ extended: true })); 

// Sirve los archivos estáticos del proyecto (html, css, js, img)
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'html')));

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

// ==========================================
// 7. ENDPOINTS DE DISPOSITIVOS
// ==========================================

// GET — Listar dispositivos de un usuario
app.get('/api/dispositivos/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;
    const query = 'SELECT * FROM dispositivos WHERE id_usuario = ? ORDER BY fecha_vinculacion DESC';
    db.query(query, [usuario_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener dispositivos.' });
        res.json({ dispositivos: results });
    });
});

// ==========================================
// 8. CONEXIÓN DIRECTA CON EL ARDUINO UNO Q
// ==========================================

// POST — El Arduino se anuncia al prender por Puerto 80
app.post('/api/dispositivos/registrar', (req, res) => {
    // Arduino nos manda: mac="WOOFITO_HARDWARE_UNOQ_01" & ip="0.0.0.0"
    const arduino_id = req.body.mac; 
    
    if (!arduino_id) {
        return res.status(400).send("ERROR:FALTA_ID\n");
    }

    // Buscamos si el dispositivo ya existe en tu tabla MySQL
    const buscarQuery = 'SELECT * FROM dispositivos WHERE id_dispositivo = ? LIMIT 1';
    db.query(buscarQuery, [arduino_id], (err, results) => {
        if (err) return res.status(500).send("ERROR:BD\n");

        if (results.length > 0) {
            const disp = results[0];
            // Si el usuario ya metió el código en la web, le avisamos al Arduino
            if (disp.vinculado === 1) {
                return res.send("VINCULADO:OK\n");
            } else {
                // Si existe pero no se ha vinculado, le recordamos su código de emparejamiento
                return res.send(`CODE:${disp.codigo_emparej}\n`);
            }
        } else {
            // Si es la primera vez que se prende este Arduino, generamos el código de 6 dígitos
            const nuevoCodigo = Math.floor(100000 + Math.random() * 900000).toString();
            const expira = new Date(Date.now() + 15 * 60 * 1000); // Válido por 15 minutos

            const insertarQuery = `
                INSERT INTO dispositivos (id_dispositivo, codigo_emparej, codigo_expira, vinculado)
                VALUES (?, ?, ?, 0)
            `;
            db.query(insertarQuery, [arduino_id, nuevoCodigo, expira], (insErr) => {
                if (insErr) return res.status(500).send("ERROR:INSERT\n");
                
                // Respondemos en el texto plano que el Arduino sabe leer en su monitor serial
                return res.send(`CODE:${nuevoCodigo}\n`);
            });
        }
    });
});

// GET — El Arduino pregunta constantemente si ya metieron el código en la web
app.get('/api/dispositivos/verificar', (req, res) => {
    const arduino_id = req.query.mac;

    if (!arduino_id) return res.send("VINCULADO:NO\n");

    const query = 'SELECT vinculado FROM dispositivos WHERE id_dispositivo = ? LIMIT 1';
    db.query(query, [arduino_id], (err, results) => {
        if (err || results.length === 0) return res.send("VINCULADO:NO\n");

        if (results[0].vinculado === 1) {
            res.send("VINCULADO:OK\n");
        } else {
            res.send("VINCULADO:NO\n");
        }
    });
});

// POST — El Arduino anuncia su código al encender
app.post('/api/dispositivos/anunciar', (req, res) => {
    const { arduino_id, codigo } = req.body;
    if (!arduino_id || !codigo) return res.status(400).json({ error: 'Faltan datos del dispositivo.' });

    const expira = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Upsert: si ya existe actualiza el código, si no lo crea sin usuario
    const query = `
        INSERT INTO dispositivos (id_dispositivo, codigo_emparej, codigo_expira, vinculado)
        VALUES (?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE codigo_emparej = ?, codigo_expira = ?, vinculado = 0
    `;
    db.query(query, [arduino_id, codigo, expira, codigo, expira], (err) => {
        if (err) return res.status(500).json({ error: 'Error al registrar dispositivo.' });
        res.json({ success: true, mensaje: 'Dispositivo anunciado. Esperando vinculación.' });
    });
});

// POST — El usuario vincula un dispositivo con su código
app.post('/api/dispositivos/vincular', (req, res) => {
    const { usuario_id, codigo, nombre_mascota } = req.body;
    if (!usuario_id || !codigo) return res.status(400).json({ error: 'Faltan datos para vincular.' });

    const codigoUpper = codigo.toUpperCase().trim();

    // Buscar dispositivo con ese código no expirado y sin vincular
    const buscar = `
        SELECT * FROM dispositivos
        WHERE codigo_emparej = ?
        AND (codigo_expira IS NULL OR codigo_expira > NOW())
        AND (vinculado = 0 OR vinculado IS NULL)
        LIMIT 1
    `;
    db.query(buscar, [codigoUpper], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al buscar dispositivo.' });
        if (results.length === 0)
            return res.status(404).json({ error: 'Código incorrecto o expirado. Reinicia tu Woofito para obtener un nuevo código.' });

        const disp   = results[0];
        const nombre = nombre_mascota || 'Mi Woofito';

        const actualizar = `
            UPDATE dispositivos
            SET id_usuario = ?, nombre_mascota = ?, vinculado = 1,
                fecha_vinculacion = NOW(), codigo_emparej = NULL, codigo_expira = NULL
            WHERE id_dispositivo = ?
        `;
        db.query(actualizar, [usuario_id, nombre, disp.id_dispositivo], (err2) => {
            if (err2) return res.status(500).json({ error: 'Error al vincular dispositivo.' });

            // Crear registro en monitoreo_tanques si no existe
            db.query(
                'INSERT IGNORE INTO monitoreo_tanques (id_dispositivo) VALUES (?)',
                [disp.id_dispositivo]
            );

            res.json({ success: true, mensaje: '¡Dispositivo vinculado!', id_dispositivo: disp.id_dispositivo });
        });
    });
});

// PUT — Renombrar mascota de un dispositivo
app.put('/api/dispositivos/renombrar', (req, res) => {
    const { id_dispositivo, nombre_mascota } = req.body;
    if (!id_dispositivo || !nombre_mascota) return res.status(400).json({ error: 'Faltan datos.' });
    db.query(
        'UPDATE dispositivos SET nombre_mascota = ? WHERE id_dispositivo = ?',
        [nombre_mascota, id_dispositivo],
        (err) => {
            if (err) return res.status(500).json({ error: 'Error al renombrar.' });
            res.json({ success: true });
        }
    );
});

// DELETE — Desvincular dispositivo de la cuenta
app.delete('/api/dispositivos/eliminar', (req, res) => {
    const { id_dispositivo, usuario_id } = req.body;
    if (!id_dispositivo || !usuario_id) return res.status(400).json({ error: 'Faltan datos.' });
    db.query(
        'UPDATE dispositivos SET id_usuario = NULL, vinculado = 0, fecha_vinculacion = NULL WHERE id_dispositivo = ? AND id_usuario = ?',
        [id_dispositivo, usuario_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Error al desvincular.' });
            if (result.affectedRows === 0) return res.status(403).json({ error: 'No tienes permiso para eliminar este dispositivo.' });
            res.json({ success: true });
        }
    );
});