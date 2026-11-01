'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IdCard as IdCardIcon, Loader2, Printer, RefreshCcw } from 'lucide-react';

import { ID_CARD_CSS, IdCardView } from '@/components/attendance/id-card';
import PermissionGuard from '@/components/auth/permission-guard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/hooks/use-tenant';
import { useClassService } from '@/services/api/class-service';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { Class } from '@/types/class';
import { IdCard } from '@/types/daily-attendance';
import { errorMessageOf } from '@/utils/error-utils';

// Only the card sheet is printed; CR80 card size, 2 columns on A4/Letter
const PRINT_CSS = `
@media print {
  @page { margin: 10mm; }
  body * { visibility: hidden !important; }
  #id-card-sheet, #id-card-sheet * { visibility: visible !important; }
  #id-card-sheet { position: absolute; left: 0; top: 0; width: 100%; }
  .id-card-actions { display: none !important; }
}
${ID_CARD_CSS}`;

export default function IdCardsPage() {
  const { tenant } = useTenant();
  const { getClasses } = useClassService();
  const { getClassIdCards, reissueIdCard } = useDailyAttendanceService();

  const [classes, setClasses] = useState<Class[]>([]);
  const [classId, setClassId] = useState('');
  const [cards, setCards] = useState<IdCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [reissuing, setReissuing] = useState<string | null>(null);

  useEffect(() => {
    getClasses({ is_active: true })
      .then(setClasses)
      .catch((err: unknown) => toast.error(errorMessageOf(err, 'Failed to load classes')));
  }, [getClasses]);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    getClassIdCards(classId)
      .then(setCards)
      .catch((err: unknown) => {
        setCards([]);
        toast.error(errorMessageOf(err, 'Failed to load ID cards'));
      })
      .finally(() => setLoading(false));
  }, [classId, getClassIdCards]);

  const onReissue = async (card: IdCard) => {
    if (!window.confirm(`Issue a new card for ${card.student_name}? Their current card will stop working immediately.`)) return;
    setReissuing(card.student_id);
    try {
      const fresh = await reissueIdCard(card.student_id);
      setCards(prev => prev.map(c => (c.student_id === fresh.student_id ? { ...fresh, class_name: fresh.class_name ?? c.class_name } : c)));
      toast.success(`New card issued for ${card.student_name}. Print it and collect the old one.`);
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to reissue the card'));
    } finally {
      setReissuing(null);
    }
  };

  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <style>{PRINT_CSS}</style>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3"><IdCardIcon className="h-8 w-8" /> Student ID Cards</h1>
            <p className="text-gray-600 mt-1">Print QR ID cards for attendance scanning. Reissue a card if it is lost or stolen.</p>
          </div>
          <Button onClick={() => window.print()} disabled={cards.length === 0}>
            <Printer className="h-4 w-4 mr-2" /> Print cards
          </Button>
        </div>

        <div className="max-w-md">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name || `${cls.grade_name} ${cls.section_name}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
        ) : classId && cards.length === 0 ? (
          <p className="text-gray-500">No students are enrolled in this class.</p>
        ) : (
          <div id="id-card-sheet" className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-start">
            {cards.map(card => (
              <div key={card.student_id} className="space-y-2">
                <IdCardView card={card} schoolName={tenant?.name} />
                <div className="id-card-actions">
                  <button
                    onClick={() => onReissue(card)}
                    disabled={reissuing === card.student_id}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-rose-600 disabled:opacity-50"
                  >
                    {reissuing === card.student_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                    Reissue (lost/stolen)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
