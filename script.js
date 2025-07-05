// Importa las funciones necesarias de Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, remove, child, set, onChildRemoved, update, onChildChanged, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js"; // NUEVO: Importa auth

// Accede a la configuración de Firebase definida globalmente en index.html
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app); // NUEVO: Inicializa Auth
const messagesRef = ref(database, 'messages');
const bannedUsersRef = ref(database, 'bannedUsers');
const adminsRef = ref(database, 'admins'); // NUEVO: Referencia a la rama de administradores

// --- Variables de Estado Globales ---
let userId = null; // userId será el UID de Firebase Auth
let userName = null; // Nombre de usuario de Firebase Auth o el elegido si no hay login
let isAdmin = false; // Flag para saber si el usuario actual es admin
let bannedUserIds = new Set(); // Para almacenar los IDs de usuarios baneados en memoria

// --- Elementos del DOM ---
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('sendBtn');
const loginButton = document.getElementById('login-button'); // NUEVO
const logoutButton = document.getElementById('logout-button'); // NUEVO
const userInfoSpan = document.getElementById('user-info');     // NUEVO

document.addEventListener('DOMContentLoaded', async () => {
    // --- Lógica de Autenticación ---
    loginButton.addEventListener('click', signInWithGoogle);
    logoutButton.addEventListener('click', signOutUser);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuario ha iniciado sesión
            userId = user.uid;
            userName = user.displayName || user.email.split('@')[0]; // Usa el nombre de Google o parte del email
            console.log("Usuario logeado:", userName, "UID:", userId);

            userInfoSpan.textContent = `Has iniciado sesión como: ${userName}`;
            loginButton.style.display = 'none';
            logoutButton.style.display = 'inline-block';
            messageInput.disabled = false;
            sendBtn.disabled = false;

            // Comprobar si el usuario es administrador
            const adminSnapshot = await get(child(adminsRef, userId));
            isAdmin = adminSnapshot.exists();
            console.log("¿Es administrador?", isAdmin);

            // Si el admin no tiene un nombre configurado por Google, puede establecer uno
            // Opcional: Si quieres mantener el flujo del modal para todos, incluso si están logueados
            // if (!userName || userName.includes('user_')) { // Por si el userName proviene de un user_ antiguo
            //     await promptForUserName();
            // }

        } else {
            // Usuario ha cerrado sesión o no ha iniciado sesión
            userId = null;
            userName = null;
            isAdmin = false;
            console.log("No hay usuario logeado.");

            userInfoSpan.textContent = 'No has iniciado sesión.';
            loginButton.style.display = 'inline-block';
            logoutButton.style.display = 'none';
            messageInput.disabled = true;
            sendBtn.disabled = true;

            // Limpiar el chat si el usuario cierra sesión (opcional)
            chatBox.innerHTML = '';
            appendMessage(null, "Por favor, inicia sesión para participar en el chat.", 'system', 'Sistema');

            // NUEVO: Pide nombre de usuario solo si no está logeado y no tiene un nombre persistente de antes
            // Si el usuario no ha iniciado sesión, ofrecerle elegir un nombre (como invitado)
            // Solo si no ha elegido uno ya en esta sesión.
            if (!sessionStorage.getItem('chatUserNameGuest')) {
                 await promptForUserNameGuest();
            } else {
                userName = sessionStorage.getItem('chatUserNameGuest');
            }
             userId = sessionStorage.getItem('chatUserId'); // Asegura que el userId persista para invitados

             // Si el usuario es invitado, aún puede enviar mensajes (si no está baneado)
             // Habilita el chat para invitados si la función promptForUserNameGuest lo permite.
             if (userName && !bannedUserIds.has(userId)) {
                messageInput.disabled = false;
                sendBtn.disabled = false;
             }
        }
    });

    // --- Funciones de Autenticación ---
    async function signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // El onAuthStateChanged se encargará de actualizar la UI
        } catch (error) {
            console.error("Error al iniciar sesión con Google:", error);
            alert("Error al iniciar sesión: " + error.message);
        }
    }

    async function signOutUser() {
        try {
            await signOut(auth);
            // El onAuthStateChanged se encargará de actualizar la UI
            // Limpia el nombre de invitado al cerrar sesión explícitamente
            sessionStorage.removeItem('chatUserNameGuest');
            sessionStorage.removeItem('chatUserId'); // Reinicia el ID de invitado también
            userId = null;
            userName = null;
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            alert("Error al cerrar sesión: " + error.message);
        }
    }

    // --- Resto de la lógica del chat (con adaptaciones) ---
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
                messageElement.classList.remove('editing');
                // Solo mostrar botón de editar si es el mensaje del usuario actual
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

            // --- Procesar comandos (Solo administradores y si hay userId) ---
            if (messageText.startsWith('/ban ')) {
                if (isAdmin && userId) { // Solo si es admin y está logeado
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
                if (isAdmin && userId) { // Solo si es admin y está logeado
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
                if (isAdmin && userId) { // Solo si es admin y está logeado
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
                    // Si el usuario está logeado, el nombre de firebaseAuth tiene prioridad
                    // Si no está logeado, puede cambiar su nombre de invitado
                    if (auth.currentUser) {
                        alert("Para cambiar tu nombre de usuario logeado, debes cambiarlo en tu perfil de Google.");
                        // Opcional: Puedes permitir cambiar el displayName de Firebase Auth, pero es más complejo.
                        // updateProfile(auth.currentUser, { displayName: newName });
                    } else {
                        // Usuario invitado
                        userName = newName;
                        sessionStorage.setItem('chatUserNameGuest', userName);
                        appendMessage(null, `Has cambiado tu nombre de invitado a: ${userName}`, 'system', 'Sistema');
                    }
                } else {
                    appendMessage(null, "El nombre debe tener entre 1 y 10 caracteres.", 'system', 'Sistema');
                }
                messageInput.value = '';
                return;
            }

            // --- 3. Si no es un comando y el mensaje no está vacío, enviarlo como mensaje normal ---
            // Solo permitir enviar mensajes si hay un userName asignado (logeado o invitado)
            if (messageText !== '' && userName) {
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

    // --- NUEVO: Función para pedir el nombre de usuario para invitados (solo si no hay login) ---
    async function promptForUserNameGuest() {
        return new Promise(resolve => {
            const currentGuestName = sessionStorage.getItem('chatUserNameGuest');
            if (currentGuestName) {
                userName = currentGuestName;
                console.log("Nombre de invitado recuperado:", userName);
                resolve();
                return;
            }

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
                    document.body.removeChild(overlay);
                    messageInput.disabled = false;
                    sendBtn.disabled = false;
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


    // --- MODIFICADO: Función para añadir mensajes al chat box ---
    function appendMessage(messageKey, text, senderId, senderName) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-item');
        
        if (messageKey) {
            messageElement.setAttribute('data-key', messageKey);
        }

        const textContentElement = document.createElement('span');
        textContentElement.classList.add('message-text');
        textContentElement.textContent = text;
        
        // Determinar el nombre a mostrar
        let displayName = senderName; // Por defecto usa el senderName del mensaje
        let isMyMessage = (auth.currentUser && senderId === auth.currentUser.uid) || (!auth.currentUser && senderId === userId);

        if (isMyMessage) {
            displayName = `Tú (${userName})`; // Tu nombre autenticado o de invitado
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
        if (isAdmin && senderId !== 'system') {
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

    // --- Funciones de edición (ligeras adaptaciones para el senderId) ---
    function startEditMessage(messageKey, textContentElement, messageElement) {
        // Asegúrate de que el mensaje a editar es del usuario actual
        const messageSenderId = messageElement.getAttribute('data-sender-id'); // Necesitarás añadir data-sender-id al message-item
        // Opcional: Volver a verificar auth.currentUser.uid === messageSenderId
        // Por ahora, asumimos que el botón de editar solo aparece en los propios mensajes
        
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
            messageHeader.style.display = 'flex';
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