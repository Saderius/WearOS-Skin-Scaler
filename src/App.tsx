import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Upload, Download, Watch, Image as ImageIcon, FileText, CheckCircle2, Circle, Square, Zap } from 'lucide-react';

export default function App() {
  const [watchType, setWatchType] = useState<'circle' | 'square'>('circle');
  const [targetSize, setTargetSize] = useState<number>(720);
  const [isTurboMode, setIsTurboMode] = useState<boolean>(true);
  const [bezelFile, setBezelFile] = useState<File | null>(null);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [layoutPreview, setLayoutPreview] = useState('');

  // Calculate layout dimensions based on target display size
  const calculateDimensions = (size: number, type: 'circle' | 'square') => {
    if (type === 'circle') {
      // Using the new reference: display is 480, layout is 530, offset is 25
      const origDisplay = 480;
      const origOffset = 25;

      const scale = size / origDisplay;
      
      // We scale the offset proportionally so the hole in the resized image matches the target size perfectly.
      const offset = Math.round(origOffset * scale);
      const layoutSize = size + offset * 2;
      
      // Scale the corner radius proportionally (original was 210 for 480 display)
      const cornerRadius = Math.round(size * (210 / 480));

      return { 
        layoutWidth: layoutSize, 
        layoutHeight: layoutSize, 
        displayWidth: size,
        displayHeight: size,
        bezelWidth: layoutSize,
        bezelHeight: layoutSize,
        bezelX: 0,
        bezelY: 0,
        displayX: offset,
        displayY: offset,
        cornerRadius 
      };
    } else {
      // Square / Rectangular
      const origDisplayW = 402;
      const origDisplayH = 476;
      const origBezelW = 434;
      const origBezelH = 508;
      const origLayoutW = 466;
      const origLayoutH = 540;
      const origBezelX = 16;
      const origBezelY = 16;
      const origDisplayX = 32;
      const origDisplayY = 32;

      // The input size is treated as the target width
      const scale = size / origDisplayW;

      const displayWidth = size;
      const displayHeight = Math.round(origDisplayH * scale);
      
      const bezelWidth = Math.round(origBezelW * scale);
      const bezelHeight = Math.round(origBezelH * scale);

      const bezelX = Math.round(origBezelX * scale);
      const bezelY = Math.round(origBezelY * scale);

      const displayX = Math.round(origDisplayX * scale);
      const displayY = Math.round(origDisplayY * scale);

      const layoutWidth = Math.round(origLayoutW * scale);
      const layoutHeight = Math.round(origLayoutH * scale);

      return {
        layoutWidth,
        layoutHeight,
        displayWidth,
        displayHeight,
        bezelWidth,
        bezelHeight,
        bezelX,
        bezelY,
        displayX,
        displayY,
        cornerRadius: 0
      };
    }
  };

  useEffect(() => {
    const dims = calculateDimensions(targetSize || 720, watchType);
    
    // In turbo mode, square doesn't use a mask. In custom mode, it depends on maskFile.
    const hasMask = isTurboMode ? watchType === 'circle' : !!maskFile;
    
    const maskSection = hasMask ? `
        foreground {
            mask    device_mask.png
        }` : '';

    const cornerRadiusSection = watchType === 'circle' ? `\n            corner_radius ${dims.cornerRadius}` : '';

    const preview = `parts {
    portrait {
        background {
            image   device_bezel.png
        }${maskSection}
    }

    device {
        display {
            width   ${dims.displayWidth}
            height  ${dims.displayHeight}
            x       0
            y       0${cornerRadiusSection}
        }
    }
}

layouts {
    portrait {
        width     ${dims.layoutWidth}
        height    ${dims.layoutHeight}

        part1 {
            name    portrait
            x       ${dims.bezelX}
            y       ${dims.bezelY}
        }

        part2 {
            name    device
            x       ${dims.displayX}
            y       ${dims.displayY}
        }
    }
}`;
    setLayoutPreview(preview);
  }, [targetSize, watchType, isTurboMode, maskFile]);

  const fetchLocalImage = async (filename: string): Promise<File> => {
    const response = await fetch(`/${filename}`);
    const blob = await response.blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  const resizeImage = (file: File, width: number, height: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleGenerate = async () => {
    if (!targetSize) return;
    if (!isTurboMode && !bezelFile) return;
    
    setIsGenerating(true);
    try {
      const dims = calculateDimensions(targetSize, watchType);
      const zip = new JSZip();
      zip.file('layout', layoutPreview);

      if (isTurboMode) {
        const bezelName = watchType === 'circle' ? 'device_bezel.png' : 'device_bezel-1.png';
        const bezelBlob = await fetchLocalImage(bezelName);
        const resizedBezel = await resizeImage(bezelBlob, dims.bezelWidth, dims.bezelHeight);
        zip.file('device_bezel.png', resizedBezel);

        if (watchType === 'circle') {
          const maskBlob = await fetchLocalImage('device_mask.png');
          const resizedMask = await resizeImage(maskBlob, dims.bezelWidth, dims.bezelHeight);
          zip.file('device_mask.png', resizedMask);
        }
      } else {
        const resizedBezel = await resizeImage(bezelFile!, dims.bezelWidth, dims.bezelHeight);
        zip.file('device_bezel.png', resizedBezel);
        
        if (maskFile) {
          const resizedMask = await resizeImage(maskFile, dims.bezelWidth, dims.bezelHeight);
          zip.file('device_mask.png', resizedMask);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `wearos_skin_${dims.displayWidth}x${dims.displayHeight}.zip`);
    } catch (error) {
      console.error('Error generating skin:', error);
      alert('An error occurred while generating the skin.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <header className="flex items-center space-x-4 pb-6 border-b border-neutral-200">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <Watch className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Wear OS Skin Scaler</h1>
            <p className="text-neutral-500 text-sm mt-1">Resize emulator skins automatically</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Controls */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 space-y-6">
              
              {/* Watch Type Picker */}
              <div className="flex justify-center">
                <div className="flex items-center space-x-2 p-1 bg-neutral-100 rounded-xl w-fit">
                  <button
                    onClick={() => setWatchType('circle')}
                    title="Round"
                    className={`p-3 rounded-lg transition-all ${
                      watchType === 'circle'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setWatchType('square')}
                    title="Square"
                    className={`p-3 rounded-lg transition-all ${
                      watchType === 'square'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    <Square className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Turbo Mode Toggle */}
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-blue-900">Turbo Mode</h3>
                    <p className="text-xs text-blue-700">Automatically use built-in high-quality skin files</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isTurboMode} onChange={(e) => setIsTurboMode(e.target.checked)} />
                  <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Target Size Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">
                  Target Display Size (px)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetSize}
                    onChange={(e) => setTargetSize(Number(e.target.value))}
                    className="w-full pl-4 pr-12 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    placeholder="720"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">
                    px
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  {watchType === 'circle' 
                    ? "The original reference display size is 480px. The bezel and corner radius scale proportionally."
                    : "The original reference display width is 402px. The height and bezel scale proportionally."}
                </p>
              </div>

              {!isTurboMode && (
                <>
                  <hr className="border-neutral-100" />

                  {/* File Uploads */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-neutral-700">
                      Original Images
                    </label>
                    
                    {/* Bezel Upload */}
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/png"
                        onChange={(e) => setBezelFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`flex items-center justify-between p-4 rounded-xl border-2 border-dashed transition-colors ${bezelFile ? 'border-green-500 bg-green-50' : 'border-neutral-300 bg-neutral-50 group-hover:border-blue-400 group-hover:bg-blue-50'}`}>
                        <div className="flex items-center space-x-3">
                          <ImageIcon className={`w-5 h-5 ${bezelFile ? 'text-green-600' : 'text-neutral-400'}`} />
                          <span className={`text-sm font-medium ${bezelFile ? 'text-green-700' : 'text-neutral-600'}`}>
                            {bezelFile ? bezelFile.name : 'Upload device_bezel.png'}
                          </span>
                        </div>
                        {bezelFile ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Upload className="w-4 h-4 text-neutral-400" />}
                      </div>
                    </div>

                    {/* Mask Upload */}
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/png"
                        onChange={(e) => setMaskFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`flex items-center justify-between p-4 rounded-xl border-2 border-dashed transition-colors ${maskFile ? 'border-green-500 bg-green-50' : 'border-neutral-300 bg-neutral-50 group-hover:border-blue-400 group-hover:bg-blue-50'}`}>
                        <div className="flex items-center space-x-3">
                          <ImageIcon className={`w-5 h-5 ${maskFile ? 'text-green-600' : 'text-neutral-400'}`} />
                          <span className={`text-sm font-medium ${maskFile ? 'text-green-700' : 'text-neutral-600'}`}>
                            {maskFile ? maskFile.name : 'Upload device_mask.png (Optional, but recommended)'}
                          </span>
                        </div>
                        {maskFile ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Upload className="w-4 h-4 text-neutral-400" />}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Action Button */}
              <button
                onClick={handleGenerate}
                disabled={(!isTurboMode && !bezelFile) || !targetSize || isGenerating}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl font-medium transition-all flex items-center justify-center space-x-2 shadow-sm disabled:shadow-none"
              >
                {isGenerating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Generate & Download ZIP</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-neutral-700">
              <FileText className="w-5 h-5" />
              <h2 className="text-sm font-medium">Generated layout file</h2>
            </div>
            <div className="bg-neutral-900 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col h-[500px]">
              <pre className="text-green-400 font-mono text-xs leading-relaxed overflow-auto flex-1 custom-scrollbar">
                {layoutPreview}
              </pre>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
