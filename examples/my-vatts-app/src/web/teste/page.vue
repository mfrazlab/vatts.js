<script setup>
import { ref, onMounted, nextTick } from 'vue';

// Estado
const messages = ref([]);
const inputMessage = ref('');
const connectionStatus = ref('Desconectado');
const isConnected = ref(false);
const chatContainer = ref(null);

// WebTransport Vars
let transport = null;
let stream = null;
let writer = null;
let reader = null;

// Configuração
const TRANSPORT_URL = 'https://beta.int.mfraz.ovh:4443/chat';

/**
 * Conecta ao servidor WebTransport
 */
const connect = async () => {
  try {
    connectionStatus.value = 'Conectando...';

    // Inicializa WebTransport
    transport = new WebTransport(TRANSPORT_URL, {
      
    });
    await transport.ready;

    connectionStatus.value = 'Conectado';
    isConnected.value = true;

    // Abre stream bidirecional
    stream = await transport.createBidirectionalStream();
    writer = stream.writable.getWriter();
    reader = stream.readable.getReader();

    // Inicia loop de leitura
    readLoop();

  } catch (error) {
    console.error("Erro na conexão:", error);
    connectionStatus.value = 'Erro';
    isConnected.value = false;
    messages.value.push({
      type: 'system',
      text: 'Falha ao conectar no WebTransport. Verifique o certificado SSL ou se o servidor Vatts.js está rodando.'
    });
  }
};

/**
 * Loop de leitura de mensagens do servidor
 */
const readLoop = async () => {
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      try {
        const data = JSON.parse(text);
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Adiciona mensagem recebida
        messages.value.push({
          ...data,
          time: now,
          isMe: false // Assumindo false para msgs do servidor por enquanto
        });

        scrollToBottom();
      } catch (e) {
        console.warn("Mensagem não-JSON recebida:", text);
      }
    }
  } catch (error) {
    console.log("Stream fechada ou erro:", error);
    connectionStatus.value = 'Desconectado';
    isConnected.value = false;
  }
};

/**
 * Envia mensagem para o servidor
 */
const sendMessage = async () => {
  if (!inputMessage.value.trim() || !writer) return;

  const text = inputMessage.value;
  inputMessage.value = ''; // Limpa input

  // Atualização Otimista (UI)
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  messages.value.push({
    type: 'user',
    sender: 'Eu',
    text: text,
    time: now,
    isMe: true
  });

  scrollToBottom();

  // Envia bytes
  try {
    const data = new TextEncoder().encode(text);
    await writer.write(data);
  } catch (e) {
    console.error("Erro ao escrever na stream:", e);
    connectionStatus.value = 'Erro ao Enviar';
  }
};

/**
 * Utilitário de Scroll
 */
const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

// Lifecycle
onMounted(() => {
  connect();
});
</script>

<template>
  <div class="flex flex-col h-screen max-w-4xl mx-auto shadow-2xl bg-gray-800 border-x border-gray-700 font-sans text-gray-100">

    <header class="bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center shrink-0">
      <div>
        <h1 class="text-xl font-bold text-blue-400 tracking-wider">VATTS<span class="text-white">.JS</span></h1>
        <p class="text-xs text-gray-400">Powered by HTTP/3 WebTransport</p>
      </div>
      <div class="flex items-center gap-2">
        <span
            class="w-3 h-3 rounded-full animate-pulse transition-colors duration-300"
            :class="{
            'bg-green-500': connectionStatus === 'Conectado',
            'bg-red-500': connectionStatus === 'Erro',
            'bg-yellow-500': !['Conectado', 'Erro'].includes(connectionStatus)
          }"
        ></span>
        <span class="text-sm font-medium">{{ connectionStatus }}</span>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref="chatContainer">
      <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-gray-500">
        <p>Conecte-se para começar a conversar...</p>
      </div>

      <div v-for="(msg, index) in messages" :key="index" class="animate-fade-in">
        <div v-if="msg.type === 'system'" class="flex justify-center my-2">
          <span class="bg-gray-700 text-gray-300 text-xs py-1 px-3 rounded-full border border-gray-600">
            {{ msg.text }}
          </span>
        </div>

        <div v-else class="flex flex-col" :class="msg.isMe ? 'items-end' : 'items-start'">
          <div
              class="max-w-[80%] rounded-2xl px-4 py-2 shadow-sm break-words"
              :class="msg.isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'"
          >
            <p class="text-xs font-bold opacity-70 mb-1" v-if="!msg.isMe">{{ msg.sender }}</p>
            <p class="text-sm whitespace-pre-wrap">{{ msg.text }}</p>
          </div>
          <span class="text-[10px] text-gray-500 mt-1 mx-1">{{ msg.time }}</span>
        </div>
      </div>
    </main>

    <footer class="bg-gray-900 p-4 border-t border-gray-700 shrink-0">
      <form @submit.prevent="sendMessage" class="flex gap-2">
        <input
            v-model="inputMessage"
            type="text"
            placeholder="Digite sua mensagem..."
            class="flex-1 bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-500 disabled:opacity-50"
            :disabled="!isConnected"
        >
        <button
            type="submit"
            class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            :disabled="!isConnected || !inputMessage.trim()"
        >
          <span>Enviar</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
      <div class="mt-2 text-right h-4">
        <button
            v-if="!isConnected"
            @click="connect"
            class="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
        >
          Reconectar
        </button>
      </div>
    </footer>

  </div>
</template>

<style scoped>
/* Animação simples de entrada */
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scrollbar Customizada (apenas para este componente) */
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #1f2937; /* gray-800 */
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #4b5563; /* gray-600 */
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #6b7280; /* gray-500 */
}
</style>
