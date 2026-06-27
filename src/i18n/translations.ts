export type Language = 'en' | 'es'

export interface Translations {
  lang: Language
  labels: {
    kicker: string
    title: string
    subtitle: string
    pledge: string
    chartFolder: string
    viewSpecimen: string
    newChart: string
    resurvey: string
    keepWatch: string
    standingWatch: string
    surveyOf: string
    symbols: string
    routes: string
    files: string
    seaworthiness: string
    was: string
    legend: string
    chartedRoute: string
    estimatedRoute: string
    arrowDirection: string
    symbolSize: string
    rock: string
    filledNew: string
    remarks: string
    selectSymbol: string
    noChange: string
    sinceLastSurvey: string
    new: string
    altered: string
    removed: string
    rocks: string
    gone: string
    source: string
    calledBy: string
    callsOut: string
    routesInbound: string
    routesOutbound: string
    estimated: string
    landingFoot: string
    soundings: string
    sourceLink: string
    noSupportedFiles: string
    readingCoastline: string
    takingSoundings: string
    nativeApp: string
    webApp: string
    chartFolderHint: string
    recents: string
    recentsTitle: string
    recentsEmpty: string
    recentsRemove: string
    recentsClose: string
    recentsNativeOnly: string
    themeToggle: string
    exportJSON: string
    exportSVG: string
    exportPNG: string
    importJSON: string
    restartTour: string
    openInEditor: string
    snapshotImported: string
    snapshotImportedBody: string
  }
  kinds: {
    function: string
    method: string
    class: string
    var: string
  }
  observations: {
    islands: string
    noCallsJoin: string
    lighthouses: string
    mostCalled: string
    portsOfDeparture: string
    entryPoints: string
    rocksTitle: string
    deadCode: string
    estimatedWaters: string
    nameCollisions: string
    straits: string
    crossModule: string
    busiest: string
    cleanSeparation: string
    noRouteCrosses: string
  }
  nodeReadings: {
    lighthouse: string
    portOfDeparture: string
    rock: string
    expedition: string
    instantiated: string
  }
  help: {
    title: string
    intro: string
    pan: string
    zoom: string
    select: string
    deselect: string
    reset: string
    search: string
    filter: string
    tour: string
    next: string
    back: string
    skip: string
    done: string
    steps: {
      welcome: { title: string; body: string }
      nodes: { title: string; body: string }
      edges: { title: string; body: string }
      select: { title: string; body: string }
      sidepanel: { title: string; body: string }
      legend: { title: string; body: string }
    }
    glossary: {
      title: string
      lighthouse: { term: string; body: string }
      port: { term: string; body: string }
      rock: { term: string; body: string }
      expedition: { term: string; body: string }
      island: { term: string; body: string }
      strait: { term: string; body: string }
      charted: { term: string; body: string }
      estimated: { term: string; body: string }
    }
  }
  search: {
    placeholder: string
    empty: string
    results: string
    result: string
  }
  filters: {
    title: string
    all: string
    functions: string
    methods: string
    classes: string
    hideRocks: string
    showRocks: string
    newOnly: string
  }
  node: {
    module: string
    kind: string
    file: string
    line: string
    copyExcerpt: string
    copied: string
    noIncoming: string
    noOutgoing: string
    callsIn: string
    callsOut: string
    callers: string
    callees: string
    reach: string
    reachDesc: string
    complexity: string
    complexityLow: string
    complexityMid: string
    complexityHigh: string
    complexityExt: string
  }
  resurveying: string
  noChanges: string
  showHelp: string
  showGlossary: string
  howToRead: string
  tourAgain: string
  chartReady: string
  chartReadyBody: string
  firstSteps: string
  readTheChart: string
}

