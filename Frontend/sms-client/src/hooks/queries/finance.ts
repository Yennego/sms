import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFinanceService } from '@/services/api/finance';
import { useTenant } from '@/hooks/use-tenant';

// Query Keys
export const financeKeys = {
    all: (tenantKey: string | null) => ['finance', tenantKey] as const,
    revenueSummary: (tenantKey: string | null) => [...financeKeys.all(tenantKey), 'revenue-summary'] as const,
    expenditureSummary: (tenantKey: string | null) => [...financeKeys.all(tenantKey), 'expenditure-summary'] as const,
    feeCategories: (tenantKey: string | null) => [...financeKeys.all(tenantKey), 'fee-categories'] as const,
    feeStructures: (tenantKey: string | null) => [...financeKeys.all(tenantKey), 'fee-structures'] as const,
    studentFees: (tenantKey: string | null) => [...financeKeys.all(tenantKey), 'student-fees'] as const,
    feeInstallments: (tenantKey: string | null, studentId?: string) => [...financeKeys.all(tenantKey), 'fee-installments', studentId || 'all'] as const,
    expenseCategories: (tenantKey: string | null) => [...financeKeys.all(tenantKey), 'expense-categories'] as const,
    expenditures: (tenantKey: string | null) => [...financeKeys.all(tenantKey), 'expenditures'] as const,
};

// --- Queries ---

export const useRevenueSummary = () => {
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: financeKeys.revenueSummary(tenantKey),
        queryFn: financeService.getRevenueSummary,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useExpenditureSummary = () => {
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: financeKeys.expenditureSummary(tenantKey),
        queryFn: financeService.getExpenditureSummary,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useFeeCategories = () => {
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: financeKeys.feeCategories(tenantKey),
        queryFn: financeService.getFeeCategories,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useFeeStructures = () => {
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: financeKeys.feeStructures(tenantKey),
        queryFn: financeService.getFeeStructures,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useStudentFees = () => {
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: financeKeys.studentFees(tenantKey),
        queryFn: financeService.getStudentFees,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useFeeInstallments = (studentId?: string) => {
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: financeKeys.feeInstallments(tenantKey, studentId),
        queryFn: () => financeService.getFeeInstallments(studentId),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useExpenseCategories = () => {
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: financeKeys.expenseCategories(tenantKey),
        queryFn: financeService.getExpenseCategories,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useExpenditures = () => {
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: financeKeys.expenditures(tenantKey),
        queryFn: financeService.getExpenditures,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

// --- Mutations ---

export const useRecordPayment = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.recordPayment,
        onSuccess: () => {
            // Invalidate both student fees and revenue summary
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees(tenantKey) });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary(tenantKey) });
        },
    });
};

export const useCreateExpenditure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.createExpenditure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditures(tenantKey) });
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditureSummary(tenantKey) });
        },
    });
};

export const useUpdateExpenditure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateExpenditure(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditures(tenantKey) });
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditureSummary(tenantKey) });
        },
    });
};

export const useDeleteExpenditure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.deleteExpenditure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditures(tenantKey) });
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditureSummary(tenantKey) });
        },
    });
};

export const useUpdateStudentFee = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateStudentFee(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees(tenantKey) });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary(tenantKey) });
        },
    });
};

export const useDeleteStudentFee = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.deleteStudentFee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees(tenantKey) });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary(tenantKey) });
        },
    });
};

export const useCreateStudentFee = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.createStudentFee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees(tenantKey) });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary(tenantKey) });
        },
    });
};

export const useBulkCreateStudentFees = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.bulkCreateStudentFees,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees(tenantKey) });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary(tenantKey) });
            queryClient.invalidateQueries({ queryKey: financeKeys.feeInstallments(tenantKey) });
        },
    });
};

// --- Category & Structure Mutations ---

export const useCreateFeeCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.createFeeCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeCategories(tenantKey) });
        },
    });
};

export const useUpdateFeeCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateFeeCategory(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeCategories(tenantKey) });
        },
    });
};

export const useDeleteFeeCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.deleteFeeCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeCategories(tenantKey) });
        },
    });
};

export const useCreateExpenseCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.createExpenseCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenseCategories(tenantKey) });
        },
    });
};

export const useUpdateExpenseCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateExpenseCategory(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenseCategories(tenantKey) });
        },
    });
};

export const useDeleteExpenseCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.deleteExpenseCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenseCategories(tenantKey) });
        },
    });
};

export const useCreateFeeStructure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.createFeeStructure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeStructures(tenantKey) });
        },
    });
};

export const useDeleteFeeStructure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: financeService.deleteFeeStructure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeStructures(tenantKey) });
        },
    });
};

export const useUpdateFeeStructure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    const { tenantKey } = useTenant();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateFeeStructure(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeStructures(tenantKey) });
        },
    });
};

export const useExportFeesXlsx = () => {
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.exportFeesXlsx,
    });
};

export const useExportFeesPdf = () => {
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.exportFeesPdf,
    });
};
