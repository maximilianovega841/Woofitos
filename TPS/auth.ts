document.addEventListener('DOMContentLoaded', () => {
    // La dirección de nuestro servidor Node.js corriendo en XAMPP
    const URL_API = 'http://localhost:3000/api';

    // ==========================================
    // 1. INTERACTIVIDAD DEL OJITO (VER CONTRASEÑA)
    // ==========================================
    const inputPass = document.getElementById('login-pass') as HTMLInputElement | null;
    const btnToggle = document.querySelector('.btn-toggle-pass') as HTMLElement | null;

    if (inputPass && btnToggle) {
        btnToggle.style.cursor = 'pointer';
        btnToggle.addEventListener('click', () => {
            if (inputPass.type === 'password') {
                inputPass.type = 'text';
                btnToggle.classList.remove('fa-eye');
                btnToggle.classList.add('fa-eye-slash');
            } else {
                inputPass.type = 'password';
                btnToggle.classList.remove('fa-eye-slash');
                btnToggle.classList.add('fa-eye');
            }
        });
    }

    // ==========================================
    // 2. CONTROL DEL ENVÍO DE DATOS DIRECTO AL BOTÓN
    // ==========================================
    // Buscamos el botón "Ingresar" directamente por sus clases
    const btnIngresar = document.querySelector('.btn-food') as HTMLButtonElement | null;
    const txtUser = document.getElementById('login-user') as HTMLInputElement | null;

    if (btnIngresar && txtUser && inputPass) {
        // Escuchamos el CLICK directo en el botón
        btnIngresar.addEventListener('click', async (e) => {
            e.preventDefault(); // Evitamos que la página intente recargarse sola

            const username = txtUser.value.trim();
            const password = inputPass.value.trim();

            // Verificación rápida por si diste clic sin escribir nada
            if (!username || !password) {
                alert('Por favor, llena ambos campos (Usuario y Contraseña).');
                return;
            }

            try {
                // Petición POST hacia Node.js
                const respuesta = await fetch(`${URL_API}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const resultado = await respuesta.json();

                // Si el servidor responde con error (ej. código 401)
                if (!respuesta.ok) {
                    alert(resultado.error || 'Error al iniciar sesión');
                    return;
                }

                // Si las credenciales son correctas
                alert(`¡Bienvenido de vuelta, ${resultado.usuario.username}! 🐾`);

                // Guardamos la sesión en el navegador de manera nativa
                sessionStorage.setItem('usuario_id', resultado.usuario.id);
                sessionStorage.setItem('usuario_nombre', resultado.usuario.username);

                // Te manda al Dashboard principal
                window.location.href = 'index.html';

            } catch (error) {
                console.error('Error de conexión:', error);
                alert('No se pudo establecer comunicación con el servidor. Verifica que tu consola "node server.js" esté encendida.');
            }
        });
    }
});