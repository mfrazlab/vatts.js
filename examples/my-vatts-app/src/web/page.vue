<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSession } from '@vatts/auth/vue';
import {importServer, Link, router} from 'vatts/vue';
import { Terminal, Cpu, Wifi, Activity, User, LogOut, ShieldCheck } from 'lucide-vue-next';
import {Image} from "vatts/vue";

// Importação do servidor adaptada para Vue
const api = importServer<typeof import("../backend/helper")>("../../backend/helper");
const { getServerDiagnostics, getPackageVersion } = api;

// Hooks e Estado
const { data: session, status, signOut } = useSession();
const serverData = ref<any>(null);
const isLoadingServer = ref(false);
const terminalLines = ref<string[]>([]);
const version = ref<string>();

// Variáveis de estilo (constantes)
const primaryColor = "#ff6b35";

// Ciclo de vida (substituindo o useState async do React)
onMounted(async () => {
  version.value = await getPackageVersion();
});

const handleTestConnection = async () => {
  isLoadingServer.value = true;
  terminalLines.value = ["> Initializing handshake...", "> Fetching diagnostics..."];

  try {
    await new Promise(r => setTimeout(r, 800));
    const data = await getServerDiagnostics("Test");
    serverData.value = data;
    terminalLines.value.push("> System online. Data synced.");
  } catch (error) {
    terminalLines.value.push("> Connection failed.");
  } finally {
    isLoadingServer.value = false;
  }
};
</script>
<script lang="ts">
import type { RouteConfig } from "vatts/vue";

