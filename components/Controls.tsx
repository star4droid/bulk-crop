

import React from 'react';
import type { CropRect } from '../types';
import { DownloadIcon, LoaderIcon, MagicWandIcon, PlusIcon, TrashIcon, EyeDropperIcon, EraserIcon } from './Icons';

type AutoDetectOptions = { mode: 'transparent' | 'color'; color: string };

interface ControlsProps {
    selectedCrop: CropRect | null;
    onCropChange: (updatedCrop: CropRect) => void;
    onDownload: () => void;
    
    // Auto Detect
    onAutoDetect: () => void;
    autoDetectOptions: AutoDetectOptions;
    onAutoDetectOptionsChange: (options: AutoDetectOptions) => void;
    onToggleColorPicker: (target: 'autoDetect' | 'bgRemove') => void;
    isAutoCropping: boolean;
    
    // Background Removal
    onRemoveBackground: () => void;
    bgRemoveColor: string;
    onBgRemoveColorChange: (color: string) => void;
    isRemovingBackground: boolean;
    bgRemoveFeather: number;
    onBgRemoveFeatherChange: (value: number) => void;

    // General state
    isDisabled: boolean;
    isLoading: boolean;
    progress: { processed: number; total: number } | null;
    imageWidth: number;
    imageHeight: number;
    onAddCrop: () => void;
    onDeleteCrop: () => void;
}

const ControlInput: React.FC<{ label: string; value: number; max: number; onChange: (value: number) => void, disabled: boolean }> = ({ label, value, max, onChange, disabled }) => (
    <div className="flex-1 min-w-[120px]">
        <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
        <input
            type="number"
            value={Math.round(value)}
            max={max}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-800 disabled:cursor-not-allowed"
            disabled={disabled}
        />
    </div>
);

