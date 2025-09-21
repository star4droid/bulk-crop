

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ImageFile, CropRect } from './types';
import { UploadCloudIcon, ChevronDownIcon, PlayIcon, PauseIcon, RewindIcon, LoaderIcon } from './components/Icons';
import { CropEditor } from './components/CropEditor';
import { Thumbnail } from './components/Thumbnail';
import { Controls } from './components/Controls';
import { CropPreviews } from './components/CropPreviews';

// This is to inform TypeScript about the JSZip library loaded from the CDN
declare const JSZip: any;

const WelcomeScreen: React.FC<{ onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ onFileChange }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="max-w-md">
            <h1 className="text-4xl font-bold text-sky-400 mb-4">Bulk Image Cropper</h1>
            <p className="text-gray-400 mb-8">
                Upload multiple images, define one or more crop areas (or let the app detect them), and we'll apply all crops to all images. Download everything in a single ZIP file.
            </p>
            <label className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 cursor-pointer inline-flex items-center gap-2">
                <UploadCloudIcon />
                <span>Select Images</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={onFileChange} />
            </label>
        </div>
    </div>
);

interface SpriteSheetPreviewProps {
    images: ImageFile[];
    crop: CropRect | null;
    animationState: { isPlaying: boolean; isReversed: boolean; };
    onTogglePlay: () => void;
    onToggleReverse: () => void;
}

const SpriteSheetPreview: React.FC<SpriteSheetPreviewProps> = ({ images, crop, animationState, onTogglePlay, onToggleReverse }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [imageElements, setImageElements] = useState<HTMLImageElement[]>([]);

    useEffect(() => {
        if (!images.length || !crop) {
            setIsLoading(false);
            return;
        }
        let isCancelled = false;
        setIsLoading(true);

        Promise.all(images.map(imgFile => new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = imgFile.url;
        }))).then(loadedImages => {
            if (!isCancelled) {
                setImageElements(loadedImages);
                setIsLoading(false);
            }
        }).catch(error => {
            console.error("Failed to load images for animation:", error);
            if (!isCancelled) setIsLoading(false);
        });

        return () => { isCancelled = true; };
    }, [images]);

    useEffect(() => {
        if (isLoading || !crop || imageElements.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        canvas.width = crop.width;
        canvas.height = crop.height;

        let frame = 0;
        let lastTime = 0;
        let animationFrameId: number;
        const fps = 10;
        const frameInterval = 1000 / fps;

        const render = (timestamp: number) => {
            if (!lastTime) lastTime = timestamp;
            const deltaTime = timestamp - lastTime;
            
            if (animationState.isPlaying && deltaTime > frameInterval) {
                lastTime = timestamp - (deltaTime % frameInterval);

                if (animationState.isReversed) {
                    frame = (frame - 1 + imageElements.length) % imageElements.length;
                } else {
                    frame = (frame + 1) % imageElements.length;
                }

                const currentImage = imageElements[frame];
                if (currentImage) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(
                        currentImage,
                        Math.round(crop.x), Math.round(crop.y), Math.round(crop.width), Math.round(crop.height),
                        0, 0, canvas.width, canvas.height
                    );
                }
            }
            animationFrameId = requestAnimationFrame(render);
        };
        
        // Initial draw
        const initialImage = imageElements[0];
        if (initialImage) {
             ctx.drawImage(
                initialImage,
                Math.round(crop.x), Math.round(crop.y), Math.round(crop.width), Math.round(crop.height),
                0, 0, canvas.width, canvas.height
            );
        }

        render(0);
        
        return () => {
            cancelAnimationFrame(animationFrameId);
        };

    }, [imageElements, crop, animationState, isLoading]);


    const containerStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: '600px',
        aspectRatio: (crop?.width && crop?.height) ? `${crop.width} / ${crop.height}` : '16/9',
        position: 'relative',
    };

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-lg border border-gray-700 w-full flex flex-col items-center gap-4">
            <div className="bg-gray-900 overflow-hidden rounded-md w-full" style={containerStyle}>
                {(isLoading || !crop) ? (
                    <div className="w-full h-full flex items-center justify-center absolute inset-0">
                        <LoaderIcon className="w-8 h-8 animate-spin" />
                    </div>
                ) : (
                    <canvas ref={canvasRef} className="w-full h-full object-contain" />
                )}
            </div>
            <div className="flex items-center gap-4">
                <button onClick={onTogglePlay} className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-3 transition-colors disabled:opacity-50" aria-label={animationState.isPlaying ? 'Pause' : 'Play'} disabled={isLoading || !crop} >
                    {animationState.isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                </button>
                <button onClick={onToggleReverse} className={`p-3 rounded-full transition-colors disabled:opacity-50 ${animationState.isReversed ? 'bg-sky-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`} aria-label="Reverse" disabled={isLoading || !crop} >
                    <RewindIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};


