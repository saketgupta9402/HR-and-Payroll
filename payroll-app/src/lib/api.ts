const API_URL = "http://localhost:4000";

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;
const NO_PREFIX_PATHS = ["/auth", "/health"];

// Cache TTL for profile endpoint (2 seconds)
const CACHE_TTL = 2000;

const resolveEndpoint = (endpoint: string) => {
  if (ABSOLUTE_URL_REGEX.test(endpoint)) {
    return endpoint;
  }

  const withLeadingSlash = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const needsApiPrefix =
    !withLeadingSlash.startsWith("/api") &&
    !NO_PREFIX_PATHS.some((prefix) => withLeadingSlash.startsWith(prefix));

  const finalPath = needsApiPrefix ? `/api${withLeadingSlash}` : withLeadingSlash;
  return `${API_URL}${finalPath}`;
};

// --- CORE API CLIENT ---

/**
 * A simple API client to make authenticated requests to your backend.
 * `credentials: "include"` is the most important part, as it sends
 * the 'session' cookie to your backend for authentication.
 */
let profileCache: { data: any; timestamp: number } | null = null;
let profileRequestInFlight: Promise<any> | null = null;

const client = {
  get: async <T>(endpoint: string): Promise<T> => {
    // Special handling for profile endpoint to prevent duplicate requests
    if (endpoint === "/api/profile") {
      // If there's a request in flight, wait for it
      if (profileRequestInFlight) {
        return profileRequestInFlight as Promise<T>;
      }
      
      // Check cache
      if (profileCache && Date.now() - profileCache.timestamp < CACHE_TTL) {
        return profileCache.data as T;
      }
      
      // Make the request and cache it
      profileRequestInFlight = fetch(resolveEndpoint(endpoint), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }).then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "API error" }));
          throw new Error(errorData.error || `API error: ${response.statusText}`);
        }
        const data = response.json();
        profileRequestInFlight = null;
        return data;
      }).then((data) => {
        profileCache = { data, timestamp: Date.now() };
        return data;
      }).catch((error) => {
        profileRequestInFlight = null;
        throw error;
      });
      
      return profileRequestInFlight as Promise<T>;
    }
    
    // For all other endpoints, make normal request
    const response = await fetch(resolveEndpoint(endpoint), {
      method: "GET",
      credentials: "include", // <-- This sends the auth cookie
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "API error" }));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }
    return response.json();
  },

  post: async <T>(endpoint: string, body: unknown): Promise<T> => {
    const response = await fetch(resolveEndpoint(endpoint), {
      method: "POST",
      credentials: "include", // <-- This sends the auth cookie
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "API error" }));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }
    return response.json();
  },

  upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    const response = await fetch(resolveEndpoint(endpoint), {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "API error" }));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }
    return response.json();
  },

  patch: async <T>(endpoint: string, body: unknown): Promise<T> => {
    const response = await fetch(resolveEndpoint(endpoint), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "API error" }));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }
    return response.json();
  },
};

// --- API METHODS ---

/**
 * This is a structured API client that uses the core `client`
 * to interact with your specific backend endpoints.
 */
