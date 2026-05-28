"use strict";
// Esperamos a que todo el HTML del Dashboard cargue correctamente
document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. ANIMACIÓN DE LOS CONTADORES DIARIOS
    // ==========================================
    const animarContador = (elementoId, valorFinal) => {
        const elemento = document.getElementById(elementoId);
        if (!elemento)
            return;
        let valorActual = 0;
        // Calculamos un incremento para que la animación se vea suave
        const incremento = Math.ceil(valorFinal / 40);
        const intervalo = setInterval(() => {
            valorActual += incremento;
            // Si nos pasamos o llegamos al valor final, frenamos el cronómetro
            if (valorActual >= valorFinal) {
                valorActual = valorFinal;
                clearInterval(intervalo);
            }
            // Pintamos el número actual en el HTML
            elemento.textContent = `${valorActual}%`;
        }, 25); // Velocidad en milisegundos por cada paso
    };
    // Mandamos a llamar la animación con los datos actuales de Woofitos
    animarContador('nivel-comida', 85);
    animarContador('nivel-agua', 92);
    // ==========================================
    // 2. INTERACTIVIDAD EN LOS BOTONES DE ACCIÓN
    // ==========================================
    const btnComida = document.querySelector('.btn-food');
    const btnAgua = document.querySelector('.btn-water');
    // Lógica para el botón de servir Comida
    if (btnComida) {
        btnComida.addEventListener('click', () => {
            const textoOriginal = btnComida.textContent;
            // Deshabilitamos el botón para que el usuario no dé mil clics seguidos
            btnComida.disabled = true;
            btnComida.textContent = 'Dispensando...';
            btnComida.style.opacity = '0.7';
            // Simulamos el tiempo físico que tardaría el servomotor en girar (2 segundos)
            setTimeout(() => {
                btnComida.disabled = false;
                btnComida.textContent = textoOriginal;
                btnComida.style.opacity = '1';
                alert('Plato de comida lleno');
            }, 2000);
        });
    }
    // Lógica para el botón de servir Agua
    if (btnAgua) {
        btnAgua.addEventListener('click', () => {
            const textoOriginal = btnAgua.textContent;
            btnAgua.disabled = true;
            btnAgua.textContent = 'Sirviendo agua... 💧';
            btnAgua.style.opacity = '0.7';
            // Simulamos el tiempo que tardaría la mini bomba de agua en llenarse
            setTimeout(() => {
                btnAgua.disabled = false;
                btnAgua.textContent = textoOriginal;
                btnAgua.style.opacity = '1';
                alert('Plato de agua rellenado con éxito');
            }, 2000);
        });
    }
});