const en: Translations = {
  lang: 'en',
  labels: {
    kicker: 'A survey of source code',
    title: 'Meridian',
    subtitle: 'A navigational chart of your code',
    pledge: 'Open a folder. Every function is drawn as a mark, every call as a route. Everything runs in your browser. Nothing leaves your machine.',
    chartFolder: 'Chart a folder',
    viewSpecimen: 'View specimen',
    newChart: 'New chart',
    resurvey: 'Re-survey',
    keepWatch: 'Keep watch',
    standingWatch: 'Standing watch',
    surveyOf: 'Meridian survey of',
    symbols: 'symbols',
    routes: 'routes',
    files: 'files',
    seaworthiness: 'seaworthiness',
    was: 'was',
    legend: 'Legend',
    chartedRoute: 'charted route (resolved call)',
    estimatedRoute: 'estimated route (by name)',
    arrowDirection: 'arrow = direction of the call',
    symbolSize: 'symbol · size = times called',
    rock: 'rock = never called, calls nothing',
    filledNew: 'filled = new since last survey',
    remarks: 'Remarks',
    selectSymbol: 'Notes from the survey. Click a symbol on the chart for its own entry.',
    noChange: 'No change',
    sinceLastSurvey: 'Since last survey',
    new: 'new',
    altered: 'altered',
    removed: 'removed',
    rocks: 'Rocks',
    gone: 'Gone',
    source: 'Source',
    calledBy: 'Called by',
    callsOut: 'Calls out',
    routesInbound: 'Routes inbound',
    routesOutbound: 'Routes outbound',
    estimated: 'est.',
    landingFoot: 'soundings given in number of calls',
    soundings: 'soundings given in number of calls',
    sourceLink: 'source',
    noSupportedFiles: 'No supported source files found in that folder.',
    readingCoastline: 'Reading the coastline…',
    takingSoundings: 'Taking soundings…',
    nativeApp: 'Desktop app',
    webApp: 'Web version',
    chartFolderHint: 'Choose a folder from your machine',
    recents: 'recent',
    recentsTitle: 'Recent charts',
    recentsEmpty: 'No charts yet — chart a folder and it will appear here.',
    recentsRemove: 'Remove',
    recentsClose: 'Close',
    recentsNativeOnly: 'Recents open automatically in the desktop app. On the web, pick the folder again.',
    themeToggle: 'Toggle theme',
    exportJSON: 'Export JSON',
    exportSVG: 'Export SVG',
    exportPNG: 'Export PNG',
    importJSON: 'Import JSON',
    restartTour: 'Restart the tour',
    openInEditor: 'Open in editor',
    snapshotImported: 'Snapshot imported',
    snapshotImportedBody: 'The JSON was read but full restoration is not yet supported in this build.',
  },
  kinds: {
    function: 'Function',
    method: 'Method',
    class: 'Class',
    var: 'Function (assigned)',
  },
  observations: {
    islands: 'islands',
    noCallsJoin: 'No calls join these groups',
    lighthouses: 'Lighthouses',
    mostCalled: 'The most-called symbols. A change here reaches the whole chart.',
    portsOfDeparture: 'Ports of departure',
    entryPoints: 'Called by nothing surveyed, yet many routes set out from them. The likely entry points.',
    rocksTitle: 'rocks',
    deadCode: 'No route touches them. Dead code, or called from outside the survey: tests, templates, reflection.',
    estimatedWaters: '% estimated',
    nameCollisions: 'That share of routes is matched by name alone; short common names collide. Dashed routes are leads, not facts.',
    straits: 'Straits',
    crossModule: 'route crosses module boundaries',
    busiest: 'Busiest',
    cleanSeparation: 'Clean separation',
    noRouteCrosses: 'No route crosses a module boundary.',
  },
  nodeReadings: {
    lighthouse: 'lighthouse',
    portOfDeparture: 'port of departure',
    rock: 'rock',
    expedition: 'expedition',
    instantiated: 'Instantiated',
  },
  help: {
    title: 'How to read this chart',
    intro: 'A 19th-century surveyor\u2019s reading of your code. Click any symbol to study it; pan and zoom to navigate; the panel on the right tells you what the chart says about it.',
    pan: 'Drag to pan · scroll to zoom · 0 to recenter',
    zoom: 'Wheel or trackpad pinch to zoom',
    select: 'Click any node for details',
    deselect: 'Click empty water to deselect',
    reset: 'Press 0 to fit the whole chart',
    search: 'Press / to search for a symbol',
    filter: 'Press F to filter by kind',
    tour: 'Take the tour',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    done: 'Done',
    steps: {
      welcome: {
        title: 'A chart of your code',
        body: 'Every circle is a function, method, class or variable. Every line is a call from one to another. The chart is laid out by force, so closely connected code clusters together. Drag to pan, scroll to zoom.',
      },
      nodes: {
        title: 'Reading the marks',
        body: 'A larger mark means a more-traveled symbol. The pulsing circle is a real symbol from your code — its size grows with the number of times it is called. A solid gold ring means it has charted routes; a dashed ring means it is new since your last survey.',
      },
      edges: {
        title: 'Following the routes',
        body: 'The lines leaving the highlighted symbol are calls it makes. Solid gold lines are proven calls — the parser saw them and resolved them. Dashed dim lines are estimated: matched by name, not pinned to a single definition. The arrowhead shows the direction of the call.',
      },
      select: {
        title: 'Pick a symbol',
        body: 'Click any node to open its entry on the right. The panel shows who calls it, what it calls, its kind, complexity, and a copy of its source. Click another node to switch; click empty water to deselect.',
      },
      sidepanel: {
        title: 'The remarks',
        body: 'The numbered notes are the chart’s own observations about the codebase: lighthouses (most-called), ports of departure (entry points), rocks (dead code), straits (where modules couple), and islands (groups that never speak to each other).',
      },
      legend: {
        title: 'Legend',
        body: 'The legend at the bottom decodes every mark. The mini-map in the corner keeps your bearings when you zoom in deep.',
      },
    },
    glossary: {
      title: 'Glossary of marks',
      lighthouse: {
        term: 'Lighthouse',
        body: 'A heavily-called symbol. Changes here ripple through the whole code. Worth a careful eye.',
      },
      port: {
        term: 'Port of departure',
        body: 'A symbol nothing in the chart calls, but that calls many things. A likely entry point: a handler, a CLI command, a public API surface.',
      },
      rock: {
        term: 'Rock',
        body: 'A symbol with no routes at all \u2014 not called by anything surveyed, and calling nothing. Either dead code, or called from outside (tests, templates, reflection).',
      },
      expedition: {
        term: 'Expedition',
        body: 'A symbol with many outgoing routes. Complexity gathers here. Often a god function or a hub that knows too much.',
      },
      island: {
        term: 'Island',
        body: 'A group of symbols with no calls to or from the rest of the chart. Either truly disconnected code, or connected by means the survey cannot see.',
      },
      strait: {
        term: 'Strait',
        body: 'A pair of modules that exchange many calls. The point of greatest coupling \u2014 changing either side will be felt on the other.',
      },
      charted: {
        term: 'Charted route',
        body: 'A call the parser can prove: same file, or an unambiguous name match. Drawn as a solid gold line.',
      },
      estimated: {
        term: 'Estimated route',
        body: 'A call matched by name only. The parser saw a call to "render" but several "render" functions exist. Drawn as a dashed dim line \u2014 a lead, not a fact.',
      },
    },
  },
  search: {
    placeholder: 'Search symbols\u2026',
    empty: 'No symbols match',
    results: 'matches',
    result: 'match',
  },
  filters: {
    title: 'Filter',
    all: 'All',
    functions: 'Functions',
    methods: 'Methods',
    classes: 'Classes',
    hideRocks: 'Hide rocks',
    showRocks: 'Show rocks',
    newOnly: 'New only',
  },
  node: {
    module: 'Module',
    kind: 'Kind',
    file: 'File',
    line: 'Line',
    copyExcerpt: 'Copy excerpt',
    copied: 'Copied',
    noIncoming: 'Nothing in the survey calls this.',
    noOutgoing: 'This symbol calls nothing in the survey.',
    callsIn: 'callers',
    callsOut: 'callees',
    callers: 'Callers',
    callees: 'Callees',
    reach: 'Reach',
    reachDesc: 'Symbols reachable from here, directly or transitively.',
    complexity: 'Complexity',
    complexityLow: 'Tidy',
    complexityMid: 'Worth a look',
    complexityHigh: 'Hub',
    complexityExt: 'Refactor candidate',
  },
  resurveying: 'Re-surveying\u2026',
  noChanges: 'The waters are unchanged.',
  showHelp: 'Show help',
  showGlossary: 'Glossary',
  howToRead: 'How to read',
  tourAgain: 'Take the tour',
  chartReady: 'The chart is ready',
  chartReadyBody: 'Click any mark to study it. Drag to pan, scroll to zoom, press 0 to recenter.',
  firstSteps: 'First time here?',
  readTheChart: 'Read the chart',
}

