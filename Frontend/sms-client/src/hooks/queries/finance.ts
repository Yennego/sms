import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFinanceService } from '@/services/api/finance';

// Query Keys
export const financeKeys = {
    all: ['finance'] as const,
    revenueSummary: () => [...financeKeys.all, 'revenue-summary'] as const,
    expenditureSummary: () => [...financeKeys.all, 'expenditure-summary'] as const,
    feeCategories: () => [...financeKeys.all, 'fee-categories'] as const,
    feeStructures: () => [...financeKeys.all, 'fee-structures'] as const,
    studentFees: () => [...financeKeys.all, 'student-fees'] as const,
    feeInstallments: (studentId?: string) => [...financeKeys.all, 'fee-installments', studentId || 'all'] as const,
    expenseCategories: () => [...financeKeys.all, 'expense-categories'] as const,
    expenditures: () => [...financeKeys.all, 'expenditures'] as const,
};

// --- Queries ---

export const useRevenueSummary = () => {
    const financeService = useFinanceService();
    return useQuery({
        queryKey: financeKeys.revenueSummary(),
        queryFn: financeService.getRevenueSummary,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useExpenditureSummary = () => {
    const financeService = useFinanceService();
    return useQuery({
        queryKey: financeKeys.expenditureSummary(),
        queryFn: financeService.getExpenditureSummary,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useFeeCategories = () => {
    const financeService = useFinanceService();
    return useQuery({
        queryKey: financeKeys.feeCategories(),
        queryFn: financeService.getFeeCategories,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useFeeStructures = () => {
    const financeService = useFinanceService();
    return useQuery({
        queryKey: financeKeys.feeStructures(),
        queryFn: financeService.getFeeStructures,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useStudentFees = () => {
    const financeService = useFinanceService();
    return useQuery({
        queryKey: financeKeys.studentFees(),
        queryFn: financeService.getStudentFees,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useFeeInstallments = (studentId?: string) => {
    const financeService = useFinanceService();
    return useQuery({
        queryKey: financeKeys.feeInstallments(studentId),
        queryFn: () => financeService.getFeeInstallments(studentId),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useExpenseCategories = () => {
    const financeService = useFinanceService();
    return useQuery({
        queryKey: financeKeys.expenseCategories(),
        queryFn: financeService.getExpenseCategories,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useExpenditures = () => {
    const financeService = useFinanceService();
    return useQuery({
        queryKey: financeKeys.expenditures(),
        queryFn: financeService.getExpenditures,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

// --- Mutations ---

export const useRecordPayment = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.recordPayment,
        onSuccess: () => {
            // Invalidate both student fees and revenue summary
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees() });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary() });
        },
    });
};

export const useCreateExpenditure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.createExpenditure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditures() });
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditureSummary() });
        },
    });
};

export const useUpdateExpenditure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateExpenditure(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditures() });
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditureSummary() });
        },
    });
};

export const useDeleteExpenditure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.deleteExpenditure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditures() });
            queryClient.invalidateQueries({ queryKey: financeKeys.expenditureSummary() });
        },
    });
};

export const useUpdateStudentFee = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateStudentFee(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees() });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary() });
        },
    });
};

export const useDeleteStudentFee = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.deleteStudentFee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees() });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary() });
        },
    });
};

export const useCreateStudentFee = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.createStudentFee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees() });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary() });
        },
    });
};

export const useBulkCreateStudentFees = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.bulkCreateStudentFees,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.studentFees() });
            queryClient.invalidateQueries({ queryKey: financeKeys.revenueSummary() });
            queryClient.invalidateQueries({ queryKey: financeKeys.feeInstallments() });
        },
    });
};

// --- Category & Structure Mutations ---

export const useCreateFeeCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.createFeeCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeCategories() });
        },
    });
};

export const useUpdateFeeCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateFeeCategory(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeCategories() });
        },
    });
};

export const useDeleteFeeCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.deleteFeeCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeCategories() });
        },
    });
};

export const useCreateExpenseCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.createExpenseCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenseCategories() });
        },
    });
};

export const useUpdateExpenseCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateExpenseCategory(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenseCategories() });
        },
    });
};

export const useDeleteExpenseCategory = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.deleteExpenseCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.expenseCategories() });
        },
    });
};

export const useCreateFeeStructure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.createFeeStructure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeStructures() });
        },
    });
};

export const useDeleteFeeStructure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: financeService.deleteFeeStructure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeStructures() });
        },
    });
};

export const useUpdateFeeStructure = () => {
    const queryClient = useQueryClient();
    const financeService = useFinanceService();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => financeService.updateFeeStructure(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.feeStructures() });
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
