import { useApiClient } from './api-client';

export interface FeeCategory {
    id: string;
    name: string;
    description: string | null;
    tenant_id: string;
    created_at: string;
    updated_at: string;
}

export interface FeeStructure {
    id: string;
    category_id: string;
    academic_year_id: string;
    class_id: string | null;
    amount: number;
    due_date: string;
    tenant_id: string;
    created_at: string;
    updated_at: string;
}

export interface StudentFee {
    id: string;
    fee_structure_id: string;
    student_id: string;
    total_amount: number;
    amount_paid: number;
    balance: number;
    status: string;
    tenant_id: string;
    student_name?: string;
    category_name?: string;
    due_date?: string;
    created_at: string;
    updated_at: string;
}

export interface Expenditure {
    id: string;
    expense_category_id: string;
    amount: number;
    date: string;
    payee: string | null;
    description: string | null;
    tenant_id: string;
    created_at: string;
    updated_at: string;
}

export interface ExpenseCategory {
    id: string;
    name: string;
    description: string | null;
    tenant_id: string;
    created_at: string;
    updated_at: string;
}

export interface FeePayment {
    id: string;
    student_fee_id: string;
    amount_paid: number;
    payment_method: string;
    payment_date: string;
    reference_id: string | null;
    tenant_id: string;
    created_at: string;
    updated_at: string;
}

export interface RevenueSummary {
    total_expected: number;
    total_collected: number;
    total_pending: number;
}

export interface ExpenditureSummary {
    total_spent: number;
}

export function useFinanceService() {
    const api = useApiClient();

    return {
        // --- Fees endpoints ---
        getRevenueSummary: async (): Promise<RevenueSummary> => {
            return await api.get<RevenueSummary>('/finance/fees/summary');
        },

        getFeeCategories: async (): Promise<FeeCategory[]> => {
            return await api.get<FeeCategory[]>('/finance/fees/categories');
        },

        createFeeCategory: async (data: Partial<FeeCategory>): Promise<FeeCategory> => {
            return await api.post<FeeCategory>('/finance/fees/categories', data);
        },

        updateFeeCategory: async (id: string, data: Partial<FeeCategory>): Promise<FeeCategory> => {
            return await api.put<FeeCategory>(`/finance/fees/categories/${id}`, data);
        },

        deleteFeeCategory: async (id: string): Promise<FeeCategory> => {
            return await api.delete<FeeCategory>(`/finance/fees/categories/${id}`);
        },

        getFeeStructures: async (): Promise<FeeStructure[]> => {
            return await api.get<FeeStructure[]>('/finance/fees/structures');
        },

        createFeeStructure: async (data: Partial<FeeStructure>): Promise<FeeStructure> => {
            return await api.post<FeeStructure>('/finance/fees/structures', data);
        },

        updateFeeStructure: async (id: string, data: Partial<FeeStructure>): Promise<FeeStructure> => {
            return await api.put<FeeStructure>(`/finance/fees/structures/${id}`, data);
        },

        deleteFeeStructure: async (id: string): Promise<FeeStructure> => {
            return await api.delete<FeeStructure>(`/finance/fees/structures/${id}`);
        },

        getStudentFees: async (): Promise<StudentFee[]> => {
            return await api.get<StudentFee[]>('/finance/fees/student-fees');
        },

        createStudentFee: async (data: Partial<StudentFee>): Promise<StudentFee> => {
            return await api.post<StudentFee>('/finance/fees/student-fees', data);
        },

        bulkCreateStudentFees: async (data: any): Promise<any> => {
            return await api.post<any>('/finance/fees/student-fees/bulk', data);
        },

        updateStudentFee: async (id: string, data: Partial<StudentFee>): Promise<StudentFee> => {
            return await api.put<StudentFee>(`/finance/fees/student-fees/${id}`, data);
        },

        deleteStudentFee: async (id: string): Promise<StudentFee> => {
            return await api.delete<StudentFee>(`/finance/fees/student-fees/${id}`);
        },

        recordPayment: async (data: Partial<FeePayment>): Promise<FeePayment> => {
            return await api.post<FeePayment>('/finance/fees/payments', data);
        },

        getFeeInstallments: async (studentId?: string): Promise<any[]> => {
            return await api.get<any[]>('/finance/fees/installments', { params: { student_id: studentId } });
        },

        exportFeesXlsx: async (): Promise<Blob> => {
            return await api.get<Blob>('/finance/fees/student-fees/export/xlsx', { responseType: 'blob' });
        },

        exportFeesPdf: async (): Promise<Blob> => {
            return await api.get<Blob>('/finance/fees/student-fees/export/pdf', { responseType: 'blob' });
        },

        // --- Expenses endpoints ---
        getExpenditureSummary: async (): Promise<ExpenditureSummary> => {
            return await api.get<ExpenditureSummary>('/finance/expenses/summary');
        },

        getExpenseCategories: async (): Promise<ExpenseCategory[]> => {
            return await api.get<ExpenseCategory[]>('/finance/expenses/categories');
        },

        createExpenseCategory: async (data: Partial<ExpenseCategory>): Promise<ExpenseCategory> => {
            return await api.post<ExpenseCategory>('/finance/expenses/categories', data);
        },

        updateExpenseCategory: async (id: string, data: Partial<ExpenseCategory>): Promise<ExpenseCategory> => {
            return await api.put<ExpenseCategory>(`/finance/expenses/categories/${id}`, data);
        },

        deleteExpenseCategory: async (id: string): Promise<ExpenseCategory> => {
            return await api.delete<ExpenseCategory>(`/finance/expenses/categories/${id}`);
        },

        getExpenditures: async (): Promise<Expenditure[]> => {
            return await api.get<Expenditure[]>('/finance/expenses');
        },

        createExpenditure: async (data: Partial<Expenditure>): Promise<Expenditure> => {
            return await api.post<Expenditure>('/finance/expenses', data);
        },

        updateExpenditure: async (id: string, data: Partial<Expenditure>): Promise<Expenditure> => {
            return await api.put<Expenditure>(`/finance/expenses/${id}`, data);
        },

        deleteExpenditure: async (id: string): Promise<Expenditure> => {
            return await api.delete<Expenditure>(`/finance/expenses/${id}`);
        }
    };
}
