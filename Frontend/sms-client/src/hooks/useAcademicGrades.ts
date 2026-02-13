import { useState, useEffect } from 'react';
import { useAcademicGradeService, AcademicGrade } from '@/services/api/academic-grade-service';

export const useAcademicGrades = () => {
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const academicGradeService = useAcademicGradeService();
  
  useEffect(() => {
    const fetchGrades = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch real academic grades from API
        const fetchedGrades = await academicGradeService.getActiveGrades();
        setGrades(fetchedGrades);
      } catch (err) {
        console.error('Failed to fetch academic grades:', err);
        setError('Failed to fetch grades');
        // No fallback - let the form handle the empty state
        setGrades([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGrades();
  }, [academicGradeService]);
  
  return { grades, isLoading, error };
};
