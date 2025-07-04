// --- Funciones de Navegación de Secciones ---
const inicioSection = document.getElementById('inicio-content');
const recursosSection = document.getElementById('recursos-content');
const chatSection = document.getElementById('chat-content');

const showInicioBtn = document.getElementById('showInicio');
const showRecursosBtn = document.getElementById('showRecursos');
const showChatBtn = document.getElementById('showChat');

function hideAllSections() {
    inicioSection.classList.add('hidden');
    recursosSection.classList.add('hidden');
    chatSection.classList.add('hidden');
}

showInicioBtn.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllSections();
    inicioSection.classList.remove('hidden');
});

showRecursosBtn.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllSections();
    recursosSection.classList.remove('hidden');
});

showChatBtn.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllSections();
    chatSection.classList.remove('hidden');
});

// Mostrar la sección de inicio por defecto al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    hideAllSections();
    inicioSection.classList.remove('hidden');
});

// --- Funciones para abrir/cerrar Modales Generales ---
function openModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.style.display = 'flex'; // Usamos flex para centrar
        document.body.style.overflow = 'hidden'; // Evita scroll en el body cuando el modal está abierto
    }
}

function closeModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.style.display = 'none';
        document.body.style.overflow = ''; // Restaura el scroll del body
    }
}

// --- Event Listeners para abrir los Modales de Recursos ---
document.getElementById('openEvangelizacionModalBtn').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('evangelizacionModal');
});

document.getElementById('openLibrosModalBtn').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('librosModal');
});

document.getElementById('openDiscipuladoModalBtn').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('discipuladoModal');
});

// --- Event Listeners para cerrar Modales (botones 'x' y clic fuera) ---
// Selecciona todos los botones con la clase 'close-button'
document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', (e) => {
        // Obtiene el ID del modal asociado a este botón de cierre del atributo data-modal
        const modalId = e.target.dataset.modal;
        closeModal(modalId); // Llama a la función para cerrar ese modal
    });
});

// Cierra el modal si se hace clic fuera de su contenido (directamente en el fondo del modal)
window.addEventListener('click', (event) => {
    // Verifica si el clic fue directamente en un elemento con la clase 'modal'
    // y no en su contenido interno
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id); // Cierra el modal usando su ID
    }
});

// --- Lógica Específica para el Modal de Imágenes ---
const modalImage = document.getElementById('modalImage');
const galleryItems = document.querySelectorAll('.image-gallery .gallery-item');

galleryItems.forEach(item => {
    item.addEventListener('click', () => {
        const fullSrc = item.dataset.fullSrc; // Obtiene la ruta de la imagen completa del atributo data-full-src
        if (fullSrc) {
            modalImage.src = fullSrc; // Establece la fuente de la imagen en el modal
            openModal('imageModal'); // Abre el modal de imagen
        }
    });
});

// NOTA: Si tenías código JavaScript para el chat (ej. conexión con Firebase),
// deberías añadirlo aquí, en la parte inferior de este archivo script.js,
// asegurándote de que no haya conflictos con lo ya existente.