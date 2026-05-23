// Página de Servicios

function servicesPage() {
  const cards = [
    {
      title: "Estado de la carrocería",
      desc: "Revisamos pintura, estructura, corrosión y daños para asegurar el buen estado del vehículo.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>`,
      img: "./assets/img/Carroceria.png",
      color: "from-slate-600 to-slate-800",
    },
    {
      title: "Niveles de emisión de gases y elementos contaminantes",
      desc: "Medimos emisiones y contaminantes para verificar el cumplimiento de la normativa ambiental.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" /></svg>`,
      img: "./assets/img/Emision de gases.png",
      color: "from-green-600 to-green-800",
    },
    {
      title: "Funcionamiento del sistema mecánico",
      desc: "Evaluamos motor, transmisión y componentes mecánicos para detectar fallos y desgaste.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-manual-gearbox"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M10 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M3 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M10 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 8l0 8" /><path d="M12 8l0 8" /><path d="M19 8v2a2 2 0 0 1 -2 2h-12" /></svg>`,
      img: "./assets/img/funcionamientomecanico.png",
      color: "from-red-600 to-red-800",
    },
    {
      title: "Funcionamiento del sistema eléctrico",
      desc: "Comprobamos batería, cableado, luces y sensores para garantizar un sistema eléctrico confiable.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" > <path d="M14 13H16L18 13" stroke-linecap="round" stroke-linejoin="round" /> <path d="M6 13H8M10 13H8M8 13V11M8 13V15" stroke-linecap="round" stroke-linejoin="round" /> <path d="M6 7H2.6C2.26863 7 2 7.26863 2 7.6V18.4C2 18.7314 2.26863 19 2.6 19H21.4C21.7314 19 22 18.7314 22 18.4V7.6C22 7.26863 21.7314 7 21.4 7H18M6 7V5H8V7M6 7H8M8 7H16M16 7V5H18V7M16 7H18" stroke-linecap="round" stroke-linejoin="round" /> </svg>`,
      img: "./assets/img/Funcionamiento del sistema electrico.png",
      color: "from-yellow-500 to-yellow-700",
    },
    {
      title: "Dirección",
      desc: "Revisamos alineación, calibración y respuesta del sistema de dirección para una conducción segura.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" > <path d="M4.36463 19.787L11.6678 13.2953C11.8573 13.1269 12.1427 13.1269 12.3322 13.2953L19.6354 19.787C20.0155 20.1249 19.707 20.7486 19.2078 20.6515L12.0954 19.2686C12.0324 19.2563 11.9676 19.2563 11.9046 19.2686L4.79225 20.6515C4.29295 20.7486 3.98446 20.1249 4.36463 19.787Z" stroke-linecap="round" stroke-linejoin="round" /> <path d="M19 6.5H16C16 6.5 16 6.5 16 6.5C16 6.5 12 6.5 12 10.5" stroke-linecap="round" stroke-linejoin="round" /> <path d="M15.5 9L19 6.5L15.5 4" stroke-linecap="round" stroke-linejoin="round" /> </svg>`,
      img: "./assets/img/Direccion.png",
      color: "from-blue-600 to-blue-800",
    },
    {
      title: "Suspensión",
      desc: "Inspeccionamos amortiguadores, resortes y soporte para asegurar manejabilidad y confort.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-car-suspension"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 22a3 3 0 1 1 0 -6a3 3 0 0 1 0 6" /><path d="M12 16v-12" /><path d="M13 2h-2v2h2v-2" /><path d="M9 11l6 -1" /><path d="M9 14l6 -1" /><path d="M9 8l6 -1" /></svg>`,
      img: "./assets/img/suspension.png",
      color: "from-indigo-600 to-indigo-800",
    },
    {
      title: "Estado de los frenos",
      desc: "Verificamos discos, pastillas, líneas y líquido de frenos para máxima seguridad en la detención.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-hand-stop"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5" /><path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5" /><path d="M14 5.5a1.5 1.5 0 0 1 3 0v6.5" /><path d="M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" /></svg>`,
      img: "./assets/img/Sistema fe frenos.png",
      color: "from-red-700 to-red-900",
    },
    {
      title: "Llantas",
      desc: "Evaluamos presión, desgaste, estado del neumático y alineación para mejorar la seguridad y el rendimiento.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" > <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z" stroke-linecap="round" stroke-linejoin="round" /> <path d="M12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16Z" stroke-linecap="round" stroke-linejoin="round" /> <path d="M12 2V8" stroke-linecap="round" stroke-linejoin="round" /> <path d="M12 16V22" stroke-linecap="round" stroke-linejoin="round" /> <path d="M2 12H8" stroke-linecap="round" stroke-linejoin="round" /> <path d="M16 12H22" stroke-linecap="round" stroke-linejoin="round" /> <path d="M4.92896 4.92871L9.1716 9.17135" stroke-linecap="round" stroke-linejoin="round" /> <path d="M14.8284 14.8286L19.071 19.0713" stroke-linecap="round" stroke-linejoin="round" /> <path d="M4.92896 19.0713L9.1716 14.8286" stroke-linecap="round" stroke-linejoin="round" /> <path d="M14.8284 9.17139L19.071 4.92875" stroke-linecap="round" stroke-linejoin="round" /> </svg>`,
      img: "./assets/img/llantas.png",
      color: "from-slate-500 to-slate-700",
    },
    {
      title: "Vidrios",
      desc: "Comprobamos parabrisas, cristales y visibilidad para mantener seguridad y confort en la conducción.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-6" > <!-- espejo --> <path d="M13 5C17.5 5 21 7.2 21 10C21 12.8 17.5 15 13 15C9.5 15 7 13.2 7 10C7 6.8 9.5 5 13 5Z" stroke-linecap="round" stroke-linejoin="round" /> <!-- brazo --> <path d="M7 10L4 13" stroke-linecap="round" stroke-linejoin="round" /> <!-- base --> <path d="M4 13H2" stroke-linecap="round" stroke-linejoin="round" /> </svg>`,
      img: "./assets/img/Vidrios.png",
      color: "from-cyan-500 to-cyan-700",
    },
  ];

  const steps = [
    { n: "01", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>`, label: "Agenda tu cita", sub: "Reserva en línea en minutos" },
    { n: "02", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>`, label: "Lleva tu vehículo", sub: "En tu fecha y hora elegida" },
    { n: "03", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg>`, label: "Realizamos la inspección", sub: "Proceso certificado y técnico" },
    { n: "04", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"/></svg>`, label: "Obtén tu certificación", sub: "Documento oficial al instante" },
  ];

  return `
    <style>
      .svc-card { transition: transform 0.28s cubic-bezier(.22,1,.36,1), box-shadow 0.28s ease; }
      .svc-card:hover { transform: translateY(-8px); box-shadow: 0 24px 48px rgba(15,23,42,0.15); }
      .svc-card img { transition: transform 0.45s ease; }
      .svc-card:hover img { transform: scale(1.06); }
      .step-dot { transition: background 0.2s, transform 0.2s; }
      .step-item:hover .step-dot { background: #dc2626; transform: scale(1.12); }
    </style>

    <!-- HERO -->
    <div class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 py-20 px-6 text-center">
      <span class="inline-block bg-red-600 text-white text-xs font-bold tracking-widest uppercase px-4 py-1 rounded-full mb-5">Inspección Vehicular</span>
      <h1 class="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">¿Qué inspeccionamos?</h1>
      <p class="text-slate-300 text-lg max-w-2xl mx-auto">Evaluamos los principales sistemas de seguridad y emisiones de tu vehículo para garantizar el cumplimiento de la normativa vigente.</p>
    </div>

    <!-- CARDS GRID -->
    <section class="bg-slate-50 py-20 px-6">
      <div class="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        ${cards.map(card => `
          <article class="svc-card bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 flex flex-col">
            <div class="relative overflow-hidden h-48">
              <img src="${card.img}" alt="${card.title}" class="w-full h-full object-cover" loading="lazy">
              <div class="absolute inset-0 bg-gradient-to-t ${card.color} opacity-60"></div>
              <div class="absolute bottom-3 left-3 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 text-white rounded-xl p-2 shadow">
                ${card.icon}
              </div>
            </div>
            <div class="p-6 flex flex-col flex-1">
              <h3 class="text-slate-900 font-bold text-lg mb-2">${card.title}</h3>
              <p class="text-slate-500 text-sm leading-relaxed flex-1">${card.desc}</p>
              <a href="#/agendar" class="mt-5 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors w-fit">
                Agendar Cita
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
              </a>
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <!-- CÓMO FUNCIONA -->
    <section class="bg-white py-20 px-6">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-14">
          <span class="inline-block bg-blue-50 text-blue-700 text-xs font-bold tracking-widest uppercase px-4 py-1 rounded-full mb-4">Proceso</span>
          <h2 class="text-3xl md:text-4xl font-extrabold text-slate-900">¿Cómo funciona?</h2>
          <p class="text-slate-500 mt-3 max-w-xl mx-auto">Un proceso simple, rápido y transparente para mantener tu vehículo en regla.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          ${steps.map((s, i) => `
            <div class="step-item flex flex-col items-center text-center group">
              <div class="step-dot w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg mb-4 group-hover:bg-red-600 transition-all duration-300">
                ${s.icon}
              </div>
              <span class="text-xs font-bold text-red-600 tracking-widest mb-1">${s.n}</span>
              <h3 class="font-bold text-slate-900 text-base mb-1">${s.label}</h3>
              <p class="text-slate-500 text-sm">${s.sub}</p>
            </div>
          `).join("")}
        </div>
      </div>
    </section>

    <!-- CTA FINAL -->
    <section class="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 py-20 px-6 text-center">
      <div class="max-w-2xl mx-auto">
        <h2 class="text-3xl md:text-4xl font-extrabold text-white mb-4">Agenda tu revisión técnico-mecánica hoy mismo</h2>
        <p class="text-slate-300 text-lg mb-10">Atención rápida, inspección confiable y cumplimiento normativo garantizado.</p>
        <a href="#/agendar" class="inline-flex items-center gap-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-lg px-10 py-4 rounded-2xl shadow-xl transition-all duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0121 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
          Agendar Cita
        </a>
      </div>
    </section>
  `;
}