export const Controls: React.FC<ControlsProps> = ({ 
    selectedCrop, onCropChange, onDownload, onAutoDetect, autoDetectOptions, 
    onAutoDetectOptionsChange, onToggleColorPicker, isAutoCropping, isDisabled, 
    isLoading, progress, imageWidth, imageHeight, onAddCrop, onDeleteCrop, onRemoveBackground,
    bgRemoveColor, onBgRemoveColorChange, isRemovingBackground, bgRemoveFeather, onBgRemoveFeatherChange
}) => {

    const handleInputChange = (field: keyof Omit<CropRect, 'id'>, value: number) => {
        if (!selectedCrop || isNaN(value)) return;
        
        const newCrop = { ...selectedCrop, [field]: value };

        if (field === 'x' && value + newCrop.width > imageWidth) {
            newCrop.x = imageWidth - newCrop.width;
        }
        if (field === 'y' && value + newCrop.height > imageHeight) {
            newCrop.y = imageHeight - newCrop.height;
        }
        if (field === 'width' && newCrop.x + value > imageWidth) {
            newCrop.width = imageWidth - newCrop.x;
        }
        if (field === 'height' && newCrop.y + value > imageHeight) {
            newCrop.height = imageHeight - newCrop.y;
        }

        onCropChange(newCrop);
    };

    const isActionDisabled = isDisabled || isLoading || isAutoCropping || isRemovingBackground;
    const isCropSelected = !!selectedCrop;
    const { mode: bgDetectMode, color: bgDetectColor } = autoDetectOptions;

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-lg border border-gray-700 w-full flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ControlInput label="X" value={selectedCrop?.x ?? 0} max={imageWidth - (selectedCrop?.width ?? 0)} onChange={(v) => handleInputChange('x', v)} disabled={!isCropSelected} />
                <ControlInput label="Y" value={selectedCrop?.y ?? 0} max={imageHeight - (selectedCrop?.height ?? 0)} onChange={(v) => handleInputChange('y', v)} disabled={!isCropSelected} />
                <ControlInput label="Width" value={selectedCrop?.width ?? 0} max={imageWidth - (selectedCrop?.x ?? 0)} onChange={(v) => handleInputChange('width', v)} disabled={!isCropSelected} />
                <ControlInput label="Height" value={selectedCrop?.height ?? 0} max={imageHeight - (selectedCrop?.y ?? 0)} onChange={(v) => handleInputChange('height', v)} disabled={!isCropSelected} />
            </div>

            <div className="flex flex-col md:flex-row gap-4 border-t border-gray-700 pt-6">
                <div className="flex-1 flex flex-col gap-4">
                    {/* Object Detection */}
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                        <h3 className="font-semibold text-gray-300 mb-3">Object Detection</h3>
                        <p className="text-sm text-gray-400 mb-4">Automatically find objects by defining the background.</p>
                        <div className="flex flex-wrap items-center gap-6 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="bg-mode" checked={bgDetectMode === 'transparent'} onChange={() => onAutoDetectOptionsChange({...autoDetectOptions, mode: 'transparent'})} className="form-radio bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500"/>
                                Transparent
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="bg-mode" checked={bgDetectMode === 'color'} onChange={() => onAutoDetectOptionsChange({...autoDetectOptions, mode: 'color'})} className="form-radio bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500"/>
                                Color
                                <input type="color" value={bgDetectColor} onChange={e => onAutoDetectOptionsChange({...autoDetectOptions, color: e.target.value})} disabled={bgDetectMode !== 'color'} className="w-8 h-8 rounded border-none bg-gray-700 cursor-pointer disabled:opacity-50"/>
                                <button onClick={() => onToggleColorPicker('autoDetect')} disabled={bgDetectMode !== 'color'} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Pick color from image for detection">
                                    <EyeDropperIcon className="w-5 h-5" />
                                </button>
                            </label>
                        </div>
                        <button
                            onClick={onAutoDetect}
                            disabled={isActionDisabled}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                        >
                            {isAutoCropping ? (<><LoaderIcon className="animate-spin" /> Detecting...</>) : (<><MagicWandIcon /> Detect Objects</>)}
                        </button>
                    </div>
                    {/* Background Removal */}
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                        <h3 className="font-semibold text-gray-300 mb-3">Background Removal</h3>
                        <p className="text-sm text-gray-400 mb-4">Remove a background color from all images with advanced edge detection.</p>
                        <div className="flex items-center gap-4 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                Color
                                <input type="color" value={bgRemoveColor} onChange={e => onBgRemoveColorChange(e.target.value)} className="w-8 h-8 rounded border-none bg-gray-700 cursor-pointer disabled:opacity-50"/>
                            </label>
                            <button onClick={() => onToggleColorPicker('bgRemove')} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Pick color from image for removal">
                                <EyeDropperIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 mb-4">
                            <div className="flex justify-between items-center">
                                <label htmlFor="feather-slider" className="text-sm font-medium text-gray-400">Edge Softness</label>
                                <span className="text-sm font-mono text-gray-300 bg-gray-700 px-2 py-0.5 rounded">{bgRemoveFeather}</span>
                            </div>
                            <input
                                id="feather-slider"
                                type="range"
                                min="0"
                                max="100"
                                value={bgRemoveFeather}
                                onChange={e => onBgRemoveFeatherChange(parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <button
                            onClick={onRemoveBackground}
                            disabled={isActionDisabled}
                            className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                        >
                            {isRemovingBackground ? (<><LoaderIcon className="animate-spin" /> Removing...</>) : (<><EraserIcon /> Remove Background</>)}
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col justify-between">
                     <div>
                        <h3 className="font-semibold text-gray-300 mb-3">Crop Management</h3>
                        <div className="flex gap-4 mb-4">
                            <button onClick={onAddCrop} disabled={isActionDisabled} className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"><PlusIcon /> Add Crop</button>
                            <button onClick={onDeleteCrop} disabled={isActionDisabled || !isCropSelected} className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"><TrashIcon /> Delete Selected</button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-4">
                        {isLoading && progress && (
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-base font-medium text-gray-300">Processing Images</span>
                                    <span className="text-sm font-medium text-gray-300">{progress.processed} / {progress.total}</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div
                                        className="bg-sky-500 h-2.5 rounded-full transition-all duration-150"
                                        style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={onDownload}
                            disabled={isActionDisabled}
                            className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                        >
                            {isLoading ? (
                                <><LoaderIcon className="animate-spin" /> Processing...</>
                            ) : (
                                <><DownloadIcon /> Download Crops (Separate Zips)</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};