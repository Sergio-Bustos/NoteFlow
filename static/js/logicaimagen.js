// --- CONFIGURACIÓN DE CANVAS ---
const canvasVisible = document.getElementById('canvasVisible');
const ctxVisible = canvasVisible.getContext('2d');

const canvasBuffer = document.getElementById('canvasBuffer');
const ctxBuffer = canvasBuffer.getContext('2d');

const fileInput = document.getElementById('upload-input');

// --- VARIABLES DE ESTADO ---
let imgOriginal = new Image();
let zoom = 1;
let angulo = 0;
let filtroMoradoActivo = false;
let dibujando = false;
let xAnterior = 0, yAnterior = 0;

// Array para guardar los trazos del Paint
let trazosPaint = [];

// --- 1. CARGA DE IMAGEN ---
fileInput.addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = () => { imgOriginal.src = reader.result; }
    reader.readAsDataURL(e.target.files[0]);
});

imgOriginal.onload = () => {
    resetearTodo(false); // Resetear estado pero no la imagen
    
    // Dimensiones basadas en la imagen original
    canvasVisible.width = imgOriginal.width;
    canvasVisible.height = imgOriginal.height;
    
    // El buffer siempre tiene el tamaño de la imagen original
    canvasBuffer.width = imgOriginal.width;
    canvasBuffer.height = imgOriginal.height;

    actualizarLienzoCompleto();
};

// --- 2. LÓGICA DE PROCESAMIENTO (FILTROS Y TRANSFORMACIÓN) ---

// Esta función redibuja todo el lienzo respetando el orden de capas
function actualizarLienzoCompleto() {
    if (!imgOriginal.src) return;

    // CAPA 1: Procesar Imagen con Filtros y Transformaciones en el BUFFER
    procesarImagenEnBuffer();

    // CAPA 2: Limpiar el canvas visible y copiar el buffer procesado
    ctxVisible.clearRect(0, 0, canvasVisible.width, canvasVisible.height);
    
    // Aplicamos Zoom y Rotación VISUAL al canvas visible (más eficiente)
    canvasVisible.style.transform = `scale(${zoom}) rotate(${angulo}deg)`;
    
    // Copiamos la imagen procesada
    ctxVisible.drawImage(canvasBuffer, 0, 0);

    // CAPA 3: Redibujar los trazos del Paint ENCIMA
    redibujarTrazosPaint();
}

