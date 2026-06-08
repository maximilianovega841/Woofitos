const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const PORT = 3000;

// ==========================================
// 1. CONFIGURACIONES INICIALES
// ==========================================
app.use(cors());
app.use(express.json()); 

// ==========================================
// 2. CONEXIÓN A LA BASE DE DATOS (XAMPP)
// ==========================================
const db = mysql.createConnection({
    host: '127.0.0.1',  
    port: 3306,         
    user: 'root',       
    password: '',       
    database: 'woofitos_db'
});

db.connect((err) => {
    if (err) {
        console.error('\n❌ Error al conectar a la base de datos de XAMPP:', err.message);
        return;
    }
    console.log('🐬 ¡Conexión exitosa a la base de datos MySQL en XAMPP!');
});

// ==========================================
// 3. COMUNICACIÓN SERIAL CON ARDUINO Q (OPCIONAL)
// ==========================================
let port = null;
let parser = null;

try {
    port = new SerialPort({
        path: 'COM3', 
        baudRate: 9600,
        autoOpen: false 
    });

    port.open((err) => {
        if (err) {
            console.log('⚠️ Aviso: No se detectó el Arduino Q en el puerto COM3. Modo emulación activado.');
        } else {
            console.log('🔌 Conexión establecida con el Arduino Q por USB en el puerto COM3');
            
            parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
            
            parser.on('data', (data) => {
                const gramos = parseInt(data.trim());
                if (!isNaN(gramos)) {
                    console.log(`🐾 El Arduino reporta: ${gramos}g en el contenedor.`);
                    
                    const query = 'INSERT INTO historial_dispensacion (cantidad_gramos, fecha) VALUES (?, NOW())';
                    db.query(query, [gramos], (err, result) => {
                        if (err) {
                            console.error('❌ Error al guardar dato del Arduino:', err.message);
                        } else {
                            console.log('💾 ¡Dato de Woofitos guardado en MySQL con éxito!');
                        }
                    });
                }
            });
        }
    });

} catch (error) {
    console.log('⚠️ Error crítico al inicializar SerialPort. Continuando sin hardware...');
}

// ==========================================
// 4. ENDPOINT: INICIO DE SESIÓN (LOGIN)
// ==========================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Por favor, llena ambos campos.' });
    }

    // AJUSTADO: Usamos las columnas 'username' y 'password_hash' que se ven en tu captura
    const query = 'SELECT * FROM usuarios WHERE username = ? AND password_hash = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('❌ Error en LOGIN SQL:', err);
            return res.status(500).json({ error: 'Error en el servidor al intentar loguear.' });
        }

        if (results.length > 0) {
            const usuarioEncontrado = results[0];
            return res.json({
                success: true,
                mensaje: '¡Acceso concedido!',
                usuario: {
                    id: usuarioEncontrado.id_usuario, // Ajustado a tu llave primaria
                    username: usuarioEncontrado.username
                }
            });
        } else {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        }
    });
});

// ==========================================
// 5. ENDPOINT: REGISTRO DE NUEVOS USUARIOS
// ==========================================
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Por favor, llena todos los campos obligatorios.' });
    }

    // AJUSTADO: Comprobación con la columna 'username'
    const checkQuery = 'SELECT * FROM usuarios WHERE username = ?';
    db.query(checkQuery, [username], (err, results) => {
        if (err) {
            console.error('❌ Error en VERIFICACIÓN DE REGISTRO SQL:', err);
            return res.status(500).json({ error: 'Error en el servidor al verificar disponibilidad del usuario.' });
        }

        if (results.length > 0) {
            return res.status(409).json({ error: 'El nombre de usuario ya está en uso. Intenta con otro.' });
        }

        // AJUSTADO: Inserción usando tus columnas reales. Si el frontend no manda email, guardamos uno por defecto.
        const correoRegistro = email || `${username}@woofitos.com`;
        const insertQuery = 'INSERT INTO usuarios (username, password_hash, email, fecha_registro) VALUES (?, ?, ?, NOW())';
        
        db.query(insertQuery, [username, password, correoRegistro], (err, result) => {
            if (err) {
                console.error('❌ Error al INSERTAR NUEVO USUARIO SQL:', err);
                return res.status(500).json({ error: 'Error al registrar el usuario en la base de datos.' });
            }

            res.status(201).json({
                success: true,
                mensaje: '¡Usuario registrado con éxito en XAMPP!'
            });
        });
    });
});

// ==========================================
// 5.1 ENDPOINT: ACTUALIZAR PERFIL DE USUARIO
// ==========================================
app.put('/api/usuarios/actualizar', (req, res) => {
    const { id_usuario, username, nombre_completo, email, password } = req.body;

    if (!id_usuario) {
        return res.status(400).json({ error: 'Falta el ID de usuario.' });
    }

    // Si el usuario envió una nueva contraseña, la actualizamos; si no, dejamos la que está
    let query = '';
    let params = [];

    if (password && password.trim() !== '') {
        query = 'UPDATE usuarios SET username = ?, nombre_completo = ?, email = ?, password_hash = ? WHERE id_usuario = ?';
        params = [username, nombre_completo, email, password, id_usuario];
    } else {
        query = 'UPDATE usuarios SET username = ?, nombre_completo = ?, email = ? WHERE id_usuario = ?';
        params = [username, nombre_completo, email, id_usuario];
    }

    db.query(query, params, (err, result) => {
        if (err) {
            console.error('❌ Error al actualizar perfil:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'El nombre de usuario o correo ya está en uso.' });
            }
            return res.status(500).json({ error: 'Error interno del servidor al actualizar.' });
        }

        res.json({
            success: true,
            mensaje: '¡Perfil actualizado con éxito!',
            usuario: {
                id_usuario,
                username,
                nombre_completo,
                email
            }
        });
    });
});

// ==========================================
// 6. ENCENDER EL SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend de Woofitos corriendo en http://localhost:${PORT}`);
});