// Importa las funciones necesarias de Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, remove, child, set, onChildRemoved, update, onChildChanged, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Accede a la configuración de Firebase definida globalmente en index.html
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const messagesRef = ref(database, 'messages');
const bannedUsersRef = ref(database, 'bannedUsers');
// Ya no necesitamos userAliasesRef para los números, los nombres se guardarán con el userId
// const userAliasesRef = ref(database, 'userAliases'); // Eliminada o no usada para el propósito anterior

// --- Generar o recuperar ID de usuario ---
let userId = sessionStorage.getItem('chatUserId');
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('chatUserId', userId);
}
console.log("Tu ID de usuario actual es:", userId);

// --- Tu ID de administrador ya configurado ---
const ADMIN_USER_ID = "user_3891b0r8w18";

let bannedUserIds = new Set(); // Para almacenar los IDs de usuarios baneados en memoria

// --- NUEVO: Almacena el nombre de usuario elegido ---
let userName = sessionStorage.getItem('chatUserName');

document.addEventListener('DOMContentLoaded', async () => {
    // --- NUEVO: Pedir nombre de usuario si no está guardado ---
    if (!userName) {
        await promptForUserName();
    }

    // Escuchar cambios en la lista de usuarios baneados en Firebase
    onChildAdded(bannedUsersRef, (snapshot) => {
        bannedUserIds.add(snapshot.key);
        console.log(`Usuario baneado añadido: ${snapshot.key}`);
    });

    onChildRemoved(bannedUsersRef, (snapshot) => {
        bannedUserIds.delete(snapshot.key);
        console.log(`Usuario desbaneado: ${snapshot.key}`);
    });

    // Lógica para el modal de imagen de la galería (sin cambios)
    const imageModal = document.getElementById('imageModal');
    const modalImg = document.getElementById('img01');
    const closeButton = document.querySelector('.close-button');

    const galleryItems = document.querySelectorAll('.image-gallery .gallery-item');

    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            imageModal.style.display = 'block';
            modalImg.src = item.getAttribute('data-full-src');
        });
    });

    closeButton.addEventListener('click', () => {
        imageModal.style.display = 'none';
    });

    imageModal.addEventListener('click', (event) => {
        if (event.target === imageModal) {
            imageModal.style.display = 'none';
        }
    });

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
        // --- 1. Escuchar nuevos mensajes ---
        onChildAdded(messagesRef, (snapshot) => {
            const message = snapshot.val();
            // Asegúrate de pasar el nombre del remitente si está disponible en el mensaje
            // Si el nombre no está en el mensaje (mensajes antiguos), intenta usar el userId como respaldo
            appendMessage(snapshot.key, message.text, message.senderId, message.senderName || message.senderId); 
        });

        // --- 2. Escuchar cambios en mensajes existentes (para ediciones) ---
        onChildChanged(messagesRef, (snapshot) => {
            const messageKey = snapshot.key;
            const updatedMessage = snapshot.val();
            const messageElement = document.querySelector(`.message-item[data-key="${messageKey}"]`);
            if (messageElement) {
                const textContentElement = messageElement.querySelector('.message-text');
                if (textContentElement) {
                    textContentElement.textContent = updatedMessage.text;
                }
                messageElement.classList.remove('editing');
                if (updatedMessage.senderId === userId && !messageElement.querySelector('.edit-button')) {
                    const editButton = document.createElement('button');
                    editButton.textContent = '✏️';
                    editButton.classList.add('edit-button');
                    editButton.title = 'Editar mensaje';
                    editButton.addEventListener('click', () => startEditMessage(messageKey, textContentElement, messageElement));
                    messageElement.appendChild(editButton);
                }
            }
        });

        sendBtn.addEventListener('click', () => {
            const messageText = messageInput.value.trim();

            if (bannedUserIds.has(userId)) {
                alert("No puedes enviar mensajes porque has sido bloqueado del chat.");
                messageInput.value = '';
                return;
            }

            // --- Procesar comandos ---
            if (messageText.startsWith('/ban ')) {
                if (userId === ADMIN_USER_ID) {
                    const targetInfo = messageText.substring(5).trim();
                    // El admin ahora puede banear por ID real o por nombre (si es único)
                    let targetUserIdToBan = targetInfo; // Por defecto, asume que es un ID

                    // Opcional: Buscar ID por nombre si el targetInfo no es un ID y necesitamos el ID real para el ban
                    // Para simplificar, seguimos asumiendo que el admin usará el ID que ve (si es admin)
                    // o el ID real que copia. Si quisieras banear por nombre, necesitarías una forma de
                    // almacenar los nombres de usuario en Firebase y buscarlos. Por ahora, nos quedamos con ID.

                    if (targetUserIdToBan) {
                        set(child(bannedUsersRef, targetUserIdToBan), true)
                            .then(() => { appendMessage(null, `Comando: El usuario ${targetUserIdToBan} ha sido baneado.`, 'system', 'Sistema'); })
                            .catch(error => { console.error("Error al banear usuario:", error); appendMessage(null, "Error al banear al usuario.", 'system', 'Sistema'); });
                    } else { appendMessage(null, "Uso: /ban [ID_de_usuario]", 'system', 'Sistema'); }
                } else { appendMessage(null, "No tienes permisos para usar este comando.", 'system', 'Sistema'); }
                messageInput.value = '';
                return;
            }

            if (messageText.startsWith('/unban ')) {
                if (userId === ADMIN_USER_ID) {
                    const targetUserId = messageText.substring(7).trim();
                    if (targetUserId) {
                        remove(child(bannedUsersRef, targetUserId))
                            .then(() => { appendMessage(null, `Comando: El usuario ${targetUserId} ha sido desbaneado.`, 'system', 'Sistema'); })
                            .catch(error => { console.error("Error al desbanear usuario:", error); appendMessage(null, "Error al desbanear al usuario.", 'system', 'Sistema'); });
                    } else { appendMessage(null, "Uso: /unban [ID_de_usuario]", 'system', 'Sistema'); }
                } else { appendMessage(null, "No tienes permisos para usar este comando.", 'system', 'Sistema'); }
                messageInput.value = '';
                return;
            }

            if (messageText.startsWith('/clear')) {
                if (userId === ADMIN_USER_ID) {
                    if (confirm("¿Estás seguro de que quieres borrar TODOS los mensajes del chat? Esta acción es irreversible.")) {
                        remove(messagesRef)
                            .then(() => {
                                chatBox.innerHTML = '';
                                appendMessage(null, "El chat ha sido limpiado por un administrador.", 'system', 'Sistema');
                                console.log("Chat limpiado exitosamente en Firebase.");
                            })
                            .catch(error => { console.error("Error al limpiar el chat:", error); appendMessage(null, "Error al intentar limpiar el chat.", 'system', 'Sistema'); });
                    }
                } else { appendMessage(null, "No tienes permisos para usar este comando.", 'system', 'Sistema'); }
                messageInput.value = '';
                return;
            }
            
            // --- NUEVO: Comando para cambiar el nombre de usuario ---
            if (messageText.startsWith('/name ')) {
                const newName = messageText.substring(6).trim();
                if (newName.length > 0 && newName.length <= 10) {
                    userName = newName;
                    sessionStorage.setItem('chatUserName', userName);
                    appendMessage(null, `Has cambiado tu nombre a: ${userName}`, 'system', 'Sistema');
                    // Opcional: Podrías actualizar todos los mensajes enviados previamente por este userId
                    // para que muestren el nuevo nombre. Esto requeriría iterar mensajes y actualizarlos.
                    // Para la mayoría de los casos, con que los nuevos mensajes muestren el nombre es suficiente.
                } else {
                    appendMessage(null, "El nombre debe tener entre 1 y 10 caracteres.", 'system', 'Sistema');
                }
                messageInput.value = '';
                return;
            }


            // --- 3. Si no es un comando y el mensaje no está vacío, enviarlo como mensaje normal ---
            if (messageText !== '') {
                push(messagesRef, {
                    text: messageText,
                    senderId: userId,
                    senderName: userName, // ¡NUEVO! Envía el nombre del remitente
                    timestamp: serverTimestamp()
                });
                messageInput.value = '';
            }
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendBtn.click();
            }
        });
    } else {
        console.error("Elementos del chat o Firebase no inicializados correctamente. Verifica tu index.html y script.js.");
    }

    // --- NUEVO: Función para pedir el nombre de usuario ---
    async function promptForUserName() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0,0,0,0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                text-align: center;
            `;

            const title = document.createElement('h3');
            title.textContent = 'Elige tu nombre de usuario';
            title.style.color = '#003153';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = 'Máximo 10 caracteres';
            nameInput.maxLength = 10;
            nameInput.style.cssText = `
                padding: 10px;
                margin: 15px 0;
                border: 1px solid #ccc;
                border-radius: 5px;
                width: 200px;
                font-size: 1em;
            `;

            const errorMsg = document.createElement('p');
            errorMsg.style.color = 'red';
            errorMsg.style.fontSize = '0.9em';
            errorMsg.style.minHeight = '1.2em'; // Espacio para el mensaje de error

            const submitBtn = document.createElement('button');
            submitBtn.textContent = 'Entrar al Chat';
            submitBtn.style.cssText = `
                background-color: #CC9900;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1em;
                margin-top: 10px;
            `;

            const setUserName = () => {
                const inputName = nameInput.value.trim();
                if (inputName.length > 0 && inputName.length <= 10) {
                    userName = inputName;
                    sessionStorage.setItem('chatUserName', userName);
                    document.body.removeChild(overlay);
                    resolve();
                } else {
                    errorMsg.textContent = 'El nombre debe tener entre 1 y 10 caracteres.';
                }
            };

            submitBtn.addEventListener('click', setUserName);
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    setUserName();
                }
            });

            modal.appendChild(title);
            modal.appendChild(nameInput);
            modal.appendChild(errorMsg);
            modal.appendChild(submitBtn);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            nameInput.focus();
        });
    }

    // --- MODIFICADO: Función para añadir mensajes al chat box (usa el nombre elegido) ---
    // Ahora recibe senderName como un parámetro explícito
    function appendMessage(messageKey, text, senderId, senderName) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-item');
        
        if (messageKey) {
            messageElement.setAttribute('data-key', messageKey);
        }

        const textContentElement = document.createElement('span');
        textContentElement.classList.add('message-text');
        textContentElement.textContent = text;
        
        // Determinar el nombre/alias a mostrar
        let displayName = senderName || "Invitado"; // Usa el nombre enviado o un predeterminado
        if (senderId === userId) {
            displayName = "Tú";
            // Si el nombre actual es diferente al enviado (ej. cambió con /name), actualiza
            if (userName && senderName !== userName) {
                displayName = `${userName} (Tú)`;
            }
        } else if (senderId === 'system') {
            displayName = 'Sistema';
        }

        // Crear el header del mensaje con el nombre
        const messageHeader = document.createElement('div');
        messageHeader.classList.add('message-header');
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('sender-name'); // Cambiado a sender-name
        nameSpan.textContent = displayName;
        messageHeader.appendChild(nameSpan);

        // Si es el ADMIN, añade el ID real oculto para copiar
        if (userId === ADMIN_USER_ID && senderId !== 'system') {
            const adminIdSpan = document.createElement('span');
            adminIdSpan.classList.add('admin-id-info');
            adminIdSpan.textContent = ` (ID: ${senderId})`;
            adminIdSpan.title = 'Haz clic para copiar ID';
            adminIdSpan.style.cursor = 'pointer';
            adminIdSpan.addEventListener('click', () => {
                navigator.clipboard.writeText(senderId).then(() => {
                    alert(`ID "${senderId}" copiado al portapapeles.`);
                }).catch(err => {
                    console.error('Error al copiar ID: ', err);
                });
            });
            messageHeader.appendChild(adminIdSpan);
        }


        // --- Orden de los elementos dentro de messageElement ---
        if (senderId === 'system') {
            messageElement.classList.add('system-message');
            messageElement.appendChild(messageHeader);
            messageElement.appendChild(textContentElement);
            messageElement.style.paddingBottom = '8px';
        } else if (senderId === userId) { // Mensaje propio
            messageElement.classList.add('sent');
            messageElement.appendChild(textContentElement);

            const editButton = document.createElement('button');
            editButton.textContent = '✏️';
            editButton.classList.add('edit-button');
            editButton.title = 'Editar mensaje';
            editButton.addEventListener('click', () => startEditMessage(messageKey, textContentElement, messageElement));
            messageElement.appendChild(editButton);
            
            messageElement.appendChild(messageHeader);
            messageElement.style.paddingBottom = '25px';
        } else { // Mensaje recibido de otro usuario
            messageElement.classList.add('received');
            messageElement.appendChild(messageHeader);
            messageElement.appendChild(textContentElement);
            messageElement.style.paddingBottom = '25px';
        }
        
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // --- Funciones de edición (sin cambios sustanciales, solo ocultar/mostrar header) ---
    function startEditMessage(messageKey, textContentElement, messageElement) {
        if (document.querySelector('.message-item.editing')) {
            alert('Ya estás editando un mensaje. Por favor, guarda o cancelas antes de editar otro.');
            return;
        }

        const currentText = textContentElement.textContent;
        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.value = currentText;
        inputField.classList.add('edit-input');

        const saveButton = document.createElement('button');
        saveButton.textContent = '✅';
        saveButton.classList.add('save-button');
        saveButton.title = 'Guardar edición';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = '❌';
        cancelButton.classList.add('cancel-button');
        cancelButton.title = 'Cancelar edición';

        textContentElement.style.display = 'none';
        const editButton = messageElement.querySelector('.edit-button');
        if (editButton) editButton.style.display = 'none';
        
        const messageHeader = messageElement.querySelector('.message-header');
        if (messageHeader) messageHeader.style.display = 'none';


        messageElement.appendChild(inputField);
        messageElement.appendChild(saveButton);
        messageElement.appendChild(cancelButton);

        messageElement.classList.add('editing');
        inputField.focus();
        messageElement.style.paddingBottom = '8px';


        saveButton.addEventListener('click', () => {
            const newText = inputField.value.trim();
            if (newText !== '' && newText !== currentText) {
                updateMessageInFirebase(messageKey, newText);
            } else {
                exitEditMode(textContentElement, inputField, saveButton, cancelButton, editButton, messageElement, currentText);
            }
        });

        cancelButton.addEventListener('click', () => {
            exitEditMode(textContentElement, inputField, saveButton, cancelButton, editButton, messageElement, currentText);
        });

        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveButton.click();
            }
        });
    }

    function exitEditMode(textContentElement, inputField, saveButton, cancelButton, editButton, messageElement, originalText) {
        textContentElement.textContent = originalText;
        textContentElement.style.display = 'inline';

        inputField.remove();
        saveButton.remove();
        cancelButton.remove();

        if (editButton) editButton.style.display = 'inline';
        
        const messageHeader = messageElement.querySelector('.message-header');
        if (messageHeader) {
            messageHeader.style.display = 'flex'; // Restaurar display flex para el header
            messageElement.style.paddingBottom = '25px';
        } else {
             messageElement.style.paddingBottom = '8px';
        }

        messageElement.classList.remove('editing');
    }

    function updateMessageInFirebase(messageKey, newText) {
        const messageRefToUpdate = child(messagesRef, messageKey);
        update(messageRefToUpdate, { text: newText })
            .then(() => {
                console.log("Mensaje actualizado en Firebase:", messageKey);
            })
            .catch(error => {
                console.error("Error al actualizar mensaje en Firebase:", error);
                alert("Error al guardar la edición del mensaje.");
            });
    }
});