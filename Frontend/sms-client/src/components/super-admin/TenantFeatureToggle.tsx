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
    Bus,
    Utensils,
    Stethoscope,
    SwitchCamera,
    MessageSquare,
    Users
} from 'lucide-react';

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
        enable_finance: false,
        enable_transportation: false,
        enable_cafeteria: false,
        enable_health: false,
        enable_parent_portal: false,
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

    const featureList = [
        {
            key: 'enable_finance',
            label: 'Finance & Billing',
            icon: Wallet,
            description: 'Manage student fees, installments, school revenue and expenditure.'
        },
        {
            key: 'enable_transportation',
            label: 'Transportation',
            icon: Bus,
            description: 'Manage school buses, routes, and vehicle tracking.'
        },
        {
            key: 'enable_cafeteria',
            label: 'Cafeteria / Canteen',
            icon: Utensils,
            description: 'Manage meal plans, inventory, and canteen sales.'
        },
        {
            key: 'enable_health',
            label: 'Health & Clinic',
            icon: Stethoscope,
            description: 'Manage student health records and clinic visits.'
        },
        {
            key: 'enable_parent_portal',
            label: 'Parent Portal',
            icon: Users,
            description: 'Allow parents to access student grades and attendance.'
        },
        {
            key: 'enable_sms_notifications',
            label: 'SMS Notifications',
            icon: MessageSquare,
            description: 'Enable automated SMS alerts for attendance and fees.'
        },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Modular Features: {tenantName}</DialogTitle>
                    <DialogDescription>
                        Enable or disable specific modules for this tenant.
                        Changes take effect immediately on the school portal sidebar.
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
