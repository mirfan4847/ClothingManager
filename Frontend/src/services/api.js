import axios from 'axios';

// ✅ Relative URL - Vite proxy forwards /api/* to http://localhost:5000/api/*
const api = axios.create({ baseURL: '/api' });

// Attach JWT token
api.interceptors.request.use(config => {
  try {
    const saved = sessionStorage.getItem('cm_user');
    if (saved) {
      const { token } = JSON.parse(saved);
      if (token && !token.startsWith('local-'))
        config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

// Handle 401 — only force-logout if the user has a real (non-local) JWT token
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      try {
        const saved = sessionStorage.getItem('cm_user');
        const token = saved ? JSON.parse(saved)?.token : null;
        const isLocalToken = token?.startsWith('local-');
        if (!isLocalToken) {
          sessionStorage.removeItem('cm_user');
          window.location.href = '/login';
        }
      } catch {
        sessionStorage.removeItem('cm_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (data) => api.post('/auth/login', data).then(r => r.data);
export const getMe = ()     => api.get('/auth/me').then(r => r.data);

// Users
export const getUsers         = ()         => api.get('/users').then(r => r.data);
export const createUser       = (data)     => api.post('/users', data).then(r => r.data);
export const updateUser       = (id, data) => api.put(`/users/${id}`, data).then(r => r.data);
export const toggleUserStatus = (id)       => api.patch(`/users/${id}/toggle-status`).then(r => r.data);
export const changePassword   = (id, data) => api.patch(`/users/${id}/change-password`, data).then(r => r.data);

// Roles
export const getRoles        = ()            => api.get('/roles').then(r => r.data);
export const updateRolePerms = (role, perms) => api.put(`/roles/${role}`, perms).then(r => r.data);

// Dropdowns
export const getSizes    = () => api.get('/dropdowns/sizes').then(r => r.data);
export const getColors   = () => api.get('/dropdowns/colors').then(r => r.data);
export const getMachines = () => api.get('/dropdowns/machines').then(r => r.data);
export const getWorkers  = () => api.get('/dropdowns/workers').then(r => r.data);
export const getAllStaff = () => api.get('/dropdowns/all-staff').then(r => r.data);

// Lots
export const getLots          = (params)   => api.get('/lots', { params }).then(r => r.data);
export const createLot        = (data)     => api.post('/lots', data).then(r => r.data);
export const updateLot        = (id, data) => api.put(`/lots/${id}`, data).then(r => r.data);
export const updateLotStatus  = (id, status) => api.patch(`/lots/${id}/status`, { status }).then(r => r.data);
export const uploadLotPicture = (id, file)   => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/lots/${id}/picture`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};

// Worker Entries
export const getEntries    = (workerId) => api.get('/workerentries', { params: { workerId } }).then(r => r.data);
export const getEntry      = (id)       => api.get(`/workerentries/${id}`).then(r => r.data);
export const createEntry   = (data)     => api.post('/workerentries', data).then(r => r.data);
export const updateEntry   = (id, data) => api.put(`/workerentries/${id}`, data).then(r => r.data);
export const deleteEntry   = (id)       => api.delete(`/workerentries/${id}`);
export const uploadPicture = (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/workerentries/${id}/picture`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);
};

// Accounts
export const getAccountSummary    = ()      => api.get('/accounts/summary').then(r => r.data);
export const getAccountCategories = ()      => api.get('/accounts/categories').then(r => r.data);
export const getAccounts          = ()      => api.get('/accounts').then(r => r.data);
export const createAccount        = (data)  => api.post('/accounts', data).then(r => r.data);
export const updateAccount        = (id, d) => api.put(`/accounts/${id}`, d).then(r => r.data);
export const toggleAccountStatus  = (id)    => api.patch(`/accounts/${id}/toggle-status`).then(r => r.data);

// Transactions
export const getTransactions   = (params) => api.get('/transactions', { params }).then(r => r.data);
export const addTransaction    = (data)   => api.post('/transactions', data).then(r => r.data);
export const deleteTransaction = (id)     => api.delete(`/transactions/${id}`);

// Wages
export const getWageRates          = (workerId)            => api.get('/wages/rates', { params: { workerId } }).then(r => r.data);
export const upsertWageRate        = (data)                => api.post('/wages/rates', data).then(r => r.data);
export const deleteWageRate        = (id)                  => api.delete(`/wages/rates/${id}`);
export const calculateWages        = (workerId, from, to)  => api.get('/wages/calculate', { params: { workerId, from, to } }).then(r => r.data);
export const calculateAllWages     = (from, to)            => api.get('/wages/calculate-all', { params: { from, to } }).then(r => r.data);
export const getWageSummary        = ()                    => api.get('/wages/summary').then(r => r.data);
export const getWagePayments       = (params)              => api.get('/wages/payments', { params }).then(r => r.data);
export const createWagePayment     = (data)                => api.post('/wages/payments', data).then(r => r.data);
export const deleteWagePayment     = (id)                  => api.delete(`/wages/payments/${id}`);
export const syncPayrollToFinance        = ()  => api.post('/wages/sync-to-finance').then(r => r.data);
export const cleanupFinanceDuplicates    = ()  => api.post('/wages/cleanup-finance-duplicates').then(r => r.data);
// Worker Advances
export const getAdvances           = (params)              => api.get('/wages/advances', { params }).then(r => r.data);
export const createAdvance         = (data)                => api.post('/wages/advances', data).then(r => r.data);
export const settleAdvance         = (id)                  => api.patch(`/wages/advances/${id}/settle`);
export const deleteAdvance         = (id)                  => api.delete(`/wages/advances/${id}`);
export const getAdvanceBalance     = (workerId)            => api.get(`/wages/advances/balance/${workerId}`).then(r => r.data);

// Purchases
export const getPurchases        = (params)   => api.get('/purchases', { params }).then(r => r.data);
export const getPurchaseSummary  = ()         => api.get('/purchases/summary').then(r => r.data);
export const createPurchase      = (data)     => api.post('/purchases', data).then(r => r.data);
export const updatePurchase      = (id, data) => api.put(`/purchases/${id}`, data).then(r => r.data);
export const deletePurchase      = (id)       => api.delete(`/purchases/${id}`);

// Inventory
export const getInventorySummary = ()           => api.get('/inventory/summary').then(r => r.data);
export const getInventoryStock   = (material)   => api.get('/inventory/stock', { params: material ? { material } : {} }).then(r => r.data);
export const getInventoryUsages  = (params)     => api.get('/inventory/usages', { params }).then(r => r.data);
export const getLotUsage         = (lotId)      => api.get(`/inventory/lot/${lotId}`).then(r => r.data);
export const createUsage         = (data)       => api.post('/inventory/usages', data).then(r => r.data);
export const updateUsage         = (id, data)   => api.put(`/inventory/usages/${id}`, data).then(r => r.data);
export const deleteUsage         = (id)         => api.delete(`/inventory/usages/${id}`);

// Suppliers
export const getSuppliers        = ()         => api.get('/suppliers').then(r => r.data);
export const getActiveSuppliers  = ()         => api.get('/suppliers/active').then(r => r.data);
export const createSupplier      = (data)     => api.post('/suppliers', data).then(r => r.data);
export const updateSupplier      = (id, data) => api.put(`/suppliers/${id}`, data).then(r => r.data);
export const toggleSupplierStatus = (id)      => api.patch(`/suppliers/${id}/toggle-status`).then(r => r.data);
export const deleteSupplier      = (id)       => api.delete(`/suppliers/${id}`);

// Sales
export const getSales          = (params)        => api.get('/sales', { params }).then(r => r.data);
export const getSale           = (id)            => api.get(`/sales/${id}`).then(r => r.data);
export const getSaleSummary    = ()              => api.get('/sales/summary').then(r => r.data);
export const createSale        = (data)          => api.post('/sales', data).then(r => r.data);
export const updateSale        = (id, data)      => api.put(`/sales/${id}`, data).then(r => r.data);
export const deleteSale        = (id)            => api.delete(`/sales/${id}`);
export const addSalePayment    = (saleId, data)  => api.post(`/sales/${saleId}/payments`, data).then(r => r.data);
export const deleteSalePayment = (id)            => api.delete(`/sales/payments/${id}`);

// Customers
export const getCustomers        = ()         => api.get('/customers').then(r => r.data);
export const getActiveCustomers  = ()         => api.get('/customers/active').then(r => r.data);
export const createCustomer      = (data)     => api.post('/customers', data).then(r => r.data);
export const updateCustomer      = (id, data) => api.put(`/customers/${id}`, data).then(r => r.data);
export const toggleCustomerStatus = (id)      => api.patch(`/customers/${id}/toggle-status`).then(r => r.data);
export const deleteCustomer      = (id)       => api.delete(`/customers/${id}`);

// Audit Logs
export const getAuditLogs    = (params) => api.get('/auditlogs', { params }).then(r => r.data);
export const getAuditStats   = (params) => api.get('/auditlogs/stats', { params }).then(r => r.data);
export const getAuditModules = ()       => api.get('/auditlogs/modules').then(r => r.data);

// Finance Reports
export const getReportPayroll               = (params) => api.get('/reports/payroll',           { params }).then(r => r.data);
export const getReportFinanceSummary        = (params) => api.get('/reports/finance/summary',          { params }).then(r => r.data);
export const getReportSalesByCustomer       = (params) => api.get('/reports/finance/sales-by-customer',{ params }).then(r => r.data);
export const getReportMonthlyCashFlow       = (params) => api.get('/reports/finance/monthly',          { params }).then(r => r.data);
export const getReportPaymentMethods        = (params) => api.get('/reports/finance/payment-methods',  { params }).then(r => r.data);
export const getReportAccountStatement      = (params) => api.get('/reports/finance/account-statement',{ params }).then(r => r.data);
export const getReportExpenses              = (params) => api.get('/reports/finance/expenses',         { params }).then(r => r.data);

export default api;
