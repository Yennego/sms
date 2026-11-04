'use client';

import { useState, useEffect } from 'react';
import {
    useSuperAdminTenantSettings,
    useSuperAdminUpdateTenantSettings
} from '@/hooks/queries/super-admin';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
    Wallet,
    ClipboardCheck,
    BookOpen,
    CalendarDays,
    Megaphone,
    MessageSquare,
} from 'lucide-react';
import { FEATURE_DEFAULTS } from '@/config/school-areas';

interface TenantFeatureToggleProps {
    tenantId: string;
    tenantName: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function TenantFeatureToggle({
    tenantId,
    tenantName,
    isOpen,
    onClose
}: TenantFeatureToggleProps) {
    const { data: settings, isLoading } = useSuperAdminTenantSettings(tenantId);
    const updateSettings = useSuperAdminUpdateTenantSettings();

    const [features, setFeatures] = useState<Record<string, boolean>>({
        ...FEATURE_DEFAULTS,
        enable_sms_notifications: false,
    });

    useEffect(() => {
        if (settings?.settings?.features) {
            // Merge API data with defaults to ensure all keys are always boolean
            setFeatures(prev => ({
                ...prev,
                ...Object.fromEntries(
                    Object.entries(settings.settings.features).map(([k, v]) => [k, Boolean(v)])
                )
            }));
        }
    }, [settings]);

    const handleToggle = (key: string) => {
        setFeatures(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSave = () => {
        if (!settings) return;

        const updatedSettings = {
            ...settings.settings,
            features: {
                ...settings.settings.features,
                ...features
            }
        };

        updateSettings.mutate({
            tenantId,
            settings: {
                settings: updatedSettings
            }
        }, {
            onSuccess: () => {
                toast.success(`Features updated for ${tenantName}`);
                onClose();
            },
            onError: () => {
                toast.error('Failed to update features');
            }
        });
    };

    // The school's ceiling: an area that is off is refused by the server for everyone in the
    // school (admins included) and greyed out on the school's role screens
    const featureList = [
        {
            key: 'enable_finance',
            label: 'Fees',
            icon: Wallet,
            description: "Fee setup, invoices, payments, receipts, expenses and the families' fee pages."
        },
        {
            key: 'enable_attendance',
            label: 'Attendance',
            icon: ClipboardCheck,
            description: 'Daily attendance, scanning, excuses, attendance reports and ID cards.'
        },
        {
            key: 'enable_homework',
            label: 'Homework',
            icon: BookOpen,
            description: 'Assignments teachers set and students hand in.'
        },
        {
            key: 'enable_timetable',
            label: 'Timetable',
            icon: CalendarDays,
            description: 'Class timetables for staff, students and parents.'
        },
        {
            key: 'enable_announcements',
            label: 'Announcements',
            icon: Megaphone,
            description: 'Announcements to staff, students and families. The inbox and school alerts stay on.'
        },
        {
            key: 'enable_sms_notifications',
            label: 'SMS alerts',
            icon: MessageSquare,
            description: 'Text-message copies of alerts (needs an SMS provider; not connected yet).'
        },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Areas: {tenantName}</DialogTitle>
                    <DialogDescription>
                        Choose what this school can use. An area that is off is hidden from everyone at the
                        school, admins included. Students, classes, the school year, grades and staff are always on.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {isLoading ? (
                        <div className="flex justify-center p-8">Loading settings...</div>
                    ) : (
                        <div className="space-y-4">
                            {featureList.map((feature) => (
                                <div
                                    key={feature.key}
                                    className={`flex items-start space-x-4 p-3 rounded-lg border transition-colors ${!!features[feature.key] ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50/30 border-gray-100'}`}
                                >
                                    <div className={`mt-1 p-2 rounded-md ${!!features[feature.key] ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <feature.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <Label
                                                htmlFor={feature.key}
                                                className="text-sm font-semibold cursor-pointer"
                                            >
                                                {feature.label}
                                            </Label>
                                            <Checkbox
                                                id={feature.key}
                                                checked={!!features[feature.key]}
                                                onCheckedChange={() => handleToggle(feature.key)}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={updateSettings.isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading || updateSettings.isPending}>
                        {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