async function detectObjectsFromImage(imageFile: ImageFile, options: { mode: 'transparent' | 'color', color: string }): Promise<Omit<CropRect, 'id'>[]> {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = imageFile.url; });

    const canvas = document.createElement('canvas');
    const { width, height } = imageFile;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };
    const colorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) =>
        Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));

    const bgColorRgb = options.mode === 'color' ? hexToRgb(options.color) : null;
    const COLOR_THRESHOLD = 35;
    const ALPHA_THRESHOLD = 10;

    const isBackground = (index: number) => {
        if (options.mode === 'transparent') {
            return data[index + 3] < ALPHA_THRESHOLD;
        }
        if (bgColorRgb) {
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            return colorDistance(r, g, b, bgColorRgb.r, bgColorRgb.g, bgColorRgb.b) < COLOR_THRESHOLD;
        }
        return false;
    };
    
    const visited = new Uint8Array(width * height);
    const boundingBoxes = [];
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x);
            if (visited[i]) continue;
            
            const pixelIndex = i * 4;
            if (isBackground(pixelIndex)) {
                visited[i] = 1;
                continue;
            }
            
            let minX = x, minY = y, maxX = x, maxY = y;
            const queue: [number, number][] = [[x, y]];
            visited[i] = 1;
            
            let head = 0;
            while(head < queue.length) {
                const [cx, cy] = queue[head++];
                
                minX = Math.min(minX, cx);
                minY = Math.min(minY, cy);
                maxX = Math.max(maxX, cx);
                maxY = Math.max(maxY, cy);
                
                for (const [dx, dy] of [[0,1], [0,-1], [1,0], [-1,0]]) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const ni = ny * width + nx;
                        if (!visited[ni] && !isBackground(ni * 4)) {
                            visited[ni] = 1;
                            queue.push([nx, ny]);
                        }
                    }
                }
            }
            if (maxX - minX > 5 && maxY - minY > 5) {
               boundingBoxes.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
            }
        }
    }
    
    return boundingBoxes;
}

