<script setup>
import { Link } from 'vatts/vue';
import { ref, onMounted } from 'vue';


const path = ref('/');

onMounted(() => {
  if (typeof window !== 'undefined') {
    path.value = window.location.pathname;
  }
});

const reload = () => {
  window.location.reload();
};
</script>

<template>
  <div class="fixed inset-0 bg-[#050505] flex items-center justify-center z-[9999] font-['Plus_Jakarta_Sans',_sans-serif] antialiased text-white">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

    <div class="container flex justify-center items-center">
      <div class="w-[min(90%,480px)] bg-[#0f0f0f] border border-[#1f1f1f] rounded-3xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
        
        <div class="p-10">
          <div class="mb-4">
            <span class="inline-block px-3 py-1 bg-[#42b883]/10 text-[#42b883] rounded-full text-xs font-semibold mb-4">
              404 Error
            </span>
            <h1 class="text-[32px] font-extrabold m-0 mb-2 tracking-tighter">
              Page not found
            </h1>
            <p class="text-[#888888] text-[15px] leading-relaxed mb-8">
              The page you are looking for doesn't exist or has been moved.
            </p>
          </div>

          <div class="bg-black rounded-xl border border-[#1f1f1f] mb-8 font-['JetBrains_Mono',_monospace] overflow-hidden">
            <div class="px-4 py-2 bg-[#161616] border-b border-[#1f1f1f] flex justify-between items-center">
              <div class="flex gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-[#333]"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#333]"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#333]"></span>
              </div>
              <span class="text-[10px] text-[#555] uppercase tracking-wide">
                vatts_debug.log
              </span>
            </div>
            <div class="p-4 text-[11px] leading-[1.8]">
              <div class="block">
                <span class="text-[#444]">TIMESTAMP:</span> {{ new Date().toISOString() }}
              </div>
              <div class="block">
                <span class="text-red-400 font-bold">FAIL</span> 
                <span class="text-[#eee]">GET {{ path }}</span>
              </div>
              <div class="block text-[#444]">
                >> [Vatts] Exception: Route definition missing.
              </div>
            </div>
          </div>

          <div class="flex gap-3">
            <Link href="/" class="flex-1 p-3 rounded-xl text-sm font-semibold cursor-pointer transition-all text-center no-underline border border-transparent bg-white text-black hover:bg-[#42b883] hover:text-black">
              Home
            </Link>
            <button @click="reload" class="flex-1 p-3 rounded-xl text-sm font-semibold cursor-pointer transition-all text-center border bg-transparent text-white border-[#1f1f1f] hover:bg-[#161616]">
              Try again
            </button>
          </div>
        </div>

        <div class="px-10 py-5 bg-[#0a0a0a] border-t border-[#1f1f1f]">
          <a href="https://npmjs.com/package/vatts" target="_blank" class="flex items-center gap-3 no-underline text-[#888888] text-[13px] transition-colors hover:text-white group">
            <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo.png" alt="Vatts Logo" class="w-[18px] h-[18px] opacity-80" />
            <span>
              Vatts.js 
            </span>
          </a>
        </div>

      </div>
    </div>
  </div>
</template>