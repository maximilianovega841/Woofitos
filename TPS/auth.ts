document.addEventListener('DOMContentLoaded', () => {
    // La dirección de nuestro servidor Node.js corriendo en XAMPP
    const URL_API = 'http://localhost:3000/api';

    // ==========================================
    // 1. INTERCAMBIO VISUAL DE PESTAÑAS (SPA)
    // ==========================================
    const sectionLogin = document.getElementById('section-login') as HTMLDivElement | null;
    const sectionRegister = document.getElementById('section-register') as HTMLDivElement | null;
    
    const linkToRegister = document.getElementById('link-to-register') as HTMLAnchorElement | null;
    const linkToLogin = document.getElementById('link-to-login') as HTMLAnchorElement | null;

    if (linkToRegister && linkToLogin && sectionLogin && sectionRegister) {
        linkToRegister.addEventListener('click', (e: Event) => {
            e.preventDefault();
            sectionLogin.classList.add('hidden-section');
            sectionRegister.classList.remove('hidden-section');
        });

        linkToLogin.addEventListener('click', (e: Event) => {
            e.preventDefault();
            sectionRegister.classList.add('hidden-section');
            sectionLogin.classList.remove('hidden-section');
        });
    }

    // ==========================================
    // 2. INTERACTIVIDAD DE LOS OJITOS (VER CONTRASEÑAS)
    // ==========================================
    // Buscamos todos los íconos de ojo en la página para que funcione en Login y Registro
    const toggleIcons = document.querySelectorAll('.btn-toggle-pass');
    
    toggleIcons.forEach((icon) => {
        const btnToggle = icon as HTMLElement;
        btnToggle.style.cursor = 'pointer';
        
        btnToggle.addEventListener('click', () => {
            const wrapper = btnToggle.parentElement;
            if (wrapper) {
                const inputPass = wrapper.querySelector('input') as HTMLInputElement | null;
                if (inputPass) {
                    if (inputPass.type === 'password') {
                        inputPass.type = 'text';
                        btnToggle.classList.remove('fa-eye');
                        btnToggle.classList.add('fa-eye-slash');
                    } else {
                        inputPass.type = 'password';
                        btnToggle.classList.remove('fa-eye-slash');
                        btnToggle.classList.add('fa-eye');
                    }
                }
            }
        });
    });

    // ==========================================
    // 3. CONTROL DEL ENVÍO DE DATOS - LOGIN
    // ==========================================
    const btnIngresar = document.querySelector('#form-login .btn-food') as HTMLButtonElement | null;
    const txtUser = document.getElementById('login-user') as HTMLInputElement | null;
    const inputPass = document.getElementById('login-pass') as HTMLInputElement | null;

    if (btnIngresar && txtUser && inputPass) {
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

    // ==========================================
    // 4. CONTROL DEL ENVÍO DE DATOS - REGISTRO
    // ==========================================
    const btnRegistrarse = document.querySelector('#section-register .btn-food') as HTMLButtonElement | null;
    const txtRegUser = document.getElementById('reg-user') as HTMLInputElement | null;
    const inputRegPass = document.getElementById('reg-pass') as HTMLInputElement | null;
    const inputRegPassConfirm = document.getElementById('reg-pass-confirm') as HTMLInputElement | null;
    const formRegister = document.getElementById('form-register') as HTMLFormElement | null;

    if (btnRegistrarse && txtRegUser && inputRegPass && inputRegPassConfirm) {
        btnRegistrarse.addEventListener('click', async (e) => {
            e.preventDefault(); // Evitamos recarga de página

            const username = txtRegUser.value.trim();
            const password = inputRegPass.value.trim();
            const passwordConfirm = inputRegPassConfirm.value.trim();

            // 1. Verificación de campos vacíos
            if (!username || !password || !passwordConfirm) {
                alert('Por favor, llena todos los campos para el registro.');
                return;
            }

            // 2. Verificación de coincidencia de contraseñas
            if (password !== passwordConfirm) {
                alert('❌ Las contraseñas no coinciden. Por favor, verifica.');
                return;
            }

            try {
                // Petición POST de registro hacia Node.js
                const respuesta = await fetch(`${URL_API}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const resultado = await respuesta.json();

                // Si el servidor responde con error (ej. usuario ya existente)
                if (!respuesta.ok) {
                    alert(resultado.error || 'Error al intentar registrar el usuario.');
                    return;
                }

                alert(`✨ ¡Usuario registrado con éxito! Ya puedes iniciar sesión. 🐾`);

                // Limpiamos los campos del registro si el formulario existe
                if (formRegister) {
                    formRegister.reset();
                }

                // Alternamos la vista para regresar al Login automáticamente tras el éxito
                if (sectionLogin && sectionRegister) {
                    sectionRegister.classList.add('hidden-section');
                    sectionLogin.classList.remove('hidden-section');
                }

            } catch (error) {
                console.error('Error de conexión:', error);
                alert('No se pudo establecer comunicación con el servidor. Revisa si tu API de Node está encendida.');
            }
        });
    }
});