async function removeImageBackground(imageFile: ImageFile, hexColor: string, feather: number): Promise<ImageFile> {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = imageFile.url; });

    const canvas = document.createElement('canvas');
    const { width, height } = imageFile;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return imageFile;
    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const originalData = new Uint8ClampedArray(imageData.data); // For Pass 2 color checks
    const data = imageData.data;

    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };
    const targetRgb = hexToRgb(hexColor);
    if (!targetRgb) return imageFile;
    
    const colorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) =>
        Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));

    // --- Pass 1: Flood-fill removal ---
    const COLOR_THRESHOLD = 20;
    const colorMatch = (r: number, g: number, b: number) => {
        return colorDistance(r, g, b, targetRgb.r, targetRgb.g, targetRgb.b) < COLOR_THRESHOLD;
    };
    
    const queue: [number, number][] = [];
    const visited = new Uint8Array(width * height);
    const addToQueue = (x: number, y: number) => {
        const i = y * width + x;
        if (visited[i]) return;
        const pixelIndex = i * 4;
        if (colorMatch(data[pixelIndex], data[pixelIndex + 1], data[pixelIndex + 2])) {
            queue.push([x, y]);
            visited[i] = 1;
        }
    };

    for (let x = 0; x < width; x++) { addToQueue(x, 0); addToQueue(x, height - 1); }
    for (let y = 1; y < height - 1; y++) { addToQueue(0, y); addToQueue(width - 1, y); }

    let head = 0;
    while(head < queue.length) {
        const [x, y] = queue[head++];
        const i = (y * width + x) * 4;
        data[i + 3] = 0; // Make transparent
        for (const [dx, dy] of [[0,1], [0,-1], [1,0], [-1,0]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) { addToQueue(nx, ny); }
        }
    }

    // --- Pass 2: Edge Feathering ---
    if (feather > 0) {
        const postFloodFillData = new Uint8ClampedArray(data);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x);
                const pixelIndex = i * 4;

                if (postFloodFillData[pixelIndex + 3] > 0) { // Is opaque
                    let isEdge = false;
                    for (const [dx, dy] of [[0,1], [0,-1], [1,0], [-1,0]]) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height && postFloodFillData[((ny * width + nx) * 4) + 3] === 0) {
                            isEdge = true;
                            break;
                        }
                    }
                    if (isEdge) {
                        const r = originalData[pixelIndex];
                        const g = originalData[pixelIndex + 1];
                        const b = originalData[pixelIndex + 2];
                        const distance = colorDistance(r, g, b, targetRgb.r, targetRgb.g, targetRgb.b);
                        if (distance < feather) {
                            const originalAlpha = originalData[pixelIndex + 3];
                            data[pixelIndex + 3] = originalAlpha * (distance / feather);
                        }
                    }
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return { ...imageFile, url: canvas.toDataURL() };
}

