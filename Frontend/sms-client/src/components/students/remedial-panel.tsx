'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { usePromotionService } from '@/services/api/promotion-service';
import { useSubjectService } from '@/services/api/subject-service';
import { toast } from 'sonner';
import { Loader2, BookOpen, AlertCircle, Plus, Calendar, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type RemedialSession = {
  id: string;
  subject_id: string;
  subject_name?: string;
  scheduled_date: string;
  status: 'scheduled' | 'completed';
  new_score?: number | null;
  passed?: boolean | null;
};

export default function RemedialPanel({ enrollmentId }: { enrollmentId: string }) {
  const { getRemedialSessions, recordRemedialResult, createRemedialSessions } = usePromotionService();
  const { getActiveSubjects } = useSubjectService();
  const [sessions, setSessions] = useState<RemedialSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [updates, setUpdates] = useState<Record<string, { new_score?: number; passed?: boolean }>>({});

  // Manual Assignment State
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);

  const load = async () => {
    if (!enrollmentId) return;
    try {
      setLoading(true);
      const list = await getRemedialSessions(enrollmentId);
      setSessions((list as RemedialSession[]) || []);

      const subs = await getActiveSubjects();
      setAllSubjects(subs || []);
    } catch (e) {
      console.error('Failed to load remedial data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentId]);

  const markCompleted = async (sessionId: string) => {
    try {
      const payload = updates[sessionId] || {};
      if (payload.new_score === undefined) {
        toast.error("Please enter a new score");
        return;
      }
      await recordRemedialResult(sessionId, { status: 'completed', new_score: payload.new_score, passed: payload.passed });
      toast.success('Remedial session completed successfully');
      await load();
    } catch (err) {
      console.error('Failed to update remedial session', err);
      toast.error('Failed to update remedial session');
    }
  };

  const manualAssign = async () => {
    if (!selectedSub) {
      toast.error("Please select a subject");
      return;
    }
    try {
      setAssigning(true);
      await createRemedialSessions(enrollmentId, [selectedSub], scheduledDate);
      toast.success("Remedial session assigned manually");
      await load();
      setSelectedSub("");
      setShowAssignForm(false);
    } catch (e) {
      toast.error("Failed to assign remedial session");
    } finally {
      setAssigning(false);
    }
  };

  if (!enrollmentId) return null;

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-indigo-50 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <h4 className="font-bold text-indigo-900">Remedial Assignments</h4>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant={showAssignForm ? "default" : "outline"}
              size="sm"
              className={showAssignForm ? "bg-indigo-600 hover:bg-indigo-700 gap-2" : "border-indigo-200 text-indigo-600 hover:bg-indigo-50 gap-2"}
              onClick={() => setShowAssignForm(!showAssignForm)}
            >
              {showAssignForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAssignForm ? "Cancel" : "Assign New"}
            </Button>

            {showAssignForm && (
              <div className="absolute right-0 top-10 w-80 p-4 space-y-4 shadow-2xl border border-indigo-100 rounded-xl bg-white z-[50]">
                <div className="space-y-1">
                  <h5 className="font-bold text-sm text-indigo-900">Manual Assignment</h5>
                  <p className="text-[10px] text-gray-500">Schedule an ad-hoc remedial for this student.</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-gray-400">Select Subject</label>
                    <Select value={selectedSub} onValueChange={setSelectedSub}>
                      <SelectTrigger className="w-full h-9 border-indigo-100 bg-white">
                        <SelectValue placeholder="Select a subject..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 z-[60]">
                        {allSubjects.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-gray-400">Scheduled Date</label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="h-9 border-indigo-100 bg-white"
                    />
                  </div>
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 h-9 font-bold text-xs"
                    onClick={manualAssign}
                    disabled={assigning || !selectedSub}
                  >
                    {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule Session"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 h-8 w-8 p-0">
            <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-white rounded-full shadow-sm">
              <BookOpen className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium">No sessions scheduled yet.</p>
            <p className="text-xs">Click "Assign New" to manually add one.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="group border border-indigo-50 rounded-xl p-4 bg-white hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-gray-800">{s.subject_name || "Unknown Subject"}</span>
                    <Badge variant={s.status === 'completed' ? 'default' : 'secondary'} className={s.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-200 border-none' : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-none'}>
                      {s.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Scheduled: {new Date(s.scheduled_date).toLocaleDateString()}</span>
                    {s.new_score != null && <span className="text-indigo-600 font-medium font-mono text-base border-l pl-4">Score: {s.new_score}%</span>}
                    {s.passed != null && <span className={s.passed ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>Result: {s.passed ? 'PASSED' : 'FAILED'}</span>}
                  </div>
                </div>

                {s.status !== 'completed' && (
                  <div className="flex items-center gap-3 bg-indigo-50/50 p-2 rounded-lg">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-indigo-400 px-1">New Exam Score</label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="%"
                        className="w-20 h-9 bg-white border-indigo-100 focus:border-indigo-400"
                        value={updates[s.id]?.new_score ?? ''}
                        onChange={(e) =>
                          setUpdates((prev) => ({ ...prev, [s.id]: { ...prev[s.id], new_score: Number(e.target.value) } }))
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <Checkbox
                        id={`passed-${s.id}`}
                        checked={updates[s.id]?.passed ?? false}
                        onCheckedChange={(val) =>
                          setUpdates((prev) => ({ ...prev, [s.id]: { ...prev[s.id], passed: Boolean(val) } }))
                        }
                        className="border-indigo-300 data-[state=checked]:bg-indigo-600"
                      />
                      <label htmlFor={`passed-${s.id}`} className="text-sm font-medium text-gray-600 cursor-pointer">Passed</label>
                    </div>
                    <Button size="sm" onClick={() => markCompleted(s.id)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm mt-4">
                      Update
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
