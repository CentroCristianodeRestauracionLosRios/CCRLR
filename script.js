// Importa las funciones necesarias de Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Accede a la configuración de Firebase definida globalmente en index.html
// Asegúrate de que firebaseConfig esté disponible en el ámbito global o pásala como parámetro si usas IIFE
const app = initializeApp(firebaseConfig); // firebaseConfig debe estar disponible aquí
const database = getDatabase(app);
const messagesRef = ref(database, 'messages'); // 'messages' es el nodo principal de tus mensajes

document.addEventListener('DOMContentLoaded', () => {
    // ... (Tu lógica existente para la galería de imágenes) ...

    // Lógica del Chat con Firebase Realtime Database
    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message');
    const sendBtn = document.getElementById('sendBtn');

    // Asegurarse de que los elementos del chat existen y Firebase está inicializado
    if (sendBtn && messageInput && chatBox && app && database && messagesRef) {
        
        // 1. Escuchar nuevos mensajes de Firebase
        // onChildAdded se dispara para cada mensaje existente y luego para cada nuevo mensaje
        onChildAdded(messagesRef, (snapshot) => {
            const message = snapshot.val(); // Obtiene los datos del mensaje
            // Asigna un tipo basado en si el mensaje es del usuario actual (simplificado para ejemplo)
            // Para un chat multiusuario real, necesitarías autenticación para saber quién es el remitente.
            const messageType = message.type || 'received'; // Asume 'received' si no hay 'type'
            appendMessage(message.text, messageType); // Añade el mensaje al DOM
        });

        // 2. Enviar mensajes a Firebase
        sendBtn.addEventListener('click', () => {
            const messageText = messageInput.value.trim();
            if (messageText !== '') {
                // Enviar el mensaje a Firebase
                push(messagesRef, {
                    text: messageText,
                    type: 'sent', // Marca el mensaje como enviado por este cliente
                    timestamp: serverTimestamp() // Marca de tiempo del servidor para ordenar
                });
                messageInput.value = ''; // Limpia el input después de enviar
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

    // Función para añadir mensajes al chat box (sin cambios importantes)
    function appendMessage(text, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-item', type);
        messageElement.textContent = text;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});