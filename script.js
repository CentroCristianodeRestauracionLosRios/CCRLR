// Importa las funciones necesarias de Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, remove, child, set, onChildRemoved, update, onChildChanged, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Accede a la configuración de Firebase definida globalmente en index.html
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const messagesRef = ref(database, 'messages');
const bannedUsersRef = ref(database, 'bannedUsers');
const adminsRef = ref(database, 'admins'); // Referencia a la rama de administradores

// --- Variables de Estado Globales ---
let userId = null; // UID de Firebase Auth o ID de invitado
let userName = null; // Nombre de usuario de Firebase Auth o el elegido como invitado
let isAdmin = false; // Flag para saber si el usuario actual es admin
let bannedUserIds = new Set(); // Para almacenar los IDs de usuarios baneados en memoria

// --- Elementos del DOM ---
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('sendBtn');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userInfoSpan = document.getElementById('user-info');

document.addEventListener('DOMContentLoaded', async () => {
    // --- Lógica de Autenticación y Estado ---
    loginButton.addEventListener('click', signInWithGoogle);
    logoutButton.addEventListener('click', signOutUser);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuario ha iniciado sesión con Firebase Auth
            userId = user.uid;
            userName = user.displayName || user.email.split('@')[0]; // Usa el nombre de Google o parte del email

            userInfoSpan.textContent = `Has iniciado sesión como: ${userName}`;
            loginButton.style.display = 'none';
            logoutButton.style.display = 'inline-block';
            messageInput.disabled = false;
            sendBtn.disabled = false;

            // Comprobar si el usuario es administrador
            try {
                const adminSnapshot = await get(child(adminsRef, userId));
                isAdmin = adminSnapshot.exists();
                console.log("Usuario logeado:", userName, "UID:", userId, "¿Es administrador?", isAdmin);
            } catch (error) {
                console.error("Error al verificar si es admin:", error);
                isAdmin = false;
            }

            // Si estaba como invitado, limpia el sessionStorage de invitado
            sessionStorage.removeItem('chatUserNameGuest');
            sessionStorage.removeItem('chatUserId');

        } else {
            // Usuario ha cerrado sesión o no ha iniciado sesión
            isAdmin = false; // Reinicia el estado de admin

            userInfoSpan.textContent = 'No has iniciado sesión.';
            loginButton.style.display = 'inline-block';
            logoutButton.style.display = 'none';
            messageInput.disabled = true;
            sendBtn.disabled = true;

            // Limpiar el chat si el usuario cierra sesión explícitamente (opcional)
            chatBox.innerHTML = '';
            appendMessage(null, "Por favor, inicia sesión o elige un nombre de invitado para participar en el chat.", 'system', 'Sistema');

            // Lógica para usuarios invitados: si no está logeado, se le pide un nombre de invitado
            // y se genera un userId para la sesión.
            await promptForUserNameGuest();

            // Si hay un userName (ya sea de login o de invitado) y no está baneado, habilita el chat
            if (userName && !bannedUserIds.has(userId)) {
                messageInput.disabled = false;
                sendBtn.disabled = false;
            } else {
                messageInput.disabled = true;
                sendBtn.disabled = true;
                if (bannedUserIds.has(userId)) {
                    appendMessage(null, "Has sido bloqueado del chat. No puedes enviar mensajes.", 'system', 'Sistema');
                }
            }
        }
    });

    // --- Funciones de Autenticación ---
    async function signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // onAuthStateChanged se encargará de actualizar la UI
        } catch (error) {
            console.error("Error al iniciar sesión con Google:", error);
            alert("Error al iniciar sesión: " + error.message);
        }
    }

    async function signOutUser() {
        try {
            await signOut(auth);
            // onAuthStateChanged se encargará de actualizar la UI
            // Limpia el nombre de invitado al cerrar sesión explícitamente
            sessionStorage.removeItem('chatUserNameGuest');
            sessionStorage.removeItem('chatUserId');
            userId = null;
            userName = null;
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            alert("Error al cerrar sesión: " + error.message);
        }
    }

    // --- Lógica para usuarios invitados si no hay login ---
    async function promptForUserNameGuest() {
        return new Promise(resolve => {
            // Recuperar el nombre de invitado y UID si ya existen en sessionStorage
            const currentGuestName = sessionStorage.getItem('chatUserNameGuest');
            const currentGuestId = sessionStorage.getItem('chatUserId');

            if (currentGuestName && currentGuestId) {
                userName = currentGuestName;
                userId = currentGuestId;
                console.log("Nombre de invitado recuperado:", userName, "ID de invitado:", userId);
                userInfoSpan.textContent = `Estás como invitado: ${userName}`;
                resolve();
                return;
            }

            // Si no hay nombre de invitado, mostrar el modal
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
            title.textContent = 'Elige tu nombre de usuario (Invitado)';
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

            const setUserNameAndEnableChat = () => {
                const inputName = nameInput.value.trim();
                if (inputName.length > 0 && inputName.length <= 10) {
                    userName = inputName;
                    sessionStorage.setItem('chatUserNameGuest', userName);
                    // Genera un userId único para el invitado si no existe
                    if (!sessionStorage.getItem('chatUserId')) {
                        userId = 'guest_' + Math.random().toString(36).substring(2, 15);
                        sessionStorage.setItem('chatUserId', userId);
                    } else {
                        userId = sessionStorage.getItem('chatUserId');
                    }
                    console.log("Nombre de invitado asignado:", userName, "ID de invitado:", userId);
                    userInfoSpan.textContent = `Estás como invitado: ${userName}`;
                    document.body.removeChild(overlay);
                    resolve();
                } else {
                    errorMsg.textContent = 'El nombre debe tener entre 1 y 10 caracteres.';
                }
            };

            submitBtn.addEventListener('click', setUserNameAndEnableChat);
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    setUserNameAndEnableChat();
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

    // --- Escuchar cambios en la lista de usuarios baneados en Firebase ---
    onChildAdded(bannedUsersRef, (snapshot) => {
        bannedUserIds.add(snapshot.key);
        console.log(`Usuario baneado añadido: ${snapshot.key}`);
        // Si el usuario actual es baneado, deshabilitar el chat
        if (userId && bannedUserIds.has(userId)) {
            messageInput.disabled = true;
            sendBtn.disabled = true;
            appendMessage(null, "Has sido bloqueado del chat.", 'system', 'Sistema');
        }
    });

    onChildRemoved(bannedUsersRef, (snapshot) => {
        bannedUserIds.delete(snapshot.key);
        console.log(`Usuario desbaneado: ${snapshot.key}`);
        // Si el usuario actual es desbaneado, y está logeado o es invitado, re-habilitar chat
        if (userId && !bannedUserIds.has(userId) && (auth.currentUser || userName)) {
            messageInput.disabled = false;
            sendBtn.disabled = false;
            appendMessage(null, "Has sido desbaneado y puedes volver a chatear.", 'system', 'Sistema');
        }
    });

    // --- Lógica para el modal de imagen de la galería ---
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

    if (sendBtn && messageInput && chatBox && app && database && messagesRef) {
        // --- 1. Escuchar nuevos mensajes ---
        onChildAdded(messagesRef, (snapshot) => {
            const message = snapshot.val();
            // Pasa el senderName que viene en el mensaje, o usa un default si no existe
            appendMessage(snapshot.key, message.text, message.senderId, message.senderName || "Invitado");
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
                // Si el mensaje fue editado por el propio usuario, restaurar el botón de edición
                if (updatedMessage.senderId === userId && !messageElement.querySelector('.edit-button')) {
                    const editButton = document.createElement('button');
                    editButton.textContent = '✏️';
                    editButton.classList.add('edit-button');
                    editButton.title = 'Editar mensaje';
                    editButton.addEventListener('click', () => startEditMessage(messageKey, textContentElement, messageElement));
                    messageElement.appendChild(editButton);
                }
                messageElement.classList.remove('editing');
                messageElement.style.paddingBottom = (messageElement.classList.contains('sent') || messageElement.classList.contains('received')) ? '25px' : '8px';
                const messageHeader = messageElement.querySelector('.message-header');
                if (messageHeader) messageHeader.style.display = 'flex';
            }
        });

        sendBtn.addEventListener('click', () => {
            const messageText = messageInput.value.trim();

            if (!userId || !userName) {
                alert("Debes iniciar sesión o elegir un nombre de invitado para enviar mensajes.");
                return;
            }

            if (bannedUserIds.has(userId)) {
                alert("No puedes enviar mensajes porque has sido bloqueado del chat.");
                messageInput.value = '';
                return;
            }

            // --- Procesar comandos (Solo administradores para /ban, /unban, /clear) ---
            if (messageText.startsWith('/ban ')) {
                if (isAdmin) { // Solo si es admin y está logeado
                    const targetInfo = messageText.substring(5).trim();
                    if (targetInfo) {
                        set(child(bannedUsersRef, targetInfo), true)
                            .then(() => { appendMessage(null, `Comando: El usuario ${targetInfo} ha sido baneado.`, 'system', 'Sistema'); })
                            .catch(error => { console.error("Error al banear usuario:", error); appendMessage(null, "Error al banear al usuario.", 'system', 'Sistema'); });
                    } else { appendMessage(null, "Uso: /ban [ID_de_usuario]", 'system', 'Sistema'); }
                } else { appendMessage(null, "No tienes permisos para usar este comando.", 'system', 'Sistema'); }
                messageInput.value = '';
                return;
            }

            if (messageText.startsWith('/unban ')) {
                if (isAdmin) { // Solo si es admin y está logeado
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
                if (isAdmin) { // Solo si es admin y está logeado
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

            // --- Comando para cambiar el nombre de usuario (accesible para todos, pero solo para su propio nombre) ---
            if (messageText.startsWith('/name ')) {
                const newName = messageText.substring(6).trim();
                if (newName.length > 0 && newName.length <= 10) {
                    if (auth.currentUser) {
                        alert("Para cambiar tu nombre de usuario logeado, se recomienda cambiarlo desde tu perfil de Google.");
                        // Opcional: Podrías añadir aquí lógica para actualizar el displayName de Firebase Auth,
                        // pero es más complejo y generalmente se prefiere que el nombre provenga de Google.
                    } else {
                        // Usuario invitado
                        userName = newName;
                        sessionStorage.setItem('chatUserNameGuest', userName);
                        userInfoSpan.textContent = `Estás como invitado: ${userName}`;
                        appendMessage(null, `Has cambiado tu nombre de invitado a: ${userName}`, 'system', 'Sistema');
                    }
                } else {
                    appendMessage(null, "El nombre debe tener entre 1 y 10 caracteres.", 'system', 'Sistema');
                }
                messageInput.value = '';
                return;
            }

            // --- 3. Si no es un comando y el mensaje no está vacío, enviarlo como mensaje normal ---
            if (messageText !== '' && userName && userId) {
                push(messagesRef, {
                    text: messageText,
                    senderId: userId, // UID de Firebase Auth o ID de invitado
                    senderName: userName, // Nombre de Google o nombre de invitado
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


    // --- Función para añadir mensajes al chat box ---
    function appendMessage(messageKey, text, senderId, senderName) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-item');

        if (messageKey) {
            messageElement.setAttribute('data-key', messageKey);
        }
        // Guardar el senderId para posibles usos futuros (ej. editar, banear)
        messageElement.setAttribute('data-sender-id', senderId);

        const textContentElement = document.createElement('span');
        textContentElement.classList.add('message-text');
        textContentElement.textContent = text;

        // Determinar el nombre a mostrar
        let displayName = senderName; // Por defecto usa el senderName del mensaje
        let isMyMessage = (auth.currentUser && senderId === auth.currentUser.uid) || (!auth.currentUser && senderId === userId); // Verifica si es mi mensaje (logueado o invitado)

        if (isMyMessage && userId) { // Si es mi mensaje y tengo un userId válido
            displayName = `Tú (${userName})`;
        } else if (senderId === 'system') {
            displayName = 'Sistema';
        }

        // Crear el header del mensaje con el nombre
        const messageHeader = document.createElement('div');
        messageHeader.classList.add('message-header');

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('sender-name');
        nameSpan.textContent = displayName;
        messageHeader.appendChild(nameSpan);

        // Si es el ADMIN y el mensaje no es del sistema, añade el ID real oculto para copiar
        if (isAdmin && senderId !== 'system' && senderId !== 'undefined') { // 'undefined' para evitar mostrar ID si no hay
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
        } else if (isMyMessage) { // Mensaje propio (ya sea logeado o invitado)
            messageElement.classList.add('sent');
            messageElement.appendChild(textContentElement);

            // Añadir botón de edición si es un mensaje propio
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

    // --- Funciones de edición ---
    function startEditMessage(messageKey, textContentElement, messageElement) {
        // Solo permitir editar un mensaje a la vez
        if (document.querySelector('.message-item.editing')) {
            alert('Ya estás editando un mensaje. Por favor, guarda o cancela antes de editar otro.');
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

        // Ocultar elementos existentes y añadir los de edición
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
        textContentElement.style.display = 'block'; // Mostrar el texto de nuevo

        inputField.remove();
        saveButton.remove();
        cancelButton.remove();

        if (editButton) editButton.style.display = 'inline'; // Mostrar el botón de edición
        
        const messageHeader = messageElement.querySelector('.message-header');
        if (messageHeader) {
            messageHeader.style.display = 'flex'; // Mostrar el encabezado
            // Restaurar padding según si es mensaje enviado/recibido o de sistema
            messageElement.style.paddingBottom = (messageElement.classList.contains('sent') || messageElement.classList.contains('received')) ? '25px' : '8px';
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
                // La función onChildChanged de Firebase Listener se encargará de actualizar el DOM.
                // No necesitas llamar a exitEditMode aquí, onChildChanged lo maneja.
            })
            .catch(error => {
                console.error("Error al actualizar mensaje en Firebase:", error);
                alert("Error al guardar la edición del mensaje.");
            });
    }
});