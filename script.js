// Importa las funciones necesarias de Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Accede a la configuración de Firebase definida globalmente en index.html
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const messagesRef = ref(database, 'messages');

// --- Generar o recuperar ID de usuario para identificar remitente ---
let userId = sessionStorage.getItem('chatUserId');
if (!userId) {
    // Genera un ID aleatorio único para la sesión del usuario
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('chatUserId', userId); // Guarda el ID en sessionStorage
}

document.addEventListener('DOMContentLoaded', () => {
    // Lógica para el modal de imagen de la galería
    const imageModal = document.getElementById('imageModal');
    const modalImg = document.getElementById('img01');
    const closeButton = document.querySelector('.close-button');

    const galleryItems = document.querySelectorAll('.image-gallery .gallery-item');

    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            imageModal.style.display = 'block'; // Muestra el modal
            modalImg.src = item.getAttribute('data-full-src'); // Establece la imagen grande
        });
    });

    // Cierra el modal cuando se hace clic en la 'x'
    closeButton.addEventListener('click', () => {
        imageModal.style.display = 'none';
    });

    // Cierra el modal cuando se hace clic fuera de la imagen (en el fondo oscuro)
    imageModal.addEventListener('click', (event) => {
        if (event.target === imageModal) {
            imageModal.style.display = 'none';
        }
    });

    // Cierra el modal con la tecla Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && imageModal.style.display === 'block') {
            imageModal.style.display = 'none';
        }
    });

    // Lógica del Chat con Firebase Realtime Database
    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message');
    const sendBtn = document.getElementById('sendBtn');

    if (sendBtn && messageInput && chatBox && app && database && messagesRef) {
        // 1. Escuchar nuevos mensajes de Firebase
        onChildAdded(messagesRef, (snapshot) => {
            const message = snapshot.val(); // Obtiene los datos del mensaje
            // Llama a appendMessage con el texto y el ID del remitente
            appendMessage(message.text, message.senderId); 
        });

        // 2. Enviar mensajes a Firebase
        sendBtn.addEventListener('click', () => {
            const messageText = messageInput.value.trim();
            if (messageText !== '') {
                // Enviar el mensaje a Firebase, incluyendo el ID del remitente
                push(messagesRef, {
                    text: messageText,
                    senderId: userId, // Guarda el ID del usuario actual
                    timestamp: serverTimestamp() // Marca de tiempo del servidor
                });
                messageInput.value = ''; // Limpia el input
            }
        });

        // Permitir enviar con Enter en el input de mensaje
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendBtn.click();
            }
        });
    } else {
        console.error("Elementos del chat o Firebase no inicializados correctamente. Verifica tu index.html y script.js.");
    }

    // Función para añadir mensajes al chat box y aplicar estilos según el remitente
    function appendMessage(text, senderId) {
        const messageElement = document.createElement('div');
        messageElement.textContent = text;
        
        // Compara el senderId del mensaje con el userId del usuario actual
        if (senderId === userId) {
            messageElement.classList.add('message-item', 'sent'); // Mensaje propio, a la derecha
        } else {
            messageElement.classList.add('message-item', 'received'); // Mensaje de otro, a la izquierda
        }
        
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight; // Desplaza al final para ver el último mensaje
    }
});