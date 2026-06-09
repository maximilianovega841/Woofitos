"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
document.addEventListener('DOMContentLoaded', () => {
    const URL_API = 'https://woofitos-production.up.railway.app/api';

    const sectionLogin = document.getElementById('section-login');
    const sectionRegister = document.getElementById('section-register');
    const linkToRegister = document.getElementById('link-to-register');
    const linkToLogin = document.getElementById('link-to-login');

    if (linkToRegister && linkToLogin && sectionLogin && sectionRegister) {
        linkToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            sectionLogin.classList.add('hidden-section');
            sectionRegister.classList.remove('hidden-section');
        });
        linkToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            sectionRegister.classList.add('hidden-section');
            sectionLogin.classList.remove('hidden-section');
        });
    }

    const toggleIcons = document.querySelectorAll('.btn-toggle-pass');
    toggleIcons.forEach((icon) => {
        const btnToggle = icon;
        btnToggle.style.cursor = 'pointer';
        btnToggle.addEventListener('click', () => {
            const wrapper = btnToggle.parentElement;
            if (wrapper) {
                const inputPass = wrapper.querySelector('input');
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

    const btnIngresar = document.querySelector('#form-login .btn-food');
    const txtUser = document.getElementById('login-user');
    const inputPass = document.getElementById('login-pass');

    if (btnIngresar && txtUser && inputPass) {
        btnIngresar.addEventListener('click', (e) => __awaiter(void 0, void 0, void 0, function* () {
            e.preventDefault();
            const username = txtUser.value.trim();
            const password = inputPass.value.trim();
            if (!username || !password) {
                alert('Por favor, llena ambos campos (Usuario y Contraseña).');
                return;
            }
            try {
                const respuesta = yield fetch(`${URL_API}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const resultado = yield respuesta.json();
                if (!respuesta.ok) {
                    alert(resultado.error || 'Error al iniciar sesión');
                    return;
                }
                alert(`¡Bienvenido de vuelta, ${resultado.usuario.username}! 🐾`);
                sessionStorage.setItem('usuario_id', resultado.usuario.id);
                sessionStorage.setItem('usuario_nombre', resultado.usuario.username);
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Error de conexión:', error);
                alert('No se pudo conectar con el servidor.');
            }
        }));
    }

    const btnRegistrarse = document.querySelector('#section-register .btn-food');
    const txtRegUser = document.getElementById('reg-user');
    const inputRegPass = document.getElementById('reg-pass');
    const inputRegPassConfirm = document.getElementById('reg-pass-confirm');
    const formRegister = document.getElementById('form-register');

    if (btnRegistrarse && txtRegUser && inputRegPass && inputRegPassConfirm) {
        btnRegistrarse.addEventListener('click', (e) => __awaiter(void 0, void 0, void 0, function* () {
            e.preventDefault();
            const username = txtRegUser.value.trim();
            const password = inputRegPass.value.trim();
            const passwordConfirm = inputRegPassConfirm.value.trim();
            if (!username || !password || !passwordConfirm) {
                alert('Por favor, llena todos los campos para el registro.');
                return;
            }
            if (password !== passwordConfirm) {
                alert('❌ Las contraseñas no coinciden. Por favor, verifica.');
                return;
            }
            try {
                const respuesta = yield fetch(`${URL_API}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const resultado = yield respuesta.json();
                if (!respuesta.ok) {
                    alert(resultado.error || 'Error al intentar registrar el usuario.');
                    return;
                }
                alert(`✨ ¡Usuario registrado con éxito! Ya puedes iniciar sesión. 🐾`);
                if (formRegister) formRegister.reset();
                if (sectionLogin && sectionRegister) {
                    sectionRegister.classList.add('hidden-section');
                    sectionLogin.classList.remove('hidden-section');
                }
            } catch (error) {
                console.error('Error de conexión:', error);
                alert('No se pudo conectar con el servidor.');
            }
        }));
    }
});