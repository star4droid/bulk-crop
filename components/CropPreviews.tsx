
import React from 'react';
import type { ImageFile, CropRect } from '../types';

const SingleCropPreview: React.FC<{
    image: ImageFile;
    crop: CropRect;
    isSelected: boolean;
    onClick: () => void;
    index: number;
}> = ({ image, crop, isSelected, onClick, index }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = React.useState({ width: 128, height: 128 }); // 8rem

    React.useLayoutEffect(() => {
        if (containerRef.current) {
            setContainerSize({
                width: containerRef.current.offsetWidth,
                height: containerRef.current.offsetHeight
            });
        }
    }, []);

    if (!crop || crop.width <= 0 || crop.height <= 0 || !image || image.width <= 0 || image.height <= 0) {
        return (
            <div className="flex-shrink-0 w-32 h-32 bg-gray-800 border-2 border-gray-700 rounded-lg overflow-hidden relative" ref={containerRef} aria-label={`Crop area ${index + 1}`}>
                 <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center p-2">
                    <p className="text-sm text-center text-white">Crop {index + 1}</p>
                    <p className="text-xs text-center text-red-400">Invalid</p>
                </div>
            </div>
        );
    }

    const cropAspectRatio = crop.width / crop.height;
    const containerAspectRatio = containerSize.width > 0 && containerSize.height > 0 ? containerSize.width / containerSize.height : 1;
    let scale: number;
    if (cropAspectRatio > containerAspectRatio) {
        scale = containerSize.height / crop.height;
    } else {
        scale = containerSize.width / crop.width;
    }
    
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;
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
            className={`flex-shrink-0 w-32 h-32 bg-gray-800 rounded-lg overflow-hidden relative cursor-pointer transition-all duration-200 ${selectionClasses}`}
            ref={containerRef}
            aria-label={`Select crop area ${index + 1}`}
            onClick={onClick}
        >
            <img src={image.url} alt={`Crop ${index + 1}`} className="absolute" style={imgStyle} />
             <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center p-2 pointer-events-none">
                <p className="text-sm font-bold text-center text-white">Crop {index + 1}</p>
            </div>
        </div>
    );
};


export const CropPreviews: React.FC<{
    image: ImageFile;
    crops: CropRect[];
    selectedCropId: string | null;
    onSelectCrop: (id: string) => void;
}> = ({ image, crops, selectedCropId, onSelectCrop }) => {
    if (crops.length <= 1) {
        return null;
    }

    return (
        <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-300">Crop Previews ({crops.length})</h2>
            <div className="flex gap-4 pb-4 overflow-x-auto pr-4 md:pr-8">
                {crops.map((crop, index) => (
                    <SingleCropPreview
                        key={crop.id}
                        image={image}
                        crop={crop}
                        isSelected={crop.id === selectedCropId}
                        onClick={() => onSelectCrop(crop.id)}
                        index={index}
                    />
                ))}
            </div>
        </section>
    );
};