export const config: RouteConfig = {
  pattern: '/',
  component: undefined,
  generateMetadata: () => ({
    title: 'Vatts.js | Home'
  })
};
</script>
<template>
  <div class="min-h-screen bg-[#0d0d0d] text-slate-200 selection:bg-[#ff6b35]/30 font-sans antialiased overflow-x-hidden">

    <!-- Background Glows -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-[10%] -left-[5%] w-[50%] h-[50%] bg-[#ff6b35]/5 blur-[120px] rounded-full" />
      <div class="absolute top-[20%] -right-[10%] w-[40%] h-[60%] bg-[#e85d04]/5 blur-[150px] rounded-full" />
    </div>

    <div class="relative z-10 max-w-[1400px] mx-auto px-6 py-12 lg:py-20">

      <!-- Header -->
      <header class="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
        <div class="space-y-4">
          <div class="flex items-center gap-5">
            <Image
                src="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo.png"
                alt="Vatts Logo"
                width="64"
                height="64"
                class="w-16 h-16 object-contain"
            />
            <h1 class="text-5xl font-extrabold tracking-tight text-white">
              Vatts<span :style="{ color: primaryColor }">.js</span>
            </h1>
          </div>
          <p class="text-slate-400 max-w-lg text-lg leading-relaxed font-medium">
            The future of fullstack development. High-performance diagnostics and
            secure authentication built directly into the core.
          </p>
        </div>

        <div class="flex gap-6 items-center border-l border-slate-800 pl-8">
          <div class="text-center">
            <p class="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-1">Status</p>
            <div class="flex items-center gap-2 font-mono text-sm" :style="{ color: primaryColor }">
              <div
                  class="w-2 h-2 rounded-full animate-pulse"
                  :style="{ backgroundColor: primaryColor, boxShadow: `0 0 8px ${primaryColor}` }"
              />
              OPERATIONAL
            </div>
          </div>
          <div class="text-center">
            <p class="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-1">Engine</p>
            <p class="text-slate-200 font-mono text-sm">v{{ version }}</p>
          </div>
        </div>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        <!-- Identity Section -->
        <section class="lg:col-span-4">
          <div class="vatts-card rounded-[2rem] overflow-hidden">
            <div class="neon-line-header" />
            <div class="p-8">
              <div class="flex items-center gap-4 mb-8">
                <div class="w-8 h-1 rounded-full" :style="{ backgroundColor: primaryColor }" />
                <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">Identity</h3>
              </div>

              <div v-if="status === 'authenticated'" class="space-y-6">
                <div class="flex items-center gap-5">
                  <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center border border-white/5 shadow-inner">
                    <User :style="{ color: primaryColor }" :size="32" />
                  </div>
                  <div>
                    <h4 class="text-xl font-bold text-white">{{ session?.user?.name }}</h4>
                    <p class="text-slate-500 text-sm font-mono">{{ session?.user?.email }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3 pt-4">
                  <div class="p-4 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                    <div>
                      <p class="text-[10px] text-slate-500 uppercase font-bold mb-1">Access Level</p>
                      <p class="text-sm text-slate-200 flex items-center gap-2">
                        <ShieldCheck :size="14" :style="{ color: primaryColor }"/> Developer
                      </p>
                    </div>
                    <button
                        @click="signOut()"
                        class="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/10"
                        title="Exit"
                    >
                      <LogOut :size="18" />
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="text-center py-6">
                <p class="text-slate-400 mb-6 italic">Secure session not detected.</p>
                <button
                    @click="router.push('/login')"
                    href="/login"
                    class="block w-full py-4 rounded-2xl font-black transition-all active:scale-[0.98] text-center"
                    :style="{ backgroundColor: primaryColor, color: '#0d0d0d' }"
                >
                  Authenticate Now
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Diagnostics Section -->
        <section class="lg:col-span-8">
          <div class="vatts-card rounded-[2rem] overflow-hidden relative">
            <div class="neon-line-header" />
            <div class="p-8">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                <div class="flex items-center gap-4">
                  <div class="w-8 h-1 rounded-full" :style="{ backgroundColor: primaryColor }" />
                  <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">Live Diagnostics</h3>
                </div>

                <button
                    @click="handleTestConnection"
                    :disabled="isLoadingServer"
                    class="btn-primary px-8 py-3 rounded-xl font-bold disabled:opacity-50"
                >
                  <div class="flex items-center gap-3">
                    <Activity :size="18" :class="{ 'animate-spin': isLoadingServer }" />
                    <span>{{ isLoadingServer ? "Pinging Server..." : "Run System Test" }}</span>
                  </div>
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Terminal Style Box -->
                <div class="font-mono text-sm text-slate-500 bg-black/40 p-6 rounded-2xl min-h-[220px] border border-white/5">
                  <p v-if="terminalLines.length === 0" class="opacity-30 italic">// Awaiting execution pulse...</p>
                  <div v-else>
                    <p
                        v-for="(line, i) in terminalLines"
                        :key="i"
                        class="mb-2 last:text-white"
                        :style="{ color: i === terminalLines.length - 1 ? primaryColor : '' }"
                    >
                      {{ line }}
                    </p>
                  </div>
                </div>

                <!-- Data Display -->
                <div class="flex flex-col justify-center">
                  <div v-if="serverData" class="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    <div class="flex justify-between items-center border-b border-white/5 pb-2">
                      <span class="text-slate-500 text-xs flex items-center gap-2"><Cpu :size="14"/> Node Host</span>
                      <span class="text-white font-bold">{{ serverData.hostname }}</span>
                    </div>
                    <div class="flex justify-between items-center border-b border-white/5 pb-2">
                      <span class="text-slate-500 text-xs flex items-center gap-2"><Activity :size="14"/> Memory</span>
                      <span class="text-white font-bold">{{ serverData.memoryUsage }}</span>
                    </div>
                    <div class="flex justify-between items-center border-b border-white/5 pb-2">
                      <span class="text-slate-500 text-xs flex items-center gap-2"><Wifi :size="14"/> OS</span>
                      <span class="text-white font-bold">{{ serverData.platform }}</span>
                    </div>
                    <p class="text-[10px] mt-4 truncate font-mono" :style="{ color: `${primaryColor}80` }">
                      TOKEN: {{ serverData.secretHash }}
                    </p>
                  </div>
                  <div v-else class="text-center p-8 border-2 border-dashed border-white/5 rounded-2xl">
                    <p class="text-slate-600 text-sm">No data fetched yet.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap');

body {
  overflow-x: hidden;
  background-color: #0d0d0d;
  font-family: 'Inter', sans-serif;
}

.neon-line-header {
  height: 1px;
  width: 100%;
  background: linear-gradient(90deg, transparent, #e85d04, #ff6b35, transparent);
  box-shadow: 0 0 15px rgba(255, 107, 53, 0.4);
}

.vatts-card {
  background: rgba(10, 10, 12, 0.95);
  border: 1px solid rgba(255, 107, 53, 0.1);
  box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.8);
  transition: all 0.3s ease;
}

.vatts-card:hover {
  border-color: rgba(255, 107, 53, 0.25);
}

.btn-primary {
  background: rgba(255, 107, 53, 0.1);
  color: #ff6b35;
  border: 1px solid rgba(255, 107, 53, 0.2);
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: rgba(255, 107, 53, 0.15);
  box-shadow: 0 0 20px rgba(255, 107, 53, 0.25);
}
</style>