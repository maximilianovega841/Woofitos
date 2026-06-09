"use strict";

document.addEventListener('DOMContentLoaded', () => {

    const URL_API = 'https://woofitos-production.up.railway.app/api';

    // ==========================================
    // 1. ANIMACIÓN DE LOS CONTADORES DIARIOS
    // ==========================================
    const animarContador = (elementoId, valorFinal) => {
        const elemento = document.getElementById(elementoId);
        if (!elemento) return;
        let valorActual = 0;
        const incremento = Math.ceil(valorFinal / 40);
        const intervalo = setInterval(() => {
            valorActual += incremento;
            if (valorActual >= valorFinal) { valorActual = valorFinal; clearInterval(intervalo); }
            elemento.textContent = `${valorActual}%`;
        }, 25);
    };

    animarContador('nivel-comida', 85);
    animarContador('nivel-agua', 92);

    // ==========================================
    // 2. BOTONES DE ACCIÓN
    // ==========================================
    const btnComida = document.querySelector('.btn-food');
    const btnAgua   = document.querySelector('.btn-water');

    if (btnComida) {
        btnComida.addEventListener('click', () => {
            const t = btnComida.textContent;
            btnComida.disabled = true; btnComida.textContent = 'Dispensando...'; btnComida.style.opacity = '0.7';
            setTimeout(() => { btnComida.disabled = false; btnComida.textContent = t; btnComida.style.opacity = '1'; alert('Plato de comida lleno'); }, 2000);
        });
    }
    if (btnAgua) {
        btnAgua.addEventListener('click', () => {
            const t = btnAgua.textContent;
            btnAgua.disabled = true; btnAgua.textContent = 'Sirviendo agua... 💧'; btnAgua.style.opacity = '0.7';
            setTimeout(() => { btnAgua.disabled = false; btnAgua.textContent = t; btnAgua.style.opacity = '1'; alert('Plato de agua rellenado con éxito'); }, 2000);
        });
    }

    // ==========================================
    // 3. HEADER DINÁMICO: LOGIN vs PERFIL
    // ==========================================
    const navAuthItem = document.getElementById('nav-auth-item');
    if (!navAuthItem) return;

    const usuarioId     = sessionStorage.getItem('usuario_id');
    const usuarioNombre = sessionStorage.getItem('usuario_nombre');

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
            const abierto = dropdown.classList.toggle('dropdown--open');
            btnToggle.setAttribute('aria-expanded', abierto);
        });
        document.addEventListener('click', () => {
            dropdown.classList.remove('dropdown--open');
            btnToggle.setAttribute('aria-expanded', false);
        });

        document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
            sessionStorage.removeItem('usuario_id');
            sessionStorage.removeItem('usuario_nombre');
            window.location.href = 'index.html';
        });

        const modalPerfil    = document.getElementById('modal-perfil');
        const btnEditarPerfil = document.getElementById('btn-editar-perfil');
        const btnCerrarModal = document.getElementById('btn-cerrar-modal');
        const formPerfil     = document.getElementById('form-perfil');

        const abrirModal = () => {
            const inp = document.getElementById('perfil-username');
            if (inp) inp.value = usuarioNombre || '';
            modalPerfil.classList.remove('hidden-section');
            document.body.style.overflow = 'hidden';
        };
        const cerrarModal = () => {
            modalPerfil.classList.add('hidden-section');
            document.body.style.overflow = '';
        };

        btnEditarPerfil.addEventListener('click', abrirModal);
        btnCerrarModal.addEventListener('click', cerrarModal);
        modalPerfil.addEventListener('click', (e) => { if (e.target === modalPerfil) cerrarModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

        if (formPerfil) {
            formPerfil.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username        = document.getElementById('perfil-username').value.trim();
                const email           = document.getElementById('perfil-email').value.trim();
                const nombre_completo = document.getElementById('perfil-nombre').value.trim();
                const password        = document.getElementById('perfil-pass').value.trim();
                if (!username) { alert('El nombre de usuario no puede quedar vacío.'); return; }
                try {
                    const resp = await fetch(`${URL_API}/usuarios/actualizar`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id_usuario: usuarioId, username, email, nombre_completo, password })
                    });
                    const res = await resp.json();
                    if (!resp.ok) { alert(res.error || 'Error al actualizar el perfil.'); return; }
                    sessionStorage.setItem('usuario_nombre', username);
                    const span = document.querySelector('#btn-perfil-toggle .profile-text');
                    if (span) span.textContent = username;
                    alert('✅ ¡Perfil actualizado con éxito!');
                    cerrarModal();
                } catch (err) {
                    console.error(err);
                    alert('No se pudo conectar con el servidor.');
                }
            });
        }
    }

    // ==========================================
    // 4. GRÁFICAS EN TIEMPO REAL
    // ==========================================

    // ── Colores de la app ──
    const COLOR_FOOD  = '#ff9f43';
    const COLOR_WATER = '#0083f7';

    // ── Generador de etiquetas de tiempo según vista ──
    const generarEtiquetas = (vista, cantidad) => {
        const ahora = new Date();
        const etiquetas = [];
        for (let i = cantidad - 1; i >= 0; i--) {
            const d = new Date(ahora);
            if (vista === 'horas') {
                d.setMinutes(d.getMinutes() - i * 5);
                etiquetas.push(d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
            } else if (vista === 'dias') {
                d.setHours(d.getHours() - i);
                etiquetas.push(d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
            } else {
                d.setDate(d.getDate() - i);
                etiquetas.push(d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }));
            }
        }
        return etiquetas;
    };

    // ── Generador de datos simulados ──
    const datosAleatorios = (cantidad, min, max) =>
        Array.from({ length: cantidad }, () => +(Math.random() * (max - min) + min).toFixed(1));

    // ── Cantidad de puntos por vista ──
    const puntosPorVista = { horas: 24, dias: 24, meses: 30 };

    // ── Opciones base de Chart.js ──
    const opcionesBase = (labelY, color) => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#fff',
                titleColor: '#212529',
                bodyColor: '#718096',
                borderColor: color,
                borderWidth: 1,
                padding: 10,
                cornerRadius: 10,
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: { font: { family: 'Fredoka', size: 11 }, color: '#718096', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
            },
            y: {
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: { font: { family: 'Fredoka', size: 11 }, color: '#718096' },
                title: { display: true, text: labelY, font: { family: 'Fredoka', size: 12 }, color: '#718096' }
            }
        }
    });

    // ── Crear dataset de línea ──
    const crearDataset = (datos, color, label) => ({
        label,
        data: datos,
        borderColor: color,
        backgroundColor: color + '18',
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        fill: true,
        tension: 0.4,
    });

    // ── Fábrica de gráfica ──
    const crearGrafica = (canvasId, labelY, color, label, min, max) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const vista   = 'horas';
        const puntos  = puntosPorVista[vista];
        const labels  = generarEtiquetas(vista, puntos);
        const datos   = datosAleatorios(puntos, min, max);

        const chart = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets: [crearDataset(datos, color, label)] },
            options: opcionesBase(labelY, color)
        });

        return chart;
    };

    // ── Instanciar las 4 gráficas ──
    const graficas = {
        platoComida:       crearGrafica('chart-plato-comida',      'Gramos (g)',  COLOR_FOOD,  'Comida dispensada', 0,   150),
        contenedorComida:  crearGrafica('chart-contenedor-comida', '% restante',  COLOR_FOOD,  'Nivel contenedor',  20,  100),
        platoAgua:         crearGrafica('chart-plato-agua',        'Mililitros (ml)', COLOR_WATER, 'Agua dispensada', 0, 300),
        contenedorAgua:    crearGrafica('chart-contenedor-agua',   '% restante',  COLOR_WATER, 'Nivel contenedor',  10,  100),
    };

    // ── Configuración de cada gráfica (min/max para simulación) ──
    const configGraficas = {
        platoComida:      { min: 0,  max: 150, labelY: 'Gramos (g)',     labelYkg: null,        color: COLOR_FOOD  },
        contenedorComida: { min: 20, max: 100, labelY: '% restante',     labelYkg: 'kg restante', color: COLOR_FOOD  },
        platoAgua:        { min: 0,  max: 300, labelY: 'Mililitros (ml)', labelYkg: null,        color: COLOR_WATER },
        contenedorAgua:   { min: 10, max: 100, labelY: '% restante',     labelYkg: null,        color: COLOR_WATER },
    };

    // ── Unidad activa por gráfica (para contenedores con toggle kg) ──
    const unidades = { contenedorComida: '%' };

    // ── Actualizar gráfica con nueva vista ──
    const actualizarGrafica = (key, vista) => {
        const chart = graficas[key];
        const cfg   = configGraficas[key];
        if (!chart || !cfg) return;

        const puntos = puntosPorVista[vista];
        const labels = generarEtiquetas(vista, puntos);

        let min = cfg.min, max = cfg.max, labelY = cfg.labelY;

        // Si el contenedor de comida está en kg, ajustamos escala
        if (key === 'contenedorComida' && unidades.contenedorComida === 'kg') {
            labelY = 'kg restante';
            min = 0; max = 5;
        }

        const datos = datosAleatorios(puntos, min, max);

        chart.data.labels              = labels;
        chart.data.datasets[0].data    = datos;
        chart.options.scales.y.title.text = labelY;
        chart.update();
    };

    // ── Vincular selectores de vista ──
    const selectores = document.querySelectorAll('.chart-view-selector');
    selectores.forEach(sel => {
        sel.addEventListener('change', (e) => {
            const key   = e.target.dataset.chart;
            const vista = e.target.value;
            actualizarGrafica(key, vista);
        });
    });

    // ── Toggle kg/% para contenedor de comida ──
    const btnToggleKg = document.getElementById('btn-toggle-kg');
    if (btnToggleKg) {
        btnToggleKg.addEventListener('click', () => {
            const esKg = unidades.contenedorComida === 'kg';
            unidades.contenedorComida = esKg ? '%' : 'kg';
            btnToggleKg.textContent = esKg ? 'Ver en kg' : 'Ver en %';

            // Obtener vista actual del selector correspondiente
            const sel   = document.querySelector('.chart-view-selector[data-chart="contenedorComida"]');
            const vista = sel ? sel.value : 'horas';
            actualizarGrafica('contenedorComida', vista);
        });
    }

    // ── Tiempo real: añadir un punto nuevo cada 5 segundos ──
    const rangosMax = { horas: 24, dias: 24, meses: 30 };

    const tickTiempoReal = () => {
        Object.keys(graficas).forEach(key => {
            const chart = graficas[key];
            const cfg   = configGraficas[key];
            if (!chart || !cfg) return;

            const sel    = document.querySelector(`.chart-view-selector[data-chart="${key}"]`);
            const vista  = sel ? sel.value : 'horas';
            const maxPts = rangosMax[vista];

            // Solo actualizar en tiempo real en vista de horas (tiene sentido en segundos)
            if (vista !== 'horas') return;

            const ahora   = new Date();
            const nuevaEt = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

            let min = cfg.min, max = cfg.max;
            if (key === 'contenedorComida' && unidades.contenedorComida === 'kg') { min = 0; max = 5; }

            // Nuevo valor: suave variación del último valor
            const ultimo    = chart.data.datasets[0].data.slice(-1)[0] ?? (min + max) / 2;
            const variacion = (Math.random() - 0.5) * (max - min) * 0.08;
            const nuevo     = Math.min(max, Math.max(min, +(ultimo + variacion).toFixed(1)));

            chart.data.labels.push(nuevaEt);
            chart.data.datasets[0].data.push(nuevo);

            if (chart.data.labels.length > maxPts) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }

            chart.update('none'); // sin animación para que sea fluido
        });
    };

    setInterval(tickTiempoReal, 5000);

});