import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageFile, CropRect } from '../types';

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move';

interface CropEditorProps {
    image: ImageFile;
    crops: CropRect[];
    selectedCropId: string | null;
    onCropChange: (updatedCrop: CropRect) => void;
    onSelectCrop: (id: string | null) => void;
    isPickingColor?: boolean;
    onColorPick?: (color: string) => void;
}

export const CropEditor: React.FC<CropEditorProps> = ({ image, crops, selectedCropId, onCropChange, onSelectCrop, isPickingColor = false, onColorPick }) => {
    const [activeHandle, setActiveHandle] = useState<Handle | null>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const startPos = useRef<{ x: number, y: number, crop: CropRect } | null>(null);

    const getScale = useCallback(() => {
        if (!imageRef.current || !image.width) {
            return { scaleX: 1, scaleY: 1 };
        }
        return {
            scaleX: image.width / imageRef.current.offsetWidth,
            scaleY: image.height / imageRef.current.offsetHeight,
        };
    }, [image.width, image.height]);

    const handleInteractionStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, handle: Handle, crop: CropRect) => {
        if (isPickingColor) return;
        e.preventDefault();
        e.stopPropagation();
        if (crop.id !== selectedCropId) {
            onSelectCrop(crop.id);
        }
        setActiveHandle(handle);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        startPos.current = { x: clientX, y: clientY, crop };
    };

    const handleInteractionMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!activeHandle || !startPos.current || !imageRef.current) return;
        
        e.preventDefault();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const { scaleX, scaleY } = getScale();
        const deltaX = (clientX - startPos.current.x) * scaleX;
        const deltaY = (clientY - startPos.current.y) * scaleY;
        
        let { x, y, width, height } = startPos.current.crop;
        const minSize = 20;

        if (activeHandle.includes('e')) width += deltaX;
        if (activeHandle.includes('w')) {
            width -= deltaX;
            x += deltaX;
        }
        if (activeHandle.includes('s')) height += deltaY;
        if (activeHandle.includes('n')) {
            height -= deltaY;
            y += deltaY;
        }
        if (activeHandle === 'move') {
            x += deltaX;
            y += deltaY;
        }
        
        if (width < minSize) {
            if (activeHandle.includes('w')) x = startPos.current.crop.x + startPos.current.crop.width - minSize;
            width = minSize;
        }
        if (height < minSize) {
            if (activeHandle.includes('n')) y = startPos.current.crop.y + startPos.current.crop.height - minSize;
            height = minSize;
        }

        if (activeHandle === 'move') {
            x = Math.max(0, Math.min(x, image.width - width));
            y = Math.max(0, Math.min(y, image.height - height));
        } else {
            x = Math.max(0, x);
            y = Math.max(0, y);
            width = Math.min(width, image.width - x);
            height = Math.min(height, image.height - y);
        }

        onCropChange({ ...startPos.current.crop, x, y, width, height });
    }, [activeHandle, getScale, image.width, image.height, onCropChange]);

    const handleInteractionEnd = useCallback(() => {
        setActiveHandle(null);
        startPos.current = null;
    }, []);

    useEffect(() => {
        const getCursorStyle = (handle: Handle | null): string => {
            if (!handle) return 'default';
            const cursorMap: Record<Handle, string> = {
                n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
                ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize',
                move: 'move'
            };
            return cursorMap[handle];
        };

        if (activeHandle) {
            document.body.style.cursor = getCursorStyle(activeHandle);
            window.addEventListener('mousemove', handleInteractionMove);
            window.addEventListener('mouseup', handleInteractionEnd);
            window.addEventListener('touchmove', handleInteractionMove, { passive: false });
            window.addEventListener('touchend', handleInteractionEnd);
        }
        return () => {
            document.body.style.cursor = 'default';
            window.removeEventListener('mousemove', handleInteractionMove);
            window.removeEventListener('mouseup', handleInteractionEnd);
            window.removeEventListener('touchmove', handleInteractionMove);
            window.removeEventListener('touchend', handleInteractionEnd);
        };
    }, [activeHandle, handleInteractionMove, handleInteractionEnd]);

    const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isPickingColor && onColorPick && imageRef.current) {
            const img = imageRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0);

            const rect = img.getBoundingClientRect();
            const scaleX = img.naturalWidth / rect.width;
            const scaleY = img.naturalHeight / rect.height;

            const x = Math.floor((e.clientX - rect.left) * scaleX);
            const y = Math.floor((e.clientY - rect.top) * scaleY);
            
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const toHex = (c: number) => `0${c.toString(16)}`.slice(-2);
            const color = `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;
            onColorPick(color);
            e.stopPropagation();
        } else {
            onSelectCrop(null);
        }
    };
    
    const { scaleX, scaleY } = getScale();
    const handles: { position: string, cursor: string, type: Handle }[] = [
        { position: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-n-resize', type: 'n' },
        { position: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursor: 'cursor-s-resize', type: 's' },
        { position: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2', cursor: 'cursor-w-resize', type: 'w' },
        { position: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2', cursor: 'cursor-e-resize', type: 'e' },
        { position: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nw-resize', type: 'nw' },
        { position: 'top-0 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'cursor-ne-resize', type: 'ne' },
        { position: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'cursor-sw-resize', type: 'sw' },
        { position: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'cursor-se-resize', type: 'se' },
    ];
    
    if (scaleX === 0 || scaleY === 0) return <div className="relative w-full max-w-4xl mx-auto"><div className="w-full aspect-video bg-gray-800 animate-pulse rounded-lg"></div></div>;

    return (
        <div 
            ref={containerRef} 
            className="relative w-full max-w-4xl mx-auto touch-none select-none" 
            onClick={handleContainerClick}
            style={{ cursor: isPickingColor ? 'crosshair' : 'default' }}
        >
            <img ref={imageRef} src={image.url} alt="Crop source" className="w-full h-auto block rounded-lg shadow-lg" draggable="false" />
            {crops.map(crop => {
                const isSelected = crop.id === selectedCropId;
                const displayCrop = {
                    left: crop.x / scaleX,
                    top: crop.y / scaleY,
                    width: crop.width / scaleX,
                    height: crop.height / scaleY,
                };

                return (
                    <div
                        key={crop.id}
                        className={`absolute cursor-move transition-colors duration-200 ${isSelected ? 'border-2 border-solid border-sky-400 bg-black bg-opacity-30' : 'border border-dashed border-white/30 hover:border-white/60'}`}
                        style={displayCrop}
                        onMouseDown={(e) => handleInteractionStart(e, 'move', crop)}
                        onTouchStart={(e) => handleInteractionStart(e, 'move', crop)}
                        onClick={(e) => { e.stopPropagation(); onSelectCrop(crop.id); }}
                    >
                        {isSelected && handles.map(h => (
                            <div
                                key={h.type}
                                className={`absolute w-3 h-3 bg-sky-400 rounded-full ${h.position} ${h.cursor}`}
                                onMouseDown={(e) => handleInteractionStart(e, h.type, crop)}
                                onTouchStart={(e) => handleInteractionStart(e, h.type, crop)}
                            />
                        ))}
                    </div>
                )
            })}
        </div>
    );
};
