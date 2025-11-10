// API Client - Replaces Supabase client

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseURL: string;
  private _token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Load token from localStorage
    this._token = localStorage.getItem('auth_token');
  }

  get token() {
    return this._token;
  }

  setToken(token: string | null) {
    this._token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}, isFormData = false) {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      ...options.headers,
    };

    // Don't set Content-Type for FormData, let browser set it with boundary
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`;
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection.');
      }
      throw error;
    }
  }

  // Auth methods
  async signup(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    orgName: string;
    domain: string;
    subdomain?: string;
    companySize?: string;
    industry?: string;
    timezone?: string;
  }) {
    const result = await this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (result.token) {
      this.setToken(result.token);
    }
    return result;
  }

  async login(email: string, password: string) {
    const result = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.token) {
      this.setToken(result.token);
    }
    return result;
  }

  async requestPasswordReset(email: string) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async getPasswordResetInfo(token: string) {
    return this.request(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
  }

  async resetPassword(data: {
    token: string;
    password: string;
    securityAnswer1?: string;
    securityAnswer2?: string;
  }) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Employee methods
  async getEmployees() {
    return this.request('/api/employees');
  }

  async createEmployee(data: {
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
    department: string;
    position: string;
    workLocation: string;
    joinDate: string;
    reportingManagerId?: string;
    role: string;
  }) {
    return this.request('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    employeeId?: string;
    department?: string;
    position?: string;
    workLocation?: string;
    joinDate?: string;
    reportingManagerId?: string | null;
    status?: string;
  }) {
    return this.request(`/api/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getEmployee(id: string) {
    return this.request(`/api/employees/${id}`);
  }

  async deactivateEmployee(id: string) {
    return this.request(`/api/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'inactive' }),
    });
  }

  async deleteEmployee(id: string) {
    return this.request(`/api/employees/${id}`, {
      method: 'DELETE',
    });
  }

  // Profile methods
  async getProfile() {
    return this.request('/api/profiles/me');
  }

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }) {
    return this.request('/api/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Organization methods
  async getOrganization() {
    return this.request('/api/organizations/me');
  }

  async updateOrganization(data: { name?: string; logo?: File }) {
    const formData = new FormData();
    if (data.name) {
      formData.append('name', data.name);
    }
    if (data.logo) {
      formData.append('logo', data.logo);
    }

    return this.request('/api/organizations/me', {
      method: 'PATCH',
      body: formData,
      headers: {} as HeadersInit, // Let browser set Content-Type with boundary
    }, true);
  }

  // Stats methods
  async getPendingCounts() {
    return this.request('/api/stats/pending-counts');
  }

  // Notifications methods
  async getNotifications() {
    return this.request('/api/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  // Check if employee needs password change
  async checkEmployeePasswordChange() {
    return this.request('/api/employees/check-password-change');
  }

  // Onboarding tracker methods
  async getOnboardingEmployees() {
    return this.request('/api/onboarding-tracker/employees');
  }

  // Submit onboarding data
  async submitOnboarding(employeeId: string, data: any) {
    return this.request('/api/onboarding/submit', {
      method: 'POST',
      body: JSON.stringify({ employeeId, ...data }),
    });
  }

  // Timesheet methods
  async getEmployeeId() {
    return this.request('/api/timesheets/employee-id');
  }

  async getTimesheet(weekStart: string, weekEnd: string) {
    return this.request(`/api/timesheets?weekStart=${weekStart}&weekEnd=${weekEnd}`);
  }

  async saveTimesheet(weekStart: string, weekEnd: string, totalHours: number, entries: any[]) {
    return this.request('/api/timesheets', {
      method: 'POST',
      body: JSON.stringify({ weekStart, weekEnd, totalHours, entries }),
    });
  }

  async getPendingTimesheets() {
    return this.request('/api/timesheets/pending');
  }

  async approveTimesheet(timesheetId: string, action: 'approve' | 'reject' | 'return', rejectionReason?: string) {
    return this.request(`/api/timesheets/${timesheetId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action, rejectionReason }),
    });
  }

  // Org chart methods
  async getOrgStructure() {
    return this.request('/api/employees/org-chart');
  }

  // Shift methods
  async getShifts() {
    return this.request('/api/shifts');
  }

  async getShiftsForEmployee(employeeId: string) {
    return this.request(`/api/shifts?employee_id=${employeeId}`);
  }

  async createShift(data: {
    employee_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type?: string;
    notes?: string;
    status?: string;
  }) {
    return this.request('/api/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Appraisal methods
  async getAppraisalCycles() {
    return this.request('/api/appraisal-cycles');
  }

  async createAppraisalCycle(data: {
    cycle_name: string;
    cycle_year: number;
    start_date: string;
    end_date: string;
    status?: string;
  }) {
    return this.request('/api/appraisal-cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPerformanceReviews(cycleId?: string) {
    const url = cycleId 
      ? `/api/performance-reviews?cycle=${cycleId}`
      : '/api/performance-reviews';
    return this.request(url);
  }

  async submitPerformanceReview(data: {
    appraisal_cycle_id: string;
    employee_id: string;
    rating: number;
    performance_score: number;
    strengths?: string;
    areas_of_improvement?: string;
    goals?: string;
    comments?: string;
  }) {
    return this.request('/api/performance-reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTeamMembers() {
    return this.request('/api/employees?team=mine');
  }

  // Employee project assignments
  async getEmployeeProjects(employeeId: string, date?: string) {
    const url = date 
      ? `/api/timesheets/employee/${employeeId}/projects?date=${date}`
      : `/api/timesheets/employee/${employeeId}/projects`;
    return this.request(url);
  }

  // Project methods
  async getProjects() {
    return this.request('/api/v1/projects');
  }

  async getProject(id: string) {
    return this.request(`/api/v1/projects/${id}`);
  }

  async createProject(data: {
    name: string;
    start_date?: string;
    end_date?: string;
    required_skills?: string[];
    required_certifications?: string[];
    priority?: number;
    expected_allocation_percent?: number;
    location?: string;
  }) {
    return this.request('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: {
    name?: string;
    start_date?: string;
    end_date?: string;
    required_skills?: string[];
    required_certifications?: string[];
    priority?: number;
    expected_allocation_percent?: number;
    location?: string;
  }) {
    return this.request(`/api/v1/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string) {
    return this.request(`/api/v1/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async getProjectAssignments(projectId: string) {
    return this.request(`/api/v1/projects/${projectId}/assignments`);
  }

  async deallocateAssignment(projectId: string, assignmentId: string, endDate?: string, reason?: string) {
    return this.request(`/api/v1/projects/${projectId}/deallocate`, {
      method: 'POST',
      body: JSON.stringify({ assignment_id: assignmentId, end_date: endDate, reason }),
    });
  }

  async replaceAssignment(projectId: string, data: {
    old_assignment_id: string;
    new_employee_id: string;
    allocation_percent: number;
    role?: string;
    start_date?: string;
    end_date?: string;
    override?: boolean;
    override_reason?: string;
    reason?: string;
  }) {
    return this.request(`/api/v1/projects/${projectId}/replace`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Employee statistics
  async getEmployeeStats(params?: { startDate?: string; endDate?: string; employeeId?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.employeeId) queryParams.append('employeeId', params.employeeId);
    const url = `/api/employee-stats${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.request(url);
  }

  // Leave policy methods
  async getLeavePolicies() {
    return this.request('/api/leave-policies');
  }

  async createLeavePolicy(data: {
    name: string;
    leave_type: string;
    annual_entitlement: number;
    probation_entitlement?: number;
    carry_forward_allowed?: boolean;
    max_carry_forward?: number;
    encashment_allowed?: boolean;
  }) {
    return this.request('/api/leave-policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Leave request methods
  async getLeaveRequests() {
    return this.request('/api/leave-requests');
  }

  async createLeaveRequest(data: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    reason?: string;
  }) {
    return this.request('/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async approveLeaveRequest(id: string) {
    return this.request(`/api/leave-requests/${id}/approve`, {
      method: 'PATCH',
    });
  }

  async rejectLeaveRequest(id: string, rejection_reason: string) {
    return this.request(`/api/leave-requests/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ rejection_reason }),
    });
  }

  // Leave balance
  async getLeaveBalance() {
    return this.request('/api/stats/leave-balance');
  }

  // Workflow runtime
  async triggerWorkflow(data: { name?: string; workflow: any; payload?: any }) {
    return this.request('/api/workflows/trigger', { method: 'POST', body: JSON.stringify(data) });
  }

  async getPendingWorkflowActions() {
    return this.request('/api/workflows/actions/pending');
  }

  async decideWorkflowAction(actionId: string, decision: 'approve' | 'reject', reason?: string, workflow?: any) {
    return this.request(`/api/workflows/actions/${actionId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason, workflow })
    });
  }

  // Presence status methods
  async updatePresenceStatus(presenceStatus: 'online' | 'away' | 'out_of_office' | 'break') {
    return this.request('/api/profiles/me/presence', {
      method: 'POST',
      body: JSON.stringify({ presence_status: presenceStatus })
    });
  }

  async getPresenceStatus() {
    return this.request('/api/profiles/me/presence');
  }

  // Check-in/Check-out methods
  async checkIn() {
    return this.request('/api/check-in-out/check-in', {
      method: 'POST'
    });
  }

  async checkOut() {
    return this.request('/api/check-in-out/check-out', {
      method: 'POST'
    });
  }

  async getTodayCheckIns() {
    return this.request('/api/check-in-out/today');
  }

  async getCheckInHistory(startDate: string, endDate: string) {
    return this.request(`/api/check-in-out/history?startDate=${startDate}&endDate=${endDate}`);
  }

  async getCheckInStatus() {
    return this.request('/api/check-in-out/status');
  }

  // Attendance methods
  async punchAttendance(data: {
    employee_id: string;
    timestamp: string;
    type: 'IN' | 'OUT';
    device_id?: string;
    metadata?: any;
  }) {
    return this.request('/api/v1/attendance/punch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadAttendance(file: File, mapping?: any) {
    const formData = new FormData();
    formData.append('file', file);
    if (mapping) {
      formData.append('mapping', JSON.stringify(mapping));
    }

    return this.request('/api/v1/attendance/upload', {
      method: 'POST',
      body: formData,
      headers: {} as HeadersInit, // Let browser set Content-Type with boundary
    }, true);
  }

  async getUploadStatus(uploadId: string) {
    return this.request(`/api/v1/attendance/upload/${uploadId}/status`);
  }

  async retryUpload(uploadId: string, force?: boolean) {
    return this.request(`/api/v1/attendance/upload/${uploadId}/retry`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  }

  async getEmployeeAttendanceTimesheet(employeeId: string, from: string, to: string) {
    return this.request(`/api/v1/attendance/employee/${employeeId}/timesheet?from=${from}&to=${to}`);
  }

  async getAttendanceUploads() {
    return this.request('/api/v1/attendance/uploads');
  }

  async cancelUpload(uploadId: string) {
    return this.request(`/api/v1/attendance/upload/${uploadId}/cancel`, {
      method: 'POST',
    });
  }

  // Termination methods
  async getTerminations() {
    return this.request('/api/terminations');
  }

  async createTermination(data: {
    employee_id: string;
    termination_date: string;
    termination_type: string;
    reason?: string;
    notes?: string;
  }) {
    return this.request('/api/terminations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async approveTermination(id: string, notes?: string) {
    return this.request(`/api/terminations/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async updateTermination(id: string, data: {
    termination_date?: string;
    termination_type?: string;
    reason?: string;
    notes?: string;
  }) {
    return this.request(`/api/terminations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTermination(id: string) {
    return this.request(`/api/terminations/${id}`, {
      method: 'DELETE',
    });
  }

  // Rehire methods
  async getRehires() {
    return this.request('/api/terminations/rehires');
  }

  async createRehire(data: {
    original_employee_id?: string;
    new_employee_id: string;
    rehire_date: string;
    reason?: string;
    previous_termination_id?: string;
  }) {
    return this.request('/api/terminations/rehire', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRehire(id: string, data: {
    rehire_date?: string;
    reason?: string;
  }) {
    return this.request(`/api/terminations/rehires/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteRehire(id: string) {
    return this.request(`/api/terminations/rehires/${id}`, {
      method: 'DELETE',
    });
  }

  // Offboarding methods
  async getOffboardingPolicies() {
    return this.request('/api/offboarding/policies');
  }

  async createOffboardingPolicy(data: {
    name: string;
    description?: string;
    notice_period_days: number;
    auto_approve_days?: number;
    use_ceo_approval?: boolean;
    applies_to_department?: string;
    applies_to_location?: string;
    is_default?: boolean;
  }) {
    return this.request('/api/offboarding/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOffboardingPolicy(id: string, data: any) {
    return this.request(`/api/offboarding/policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteOffboardingPolicy(id: string) {
    return this.request(`/api/offboarding/policies/${id}`, {
      method: 'DELETE',
    });
  }

  async getMaskedVerification() {
    return this.request('/api/offboarding/verify/masked');
  }

  async sendVerificationOTP(type: 'email' | 'phone') {
    return this.request('/api/offboarding/verify/send', {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  }

  async confirmVerification(type: 'email' | 'phone', otp: string) {
    return this.request('/api/offboarding/verify/confirm', {
      method: 'POST',
      body: JSON.stringify({ type, otp }),
    });
  }

  async confirmAddress(data: {
    confirmed: boolean;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  }) {
    return this.request('/api/offboarding/verify/address', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitOffboardingSurvey(data: {
    survey_json: any;
    reason: string;
  }) {
    return this.request('/api/offboarding/survey', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOffboardingRequests() {
    return this.request('/api/offboarding');
  }

  async getOffboardingRequest(id: string) {
    return this.request(`/api/offboarding/${id}`);
  }

  async approveOffboarding(id: string, comment?: string) {
    return this.request(`/api/offboarding/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async denyOffboarding(id: string, comment: string) {
    return this.request(`/api/offboarding/${id}/deny`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async updateChecklist(id: string, data: {
    leaves_remaining?: number;
    financials_due?: number;
    assets_pending?: number;
    compliance_clear?: boolean;
    finance_clear?: boolean;
    it_clear?: boolean;
    notes?: string;
  }) {
    return this.request(`/api/offboarding/${id}/checklist`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateLetter(id: string) {
    return this.request(`/api/offboarding/${id}/generate-letter`, {
      method: 'POST',
    });
  }

  async finalizeOffboarding(id: string) {
    return this.request(`/api/offboarding/${id}/finalize`, {
      method: 'POST',
    });
  }

  // Rehire methods
  async searchOffboardedIdentities(data: { email?: string; emp_code?: string }) {
    return this.request('/api/rehire/search', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createRehireRequest(data: {
    offboarded_identity_id: string;
    manager_id?: string;
    department?: string;
    position?: string;
    email: string;
    first_name: string;
    last_name: string;
  }) {
    return this.request('/api/rehire/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRehireRequests() {
    return this.request('/api/rehire');
  }

  async getRehireRequest(id: string) {
    return this.request(`/api/rehire/${id}`);
  }

  async approveRehire(id: string, comment?: string) {
    return this.request(`/api/rehire/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async denyRehire(id: string, comment: string) {
    return this.request(`/api/rehire/${id}/deny`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  // Policy methods
  async getPolicyCatalog() {
    return this.request('/api/policies/catalog');
  }

  async getOrgPolicies(date?: string) {
    const url = date 
      ? `/api/policies/org?date=${date}`
      : '/api/policies/org';
    return this.request(url);
  }

  async createOrgPolicy(data: {
    policy_key: string;
    value: any;
    effective_from?: string;
    effective_to?: string;
  }) {
    return this.request('/api/policies/org', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEmployeePolicies(userId: string, date?: string) {
    const url = date
      ? `/api/policies/employee/${userId}?date=${date}`
      : `/api/policies/employee/${userId}`;
    return this.request(url);
  }

  async createEmployeePolicy(userId: string, data: {
    policy_key: string;
    value: any;
    effective_from?: string;
    effective_to?: string;
  }) {
    return this.request(`/api/policies/employee/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Promotion methods
  async getPromotionHealth() {
    return this.request('/api/promotion/health');
  }

  async createPromotionCycle(data: {
    name: string;
    period: 'QUARTERLY' | 'H1' | 'ANNUAL' | 'CUSTOM';
    start_date: string;
    end_date: string;
    criteria?: any;
  }) {
    return this.request('/api/promotion/cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentPromotionCycles() {
    return this.request('/api/promotion/cycles/current');
  }

  async submitPromotionEvaluation(data: {
    cycle_id: string;
    employee_id: string;
    rating: number;
    remarks?: string;
    recommendation?: 'NONE' | 'PROMOTE' | 'HOLD';
    attachments?: any;
  }) {
    return this.request('/api/promotion/evaluations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reviewPromotionEvaluation(id: string) {
    return this.request(`/api/promotion/review/${id}`, {
      method: 'POST',
    });
  }

  async approvePromotion(id: string) {
    return this.request(`/api/promotion/approve/${id}`, {
      method: 'POST',
    });
  }

  // User invite methods
  async inviteUsers(data: {
    emails: string[];
    role: string;
  }) {
    return this.request('/api/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // First login
  async firstLogin(data: {
    token: string;
    newPassword: string;
  }) {
    return this.request('/api/auth/first-login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Payroll SSO
  async getPayrollSso() {
    return this.request('/api/payroll/sso');
  }

  async getPayrollRuns(params?: { status?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/api/payroll/runs${query}`);
  }

  async getPayrollRunAdjustments(runId: string) {
    return this.request(`/api/payroll/runs/${runId}/adjustments`);
  }

  async createPayrollRunAdjustment(runId: string, data: {
    employee_id: string;
    component_name: string;
    amount: number;
    is_taxable?: boolean;
    notes?: string;
  }) {
    return this.request(`/api/payroll/runs/${runId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePayrollRunAdjustment(adjustmentId: string, data: {
    component_name?: string;
    amount?: number;
    is_taxable?: boolean;
    notes?: string;
  }) {
    return this.request(`/api/payroll/adjustments/${adjustmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePayrollRunAdjustment(adjustmentId: string) {
    return this.request(`/api/payroll/adjustments/${adjustmentId}`, {
      method: 'DELETE',
    });
  }

  async getTaxDefinitions(financialYear: string) {
    return this.request(`/api/tax/declarations/definitions?financial_year=${encodeURIComponent(financialYear)}`);
  }

  async getMyTaxDeclaration(financialYear: string) {
    return this.request(`/api/tax/declarations/me?financial_year=${encodeURIComponent(financialYear)}`);
  }

  async saveTaxDeclaration(data: {
    financial_year: string;
    chosen_regime: 'old' | 'new';
    status: 'draft' | 'submitted';
    items: Array<{
      component_id: string;
      declared_amount: number;
      proof_url?: string;
      notes?: string;
    }>;
  }) {
    return this.request('/api/tax/declarations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTaxDeclarations(params?: { financial_year?: string; status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.financial_year) searchParams.append('financial_year', params.financial_year);
    if (params?.status) searchParams.append('status', params.status);
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/api/tax/declarations${queryString}`);
  }

  async reviewTaxDeclaration(
    declarationId: string,
    data: {
      status: 'approved' | 'rejected';
      items?: Array<{ id: string; approved_amount?: number; notes?: string }>;
      remarks?: string;
    }
  ) {
    return this.request(`/api/tax/declarations/${declarationId}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async downloadForm16(financialYear: string, employeeId?: string) {
    const params = new URLSearchParams();
    params.append('financial_year', financialYear);
    if (employeeId) {
      params.append('employee_id', employeeId);
    }
    const url = `${this.baseURL}/api/reports/form16?${params.toString()}`;
    const headers: HeadersInit = {};
    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to download Form 16');
    }
    return response.blob();
  }
}

export const api = new ApiClient(API_URL);