// Aplica Brillo, Contraste, Saturación, Grises y Morado al Canvas Oculto
function procesarImagenEnBuffer() {
    ctxBuffer.save();
    ctxBuffer.clearRect(0, 0, canvasBuffer.width, canvasBuffer.height);

    // Obtener valores de los sliders
    const b = document.getElementById('brightness').value;
    const c = document.getElementById('contrast').value;
    const s = document.getElementById('saturation').value;
    const g = document.getElementById('grayscale').value;

    // Aplicar filtros nativos de Canvas
    ctxBuffer.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) grayscale(${g}%)`;
    
    // Dibujar la imagen original en el buffer con los filtros
    ctxBuffer.drawImage(imgOriginal, 0, 0);
    
    // Aplicar Filtro Morado "Multiply" si está activo
    if (filtroMoradoActivo) {
        ctxBuffer.fillStyle = "rgba(139, 92, 246, 0.3)"; // Morado Gartic
        ctxBuffer.globalCompositeOperation = "multiply";
        ctxBuffer.fillRect(0, 0, canvasBuffer.width, canvasBuffer.height);
    }

    ctxBuffer.restore(); // Restaurar estado para el siguiente dibujado
}

// Escuchar cambios en los sliders de filtros
const sliders = document.querySelectorAll('.filter-slider');
sliders.forEach(slider => {
    slider.addEventListener('input', actualizarLienzoCompleto);
});

// --- 3. FUNCIONES DE TRANSFORMACIÓN (ZOOM Y ROTACIÓN) ---

function ajustarZoom(valor) {
    zoom += valor;
    if (zoom < 0.1) zoom = 0.1; // Límite mínimo
    actualizarLienzoCompleto();
}

function rotar(grados) {
    angulo += grados;
    actualizarLienzoCompleto();
}

function toggleFiltroMorado() {
    filtroMoradoActivo = !filtroMoradoActivo;
    const btn = document.getElementById('btnFiltroMorado');
    btn.classList.toggle('active');
    actualizarLienzoCompleto();
}

// --- 4. LÓGICA DE PAINT (DIBUJO) ---

// Función matemática para calcular la posición real del mouse 
// considerando el Zoom y la Rotación visual del canvas.
function obtenerPosicionReal(e) {
    const rect = canvasVisible.getBoundingClientRect();
    
    // Ajuste por el escalado visual (zoom)
    const scaleX = canvasVisible.width / rect.width;
    const scaleY = canvasVisible.height / rect.height;

    // Coordenadas relativas al elemento canvas
    let xRel = (e.clientX - rect.left) * scaleX;
    let yRel = (e.clientY - rect.top) * scaleY;

    return { x: xRel, y: yRel };
}

canvasVisible.addEventListener('mousedown', (e) => {
    if (!imgOriginal.src) return;
    dibujando = true;
    const pos = obtenerPosicionReal(e);
    xAnterior = pos.x;
    yAnterior = pos.y;
    
    // Empezar un nuevo trazo
    trazosPaint.push({
        color: document.getElementById('colorPincel').value,
        grosor: document.getElementById('grosorPincel').value,
        puntos: [{ x: pos.x, y: pos.y }]
    });
});

canvasVisible.addEventListener('mousemove', (e) => {
    if (!dibujando || !imgOriginal.src) return;
    const pos = obtenerPosicionReal(e);

    // Dibujar trazo en caliente (para feedback visual)
    ctxVisible.beginPath();
    ctxVisible.moveTo(xAnterior, yAnterior);
    ctxVisible.lineTo(pos.x, pos.y);
    ctxVisible.strokeStyle = document.getElementById('colorPincel').value;
    ctxVisible.lineWidth = document.getElementById('grosorPincel').value;
    ctxVisible.lineCap = "round";
    ctxVisible.lineJoin = "round";
    ctxVisible.stroke();

    // Guardar el punto en el último trazo
    trazosPaint[trazosPaint.length - 1].puntos.push({ x: pos.x, y: pos.y });

    xAnterior = pos.x;
    yAnterior = pos.y;
});

window.addEventListener('mouseup', () => dibujando = false);

// Redibuja todos los trazos guardados en el array
function redibujarTrazosPaint() {
    trazosPaint.forEach(trazo => {
        if (trazo.puntos.length < 2) return;
        
        ctxVisible.beginPath();
        ctxVisible.moveTo(trazo.puntos[0].x, trazo.puntos[0].y);
        
        ctxVisible.strokeStyle = trazo.color;
        ctxVisible.lineWidth = trazo.grosor;
        ctxVisible.lineCap = "round";
        ctxVisible.lineJoin = "round";

        for (let i = 1; i < trazo.puntos.length; i++) {
            ctxVisible.lineTo(trazo.puntos[i].x, trazo.puntos[i].y);
        }
        ctxVisible.stroke();
    });
}

function limpiarDibujo() {
    trazosPaint = []; // Vaciar el array de trazos
    actualizarLienzoCompleto();
}

// --- 5. ACCIONES FINALES ---

function resetearTodo(limpiarImagen = true) {
    zoom = 1;
    angulo = 0;
    filtroMoradoActivo = false;
    document.getElementById('btnFiltroMorado').classList.remove('active');
    
    // Resetear sliders a valores por defecto
    sliders.forEach(f => f.value = f.id === 'grayscale' ? 0 : 100);
    
    trazosPaint = []; // Limpiar Paint

    if (limpiarImagen) {
        imgOriginal = new Image();
        ctxVisible.clearRect(0, 0, canvasVisible.width, canvasVisible.height);
        canvasVisible.style.transform = "none";
    } else {
        actualizarLienzoCompleto();
    }
}

// Descarga la imagen con filtros y el Paint (pero sin la rotación/zoom visual)
function descargarResultado() {
    if (!imgOriginal.src) return;

    // Para descargar, necesitamos dibujar el Paint encima del Buffer procesado
    procesarImagenEnBuffer(); // Asegurar que el buffer tiene los filtros actualizados
    
    // Dibujamos los trazos del Paint en el buffer oculto
    trazosPaint.forEach(trazo => {
        if (trazo.puntos.length < 2) return;
        ctxBuffer.beginPath();
        ctxBuffer.moveTo(trazo.puntos[0].x, trazo.puntos[0].y);
        ctxBuffer.strokeStyle = trazo.color;
        ctxBuffer.lineWidth = trazo.grosor;
        ctxBuffer.lineCap = "round";
        ctxBuffer.lineJoin = "round";
        for (let i = 1; i < trazo.puntos.length; i++) {
            ctxBuffer.lineTo(trazo.puntos[i].x, trazo.puntos[i].y);
        }
        ctxBuffer.stroke();
    });

    // Descargar el contenido del Buffer
    const link = document.createElement('a');
    link.download = 'GarticPhoto_PRO.png';
    link.href = canvasBuffer.toDataURL();
    link.click();
}

async function enviarABaseDeDatos() {
    if (!imgOriginal.src) {
        alert("No hay ninguna imagen para guardar.");
        return;
    }

    // 1. Preparamos el canvas final (Filtros + Paint)
    procesarImagenEnBuffer(); 
    
    // Dibujamos los trazos del Paint en el buffer antes de convertir
    trazosPaint.forEach(trazo => {
        if (trazo.puntos.length < 2) return;
        ctxBuffer.beginPath();
        ctxBuffer.moveTo(trazo.puntos[0].x, trazo.puntos[0].y);
        ctxBuffer.strokeStyle = trazo.color;
        ctxBuffer.lineWidth = trazo.grosor;
        ctxBuffer.lineCap = "round";
        ctxBuffer.stroke();
    });

    // 2. Convertimos el canvas a un String Base64
    const imagenBase64 = canvasBuffer.toDataURL('image/png');
    
    // 3. Obtenemos el nombre (puedes usar el nombre del archivo original o un prompt)
    const nombreImagen = prompt("Dale un nombre a tu creación:", "mi_dibujo_pro");

    if (!nombreImagen) return;

    // 4. Estructura para PostgreSQL
    const datosParaDB = {
        nombre: nombreImagen,
        formato: "png",
        data: imagenBase64, // Este es el texto largo que irá a la columna TEXT
        fecha: new Date().toISOString()
    };

    console.log("Enviando a PostgreSQL...", datosParaDB);


    alert("¡Imagen procesada! En la consola (F12) puedes ver el código Base64 listo para tu INSERT de SQL.");
}