export const api = {
  // Simple .get() and .post() for general use
  get: client.get,
  post: client.post,
  patch: client.patch,
  upload: client.upload,

  uploadTaxProof: (
    componentCode: string,
    financialYear: string,
    file: File
  ): Promise<{ url: string; fileName?: string; size?: number; mimeType?: string }> => {
    const formData = new FormData();
    formData.append("component_code", componentCode);
    formData.append("financial_year", financialYear);
    formData.append("file", file);
    return client.upload<{ url: string; fileName?: string; size?: number; mimeType?: string }>(
      "/api/tax-declarations/proofs",
      formData
    );
  },

  // --- Authentication ---
  auth: {
    login: (email, password) =>
      client.post("/auth/login", { email, password }),

    signup: (data) =>
      client.post("/auth/signup", data),

    employeeSignup: (data) =>
      client.post("/auth/employee-signup", data),

    logout: () =>
      client.post("/auth/logout", {}),

    session: () =>
      client.get("/auth/session"),
  },

  // --- Current User ("Me") ---
  me: {
    profile: () =>
      client.get("/api/profile"),

    employee: () =>
      client.get("/api/employees/me"),

    compensation: () =>
      client.get("/api/employees/me/compensation"),
  },

  // --- NEW: Dashboard ---
  dashboard: {
    tenant: () =>
      client.get("/api/tenant"),
    
    stats: () =>
      client.get("/api/stats"),
    
    cycles: () =>
      client.get("/api/payroll-cycles"),
  },
  
  // --- Data Endpoints ---
  employees: {
    list: (searchTerm?: string) => {
      const params = new URLSearchParams();
      if (searchTerm) {
        params.set("q", searchTerm);
      }
      const queryString = params.toString();
      const endpoint = `/api/employees${queryString ? `?${queryString}` : ""}`;
      return client.get<{ employees: unknown[] }>(endpoint);
    },

    create: (data) => client.post("/api/employees", data),
    
    getCompensation: (employeeId) =>
      client.get(`/api/employees/${employeeId}/compensation`),
    
    createCompensation: (employeeId, data) =>
      client.post(`/api/employees/${employeeId}/compensation`, data),

    updateStatus: (employeeId: string, status: string) =>
      client.patch(`/api/employees/${employeeId}/status`, { status }),
  },

  payroll: {
    getNewCycleData: () =>
      client.get("/api/payroll/new-cycle-data"),
    
    createCycle: (data) =>
      client.post("/api/payroll-cycles", data),
    
    previewCycle: (cycleId) =>
      client.get(`/api/payroll-cycles/${cycleId}/preview`),
    
    processCycle: (cycleId, payrollItems?) =>
      client.post(`/api/payroll-cycles/${cycleId}/process`, payrollItems ? { payrollItems } : {}),
    
    setIncentive: (cycleId: string, employeeId: string, amount: number) =>
      client.post(`/api/payroll-cycles/${cycleId}/incentives`, {
        employee_id: employeeId,
        amount,
      }),
    
    getCyclePayslips: (cycleId) =>
      client.get(`/api/payroll-cycles/${cycleId}/payslips`),
  },
  
  payslips: {
    list: () =>
      client.get("/api/payslips"),
    
    downloadPDF: async (payslipId: string) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/payslips/${payslipId}/pdf`, {
        method: "GET",
        credentials: "include", // Include cookies for authentication
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to download payslip" }));
        throw new Error(error.error || "Failed to download payslip");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${payslipId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  },

  tax: {
    getDeclarations: () =>
      client.get("/api/tax-declarations"),
    
    createDeclaration: (data) =>
      client.post("/api/tax-declarations", data),

    getDocuments: () =>
      client.get("/api/tax-documents"),
  },

  payrollSettings: {
    get: () =>
      client.get<{ settings: any }>("/api/payroll-settings"),
    
    save: (data) =>
      client.post<{ settings: any }>("/api/payroll-settings", data),

    getTaxRegimes: (financialYear: string) =>
      client.get<{ financial_year: string; regime: Record<string, any> }>(
        `/api/payroll-settings/tax-regimes?financial_year=${encodeURIComponent(financialYear)}`
      ),

    saveTaxRegimes: (data: { financial_year: string; regime: Record<string, any> }) =>
      client.post("/api/payroll-settings/tax-regimes", data),
  },

  // Leave and Attendance removed - handled by HR system

  // --- Reports ---
  reports: {
    getPayrollRegister: async (cycleId: string) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/reports/payroll-register?cycleId=${cycleId}`, {
        method: "GET",
        credentials: "include", // Include cookies for authentication
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to download payroll register" }));
        throw new Error(error.error || "Failed to download payroll register");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Extract filename from Content-Disposition header if available
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `payroll-register-${cycleId}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  },

  reimbursements: {
    submit: (formData: FormData) => client.upload("/api/v1/reimbursements/submit", formData),
    myClaims: () => client.get<{ reimbursements: any[] }>("/api/v1/reimbursements/my-claims"),
    pending: () => client.get<{ reimbursements: any[] }>("/api/v1/reimbursements/pending"),
    approve: (id: string) => client.post(`/api/v1/reimbursements/${id}/approve`, {}),
    reject: (id: string) => client.post(`/api/v1/reimbursements/${id}/reject`, {}),
  },
};

