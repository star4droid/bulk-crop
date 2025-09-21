import React, { useRef, useLayoutEffect, useState } from 'react';
import type { ImageFile, CropRect } from '../types';

interface ThumbnailProps {
    image: ImageFile;
    crop: CropRect;
    isSelected: boolean;
    onClick: () => void;
}

export const Thumbnail: React.FC<ThumbnailProps> = ({ image, crop, isSelected, onClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Default to w-40 h-40 size in pixels (10rem = 160px) to prevent issues on first render
    const [containerSize, setContainerSize] = useState({ width: 160, height: 160 }); 

    useLayoutEffect(() => {
        if (containerRef.current) {
            setContainerSize({
                width: containerRef.current.offsetWidth,
                height: containerRef.current.offsetHeight
            });
        }
    }, []);

    // Guard against division by zero or invalid data
    if (!crop || crop.width <= 0 || crop.height <= 0 || !image || image.width <= 0 || image.height <= 0) {
        return (
            <div className="flex-shrink-0 w-40 h-40 bg-gray-800 border-2 border-gray-700 rounded-lg overflow-hidden relative" ref={containerRef} aria-label={`thumbnail for ${image?.name}`}>
                 <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center p-2">
                    <p className="text-xs text-center text-white break-words">{image?.name || 'Invalid image'}</p>
                </div>
            </div>
        );
    }
    
    const cropAspectRatio = crop.width / crop.height;
    const containerAspectRatio = containerSize.width > 0 && containerSize.height > 0 ? containerSize.width / containerSize.height : 1;

    let scale: number;
    // This logic mimics object-fit: cover for the cropped area
    if (cropAspectRatio > containerAspectRatio) {
        // Crop is wider than container, so we must scale to fit container's height and let width overflow
        scale = containerSize.height / crop.height;
    } else {
        // Crop is taller or same aspect as container, so we must scale to fit container's width and let height overflow
        scale = containerSize.width / crop.width;
    }
    
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    // Calculate translation to center the cropped area within the container
    const translateX = -(crop.x * scale) + (containerSize.width - (crop.width * scale)) / 2;
    const translateY = -(crop.y * scale) + (containerSize.height - (crop.height * scale)) / 2;
    
    const imgStyle: React.CSSProperties = {
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
        transform: `translate(${translateX}px, ${translateY}px)`,
        maxWidth: 'none',
    };

    const selectionClasses = isSelected
        ? 'ring-4 ring-offset-2 ring-offset-gray-900 ring-sky-400'
        : 'border-2 border-gray-700 hover:border-sky-500';

    return (
        <div
            className={`flex-shrink-0 w-40 h-40 bg-gray-800 rounded-lg overflow-hidden relative cursor-pointer transition-all duration-200 ${selectionClasses}`}
            ref={containerRef}
            aria-label={`thumbnail for ${image.name}`}
            onClick={onClick}
        >
            <img
                src={image.url}
                alt={image.name}
                className="absolute"
                style={imgStyle}
            />
             <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center p-2">
                <p className="text-xs text-center text-white break-words">{image.name}</p>
            </div>
        </div>
    );
};
