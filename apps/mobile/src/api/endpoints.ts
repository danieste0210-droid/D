// Mapa central de rutas del backend. Mantener en sync con apps/api (ver openapi.yaml en la raíz de api).
export const endpoints = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    pushToken: '/auth/push-token',
  },
  sales: {
    process: '/sale/process',
    all: '/sale/sales/all',
    search: '/sale/sales/search',
    summary: '/sale/sales/sumary',
    lastSale: '/sale/sales/ultsale',
    cancel: (id: string) => `/sale/sales/delete/${id}`,
  },
  lotteries: {
    create: '/lotteries/create',
    edit: (id: string) => `/lotteries/edit/${id}`,
    block: (id: string) => `/lotteries/block/${id}`,
    delete: (id: string) => `/lotteries/delete/${id}`,
    all: '/lotteries/all',
    day: '/lotteries/day',
    results: '/lotteries/results',
    awardsForUser: '/lotteries/awards/user',
  },
  closures: {
    create: '/closures/create',
    all: '/closures/getAll',
    update: (id: string) => `/closures/update/${id}`,
    delete: (id: string) => `/closures/delete/${id}`,
  },
  results: {
    create: '/results/create',
    reverse: (id: string) => `/results/reverse/${id}`,
    pendingAwards: '/results/awards/pending',
  },
  users: {
    create: '/user/create',
    update: (id: string) => `/user/update/${id}`,
    deactivate: (id: string) => `/user/delete/${id}`,
    all: '/user/super',
  },
  reports: {
    sales: '/reports/sales',
    exportExcel: '/reports/sales/export/excel',
    exportPdf: '/reports/sales/export/pdf',
  },
} as const;
