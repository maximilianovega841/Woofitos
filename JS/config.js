"use strict";

document.addEventListener('DOMContentLoaded', () => {

    const URL_API = 'https://woofitos-production.up.railway.app/api';

    // ── Sesión ──
    const usuarioId     = sessionStorage.getItem('usuario_id');
    const usuarioNombre = sessionStorage.getItem('usuario_nombre');

    // ── Protección de ruta: si no hay sesión, mandar al login ──
    if (!usuarioId) {
        window.location.href = 'login.html';
        return;
    }

    // Mostrar nombre en sección cuenta
    const cuentaUsername = document.getElementById('cuenta-username');
    if (cuentaUsername) cuentaUsername.textContent = usuarioNombre || '—';

    // ==========================================
    // 1. HEADER DINÁMICO
    // ==========================================
    const navAuthItem = document.getElementById('nav-auth-item');
    if (navAuthItem) {
        if (!usuarioId) {
            navAuthItem.innerHTML = `
                <a href="login.html" class="profile">
                    <img src="/img/login.png" alt="Perfil" class="avatar">
                    <span class="profile-text">Login</span>
                </a>`;
        } else {
            navAuthItem.innerHTML = `
                <div class="profile-dropdown-wrapper">
                    <button class="profile profile-btn" id="btn-perfil-toggle" aria-expanded="false">
                        <img src="/img/login.png" alt="Perfil" class="avatar">
                        <span class="profile-text">${usuarioNombre}</span>
                        <i class="profile-chevron">▾</i>
                    </button>
                    <div class="profile-dropdown" id="profile-dropdown" role="menu">
                        <button class="dropdown-item" id="btn-editar-perfil">✏️ Editar perfil</button>
                        <hr class="dropdown-divider">
                        <button class="dropdown-item dropdown-item--danger" id="btn-cerrar-sesion">🚪 Cerrar sesión</button>
                    </div>
                </div>`;

            const btnToggle = document.getElementById('btn-perfil-toggle');
            const dropdown  = document.getElementById('profile-dropdown');

            btnToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('dropdown--open');
                btnToggle.setAttribute('aria-expanded', dropdown.classList.contains('dropdown--open'));
            });
            document.addEventListener('click', () => {
                dropdown.classList.remove('dropdown--open');
                btnToggle.setAttribute('aria-expanded', false);
            });

            document.getElementById('btn-cerrar-sesion').addEventListener('click', cerrarSesion);

            // Modal perfil
            const modalPerfil     = document.getElementById('modal-perfil');
            const btnEditarPerfil = document.getElementById('btn-editar-perfil');
            const btnCerrarModal  = document.getElementById('btn-cerrar-modal');
            const formPerfil      = document.getElementById('form-perfil');

            btnEditarPerfil.addEventListener('click', () => {
                document.getElementById('perfil-username').value = usuarioNombre || '';
                modalPerfil.classList.remove('hidden-section');
                document.body.style.overflow = 'hidden';
            });
            btnCerrarModal.addEventListener('click', () => {
                modalPerfil.classList.add('hidden-section');
                document.body.style.overflow = '';
            });
            modalPerfil.addEventListener('click', (e) => {
                if (e.target === modalPerfil) {
                    modalPerfil.classList.add('hidden-section');
                    document.body.style.overflow = '';
                }
            });

            if (formPerfil) {
                formPerfil.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const username        = document.getElementById('perfil-username').value.trim();
                    const email           = document.getElementById('perfil-email').value.trim();
                    const nombre_completo = document.getElementById('perfil-nombre').value.trim();
                    const password        = document.getElementById('perfil-pass').value.trim();
                    if (!username) { alert('El nombre no puede quedar vacío.'); return; }
                    try {
                        const resp = await fetch(`${URL_API}/usuarios/actualizar`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id_usuario: usuarioId, username, email, nombre_completo, password })
                        });
                        const res = await resp.json();
                        if (!resp.ok) { alert(res.error || 'Error al actualizar.'); return; }
                        sessionStorage.setItem('usuario_nombre', username);
                        alert('✅ ¡Perfil actualizado!');
                        modalPerfil.classList.add('hidden-section');
                        document.body.style.overflow = '';
                        location.reload();
                    } catch (err) { alert('Error de conexión.'); }
                });
            }
        }
    }

    // ==========================================
    // 2. HAMBURGUESA
    // ==========================================
    const btnHamburger = document.getElementById('btn-hamburger');
    const mainNav      = document.getElementById('main-nav');

    if (btnHamburger && mainNav) {
        btnHamburger.addEventListener('click', () => {
            btnHamburger.classList.toggle('is-open');
            mainNav.classList.toggle('nav--open');
        });
    }

    // ==========================================
    // 3. CERRAR SESIÓN
    // ==========================================
    function cerrarSesion() {
        sessionStorage.removeItem('usuario_id');
        sessionStorage.removeItem('usuario_nombre');
        window.location.href = 'index.html';
    }

    const btnLogoutConfig = document.getElementById('btn-logout-config');
    if (btnLogoutConfig) btnLogoutConfig.addEventListener('click', cerrarSesion);

    // ==========================================
    // 4. CARGAR DISPOSITIVOS
    // ==========================================
    const listaDiv       = document.getElementById('lista-dispositivos');
    const emptyDiv       = document.getElementById('dispositivos-empty');

    const renderDispositivos = (dispositivos) => {
        // Limpiar lista (excepto el empty placeholder)
        const cards = listaDiv.querySelectorAll('.device-card');
        cards.forEach(c => c.remove());

        if (!dispositivos || dispositivos.length === 0) {
            emptyDiv.classList.remove('hidden-section');
            return;
        }

        emptyDiv.classList.add('hidden-section');

        dispositivos.forEach(disp => {
            const fecha = disp.fecha_vinculacion
                ? new Date(disp.fecha_vinculacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Sin fecha';

            const card = document.createElement('div');
            card.className = 'device-card';
            card.innerHTML = `
                <div class="device-card-header">
                    <div class="device-icon">🐾</div>
                    <div class="device-info">
                        <p class="device-name">${disp.nombre_mascota || 'Mi Woofito'}</p>
                        <p class="device-id">${disp.id_dispositivo}</p>
                    </div>
                </div>
                <p class="device-date">Vinculado el ${fecha}</p>
                <div class="device-actions">
                    <button class="btn-device-edit" data-id="${disp.id_dispositivo}" data-nombre="${disp.nombre_mascota || ''}">✏️ Renombrar</button>
                    <button class="btn-device-delete" data-id="${disp.id_dispositivo}">🗑️</button>
                </div>`;
            listaDiv.insertBefore(card, emptyDiv);
        });

        // Eventos de editar
        listaDiv.querySelectorAll('.btn-device-edit').forEach(btn => {
            btn.addEventListener('click', () => abrirEditarDispositivo(btn.dataset.id, btn.dataset.nombre));
        });

        // Eventos de eliminar
        listaDiv.querySelectorAll('.btn-device-delete').forEach(btn => {
            btn.addEventListener('click', () => eliminarDispositivo(btn.dataset.id));
        });
    };

    const cargarDispositivos = async () => {
        if (!usuarioId) return;
        try {
            const resp = await fetch(`${URL_API}/dispositivos/${usuarioId}`);
            if (!resp.ok) return;
            const data = await resp.json();
            renderDispositivos(data.dispositivos || []);
        } catch (err) {
            console.error('Error al cargar dispositivos:', err);
        }
    };

    cargarDispositivos();

    // ==========================================
    // 5. MODAL AGREGAR DISPOSITIVO
    // ==========================================
    const modalAgregar   = document.getElementById('modal-agregar');
    const btnAgregar     = document.getElementById('btn-agregar-dispositivo');
    const btnAgregarEmpty = document.getElementById('btn-agregar-empty');
    const btnCerrarAgregar = document.getElementById('btn-cerrar-agregar');
    const btnVincular    = document.getElementById('btn-vincular');
    const inputCodigo    = document.getElementById('input-codigo');
    const inputNombreMascota = document.getElementById('input-nombre-mascota');
    const msgVincular    = document.getElementById('msg-vincular');

    const abrirModalAgregar = () => {
        inputCodigo.value = '';
        inputNombreMascota.value = '';
        msgVincular.className = 'pair-msg hidden-section';
        msgVincular.textContent = '';
        modalAgregar.classList.remove('hidden-section');
        document.body.style.overflow = 'hidden';
        setTimeout(() => inputCodigo.focus(), 100);
    };

    const cerrarModalAgregar = () => {
        modalAgregar.classList.add('hidden-section');
        document.body.style.overflow = '';
    };

    btnAgregar.addEventListener('click', abrirModalAgregar);
    if (btnAgregarEmpty) btnAgregarEmpty.addEventListener('click', abrirModalAgregar);
    btnCerrarAgregar.addEventListener('click', cerrarModalAgregar);
    modalAgregar.addEventListener('click', (e) => { if (e.target === modalAgregar) cerrarModalAgregar(); });

    // Forzar mayúsculas en el input del código
    inputCodigo.addEventListener('input', () => {
        inputCodigo.value = inputCodigo.value.toUpperCase();
    });

    btnVincular.addEventListener('click', async () => {
        const codigo       = inputCodigo.value.trim().toUpperCase();
        const nombreMascota = inputNombreMascota.value.trim();

        if (!codigo) {
            mostrarMsg(msgVincular, 'Por favor ingresa el código del Woofito.', 'error');
            return;
        }
        if (!usuarioId) {
            mostrarMsg(msgVincular, 'Debes iniciar sesión para vincular un dispositivo.', 'error');
            return;
        }

        btnVincular.disabled = true;
        btnVincular.textContent = 'Vinculando...';

        try {
            const resp = await fetch(`${URL_API}/dispositivos/vincular`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: usuarioId, codigo, nombre_mascota: nombreMascota })
            });
            const data = await resp.json();

            if (!resp.ok) {
                mostrarMsg(msgVincular, data.error || 'No se pudo vincular el dispositivo.', 'error');
            } else {
                mostrarMsg(msgVincular, `✅ ¡${nombreMascota || 'Woofito'} vinculado con éxito!`, 'ok');
                setTimeout(() => {
                    cerrarModalAgregar();
                    cargarDispositivos();
                }, 1500);
            }
        } catch (err) {
            mostrarMsg(msgVincular, 'Error de conexión con el servidor.', 'error');
        } finally {
            btnVincular.disabled = false;
            btnVincular.textContent = 'Vincular Woofito 🐾';
        }
    });

    // ==========================================
    // 6. MODAL EDITAR DISPOSITIVO
    // ==========================================
    const modalEditar      = document.getElementById('modal-editar-disp');
    const btnCerrarEditar  = document.getElementById('btn-cerrar-editar-disp');
    const inputEditarNombre = document.getElementById('editar-nombre-mascota');
    const inputEditarId    = document.getElementById('editar-disp-id');
    const btnGuardarEditar = document.getElementById('btn-guardar-editar');
    const msgEditar        = document.getElementById('msg-editar');

    const abrirEditarDispositivo = (id, nombre) => {
        inputEditarId.value    = id;
        inputEditarNombre.value = nombre;
        msgEditar.className = 'pair-msg hidden-section';
        modalEditar.classList.remove('hidden-section');
        document.body.style.overflow = 'hidden';
        setTimeout(() => inputEditarNombre.focus(), 100);
    };

    const cerrarEditarDispositivo = () => {
        modalEditar.classList.add('hidden-section');
        document.body.style.overflow = '';
    };

    btnCerrarEditar.addEventListener('click', cerrarEditarDispositivo);
    modalEditar.addEventListener('click', (e) => { if (e.target === modalEditar) cerrarEditarDispositivo(); });

    btnGuardarEditar.addEventListener('click', async () => {
        const id     = inputEditarId.value;
        const nombre = inputEditarNombre.value.trim();
        if (!nombre) { mostrarMsg(msgEditar, 'El nombre no puede estar vacío.', 'error'); return; }

        btnGuardarEditar.disabled = true;
        try {
            const resp = await fetch(`${URL_API}/dispositivos/renombrar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_dispositivo: id, nombre_mascota: nombre })
            });
            const data = await resp.json();
            if (!resp.ok) {
                mostrarMsg(msgEditar, data.error || 'Error al renombrar.', 'error');
            } else {
                mostrarMsg(msgEditar, '✅ ¡Nombre actualizado!', 'ok');
                setTimeout(() => { cerrarEditarDispositivo(); cargarDispositivos(); }, 1200);
            }
        } catch (err) {
            mostrarMsg(msgEditar, 'Error de conexión.', 'error');
        } finally {
            btnGuardarEditar.disabled = false;
        }
    });

    // ==========================================
    // 7. ELIMINAR DISPOSITIVO
    // ==========================================
    const eliminarDispositivo = async (id) => {
        if (!confirm(`¿Seguro que quieres desvincular el dispositivo ${id}? Esta acción no se puede deshacer.`)) return;
        try {
            const resp = await fetch(`${URL_API}/dispositivos/eliminar`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_dispositivo: id, usuario_id: usuarioId })
            });
            const data = await resp.json();
            if (!resp.ok) { alert(data.error || 'Error al eliminar.'); return; }
            cargarDispositivos();
        } catch (err) {
            alert('Error de conexión.');
        }
    };

    // ==========================================
    // 8. UTILS
    // ==========================================
    const mostrarMsg = (el, texto, tipo) => {
        el.textContent = texto;
        el.className = `pair-msg msg--${tipo}`;
    };

    // Cerrar modales con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModalAgregar();
            cerrarEditarDispositivo();
        }
    });
});