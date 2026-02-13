'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    folder?: string;
    className?: string;
    aspectRatio?: 'square' | 'landscape' | 'portrait';
    maxSizeMB?: number;
    placeholder?: string;
    disabled?: boolean;
}

export default function ImageUpload({
    value,
    onChange,
    folder = 'uploads',
    className,
    aspectRatio = 'square',
    maxSizeMB = 5,
    placeholder = 'Click or drag to upload image',
    disabled = false,
}: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const aspectRatioClass = {
        square: 'aspect-square',
        landscape: 'aspect-video',
        portrait: 'aspect-[3/4]',
    }[aspectRatio];

    const handleFileSelect = useCallback(async (file: File) => {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Invalid file type. Only JPG, PNG, WebP, and GIF are allowed.');
            return;
        }

        // Validate file size
        const maxSize = maxSizeMB * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error(`File too large. Maximum size is ${maxSizeMB}MB.`);
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);

            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 100);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const data = await response.json();
            setUploadProgress(100);
            onChange(data.url);
            toast.success('Image uploaded successfully');
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Failed to upload image');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    }, [folder, maxSizeMB, onChange]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (disabled || isUploading) return;

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [disabled, isUploading, handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && !isUploading) {
            setIsDragging(true);
        }
    }, [disabled, isUploading]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleClick = () => {
        if (!disabled && !isUploading) {
            fileInputRef.current?.click();
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        toast.info('Image removed');
    };

    return (
        <div className={cn('relative', className)}>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleInputChange}
                className="hidden"
                disabled={disabled || isUploading}
            />

            <div
                onClick={handleClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                    'relative overflow-hidden rounded-lg border-2 border-dashed transition-all cursor-pointer',
                    aspectRatioClass,
                    isDragging && 'border-indigo-500 bg-indigo-50',
                    !isDragging && !value && 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100',
                    value && 'border-transparent',
                    (disabled || isUploading) && 'opacity-50 cursor-not-allowed',
                )}
            >
                {/* Image Preview */}
                {value ? (
                    <div className="relative w-full h-full">
                        <Image
                            src={value}
                            alt="Uploaded image"
                            fill
                            className="object-cover"
                            unoptimized // Use unoptimized for external URLs like Vercel Blob
                        />
                        {/* Remove button */}
                        {!disabled && !isUploading && (
                            <button
                                onClick={handleRemove}
                                className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                                type="button"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ) : (
                    /* Upload placeholder */
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
                        {isUploading ? (
                            <>
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                <span className="text-sm font-medium">{uploadProgress}% uploading...</span>
                            </>
                        ) : (
                            <>
                                {isDragging ? (
                                    <Upload className="w-8 h-8 text-indigo-500" />
                                ) : (
                                    <ImageIcon className="w-8 h-8" />
                                )}
                                <span className="text-sm font-medium text-center px-4">{placeholder}</span>
                                <span className="text-xs text-gray-400">JPG, PNG, WebP, GIF • Max {maxSizeMB}MB</span>
                            </>
                        )}
                    </div>
                )}

                {/* Upload progress overlay */}
                {isUploading && value && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-center text-white">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                            <span className="text-sm">{uploadProgress}%</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
