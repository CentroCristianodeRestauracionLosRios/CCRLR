document.addEventListener('DOMContentLoaded', () => {
    // Lógica para la galería de imágenes: abre la imagen completa en una nueva pestaña al hacer clic.
    const galleryItems = document.querySelectorAll('.image-gallery .gallery-item');

    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            const fullSrc = item.getAttribute('data-full-src');
            window.open(fullSrc, '_blank'); 
        });
    });

    // Lógica del Chat (Ejemplo muy básico)
    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message');
    const sendBtn = document.getElementById('sendBtn');

    if (sendBtn && messageInput && chatBox) { // Asegurarse de que los elementos del chat existen
        sendBtn.addEventListener('click', () => {
            const messageText = messageInput.value.trim();
            if (messageText !== '') {
                appendMessage(messageText, 'sent');
                messageInput.value = '';
                // Aquí podrías añadir lógica para enviar el mensaje a un backend o simular una respuesta
                // setTimeout(() => appendMessage("Gracias por tu mensaje. Un pastor se pondrá en contacto pronto.", 'received'), 1000);
            }
        });

        // Permitir enviar con Enter en el input de mensaje
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendBtn.click(); // Simula un clic en el botón Enviar
            }
        });
    }

    // Función para añadir mensajes al chat box
    function appendMessage(text, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-item', type);
        messageElement.textContent = text;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight; // Desplazar al final
    }

    // Si quieres un mensaje de bienvenida inicial en el chat, puedes llamarlo aquí:
    // appendMessage("¡Bienvenido al Chat de Oración! Deja tu petición.", 'received');
});