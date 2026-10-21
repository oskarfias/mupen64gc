// Recursos (blog). Los tres artículos son BORRADORES: revisar antes de publicar.
// Mientras draft = true, la página muestra el aviso y se marca con noindex.
// Datos legales: solo se usan los datos permitidos (ver README).

export const posts = [
  {
    slug: 'jornada-de-40-horas-que-hacer-antes-de-2027',
    title: 'Jornada de 40 horas: qué hacer antes de 2027',
    description: 'Qué cambia con la reducción de la jornada, qué es obligatorio desde 2027 y cinco pasos para prepararte sin perder productividad.',
    area: 'rh',
    date: '[FECHA DE PUBLICACIÓN]',
    draft: true,
    related: ['ruta-40-horas', 'paquete-empresa-en-orden-2027'],
    body: `
<p>La jornada laboral en México se reduce de forma gradual. Para una pyme, el cambio no es solo de calendario: toca horarios, turnos, costos, contratos y la forma de medir la productividad.</p>
<h2>Lo que ya sabemos</h2>
<ul>
  <li>Desde el 1 de enero de 2027 el registro electrónico de la jornada es obligatorio.</li>
  <li>La jornada máxima baja de 48 a 46 horas en 2027.</li>
  <li>La jornada llega a 40 horas en 2030.</li>
</ul>
<p>[VERIFICA LAS FUENTES OFICIALES Y AGREGA LOS ENLACES ANTES DE PUBLICAR]</p>
<h2>Cinco pasos para prepararte</h2>
<h3>1. Mide el impacto por puesto y turno</h3>
<p>No todos los puestos se afectan igual. Haz una lista de puestos y turnos con las horas que hoy trabaja cada uno y compárala con el límite de cada año. Ahí verás dónde hay brecha.</p>
<h3>2. Calcula el costo de 2027 a 2030</h3>
<p>Si la operación necesita las mismas horas de cobertura, alguien tendrá que cubrirlas: con más personal, con turnos distintos o con mejoras de productividad. Ponle número a cada opción antes de decidir.</p>
<h3>3. Rediseña horarios y turnos</h3>
<p>Con el impacto y el costo a la vista, rediseña la cobertura. Empieza por los puestos donde la brecha es mayor.</p>
<h3>4. Implementa el registro electrónico de la jornada</h3>
<p>Elige la herramienta, define quién la revisa y prueba el registro antes de que sea obligatorio. Un registro que nadie revisa no sirve para tomar decisiones.</p>
<h3>5. Revisa contratos y reglamento con un abogado laboral</h3>
<p>Los cambios de horario deben quedar por escrito. Revisa contratos y reglamento interior con un especialista antes de aplicarlos.</p>
<h2>¿Por dónde empiezo?</h2>
<p>Si quieres saber cuánto le cuesta el cambio a tu empresa, la <a class="link" href="/soluciones/ruta-40-horas/">Ruta 40 horas</a> incluye un diagnóstico exprés de impacto por puesto y turno.</p>`,
  },
  {
    slug: 'nom-035-en-pymes-obligaciones-segun-tu-tamano',
    title: 'NOM-035 en pymes: obligaciones según tu tamaño',
    description: 'A quién aplica la NOM-035, cómo cambian las obligaciones según el número de trabajadores y cómo armar una carpeta de evidencias.',
    area: 'rh',
    date: '[FECHA DE PUBLICACIÓN]',
    draft: true,
    related: ['nom-035-llave-en-mano', 'encuesta-de-clima'],
    body: `
<p>La NOM-035 aplica a todos los centros de trabajo, sin importar su tamaño. Lo que cambia según el número de trabajadores son las obligaciones que debes cumplir.</p>
<h2>Tres rangos de tamaño</h2>
<ul>
  <li><strong>Hasta 15 trabajadores.</strong> [DETALLE DE OBLIGACIONES — VALIDAR CON LA NORMA OFICIAL]</li>
  <li><strong>De 16 a 50 trabajadores.</strong> [DETALLE DE OBLIGACIONES — VALIDAR CON LA NORMA OFICIAL]</li>
  <li><strong>Más de 50 trabajadores.</strong> [DETALLE DE OBLIGACIONES — VALIDAR CON LA NORMA OFICIAL]</li>
</ul>
<h2>¿Qué pasa si no cumplo?</h2>
<p>El incumplimiento puede sancionarse con multas de 250 a 5,000 UMA.</p>
<p>[VERIFICA LAS FUENTES OFICIALES Y AGREGA LOS ENLACES ANTES DE PUBLICAR]</p>
<h2>La carpeta de evidencias</h2>
<p>Cumplir no es solo aplicar un cuestionario. Lo que demuestra el cumplimiento es la evidencia ordenada: documentos, resultados, acciones y registros de difusión y capacitación, en un solo lugar y al día.</p>
<h2>Cómo empezar esta semana</h2>
<ol>
  <li>Cuenta a tus trabajadores por centro de trabajo para saber en qué rango estás.</li>
  <li>Revisa qué documentos ya tienes y cuáles faltan.</li>
  <li>Asigna a una persona responsable de la carpeta.</li>
</ol>
<p>Si tienes hasta 15 personas, el <a class="link" href="/soluciones/nom-035-llave-en-mano/">kit hazlo tú</a> te da los formatos. Si prefieres que lo hagamos por ti, revisa <a class="link" href="/soluciones/nom-035-llave-en-mano/">NOM-035 llave en mano</a>.</p>`,
  },
  {
    slug: 'flujo-de-efectivo-a-13-semanas',
    title: 'Flujo de efectivo a 13 semanas: cómo saber si te alcanza',
    description: 'Cómo armar un flujo de efectivo semanal a 13 semanas, qué incluir y cómo usarlo cada lunes para decidir pagos y cobranza.',
    area: 'finanzas',
    date: '[FECHA DE PUBLICACIÓN]',
    draft: true,
    related: ['flujo-de-efectivo-13-semanas', 'cfo-externo'],
    body: `
<p>Una empresa puede tener utilidad y quedarse sin dinero. El flujo de efectivo a 13 semanas responde una sola pregunta: ¿me alcanza el dinero los próximos tres meses?</p>
<h2>¿Por qué 13 semanas?</h2>
<p>Trece semanas son un trimestre. Es suficiente para ver venir un faltante y hacer algo al respecto, y lo bastante corto para proyectarlo con datos reales: facturas por cobrar, pagos comprometidos y nómina.</p>
<h2>Qué incluir</h2>
<ul>
  <li><strong>Saldo inicial:</strong> lo que hay hoy en bancos.</li>
  <li><strong>Entradas:</strong> cobranza esperada por semana, cliente por cliente.</li>
  <li><strong>Salidas:</strong> nómina, proveedores, renta, impuestos, créditos y gastos fijos.</li>
  <li><strong>Saldo final:</strong> saldo inicial más entradas menos salidas. Se convierte en el saldo inicial de la semana siguiente.</li>
</ul>
<h2>Define tu semáforo</h2>
<p>Decide un saldo mínimo con el que te sientes seguro. Las semanas por debajo de ese saldo son alerta; las semanas en negativo, urgencia. Así sabes con anticipación cuándo acelerar cobranza, mover pagos o pedir financiamiento.</p>
<h2>La rutina de cada lunes</h2>
<ol>
  <li>Actualiza el saldo real de bancos.</li>
  <li>Marca lo que sí se cobró y se pagó la semana pasada.</li>
  <li>Agrega una semana nueva al final para mantener siempre 13 semanas por delante.</li>
  <li>Revisa el semáforo y decide.</li>
</ol>
<p>¿Quieres la plantilla lista? <a class="link" href="/soluciones/flujo-de-efectivo-13-semanas/">Flujo de efectivo a 13 semanas</a> incluye el modelo semanal, el semáforo de alertas y un video para actualizarlo.</p>`,
  },
];
