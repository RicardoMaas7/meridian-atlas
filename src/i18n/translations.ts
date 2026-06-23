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
    selectSymbol: 'Notes from the survey. Select a symbol for its own entry.',
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
    selectSymbol: 'Notas del levantamiento. Selecciona un símbolo para ver su entrada.',
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
    nameCollisions: 'Esa proporción de rutas se匹配 por nombre nomás; nombres cortos comunes colliden. Rutas punteadas son pistas, no hechos.',
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
}

export const translations = { en, es }

export function t(lang: Language): Translations {
  return translations[lang]
}