console.log("Sistema de Notas Gartic cargado");

// Función para formatos básicos (Negrita, etc)
function aplicarFormato(comando, e) {
    if (e) e.preventDefault(); 
    document.execCommand(comando, false, null);
    document.getElementById('cuerpo-nota').focus();
}

// Función para tamaño
function cambiarTamano(valor) {
    document.execCommand('fontSize', false, valor);
    document.getElementById('cuerpo-nota').focus();
}

// Función para el Color Pro
function cambiarColor(color) {
    document.execCommand('foreColor', false, color);
    
    // Actualizamos el círculo visual de la paleta
    const visual = document.getElementById('colorMuestra');
    if (visual) {
        visual.style.backgroundColor = color;
    }
    
    document.getElementById('cuerpo-nota').focus();
}

// Función de Guardado
function guardarEnPostgres() {
    const titulo = document.getElementById('titulo-nota').value.trim();
    const contenido = document.getElementById('cuerpo-nota').innerHTML;

    if (!titulo) {
        alert("¡Ponle un nombre al archivo!");
        document.getElementById('titulo-nota').focus();
        return;
    }

    if (document.getElementById('cuerpo-nota').innerText.trim() === "") {
        alert("La nota está vacía.");
        return;
    }

    // Objeto listo para PostgreSQL
    const datosParaEnviar = {
        nombre_archivo: titulo,
        html_contenido: contenido,
        fecha: new Date().toLocaleString()
    };

    console.log("ENVIANDO A POSTGRESQL:", datosParaEnviar);
    alert(`Archivo "${titulo}" capturado con éxito.\nListo para enviarlo al servidor.`);
}