const App: React.FC = () => {
    const [images, setImages] = useState<ImageFile[]>([]);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [crops, setCrops] = useState<CropRect[]>([]);
    const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
    const [isAutoCropping, setIsAutoCropping] = useState(false);
    const [isRemovingBackground, setIsRemovingBackground] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [animationState, setAnimationState] = useState({ isPlaying: true, isReversed: false });
    const [colorPickerTarget, setColorPickerTarget] = useState<'autoDetect' | 'bgRemove' | null>(null);
    const [autoDetectOptions, setAutoDetectOptions] = useState({ mode: 'transparent' as 'transparent' | 'color', color: '#ffffff' });
    const [bgRemoveColor, setBgRemoveColor] = useState('#ffffff');
    const [bgRemoveFeather, setBgRemoveFeather] = useState(25);
    const thumbnailsRef = useRef<HTMLElement>(null);

    const numericSort = (a: ImageFile, b: ImageFile) => {
        const regex = /(\d+)(?!.*\d)/;
        const nameA = a.name.split('.').slice(0, -1).join('.');
        const nameB = b.name.split('.').slice(0, -1).join('.');
        const matchA = nameA.match(regex);
        const matchB = nameB.match(regex);
        if (matchA && matchB) {
            const numA = parseInt(matchA[1], 10);
            const numB = parseInt(matchB[1], 10);
            if (numA !== numB) return numA - numB;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        Promise.all(files.map(file => new Promise<ImageFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => resolve({ id: `${file.name}-${Date.now()}`, name: file.name, url: event.target?.result as string, width: img.width, height: img.height });
                img.onerror = reject;
                img.src = event.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }))).then(imageData => {
            imageData.sort(numericSort);
            setImages(imageData);
            if (imageData.length > 0) {
                const firstImage = imageData[0];
                setSelectedImageId(firstImage.id);
                const size = Math.min(firstImage.width, firstImage.height) * 0.5;
                const initialCrop: CropRect = {
                    id: `crop-${Date.now()}`,
                    x: (firstImage.width - size) / 2,
                    y: (firstImage.height - size) / 2,
                    width: size,
                    height: size,
                };
                setCrops([initialCrop]);
                setSelectedCropId(initialCrop.id);
            } else {
                setSelectedImageId(null);
                setCrops([]);
                setSelectedCropId(null);
            }
        }).catch(console.error);
    };

    const handleCropChange = useCallback((updatedCrop: CropRect) => {
        setCrops(prev => prev.map(c => c.id === updatedCrop.id ? updatedCrop : c));
    }, []);
    
    const handleSelectCrop = useCallback((id: string | null) => {
        setSelectedCropId(id);
    }, []);

    const handleAddCrop = () => {
        const mainImage = images.find(img => img.id === selectedImageId) || images[0];
        if (!mainImage) return;
        const size = Math.min(mainImage.width, mainImage.height) * 0.25;
        const newCrop: CropRect = {
            id: `crop-${Date.now()}`,
            x: (mainImage.width - size) / 2,
            y: (mainImage.height - size) / 2,
            width: size,
            height: size,
        };
        setCrops(prev => [...prev, newCrop]);
        setSelectedCropId(newCrop.id);
    };

    const handleDeleteCrop = () => {
        if (!selectedCropId) return;
        setCrops(prev => {
            const newCrops = prev.filter(c => c.id !== selectedCropId);
            const newSelectedId = newCrops.length > 0 ? newCrops[0].id : null;
            setSelectedCropId(newSelectedId);
            return newCrops;
        });
    };

    const handleAutoDetectObjects = async () => {
        const imageToCrop = images.find(img => img.id === selectedImageId) || images[0];
        if (!imageToCrop) return;

        setIsAutoCropping(true);
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI to update

        try {
            const detectedCrops = await detectObjectsFromImage(imageToCrop, autoDetectOptions);
            if (detectedCrops.length > 0) {
                const newCrops = detectedCrops.map(obj => ({ id: `crop-${Date.now()}-${Math.random()}`, ...obj }));
                setCrops(newCrops);
                setSelectedCropId(newCrops[0]?.id || null);
            } else {
                alert("No objects were detected. You can add a crop area manually.");
                setCrops([]); setSelectedCropId(null);
            }
        } catch (error) {
            console.error("Auto-detect failed:", error);
            alert("Could not auto-detect objects. Please try again or add crops manually.");
        } finally {
            setIsAutoCropping(false);
        }
    };
    
    const handleColorPicked = (color: string) => {
        if (colorPickerTarget === 'autoDetect') {
            setAutoDetectOptions(prev => ({...prev, color, mode: 'color'}));
        } else if (colorPickerTarget === 'bgRemove') {
            setBgRemoveColor(color);
        }
        setColorPickerTarget(null);
    };
    
    const handleToggleColorPicker = (target: 'autoDetect' | 'bgRemove') => {
        setColorPickerTarget(prev => prev === target ? null : target);
    };
    
    const handleRemoveBackground = async () => {
        if (images.length === 0) return;
        setIsRemovingBackground(true);
        try {
            const updatedImages = await Promise.all(
                images.map(image => removeImageBackground(image, bgRemoveColor, bgRemoveFeather))
            );
            setImages(updatedImages);
        } catch (error) {
            console.error("Failed to remove background:", error);
            alert("An error occurred while removing the background.");
        } finally {
            setIsRemovingBackground(false);
        }
    };

    const handleDownload = async () => {
        if (images.length === 0 || crops.length === 0) return;
        setIsLoading(true);
        const totalOperations = images.length * crops.length;
        setProgress({ processed: 0, total: totalOperations });
        let processedCount = 0;
    
        try {
            const zipFileNameBase = (images[0]?.name.split('.').slice(0, -1).join('.')) || 'cropped-images';
    
            for (let i = 0; i < crops.length; i++) {
                const crop = crops[i];
                const zip = new JSZip();
    
                for (const imageFile of images) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = imageFile.url; });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = crop.width;
                    canvas.height = crop.height;
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        processedCount++;
                        setProgress({ processed: processedCount, total: totalOperations });
                        await new Promise(resolve => requestAnimationFrame(resolve));
                        continue;
                    }
                    
                    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
                    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                    
                    if (blob) {
                        const baseName = imageFile.name.substring(0, imageFile.name.lastIndexOf('.'));
                        const fileName = `${baseName}.png`;
                        zip.file(fileName, blob);
                    }

                    processedCount++;
                    setProgress({ processed: processedCount, total: totalOperations });
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
    
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(zipBlob);
                link.download = crops.length > 1 ? `${zipFileNameBase}-crop-${i + 1}.zip` : `${zipFileNameBase}-crop.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);

                if (i < crops.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } catch (error) {
            console.error("Failed to create zip file:", error);
            alert("An error occurred while creating the zip file.");
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    };

    const handleScrollToThumbnails = () => thumbnailsRef.current?.scrollIntoView({ behavior: 'smooth' });

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            setShowScrollButton(!entry.isIntersecting && entry.boundingClientRect.top > window.innerHeight);
        }, { threshold: 0 });
        const currentRef = thumbnailsRef.current;
        if (currentRef) observer.observe(currentRef);
        return () => { if (currentRef) observer.unobserve(currentRef); };
    }, [images.length]);

    const mainImage = images.find(img => img.id === selectedImageId) || images[0];
    const selectedCrop = crops.find(c => c.id === selectedCropId) || null;

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8">
            {images.length === 0 ? (
                <WelcomeScreen onFileChange={handleFileChange} />
            ) : (
                <div className="flex flex-col gap-8 flex-grow">
                    {mainImage && (
                        <main className="flex flex-col gap-6">
                            <CropEditor image={mainImage} crops={crops} selectedCropId={selectedCropId} onCropChange={handleCropChange} onSelectCrop={handleSelectCrop} isPickingColor={!!colorPickerTarget} onColorPick={handleColorPicked} />
                            <CropPreviews image={mainImage} crops={crops} selectedCropId={selectedCropId} onSelectCrop={handleSelectCrop} />
                            <Controls 
                                selectedCrop={selectedCrop}
                                onCropChange={handleCropChange} 
                                onDownload={handleDownload}
                                onAutoDetect={handleAutoDetectObjects}
                                autoDetectOptions={autoDetectOptions}
                                onAutoDetectOptionsChange={setAutoDetectOptions}
                                onToggleColorPicker={handleToggleColorPicker}
                                isAutoCropping={isAutoCropping}
                                isDisabled={images.length === 0}
                                isLoading={isLoading}
                                progress={progress}
                                imageWidth={mainImage.width}
                                imageHeight={mainImage.height}
                                onAddCrop={handleAddCrop}
                                onDeleteCrop={handleDeleteCrop}
                                onRemoveBackground={handleRemoveBackground}
                                bgRemoveColor={bgRemoveColor}
                                onBgRemoveColorChange={setBgRemoveColor}
                                isRemovingBackground={isRemovingBackground}
                                bgRemoveFeather={bgRemoveFeather}
                                onBgRemoveFeatherChange={setBgRemoveFeather}
                            />
                        </main>
                    )}

                    <aside ref={thumbnailsRef}>
                        <h2 className="text-xl font-semibold mb-3 text-gray-300">Images ({images.length})</h2>
                        <div className="flex gap-4 pb-4 overflow-x-auto pr-4 md:pr-8">
                            {images.map(img => (
                                <Thumbnail
                                    key={img.id}
                                    image={img}
                                    crop={crops[0] || {id: '', x: 0, y: 0, width: img.width, height: img.height}}
                                    isSelected={img.id === selectedImageId}
                                    onClick={() => setSelectedImageId(img.id)}
                                />
                            ))}
                        </div>
                    </aside>
                    
                    {images.length > 1 && (
                        <section className="mt-2">
                            <h2 className="text-xl font-semibold mb-3 text-gray-300">Animation Preview (Selected Crop)</h2>
                            <SpriteSheetPreview
                                images={images}
                                crop={selectedCrop}
                                animationState={animationState}
                                onTogglePlay={() => setAnimationState(s => ({ ...s, isPlaying: !s.isPlaying }))}
                                onToggleReverse={() => setAnimationState(s => ({ ...s, isReversed: !s.isReversed }))}
                            />
                        </section>
                    )}

                     <div className="text-center mt-4">
                        <label className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer">
                            Upload different images
                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                    </div>
                </div>
            )}
            {showScrollButton && (
                 <button onClick={handleScrollToThumbnails} className="fixed bottom-6 right-6 bg-sky-600 hover:bg-sky-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 transform hover:scale-110 z-10" aria-label="Scroll to images">
                    <ChevronDownIcon className="w-6 h-6" />
                </button>
            )}
        </div>
    );
};

export default App;