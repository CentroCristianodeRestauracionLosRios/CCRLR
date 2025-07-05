<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyCHznVAG8HyaAwzTMcYXrEjS4ikcgf9Nx0",
    authDomain: "chat-ccrlr.firebaseapp.com",
    databaseURL: "https://chat-ccrlr-default-rtdb.firebaseio.com",
    projectId: "chat-ccrlr",
    storageBucket: "chat-ccrlr.firebasestorage.app",
    messagingSenderId: "832816032978",
    appId: "1:832816032978:web:08721a677cff57b0d9110b",
    measurementId: "G-P71V26NFRE"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>