const es: Translations = {
  lang: 'es',
  labels: {
    kicker: 'Un levantamiento de código fuente',
    title: 'Meridian',
    subtitle: 'Una carta náutica de tu código',
    pledge: 'Abre una carpeta. Cada función se dibuja como una marca, cada llamada como una ruta. Todo se ejecuta en tu navegador. Nada sale de tu máquina.',
    chartFolder: 'Levantar carpeta',
    viewSpecimen: 'Ver ejemplo',
    newChart: 'Nueva carta',
    resurvey: 'Revisar',
    keepWatch: 'Vigilar',
    standingWatch: 'En vigía',
    surveyOf: 'Levantamiento Meridian de',
    symbols: 'símbolos',
    routes: 'rutas',
    files: 'archivos',
    seaworthiness: 'navegabilidad',
    was: 'era',
    legend: 'Leyenda',
    chartedRoute: 'ruta trazada (llamada resuelta)',
    estimatedRoute: 'ruta estimada (por nombre)',
    arrowDirection: 'flecha = dirección de la llamada',
    symbolSize: 'símbolo · tamaño = veces llamado',
    rock: 'roca = nunca llamado, no llama a nada',
    filledNew: 'relleno = nuevo desde el último levantamiento',
    remarks: 'Notas',
    selectSymbol: 'Notas del levantamiento. Haz clic en un símbolo de la carta para ver su entrada.',
    noChange: 'Sin cambios',
    sinceLastSurvey: 'Desde el último levantamiento',
    new: 'nuevos',
    altered: 'alterados',
    removed: 'eliminados',
    rocks: 'Rocas',
    gone: 'Eliminados',
    source: 'Código',
    calledBy: 'Llamado por',
    callsOut: 'Llama a',
    routesInbound: 'Rutas entrantes',
    routesOutbound: 'Rutas salientes',
    estimated: 'est.',
    landingFoot: 'muestras en número de llamadas',
    soundings: 'muestras en número de llamadas',
    sourceLink: 'código',
    noSupportedFiles: 'No se encontraron archivos fuente soportados en esa carpeta.',
    readingCoastline: 'Leyendo la costa…',
    takingSoundings: 'Tomando muestras…',
    nativeApp: 'App de escritorio',
    webApp: 'Versión web',
    chartFolderHint: 'Elige una carpeta de tu máquina',
    recents: 'recientes',
    recentsTitle: 'Cartas recientes',
    recentsEmpty: 'Aún no hay cartas — explora una carpeta y aparecerá aquí.',
    recentsRemove: 'Quitar',
    recentsClose: 'Cerrar',
    recentsNativeOnly: 'Las recientes se abren solas en la app de escritorio. En la web, vuelve a elegir la carpeta.',
    themeToggle: 'Cambiar tema',
    exportJSON: 'Exportar JSON',
    exportSVG: 'Exportar SVG',
    exportPNG: 'Exportar PNG',
    importJSON: 'Importar JSON',
    restartTour: 'Repetir el tour',
    openInEditor: 'Abrir en el editor',
    snapshotImported: 'Snapshot importado',
    snapshotImportedBody: 'El JSON se leyó, pero la restauración completa aún no está disponible en esta build.',
  },
  kinds: {
    function: 'Función',
    method: 'Método',
    class: 'Clase',
    var: 'Función (asignada)',
  },
  observations: {
    islands: 'islas',
    noCallsJoin: 'Ninguna llamada une estos grupos',
    lighthouses: 'Faros',
    mostCalled: 'Los símbolos más llamados. Un cambio aquí alcanza toda la carta.',
    portsOfDeparture: 'Puertos de partida',
    entryPoints: 'No los llama nada levantado, pero muchas rutas salen de ellos. Puntos de entrada probables.',
    rocksTitle: 'rocas',
    deadCode: 'Ninguna ruta los toca. Código muerto, o llamado desde fuera del levantamiento: tests, plantillas, reflexión.',
    estimatedWaters: '% estimado',
    nameCollisions: 'Esa proporción de rutas se empareja solo por nombre; los nombres cortos comunes colisionan. Las rutas punteadas son pistas, no hechos.',
    straits: 'Estrechos',
    crossModule: 'ruta cruza límites de módulo',
    busiest: 'Más transitado',
    cleanSeparation: 'Separación limpia',
    noRouteCrosses: 'Ninguna ruta cruza un límite de módulo.',
  },
  nodeReadings: {
    lighthouse: 'faro',
    portOfDeparture: 'puerto de partida',
    rock: 'roca',
    expedition: 'expedición',
    instantiated: 'Instanciado',
  },
  help: {
    title: 'Cómo leer esta carta',
    intro: 'La lectura que un cartógrafo del siglo XIX haría de tu código. Haz clic en cualquier símbolo para estudiarlo; arrastra y haz zoom para navegar; el panel de la derecha te dice lo que la carta opina de él.',
    pan: 'Arrastra para mover · scroll para zoom · 0 para recentrar',
    zoom: 'Rueda o pinch en el trackpad para hacer zoom',
    select: 'Clic en cualquier nodo para ver detalles',
    deselect: 'Clic en el agua para deseleccionar',
    reset: 'Pulsa 0 para encajar la carta',
    search: 'Pulsa / para buscar un símbolo',
    filter: 'Pulsa F para filtrar por tipo',
    tour: 'Hacer el tour',
    next: 'Siguiente',
    back: 'Atrás',
    skip: 'Saltar',
    done: 'Hecho',
    steps: {
      welcome: {
        title: 'Una carta de tu código',
        body: 'Cada círculo es una función, método, clase o variable. Cada línea es una llamada de uno a otro. La carta se ordena por fuerzas, por lo que el código muy conectado se agrupa. Arrastra para mover, scroll para zoom.',
      },
      nodes: {
        title: 'Leyendo las marcas',
        body: 'Una marca más grande significa un símbolo más transitado. El círculo que pulsa es un símbolo real de tu código — su tamaño crece con el número de veces que se le llama. Un anillo dorado sólido significa que tiene rutas trazadas; un anillo punteado significa que es nuevo desde tu último levantamiento.',
      },
      edges: {
        title: 'Siguiendo las rutas',
        body: 'Las líneas que salen del símbolo resaltado son llamadas que él hace. Las líneas doradas sólidas son llamadas probadas — el parser las vio y las resolvió. Las líneas tenues punteadas son estimadas: coinciden por nombre, no se fijan a una sola definición. La punta de flecha muestra la dirección.',
      },
      select: {
        title: 'Elige un símbolo',
        body: 'Haz clic en cualquier nodo para abrir su entrada a la derecha. El panel muestra quién lo llama, qué llama, su tipo, complejidad, y una copia de su código. Haz clic en otro nodo para cambiar; clic en el agua para deseleccionar.',
      },
      sidepanel: {
        title: 'Las notas',
        body: 'Las notas numeradas son las observaciones de la carta sobre el código: faros (los más llamados), puertos de partida (puntos de entrada), rocas (código muerto), estrechos (donde se acoplan los módulos), e islas (grupos que no se hablan entre sí).',
      },
      legend: {
        title: 'Leyenda',
        body: 'La leyenda al pie descodifica cada marca. El minimapa en la esquina te mantiene orientado cuando haces mucho zoom.',
      },
    },
    glossary: {
      title: 'Glosario de marcas',
      lighthouse: {
        term: 'Faro',
        body: 'Un símbolo muy llamado. Los cambios aquí se propagan por todo el código. Vale la pena mirarlo con cuidado.',
      },
      port: {
        term: 'Puerto de partida',
        body: 'Un símbolo al que nada en la carta llama, pero que llama a muchas cosas. Un punto de entrada probable: un handler, un comando CLI, una API pública.',
      },
      rock: {
        term: 'Roca',
        body: 'Un símbolo sin ninguna ruta — no lo llama nada del levantamiento, y no llama a nada. O bien código muerto, o llamado desde fuera (tests, plantillas, reflexión).',
      },
      expedition: {
        term: 'Expedición',
        body: 'Un símbolo con muchas rutas salientes. La complejidad se concentra aquí. A menudo una función dios o un hub que sabe demasiado.',
      },
      island: {
        term: 'Isla',
        body: 'Un grupo de símbolos sin llamadas hacia o desde el resto de la carta. O bien código realmente desconectado, o conectado por medios que el levantamiento no puede ver.',
      },
      strait: {
        term: 'Estrecho',
        body: 'Un par de módulos que intercambian muchas llamadas. El punto de mayor acoplamiento — cambiar cualquier lado se notará en el otro.',
      },
      charted: {
        term: 'Ruta trazada',
        body: 'Una llamada que el parser puede probar: mismo archivo, o coincidencia de nombre no ambigua. Se dibuja como línea dorada sólida.',
      },
      estimated: {
        term: 'Ruta estimada',
        body: 'Una llamada que coincide solo por nombre. El parser vio una llamada a "render" pero hay varias funciones "render". Se dibuja como línea tenue punteada — una pista, no un hecho.',
      },
    },
  },
  search: {
    placeholder: 'Buscar símbolos…',
    empty: 'Ningún símbolo coincide',
    results: 'coincidencias',
    result: 'coincidencia',
  },
  filters: {
    title: 'Filtrar',
    all: 'Todo',
    functions: 'Funciones',
    methods: 'Métodos',
    classes: 'Clases',
    hideRocks: 'Ocultar rocas',
    showRocks: 'Mostrar rocas',
    newOnly: 'Solo nuevos',
  },
  node: {
    module: 'Módulo',
    kind: 'Tipo',
    file: 'Archivo',
    line: 'Línea',
    copyExcerpt: 'Copiar excerpt',
    copied: 'Copiado',
    noIncoming: 'Nada en el levantamiento llama a esto.',
    noOutgoing: 'Este símbolo no llama a nada en el levantamiento.',
    callsIn: 'llamantes',
    callsOut: 'llamados',
    callers: 'Llamantes',
    callees: 'Llamados',
    reach: 'Alcance',
    reachDesc: 'Símbolos alcanzables desde aquí, directa o transitivamente.',
    complexity: 'Complejidad',
    complexityLow: 'Ordenado',
    complexityMid: 'A revisar',
    complexityHigh: 'Hub',
    complexityExt: 'A refactorizar',
  },
  resurveying: 'Relevantando…',
  noChanges: 'Las aguas no han cambiado.',
  showHelp: 'Mostrar ayuda',
  showGlossary: 'Glosario',
  howToRead: 'Cómo leer',
  tourAgain: 'Hacer el tour',
  chartReady: 'La carta está lista',
  chartReadyBody: 'Haz clic en una marca para estudiarla. Arrastra para mover, scroll para zoom, pulsa 0 para recentrar.',
  firstSteps: '¿Primera vez aquí?',
  readTheChart: 'Leer la carta',
}

export const translations = { en, es }

export function t(lang: Language): Translations {
  return translations[lang]
}
